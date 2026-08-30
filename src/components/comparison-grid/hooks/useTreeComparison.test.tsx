// useTreeComparison(階層比較の React 接続)の結合テストです(renderHook のため jsdom)。
//   - 木の平坦化順 / パスキー / getTreeInfo
//   - 「差分のみ」で差分行の祖先(文脈行)が残ること(contextRows)
//   - alignRows の構造整列と「差分のみ」の併用
//   - 代表コードの切り替え(再レンダーで getRepresentativeCode を差し替え)
//   - useComparisonNavigation との結合(整列表示では停止順が行位置順になる)
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { buildComparisonTree } from '../logic/tree';
import { useTreeComparison } from './useTreeComparison';
import { useComparisonNavigation } from './useComparisonNavigation';
import type { CompareField, ComparisonTreeNode } from '../model/types';

afterEach(() => {
  cleanup();
});

type Row = { code: string; level: number; qty: number; repr?: string };
const row = (code: string, level: number, qty = 1, repr?: string): Row => ({ code, level, qty, repr });
const getLevel = (r: Row) => r.level;
const getCode = (r: Row) => r.code;
const getRepr = (r: Row) => r.repr;
const compareFields: CompareField<Row>[] = [{ key: 'qty', label: '数量' }];
const treeOf = (rows: readonly Row[]) => buildComparisonTree(rows, { getLevel }).roots;

// 左: A(B(C), D) / E。右: A(B(C 数量 2), N(N1)) / E。
//   → C: field-diff / D: left-only / N, N1: right-only / A, B, E: same。
const left = [row('A', 1), row('B', 2), row('C', 3), row('D', 2), row('E', 1)];
const right = [row('A', 1), row('B', 2), row('C', 3, 2), row('N', 2), row('N1', 3), row('E', 1)];
const leftTree = treeOf(left);
const rightTree = treeOf(right);

const codes = (rows: readonly Row[], placeholders?: ReadonlySet<Row>) =>
  rows.map((r) => (placeholders?.has(r) ? '-' : r.code));

type Options = {
  left?: ComparisonTreeNode<Row>[];
  right?: ComparisonTreeNode<Row>[];
  showDiffOnly?: boolean;
  alignRows?: boolean;
  getRepresentativeCode?: (r: Row) => string | undefined;
};

const renderTree = (options: Options = {}) =>
  renderHook(
    (props: Options) =>
      useTreeComparison<Row>({
        left: props.left ?? leftTree,
        right: props.right ?? rightTree,
        getCode,
        getRepresentativeCode: props.getRepresentativeCode,
        compareFields,
        showDiffOnly: props.showDiffOnly,
        alignRows: props.alignRows,
      }),
    { initialProps: options },
  );

describe('useTreeComparison', () => {
  it('木を深さ優先順に平坦化し、パスキーで突き合わせる', () => {
    const { result } = renderTree();
    expect(codes(result.current.visibleLeft)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(codes(result.current.visibleRight)).toEqual(['A', 'B', 'C', 'N', 'N1', 'E']);
    expect(result.current.getDiff(left[2])).toMatchObject({ kind: 'field-diff', matchKey: 'A/B/C' });
    expect(result.current.getDiff(left[2])?.counterpart).toBe(right[2]);
    expect(result.current.getDiff(left[3])?.kind).toBe('left-only');
    expect(result.current.getDiff(right[4])).toMatchObject({ kind: 'right-only', matchKey: 'A/N/N1' });
    expect(result.current.hasBothSides).toBe(true);
    expect(result.current.summary.left).toEqual({ total: 5, same: 3, only: 1, fieldDiff: 1 });
    expect(result.current.contextRows.left.size).toBe(0);
    expect(result.current.placeholders.left.size).toBe(0);
  });

  it('getTreeInfo で深さ / 親 / 子の有無を引ける(左右どちらの行でも)', () => {
    const { result } = renderTree();
    expect(result.current.getTreeInfo(left[2])).toMatchObject({ depth: 2, parent: left[1], hasChildren: false });
    expect(result.current.getTreeInfo(left[0])).toMatchObject({ depth: 0, parent: undefined, hasChildren: true });
    expect(result.current.getTreeInfo(right[3])).toMatchObject({ depth: 1, parent: right[0], matchKey: 'A/N' });
    expect(result.current.getTreeInfo(row('Z', 1))).toBeUndefined();
  });

  it('「差分のみ」は差分行に加えてその祖先を文脈行として残す', () => {
    const { result } = renderTree({ showDiffOnly: true });
    expect(result.current.effectiveShowDiffOnly).toBe(true);
    expect(codes(result.current.visibleLeft)).toEqual(['A', 'B', 'C', 'D']);
    expect(codes(result.current.visibleRight)).toEqual(['A', 'B', 'C', 'N', 'N1']);
    // 文脈行 = 差分行の祖先で自身は same。E は差分の祖先ではないので落ちる。
    expect([...result.current.contextRows.left].map(getCode).sort()).toEqual(['A', 'B']);
    expect([...result.current.contextRows.right].map(getCode).sort()).toEqual(['A', 'B']);
    // 差分行そのものは文脈行ではない。
    expect(result.current.contextRows.right.has(right[3])).toBe(false);
  });

  it('alignRows は構造整列で、右のみサブツリーが兄弟の位置に入る', () => {
    const { result } = renderTree({ alignRows: true });
    const { visibleLeft, visibleRight, placeholders } = result.current;
    expect(codes(visibleLeft, placeholders.left)).toEqual(['A', 'B', 'C', '-', '-', 'D', 'E']);
    expect(codes(visibleRight, placeholders.right)).toEqual(['A', 'B', 'C', 'N', 'N1', '-', 'E']);
    expect(placeholders.left.size).toBe(2);
    expect(placeholders.right.size).toBe(1);
  });

  it('alignRows + 「差分のみ」は対の単位でフィルタし、文脈行の対も残す', () => {
    const { result } = renderTree({ alignRows: true, showDiffOnly: true });
    const { visibleLeft, visibleRight, placeholders, contextRows } = result.current;
    expect(codes(visibleLeft, placeholders.left)).toEqual(['A', 'B', 'C', '-', '-', 'D']);
    expect(codes(visibleRight, placeholders.right)).toEqual(['A', 'B', 'C', 'N', 'N1', '-']);
    expect(visibleLeft).toHaveLength(visibleRight.length);
    expect(contextRows.left.has(left[0])).toBe(true);
    expect(contextRows.right.has(right[1])).toBe(true);
  });

  it('片側が空なら「差分のみ」は無効で、平坦化した行がそのまま表示される', () => {
    const { result } = renderTree({ right: [], showDiffOnly: true });
    expect(result.current.hasBothSides).toBe(false);
    expect(result.current.effectiveShowDiffOnly).toBe(false);
    expect(result.current.canShowDiffOnly).toBe(false);
    expect(codes(result.current.visibleLeft)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(result.current.visibleRight).toEqual([]);
  });

  it('入力の木が同じ参照なら表示配列の参照も安定する', () => {
    const { result, rerender } = renderTree();
    const first = result.current.visibleLeft;
    rerender({});
    expect(result.current.visibleLeft).toBe(first);
  });

  it('getRepresentativeCode の切り替えで、親の後継品番が子へ伝播して突き合う', () => {
    // 左: B2003(X)。右: B2004(代表 B2003)(X 数量 2)。
    const l = [row('B2003', 1), row('X', 2)];
    const r = [row('B2004', 1, 1, 'B2003'), row('X', 2, 2)];
    const { result, rerender } = renderTree({ left: treeOf(l), right: treeOf(r) });
    expect(result.current.annotatedLeft.map((e) => e.diff.kind)).toEqual(['left-only', 'left-only']);

    rerender({ left: treeOf(l), right: treeOf(r), getRepresentativeCode: getRepr });
    expect(result.current.annotatedLeft.map((e) => e.diff.kind)).toEqual(['same', 'field-diff']);
    expect(result.current.getDiff(r[1])).toMatchObject({ kind: 'field-diff', matchKey: 'B2003/X' });
  });

  it('useComparisonNavigation と組み合わせると、整列表示では停止順が行位置順になる', () => {
    const { result } = renderHook(() => {
      const comparison = useTreeComparison<Row>({
        left: leftTree,
        right: rightTree,
        getCode,
        compareFields,
        alignRows: true,
      });
      return useComparisonNavigation<Row>({ comparison, alignRows: true });
    });
    // 整列表示: A|A, B|B, C|C, -|N, -|N1, D|-, E|E → 停止は C(2) → N(3) → N1(4) → D(5)。
    expect(result.current.diffStops.map((stop) => [stop.kind, stop.leftIndex ?? stop.rightIndex])).toEqual([
      ['field-diff', 2],
      ['right-only', 3],
      ['right-only', 4],
      ['left-only', 5],
    ]);
  });
});
