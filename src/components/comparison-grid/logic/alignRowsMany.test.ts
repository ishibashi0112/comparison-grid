// N 構成の整列(alignComparisonRowsMany)の単体テストです(node 環境)。
import { describe, it, expect } from 'vitest';
import { compareMany } from './compareMany';
import { alignComparisonRowsMany } from './alignRowsMany';
import { compare } from './compare';
import { alignComparisonRows } from './alignRows';
import type { CompareField, ComparisonSideInput } from '../model/types';

type Row = { id: string; qty: number };
const row = (id: string, qty: number): Row => ({ id, qty });
const getMatchKey = (r: Row) => r.id;
const compareFields: CompareField<Row>[] = [{ key: 'qty', label: '数量' }];

const alignOf = (sides: ComparisonSideInput<Row>[], policy?: 'last' | 'first') => {
  const result = compareMany(sides, { getMatchKey, compareFields, duplicateKeyPolicy: policy });
  return { result, aligned: alignComparisonRowsMany(result) };
};

describe('alignComparisonRowsMany', () => {
  it('全行が対になる入力ではプレースホルダなしで基準の行順に並ぶ', () => {
    const base = [row('A', 1), row('B', 1)];
    const a = [row('B', 2), row('A', 1)];
    const b = [row('A', 1), row('B', 1)];
    const { aligned } = alignOf([
      { id: 'base', rows: base },
      { id: 'a', rows: a },
      { id: 'b', rows: b },
    ]);
    expect(aligned.rowCount).toBe(2);
    expect([...aligned.rows.keys()]).toEqual(['base', 'a', 'b']);
    expect(aligned.rows.get('base')).toEqual([base[0], base[1]]);
    expect(aligned.rows.get('a')).toEqual([a[1], a[0]]);
    expect(aligned.rows.get('b')).toEqual([b[0], b[1]]);
    for (const set of aligned.placeholders.values()) expect(set.size).toBe(0);
  });

  it('欠損側にプレースホルダが入り、基準に無い行は構成順 → 行順で末尾に並ぶ', () => {
    const base = [row('A', 1), row('C', 1)];
    const a = [row('D', 1), row('A', 1)];
    const b = [row('E', 1), row('C', 1), row('F', 1)];
    const { aligned } = alignOf([
      { id: 'base', rows: base },
      { id: 'a', rows: a },
      { id: 'b', rows: b },
    ]);
    // 位置: A / C / D(a のみ)/ E(b のみ)/ F(b のみ)。
    expect(aligned.rowCount).toBe(5);
    const baseRows = aligned.rows.get('base')!;
    const aRows = aligned.rows.get('a')!;
    const bRows = aligned.rows.get('b')!;
    expect(baseRows[0]).toBe(base[0]);
    expect(baseRows[1]).toBe(base[1]);
    expect(aRows[0]).toBe(a[1]);
    expect(aligned.placeholders.get('a')!.has(aRows[1])).toBe(true); // C は a に無い
    expect(bRows[1]).toBe(b[1]);
    expect(aligned.placeholders.get('b')!.has(bRows[0])).toBe(true); // A は b に無い
    expect(aRows[2]).toBe(a[0]); // D
    expect(bRows[3]).toBe(b[0]); // E
    expect(bRows[4]).toBe(b[2]); // F
    expect(aligned.placeholders.get('base')!.size).toBe(3);
    expect(aligned.placeholders.get('a')!.size).toBe(3);
    expect(aligned.placeholders.get('b')!.size).toBe(2);
    // 全構成の配列は同じ長さ。
    for (const rows of aligned.rows.values()) expect(rows).toHaveLength(5);
  });

  it('基準に無い同じキーの行は他構成どうしで同じ行位置にまとまる', () => {
    const base = [row('A', 1)];
    const a = [row('X', 1), row('A', 1)];
    const b = [row('Y', 1), row('X', 2)];
    const { aligned } = alignOf([
      { id: 'base', rows: base },
      { id: 'a', rows: a },
      { id: 'b', rows: b },
    ]);
    // 位置: A / X(a と b)/ Y(b のみ)。
    expect(aligned.rowCount).toBe(3);
    expect(aligned.rows.get('a')![1]).toBe(a[0]);
    expect(aligned.rows.get('b')![1]).toBe(b[1]);
    expect(aligned.rows.get('b')![2]).toBe(b[0]);
    expect(aligned.placeholders.get('a')!.has(aligned.rows.get('a')![2])).toBe(true);
  });

  it('キー重複で同じ相手を指す基準行は、後の行がプレースホルダと組む', () => {
    const base = [row('A', 1), row('A', 2)];
    const a = [row('A', 2)];
    const { aligned } = alignOf([
      { id: 'base', rows: base },
      { id: 'a', rows: a },
    ]);
    expect(aligned.rowCount).toBe(2);
    expect(aligned.rows.get('a')![0]).toBe(a[0]);
    expect(aligned.placeholders.get('a')!.has(aligned.rows.get('a')![1])).toBe(true);
    expect(aligned.placeholders.get('base')!.size).toBe(0);
  });

  it('プレースホルダは毎回新しいオブジェクトで、createPlaceholderRow に構成 ID が渡る', () => {
    const base = [row('A', 1)];
    const a = [row('B', 1)];
    const result = compareMany(
      [
        { id: 'base', rows: base },
        { id: 'a', rows: a },
      ],
      { getMatchKey, compareFields },
    );
    const ids: string[] = [];
    const aligned = alignComparisonRowsMany(result, {
      createPlaceholderRow: (sideId) => {
        ids.push(sideId);
        return row(`__${sideId}`, 0);
      },
    });
    expect(ids).toEqual(['base', 'a']);
    expect(aligned.rows.get('base')![1]).toEqual(row('__base', 0));
    expect(aligned.rows.get('a')![0]).toEqual(row('__a', 0));
    const twice = alignComparisonRowsMany(result);
    expect(twice.rows.get('a')![0]).not.toBe(aligned.rows.get('a')![0]);
    // プレースホルダは差分 Map に載らない。
    expect(result.sidesById.get('a')!.diffs.get(twice.rows.get('a')![0])).toBeUndefined();
  });

  it('2 構成では alignComparisonRows と同じ並びになる', () => {
    const left = [row('A', 1), row('C', 1), row('A', 3)];
    const right = [row('D', 1), row('A', 1), row('E', 1)];
    const twoWay = compare(left, right, { getMatchKey, compareFields });
    const pairs = alignComparisonRows(twoWay.annotatedLeft, twoWay.annotatedRight).pairs;
    const { aligned } = alignOf([
      { id: 'left', rows: left },
      { id: 'right', rows: right },
    ]);
    expect(aligned.rowCount).toBe(pairs.length);
    const l = aligned.rows.get('left')!;
    const r = aligned.rows.get('right')!;
    pairs.forEach((pair, index) => {
      // 実行ごとにプレースホルダは別オブジェクトなので、実行内の行だけ同一性で比べる。
      if (left.includes(pair.left)) expect(l[index]).toBe(pair.left);
      else expect(aligned.placeholders.get('left')!.has(l[index])).toBe(true);
      if (right.includes(pair.right)) expect(r[index]).toBe(pair.right);
      else expect(aligned.placeholders.get('right')!.has(r[index])).toBe(true);
    });
  });
});

describe("alignComparisonRowsMany: mode 'all'", () => {
  it('先頭の構成を軸に整列し、軸に無い行は同キーどうしを同じ行位置にまとめる', () => {
    const x = [row('A', 1), row('B', 1)];
    const p1 = [row('B', 2), row('A', 1), row('E', 1)];
    const p2 = [row('E', 1), row('A', 1)];
    const result = compareMany(
      [
        { id: 'x', rows: x },
        { id: 'p1', rows: p1 },
        { id: 'p2', rows: p2 },
      ],
      { getMatchKey, compareFields, mode: 'all' },
    );
    const aligned = alignComparisonRowsMany(result);
    // 位置: A / B(p2 はプレースホルダ)/ E(x はプレースホルダ)。
    expect(aligned.rowCount).toBe(3);
    expect(aligned.rows.get('x')![0]).toBe(x[0]);
    expect(aligned.rows.get('p1')![0]).toBe(p1[1]);
    expect(aligned.rows.get('p2')![0]).toBe(p2[1]);
    expect(aligned.rows.get('p1')![1]).toBe(p1[0]);
    expect(aligned.placeholders.get('p2')!.has(aligned.rows.get('p2')![1])).toBe(true);
    expect(aligned.rows.get('p1')![2]).toBe(p1[2]);
    expect(aligned.rows.get('p2')![2]).toBe(p2[0]);
    expect(aligned.placeholders.get('x')!.has(aligned.rows.get('x')![2])).toBe(true);
  });
});
