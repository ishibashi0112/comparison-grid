// 合成コンポーネント(ComparisonLayout.Root / .Pane / .Header / .Grid)を実際に描画する結合テストです。
//   - N 構成(useMultiComparison)で 3 ペインを描画し、差分クラスが構成ごとに付くこと
//   - 2-way(useComparison)モデルでも同じ書き方で動くこと(side は 'left' / 'right')
//   - Header スロット / Pane 無しの Grid(side prop)/ Root 外の例外
//   - スクロール同期グループへのハンドル登録と外部グループの注入
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useEffect, useMemo } from 'react';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { installJsdomLayoutStubs } from '@ishibashi0112/spreadsheet-grid/testing';
import {
  ComparisonLayoutGrid,
  ComparisonLayoutHeader,
  ComparisonLayoutPane,
  ComparisonLayoutRoot,
} from './ComparisonLayout';
import { ComparisonLayout } from './comparisonLayoutNamespace';
import { useComparisonLayout } from './comparisonLayoutContext';
import { useMultiComparison } from '../hooks/useMultiComparison';
import { useComparison } from '../hooks/useComparison';
import type { CompareField, ComparisonScrollSyncGroup } from '../model/types';

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

// base: A(same) / B(a と違う) / C(どこにも無い)。a: A / B' / D(only)。b: A / B。
const base = [row('A', 1), row('B', 1), row('C', 1)];
const planA = [row('A', 1), row('B', 2), row('D', 1)];
const planB = [row('A', 1), row('B', 1)];
const sides = [
  { id: 'base', rows: base, label: '現行' },
  { id: 'a', rows: planA, label: '案1' },
  { id: 'b', rows: planB, label: '案2' },
];

const rowsIn = (root: HTMLElement, side: string) =>
  Array.from(root.querySelectorAll(`.cmpg-pane--${side} .ssg-body-row`));
const rowClassesIn = (root: HTMLElement, side: string) =>
  rowsIn(root, side).map((el) =>
    Array.from(el.classList)
      .filter((name) => name.startsWith('cmpg-'))
      .sort()
      .join(' '),
  );

function MultiHarness(props: {
  alignRows?: boolean;
  showDiffOnly?: boolean;
  enableScrollSync?: boolean;
  group?: ComparisonScrollSyncGroup<Row>;
  withHeaders?: boolean;
}) {
  const multi = useMultiComparison<Row>({
    sides,
    getMatchKey: (r) => r.id,
    compareFields,
    alignRows: props.alignRows,
    showDiffOnly: props.showDiffOnly,
  });
  return (
    <ComparisonLayout.Root<Row>
      comparison={multi}
      columns={columns}
      keyColumnKeys={['id']}
      showDiffLabelColumn
      enableScrollSync={props.enableScrollSync}
      scrollSyncGroup={props.group}
    >
      {multi.sides.map((side) => (
        <ComparisonLayout.Pane key={side.id} side={side.id}>
          {props.withHeaders ? <ComparisonLayout.Header>{side.label}</ComparisonLayout.Header> : null}
          <ComparisonLayout.Grid<Row> />
        </ComparisonLayout.Pane>
      ))}
    </ComparisonLayout.Root>
  );
}

describe('ComparisonLayout(N 構成)', () => {
  it('3 ペインを描画し、構成ごとに差分クラス(--field / --only)とラベル列が付く', () => {
    const { container } = render(<MultiHarness />);
    expect(container.querySelectorAll('.cmpg-view .cmpg-pane')).toHaveLength(3);
    expect(container.querySelectorAll('.cmpg-grid.ssg-root')).toHaveLength(3);
    expect(
      Array.from(container.querySelectorAll('.cmpg-pane')).map((el) => el.getAttribute('data-cmpg-side')),
    ).toEqual(['base', 'a', 'b']);

    expect(rowClassesIn(container, 'base')).toEqual([
      '',
      'cmpg-row-diff cmpg-row-diff--field',
      'cmpg-row-diff cmpg-row-diff--only',
    ]);
    expect(rowClassesIn(container, 'a')).toEqual([
      '',
      'cmpg-row-diff cmpg-row-diff--field',
      'cmpg-row-diff cmpg-row-diff--only',
    ]);
    expect(rowClassesIn(container, 'b')).toEqual(['', '']);

    // 差分ラベル列(末尾の列。基準ペインは内訳 / 他ペインは 2-way 相当)。
    const cellsOfRow = (rowEl: Element) => Array.from(rowEl.querySelectorAll('.ssg-body-cell'));
    const labelCells = (side: string) =>
      rowsIn(container, side).map((rowEl) => cellsOfRow(rowEl).at(-1)?.textContent?.trim());
    expect(labelCells('base')).toEqual(['', '案1: 数量違い', '基準のみ']);
    expect(labelCells('a')).toEqual(['', '数量違い', 'この構成のみ']);

    // キー列(先頭の列)は相手の無い行だけ強調される。
    const keyHighlighted = rowsIn(container, 'base').map(
      (rowEl) => cellsOfRow(rowEl)[0]?.classList.contains('cmpg-cell-diff--key') ?? false,
    );
    expect(keyHighlighted).toEqual([false, false, true]);
  });

  it('alignRows で全ペインが同じ行数になり、プレースホルダ行クラスが付く', () => {
    const { container } = render(<MultiHarness alignRows />);
    // 位置: A / B / C / D。
    expect(rowsIn(container, 'base')).toHaveLength(4);
    expect(rowsIn(container, 'a')).toHaveLength(4);
    expect(rowsIn(container, 'b')).toHaveLength(4);
    expect(rowClassesIn(container, 'b')[2]).toBe('cmpg-row-placeholder');
    expect(rowClassesIn(container, 'base')[3]).toBe('cmpg-row-placeholder');
  });

  it('Header スロットは指定したペインにだけ描画される', () => {
    const { container } = render(<MultiHarness withHeaders />);
    const headers = Array.from(container.querySelectorAll('.cmpg-pane-header')).map((el) => el.textContent);
    expect(headers).toEqual(['現行', '案1', '案2']);
    expect(container.querySelectorAll('.cmpg-pane-body')).toHaveLength(3);
  });

  it('Grid をマウントすると同期グループにハンドルが登録され、外部グループも注入できる', () => {
    const register = vi.fn(() => () => {});
    const group: ComparisonScrollSyncGroup<Row> = {
      enabled: true,
      syncHorizontal: false,
      register,
      broadcast: vi.fn(),
      getHandle: () => null,
    };
    render(<MultiHarness group={group} />);
    expect(register).toHaveBeenCalledTimes(3);
    expect(register.mock.calls.map((call) => (call as unknown[])[0])).toEqual(['base', 'a', 'b']);
  });

  it('Root が生成する同期グループにもハンドルが登録される(useComparisonLayout で取り出せる)', () => {
    const holder: { seen?: ComparisonScrollSyncGroup<Row> } = {};
    function Probe() {
      const group = useComparisonLayout<Row>().scrollSyncGroup;
      useEffect(() => {
        holder.seen = group;
      }, [group]);
      return null;
    }
    function Harness() {
      const multi = useMultiComparison<Row>({ sides, getMatchKey: (r) => r.id, compareFields });
      return (
        <ComparisonLayoutRoot<Row> comparison={multi} columns={columns} enableScrollSync>
          <Probe />
          <ComparisonLayoutGrid<Row> side="a" />
        </ComparisonLayoutRoot>
      );
    }
    const { container } = render(<Harness />);
    // Pane 無しでも side prop で描画できる(ラッパー無し → .cmpg-pane-body 直下)。
    expect(container.querySelector('.cmpg-view > .cmpg-pane-body .cmpg-grid')).not.toBeNull();
    expect(holder.seen?.enabled).toBe(true);
    expect(holder.seen?.getHandle('a')).not.toBeNull();
    expect(holder.seen?.getHandle('base')).toBeNull();
  });

  it('Root 外の Grid / Pane、存在しない構成 ID は日本語メッセージの例外になる', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ComparisonLayoutGrid<Row> side="a" />)).toThrow(/Root/);
    expect(() => render(<ComparisonLayoutPane side="a" />)).toThrow(/Root/);
    function Missing() {
      const multi = useMultiComparison<Row>({ sides, getMatchKey: (r) => r.id, compareFields });
      return (
        <ComparisonLayoutRoot<Row> comparison={multi} columns={columns}>
          <ComparisonLayoutGrid<Row> side="nope" />
        </ComparisonLayoutRoot>
      );
    }
    expect(() => render(<Missing />)).toThrow(/"nope"/);
    function NoSide() {
      const multi = useMultiComparison<Row>({ sides, getMatchKey: (r) => r.id, compareFields });
      return (
        <ComparisonLayoutRoot<Row> comparison={multi} columns={columns}>
          <ComparisonLayoutGrid<Row> />
        </ComparisonLayoutRoot>
      );
    }
    expect(() => render(<NoSide />)).toThrow(/side/);
    spy.mockRestore();
  });
});

describe('ComparisonLayout(2-way モデル)', () => {
  function TwoWayHarness(props: { inline?: boolean }) {
    const comparison = useComparison<Row>({
      left: base,
      right: planA,
      getMatchKey: (r) => r.id,
      compareFields,
    });
    // インラインで組んだモデルでも再正規化されないことを確認するため、あえて新しいオブジェクトを渡す。
    const model = props.inline
      ? {
          visibleLeft: comparison.visibleLeft,
          visibleRight: comparison.visibleRight,
          leftDiffs: comparison.leftDiffs,
          rightDiffs: comparison.rightDiffs,
          compareFields: comparison.compareFields,
        }
      : comparison;
    const common = useMemo(() => ({ height: 300 }), []);
    return (
      <ComparisonLayoutRoot<Row> comparison={model} columns={columns} keyColumnKeys={['id']} gridProps={common}>
        <ComparisonLayoutPane side="left">
          <ComparisonLayoutHeader>L</ComparisonLayoutHeader>
          <ComparisonLayoutGrid<Row> />
        </ComparisonLayoutPane>
        <ComparisonLayoutPane side="right">
          <ComparisonLayoutGrid<Row> gridProps={{ theme: 'dark' }} />
        </ComparisonLayoutPane>
      </ComparisonLayoutRoot>
    );
  }

  it("side は 'left' / 'right' で、2-way の差分クラス(--left-only / --right-only)が付く", () => {
    const { container } = render(<TwoWayHarness />);
    expect(rowClassesIn(container, 'left')).toEqual([
      '',
      'cmpg-row-diff cmpg-row-diff--field',
      'cmpg-row-diff cmpg-row-diff--left-only',
    ]);
    expect(rowClassesIn(container, 'right')[2]).toBe('cmpg-row-diff cmpg-row-diff--right-only');
    expect(container.querySelectorAll('.cmpg-pane-header')).toHaveLength(1);
  });

  it('Root の gridProps と Grid の gridProps がマージされる', () => {
    const { container } = render(<TwoWayHarness />);
    const right = container.querySelector('.cmpg-pane--right .cmpg-grid');
    expect(right?.classList.contains('ssg-theme-dark')).toBe(true);
    const left = container.querySelector('.cmpg-pane--left .cmpg-grid');
    expect(left?.classList.contains('ssg-theme-dark')).toBe(false);
  });

  it('モデルをインラインで組んでも描画できる', () => {
    const { container } = render(<TwoWayHarness inline />);
    expect(container.querySelectorAll('.cmpg-grid.ssg-root')).toHaveLength(2);
  });
});
