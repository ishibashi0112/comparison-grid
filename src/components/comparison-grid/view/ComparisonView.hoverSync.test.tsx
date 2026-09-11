// enableHoverSync(片側の行ホバーを相手ペインの同じ行位置にも表示)の結合テストです。
//   spreadsheet-grid v0.33.0 の controlled 行ホバーに乗るため、実グリッドを描画し、左ペインのセルへ
//   pointerEnter したときに右ペインの同じ行位置にも .ssg-body-cell--row-hovered が付くことを DOM で検証します。
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { installJsdomLayoutStubs } from '@ishibashi0112/spreadsheet-grid/testing';
import { ComparisonView } from './ComparisonView';
import { useComparison } from '../hooks/useComparison';
import type { CompareField, ComparisonViewProps, UseComparisonOptions } from '../model/types';

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
// left: A / B / C(left-only)。right: A / B / D(right-only)。整列すると両側 4 行。
const left = [row('A', 1), row('B', 1), row('C', 1)];
const right = [row('A', 1), row('B', 2), row('D', 1)];

type HarnessProps = Partial<UseComparisonOptions<Row>> &
  Omit<ComparisonViewProps<Row>, 'comparison' | 'columns'>;

function Harness({ alignRows = true, ...viewProps }: HarnessProps) {
  const comparison = useComparison<Row>({
    left,
    right,
    getMatchKey: (r) => r.id,
    compareFields,
    alignRows,
  });
  return <ComparisonView<Row> comparison={comparison} columns={columns} {...viewProps} />;
}

const cellAt = (root: HTMLElement, side: 'left' | 'right', rowIndex: number): HTMLElement => {
  const rows = root.querySelectorAll(`.cmpg-pane--${side} .ssg-body-row`);
  const cell = rows[rowIndex]?.querySelector<HTMLElement>('.ssg-body-cell');
  if (!cell) throw new Error(`セル (${side}, ${rowIndex}) が見つかりません`);
  return cell;
};

// 行ハイライト(.ssg-body-cell--row-hovered)が付いているビュー行 index。
const hoveredRows = (root: HTMLElement, side: 'left' | 'right'): number[] =>
  Array.from(root.querySelectorAll(`.cmpg-pane--${side} .ssg-body-row`))
    .map((rowEl, index) => (rowEl.querySelector('.ssg-body-cell--row-hovered') ? index : null))
    .filter((index): index is number => index !== null);

describe('ComparisonView enableHoverSync', () => {
  it('左ペインの行ホバーが右ペインの同じ行位置にも付き、離れると両方消える', () => {
    const { container } = render(<Harness enableHoverSync />);
    fireEvent.pointerEnter(cellAt(container, 'left', 1));
    expect(hoveredRows(container, 'left')).toEqual([1]);
    expect(hoveredRows(container, 'right')).toEqual([1]);

    // 右ペインから別の行へ → 両方が移る。
    fireEvent.pointerEnter(cellAt(container, 'right', 3));
    expect(hoveredRows(container, 'left')).toEqual([3]);
    expect(hoveredRows(container, 'right')).toEqual([3]);

    // 右ペインのグリッド本体から出る → 両方解除。
    const rightShell = container.querySelector<HTMLElement>('.cmpg-pane--right .ssg-shell');
    expect(rightShell).not.toBeNull();
    fireEvent.pointerLeave(rightShell!);
    expect(hoveredRows(container, 'left')).toEqual([]);
    expect(hoveredRows(container, 'right')).toEqual([]);
  });

  it('既定(enableHoverSync 未指定)ではホバーは片側だけ', () => {
    const { container } = render(<Harness />);
    fireEvent.pointerEnter(cellAt(container, 'left', 1));
    expect(hoveredRows(container, 'left')).toEqual([1]);
    expect(hoveredRows(container, 'right')).toEqual([]);
  });

  it('gridProps の enableRowHover: false では同期しても何も光らない', () => {
    const { container } = render(<Harness enableHoverSync gridProps={{ enableRowHover: false }} />);
    fireEvent.pointerEnter(cellAt(container, 'left', 1));
    expect(hoveredRows(container, 'left')).toEqual([]);
    expect(hoveredRows(container, 'right')).toEqual([]);
  });
});
