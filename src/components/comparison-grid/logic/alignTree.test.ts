// 木モードの左右整列(alignComparisonTree: 構造マージ)の単体テストです(node 環境)。
import { describe, it, expect } from 'vitest';
import { buildComparisonTree, flattenComparisonTree } from './tree';
import { compare } from './compare';
import { alignComparisonTree } from './alignTree';

type Row = { code: string; level: number; qty?: number };
const row = (code: string, level: number, qty = 1): Row => ({ code, level, qty });
const getLevel = (r: Row) => r.level;
const getCode = (r: Row) => r.code;

const alignOf = (left: Row[], right: Row[]) => {
  const leftTree = buildComparisonTree(left, { getLevel }).roots;
  const rightTree = buildComparisonTree(right, { getLevel }).roots;
  const flatLeft = flattenComparisonTree(leftTree, { getCode });
  const flatRight = flattenComparisonTree(rightTree, { getCode });
  const result = compare(flatLeft.rows, flatRight.rows, {
    getMatchKey: (r) => flatLeft.infos.get(r)?.matchKey ?? flatRight.infos.get(r)?.matchKey ?? '',
    compareFields: [{ key: 'qty', label: '数量' }],
  });
  const aligned = alignComparisonTree(leftTree, rightTree, result.leftDiffs);
  const label = (r: Row, placeholders: ReadonlySet<Row>) => (placeholders.has(r) ? '-' : r.code);
  return {
    result,
    aligned,
    // 各対を "左|右" の文字列にする('-' はプレースホルダ)。
    lines: aligned.pairs.map(
      (pair) =>
        `${label(pair.left, aligned.placeholders.left)}|${label(pair.right, aligned.placeholders.right)}`,
    ),
  };
};

describe('alignComparisonTree', () => {
  it('全行が対になる木は左の順で並び、子も再帰的に対になる', () => {
    const left = [row('A', 1), row('B', 2), row('C', 2), row('D', 1)];
    const right = [row('D', 1), row('A', 1), row('C', 2), row('B', 2)];
    const { lines, aligned } = alignOf(left, right);
    expect(lines).toEqual(['A|A', 'B|B', 'C|C', 'D|D']);
    expect(aligned.placeholders.left.size).toBe(0);
    expect(aligned.placeholders.right.size).toBe(0);
  });

  it('右にしか無いサブツリーは末尾ではなく、直前に対になった兄弟の直後に入る', () => {
    // 右の ASSY A に部品 N(子 N1 付き)が B の後に追加された。
    const left = [row('A', 1), row('B', 2), row('C', 2), row('Z', 1)];
    const right = [row('A', 1), row('B', 2), row('N', 2), row('N1', 3), row('C', 2), row('Z', 1)];
    const { lines, aligned } = alignOf(left, right);
    expect(lines).toEqual(['A|A', 'B|B', '-|N', '-|N1', 'C|C', 'Z|Z']);
    expect(aligned.placeholders.left.size).toBe(2);
  });

  it('先行する対が無い右のみの兄弟は最初の対の直前に入る(左のみの兄弟の後)', () => {
    const left = [row('A', 1), row('B', 2)];
    const right = [row('A', 1), row('N', 2), row('B', 2)];
    expect(alignOf(left, right).lines).toEqual(['A|A', '-|N', 'B|B']);
    const leftWithOnly = [row('A', 1), row('L', 2), row('B', 2)];
    expect(alignOf(leftWithOnly, right).lines).toEqual(['A|A', 'L|-', '-|N', 'B|B']);
  });

  it('左にしか無いサブツリーは丸ごと右プレースホルダと組む', () => {
    const left = [row('A', 1), row('B', 2), row('B1', 3), row('C', 2)];
    const right = [row('A', 1), row('C', 2)];
    const { lines, aligned } = alignOf(left, right);
    expect(lines).toEqual(['A|A', 'B|-', 'B1|-', 'C|C']);
    expect(aligned.placeholders.right.size).toBe(2);
  });

  it('ルート単位で片側のみの場合もサブツリーごと整列する', () => {
    const left = [row('A', 1), row('A1', 2)];
    const right = [row('N', 1), row('N1', 2), row('A', 1), row('A1', 2)];
    // 右の N は先行する対が無いので最初の対(A)の直前。
    expect(alignOf(left, right).lines).toEqual(['-|N', '-|N1', 'A|A', 'A1|A1']);
  });

  it('対が 1 つも無い兄弟リストでは右のみを末尾に置く(平坦な整列と同じ)', () => {
    const left = [row('P', 1), row('X', 2)];
    const right = [row('Q', 1), row('X', 2)];
    expect(alignOf(left, right).lines).toEqual(['P|-', 'X|-', '-|Q', '-|X']);
  });

  it('親が違う同じ品番は対にならない(それぞれ片側のみ)', () => {
    const left = [row('P', 1), row('X', 2)];
    const right = [row('Q', 1), row('X', 2)];
    expect(alignOf(left, right).lines).toEqual(['P|-', 'X|-', '-|Q', '-|X']);
  });

  it('左右の行数は常に一致し、プレースホルダは行ごとに別オブジェクト', () => {
    const left = [row('A', 1), row('B', 2), row('C', 1)];
    const right = [row('D', 1), row('E', 2)];
    const { aligned } = alignOf(left, right);
    expect(aligned.pairs).toHaveLength(5);
    expect(new Set(aligned.pairs.map((p) => p.left)).size).toBe(5);
    expect(new Set(aligned.pairs.map((p) => p.right)).size).toBe(5);
  });

  it('createPlaceholderRow で側に応じたプレースホルダを生成できる', () => {
    const left = [row('A', 1)];
    const right = [row('B', 1)];
    const leftTree = buildComparisonTree(left, { getLevel }).roots;
    const rightTree = buildComparisonTree(right, { getLevel }).roots;
    const aligned = alignComparisonTree(leftTree, rightTree, new Map(), {
      createPlaceholderRow: (side) => row(`__placeholder-${side}`, 0),
    });
    expect(aligned.pairs.map((p) => `${p.left.code}|${p.right.code}`)).toEqual([
      'A|__placeholder-right',
      '__placeholder-left|B',
    ]);
  });

  it('counterpart が別の兄弟リストに居る場合(キーがパスでない)は対にせず片側のみとして扱う', () => {
    // 品番だけのキーで compare した結果を渡すと、別の親の下の X 同士が counterpart になる。
    const left = [row('P', 1), row('X', 2)];
    const right = [row('Q', 1), row('X', 2)];
    const leftTree = buildComparisonTree(left, { getLevel }).roots;
    const rightTree = buildComparisonTree(right, { getLevel }).roots;
    const result = compare(left, right, { getMatchKey: (r) => r.code, compareFields: [] });
    expect(result.leftDiffs.get(left[1])?.counterpart).toBe(right[1]);
    const aligned = alignComparisonTree(leftTree, rightTree, result.leftDiffs);
    const codes = aligned.pairs.map(
      (p) =>
        `${aligned.placeholders.left.has(p.left) ? '-' : p.left.code}|${aligned.placeholders.right.has(p.right) ? '-' : p.right.code}`,
    );
    expect(codes).toEqual(['P|-', 'X|-', '-|Q', '-|X']);
  });
});
