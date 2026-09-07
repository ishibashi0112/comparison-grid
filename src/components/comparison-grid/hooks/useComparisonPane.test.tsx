// useComparisonPane(ペインのヘッドレス版)のテストです。
//   - renderHook で gridProps の合成(rows / columns / getRowClassName / className、利用側 props の透過)を検証
//   - 実際の SpreadsheetGrid へ gridProps をスプレッドし、ラッパー(.cmpg-pane)無しでも
//     差分クラスが DOM に付くことを検証(ヘッドレス利用の結合テスト)
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, renderHook, cleanup } from '@testing-library/react';
import { SpreadsheetGrid, type GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { installJsdomLayoutStubs } from '@ishibashi0112/spreadsheet-grid/testing';
import { compare } from '../logic/compare';
import { useComparisonPane } from './useComparisonPane';
import type { CompareField, ComparisonGridProps, UseComparisonPaneOptions } from '../model/types';

let uninstallLayoutStubs: (() => void) | undefined;
beforeAll(() => {
  uninstallLayoutStubs = installJsdomLayoutStubs();
});

afterAll(() => {
  uninstallLayoutStubs?.();
});

afterEach(() => {
  cleanup();
});

type Row = { id: string; qty: number };
const row = (id: string, qty: number): Row => ({ id, qty });

const compareFields: CompareField<Row>[] = [{ key: 'qty', label: '数量' }];
const columns: GridColumn<Row>[] = [
  { key: 'id', title: 'ID', width: 80 },
  { key: 'qty', title: '数量', width: 80 },
];

// left: A(same) / B(qty 差分) / C(left-only)。right: A / B / D(right-only)。
const left = [row('A', 1), row('B', 1), row('C', 1)];
const right = [row('A', 1), row('B', 2), row('D', 1)];
const result = compare(left, right, { getMatchKey: (r) => r.id, compareFields });

const baseOptions = (
  overrides?: Partial<UseComparisonPaneOptions<Row>>,
): UseComparisonPaneOptions<Row> => ({
  rows: left,
  diffs: result.leftDiffs,
  columns,
  compareFields,
  keyColumnKeys: ['id'],
  ...overrides,
});

describe('useComparisonPane', () => {
  it('SpreadsheetGrid へそのままスプレッドできる gridProps を返す(rows / columns / className)', () => {
    const { result: hook } = renderHook(() => useComparisonPane<Row>(baseOptions()));
    const { gridProps } = hook.current;
    expect(gridProps.rows).toBe(left);
    expect(gridProps.columns).toBe(hook.current.columns);
    expect(gridProps.columns.map((c) => c.key)).toEqual(['id', 'qty']);
    expect(gridProps.className).toBe('cmpg-grid');
    expect(gridProps.getRowClassName).toBe(hook.current.getRowClassName);
    // 差分行 B の行クラス
    expect(gridProps.getRowClassName?.(left[1], 1, {} as never)).toContain('cmpg-row-diff--field');
    expect(gridProps.getRowClassName?.(left[0], 0, {} as never)).toBeFalsy();
  });

  it('利用側 gridProps を透過し、getRowClassName / className はライブラリのものと合成する', () => {
    const userGridProps: ComparisonGridProps<Row> = {
      theme: 'dark',
      className: 'mine',
      getRowClassName: (r) => `user-${r.id}`,
    };
    const { result: hook } = renderHook(() =>
      useComparisonPane<Row>(baseOptions({ gridProps: userGridProps })),
    );
    const { gridProps } = hook.current;
    expect(gridProps.theme).toBe('dark');
    expect(gridProps.className).toBe('cmpg-grid mine');
    expect(gridProps.getRowClassName?.(left[2], 2, {} as never)).toBe(
      'cmpg-row-diff cmpg-row-diff--left-only user-C',
    );
  });

  it('showDiffLabelColumn で差分ラベル列を含め、getDiff で差分を引ける', () => {
    const { result: hook } = renderHook(() =>
      useComparisonPane<Row>(baseOptions({ showDiffLabelColumn: true })),
    );
    expect(hook.current.columns.map((c) => c.key)).toEqual(['id', 'qty', 'cmpgDiffLabel']);
    expect(hook.current.getDiff(left[1])?.kind).toBe('field-diff');
    expect(hook.current.getDiff(left[1])?.label).toBe('数量違い');
    expect(hook.current.getDiff(row('X', 0))).toBeUndefined();
  });

  it('入力が同じなら gridProps の参照は安定する(columns / compareFields は浅い構造比較)', () => {
    const { result: hook, rerender } = renderHook(
      (options: UseComparisonPaneOptions<Row>) => useComparisonPane<Row>(options),
      { initialProps: baseOptions() },
    );
    const first = hook.current.gridProps;
    // 列配列と compareFields を新しい配列(同じ内容)で渡し直す。
    rerender(baseOptions({ columns: [...columns], compareFields: [...compareFields] }));
    expect(hook.current.gridProps).toBe(first);
  });

  it('ラッパー(.cmpg-pane)無しで SpreadsheetGrid に渡しても差分クラスが DOM に付く(ヘッドレス利用)', () => {
    function Headless() {
      const pane = useComparisonPane<Row>(baseOptions({ showDiffLabelColumn: true }));
      return <SpreadsheetGrid<Row> {...pane.gridProps} />;
    }
    const { container } = render(<Headless />);
    const root = container.querySelector('.ssg-root');
    expect(root?.classList.contains('cmpg-grid')).toBe(true);
    // 差分行(B / C)のセルに行クラス、キー列 × left-only(C)と差分フィールド(B の qty)にセルクラス。
    const diffCells = container.querySelectorAll('.ssg-body-cell.cmpg-row-diff');
    expect(diffCells.length).toBeGreaterThan(0);
    const keyCells = Array.from(container.querySelectorAll('.ssg-body-cell.cmpg-cell-diff--key'));
    expect(keyCells.map((el) => el.textContent?.trim())).toEqual(['C']);
    const fieldCells = Array.from(
      container.querySelectorAll('.ssg-body-cell.cmpg-cell-diff--field'),
    );
    expect(fieldCells.map((el) => el.textContent?.trim())).toEqual(['1']);
    // 差分ラベル列
    const labels = Array.from(container.querySelectorAll('.ssg-body-cell')).map(
      (el) => el.textContent?.trim(),
    );
    expect(labels).toContain('数量違い');
    expect(labels).toContain('左のみ');
  });
});
