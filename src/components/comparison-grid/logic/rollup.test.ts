// ロールアップ(countDescendantDiffs)の単体テストです(node 環境)。
import { describe, it, expect } from 'vitest';
import { buildComparisonTree, flattenComparisonTree } from './tree';
import { compare } from './compare';
import { countDescendantDiffs } from './rollup';

type Row = { code: string; level: number; qty: number };
const row = (code: string, level: number, qty = 1): Row => ({ code, level, qty });
const getLevel = (r: Row) => r.level;
const getCode = (r: Row) => r.code;

const rollupOf = (left: Row[], right: Row[]) => {
  const flatLeft = flattenComparisonTree(buildComparisonTree(left, { getLevel }).roots, { getCode });
  const flatRight = flattenComparisonTree(buildComparisonTree(right, { getLevel }).roots, { getCode });
  const result = compare(flatLeft.rows, flatRight.rows, {
    getMatchKey: (r) => flatLeft.infos.get(r)?.matchKey ?? flatRight.infos.get(r)?.matchKey ?? '',
    compareFields: [{ key: 'qty', label: '数量' }],
  });
  return {
    left: countDescendantDiffs(result.annotatedLeft, flatLeft.infos),
    right: countDescendantDiffs(result.annotatedRight, flatRight.infos),
  };
};

describe('countDescendantDiffs', () => {
  it('差分行の祖先すべてに配下の差分行数を積み上げ、自身は数えない', () => {
    // 左: A(B(C, D), E)。右: C の数量違い、D は右に無い(左のみ)、E は同一。
    const left = [row('A', 1), row('B', 2), row('C', 3), row('D', 3), row('E', 2)];
    const right = [row('A', 1), row('B', 2), row('C', 3, 2), row('E', 2)];
    const { left: counts } = rollupOf(left, right);
    expect(counts.get(left[0])).toBe(2); // A: C + D
    expect(counts.get(left[1])).toBe(2); // B: C + D
    expect(counts.has(left[2])).toBe(false); // C 自身は数えない
    expect(counts.has(left[4])).toBe(false); // E: 配下なし
  });

  it('祖先自身が差分行でも配下の数は別に積み上がる', () => {
    // 左: A(B)。右: A(B 数量違い)+ A は数量違い。
    const left = [row('A', 1), row('B', 2)];
    const right = [row('A', 1, 5), row('B', 2, 5)];
    const { left: counts, right: rightCounts } = rollupOf(left, right);
    expect(counts.get(left[0])).toBe(1);
    expect(rightCounts.get(right[0])).toBe(1);
  });

  it('右のみのサブツリーは右側の祖先に積み上がる', () => {
    const left = [row('A', 1)];
    const right = [row('A', 1), row('N', 2), row('N1', 3)];
    const { left: counts, right: rightCounts } = rollupOf(left, right);
    expect(counts.size).toBe(0);
    expect(rightCounts.get(right[0])).toBe(2); // A: N + N1
    expect(rightCounts.get(right[1])).toBe(1); // N: N1
  });

  it('差分が無ければ空の Map', () => {
    const rows = [row('A', 1), row('B', 2)];
    const { left: counts } = rollupOf(rows, rows.map((r) => ({ ...r })));
    expect(counts.size).toBe(0);
  });
});
