// 左右整列(alignComparisonRows)の単体テストです(node 環境)。
import { describe, it, expect } from 'vitest';
import { compare } from './compare';
import { alignComparisonRows } from './alignRows';
import type { CompareField } from '../model/types';

type Row = { id: string; qty: number };
const row = (id: string, qty: number): Row => ({ id, qty });
const getMatchKey = (r: Row) => r.id;
const compareFields: CompareField<Row>[] = [{ key: 'qty', label: '数量' }];

const alignOf = (left: Row[], right: Row[], policy?: 'last' | 'first') => {
  const result = compare(left, right, {
    getMatchKey,
    compareFields,
    duplicateKeyPolicy: policy,
  });
  return { result, aligned: alignComparisonRows(result.annotatedLeft, result.annotatedRight) };
};

describe('alignComparisonRows', () => {
  it('全行が対になる入力ではプレースホルダなしで左の行順に並ぶ', () => {
    const left = [row('A', 1), row('B', 1)];
    const right = [row('B', 2), row('A', 1)]; // 右は逆順でも左順に整列される
    const { aligned } = alignOf(left, right);

    expect(aligned.pairs).toHaveLength(2);
    expect(aligned.pairs[0]).toEqual({ left: left[0], right: right[1] });
    expect(aligned.pairs[1]).toEqual({ left: left[1], right: right[0] });
    expect(aligned.placeholders.left.size).toBe(0);
    expect(aligned.placeholders.right.size).toBe(0);
  });

  it('left-only は右へ、right-only は左へプレースホルダが入り、右のみ行は右の行順で末尾に並ぶ', () => {
    const left = [row('A', 1), row('C', 1)];
    const right = [row('D', 1), row('A', 1), row('E', 1)];
    const { aligned } = alignOf(left, right);

    // 左順: A(対)/ C(left-only)→ 末尾に右のみ D / E(右の行順)。
    expect(aligned.pairs).toHaveLength(4);
    expect(aligned.pairs[0].left).toBe(left[0]);
    expect(aligned.pairs[0].right).toBe(right[1]);
    expect(aligned.pairs[1].left).toBe(left[1]);
    expect(aligned.placeholders.right.has(aligned.pairs[1].right)).toBe(true);
    expect(aligned.pairs[2].right).toBe(right[0]);
    expect(aligned.pairs[3].right).toBe(right[2]);
    expect(aligned.placeholders.left.has(aligned.pairs[2].left)).toBe(true);
    expect(aligned.placeholders.left.has(aligned.pairs[3].left)).toBe(true);
    expect(aligned.placeholders.left.size).toBe(2);
    expect(aligned.placeholders.right.size).toBe(1);
  });

  it('プレースホルダは行ごとに別オブジェクトで、左右の行数は常に一致する', () => {
    const left = [row('A', 1), row('B', 1)];
    const right = [row('C', 1), row('D', 1)];
    const { aligned } = alignOf(left, right);

    expect(aligned.pairs).toHaveLength(4);
    const rightRows = aligned.pairs.map((pair) => pair.right);
    const leftRows = aligned.pairs.map((pair) => pair.left);
    expect(new Set(rightRows).size).toBe(4);
    expect(new Set(leftRows).size).toBe(4);
  });

  it('キー重複で同じ相手を指す行は先勝ちで相手を消費し、残りはプレースホルダと組む', () => {
    // 左 A × 2(どちらも counterpart = 右 A)。
    const left = [row('A', 1), row('A', 2)];
    const right = [row('A', 1)];
    const { aligned } = alignOf(left, right, 'first');

    expect(aligned.pairs).toHaveLength(2);
    expect(aligned.pairs[0].right).toBe(right[0]);
    expect(aligned.placeholders.right.has(aligned.pairs[1].right)).toBe(true);
  });

  it('右の重複キーで対にならなかった右行は末尾でプレースホルダと組む', () => {
    // 右 A × 2。後勝ちでは左 A の counterpart は右 A(2 つ目)。1 つ目の右 A は未消費。
    const left = [row('A', 1)];
    const right = [row('A', 1), row('A', 2)];
    const { aligned } = alignOf(left, right, 'last');

    expect(aligned.pairs).toHaveLength(2);
    expect(aligned.pairs[0].right).toBe(right[1]);
    expect(aligned.pairs[1].right).toBe(right[0]);
    expect(aligned.placeholders.left.size).toBe(1);
  });

  it('片側が空なら全行がプレースホルダと組む', () => {
    const left = [row('A', 1), row('B', 1)];
    const { aligned } = alignOf(left, []);

    expect(aligned.pairs).toHaveLength(2);
    expect(aligned.placeholders.right.size).toBe(2);
    expect(aligned.placeholders.left.size).toBe(0);
  });

  it('createPlaceholderRow で側に応じたプレースホルダを生成できる', () => {
    const left = [row('A', 1)];
    const right = [row('B', 1)];
    const result = compare(left, right, { getMatchKey, compareFields });
    const aligned = alignComparisonRows(result.annotatedLeft, result.annotatedRight, {
      createPlaceholderRow: (side) => row(`__placeholder-${side}`, 0),
    });

    expect(aligned.pairs[0].right.id).toBe('__placeholder-right');
    expect(aligned.pairs[1].left.id).toBe('__placeholder-left');
  });
});
