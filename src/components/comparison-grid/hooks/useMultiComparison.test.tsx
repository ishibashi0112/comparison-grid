// useMultiComparison の結合テストです(renderHook のため jsdom)。
//   - hasAllSides / effectiveShowDiffOnly / canShowDiffOnly の導出
//   - 差分のみフィルタ(非整列 / 整列)
//   - インライン記述でも結果参照が安定すること(sides の要素ごとの参照安定化)
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useMultiComparison } from './useMultiComparison';
import type { CompareField } from '../model/types';

afterEach(() => {
  cleanup();
});

type Row = { id: string; qty: number };
const row = (id: string, qty: number): Row => ({ id, qty });
const getMatchKey = (r: Row) => r.id;
const compareFields: CompareField<Row>[] = [{ key: 'qty', label: '数量' }];

// base: A(same) / B(a と違う) / C(a にも b にも無い → only)。a: A / B' / D(only)。b: A / B。
const base = [row('A', 1), row('B', 1), row('C', 1)];
const planA = [row('A', 1), row('B', 2), row('D', 1)];
const planB = [row('A', 1), row('B', 1)];
const sides = [
  { id: 'base', rows: base, label: '現行' },
  { id: 'a', rows: planA, label: '案1' },
  { id: 'b', rows: planB, label: '案2' },
];

describe('useMultiComparison', () => {
  it('いずれかの構成が空なら showDiffOnly=true でも実効値は false で、入力配列がそのまま表示される', () => {
    const { result } = renderHook(() =>
      useMultiComparison<Row>({
        sides: [
          { id: 'base', rows: base },
          { id: 'a', rows: [] },
        ],
        getMatchKey,
        compareFields,
        showDiffOnly: true,
      }),
    );
    expect(result.current.hasAllSides).toBe(false);
    expect(result.current.effectiveShowDiffOnly).toBe(false);
    expect(result.current.canShowDiffOnly).toBe(false);
    expect(result.current.hasAnyDiff).toBe(true);
    expect(result.current.getSide('base')?.visibleRows).toBe(base);
  });

  it('全構成あり + showDiffOnly で same 行が構成ごとに除かれる(非整列)', () => {
    const { result } = renderHook(() =>
      useMultiComparison<Row>({ sides, getMatchKey, compareFields, showDiffOnly: true }),
    );
    expect(result.current.effectiveShowDiffOnly).toBe(true);
    expect(result.current.canShowDiffOnly).toBe(true);
    expect(result.current.getSide('base')?.visibleRows).toEqual([base[1], base[2]]);
    expect(result.current.getSide('a')?.visibleRows).toEqual([planA[1], planA[2]]);
    expect(result.current.getSide('b')?.visibleRows).toEqual([]);
    expect(result.current.sides.map((s) => s.id)).toEqual(['base', 'a', 'b']);
    for (const side of result.current.sides) expect(side.placeholderRows.size).toBe(0);
  });

  it('フィルタ無しでは visibleRows が入力と同一参照', () => {
    const { result } = renderHook(() => useMultiComparison<Row>({ sides, getMatchKey, compareFields }));
    expect(result.current.getSide('base')?.visibleRows).toBe(base);
    expect(result.current.getSide('a')?.visibleRows).toBe(planA);
  });

  it('alignRows で全構成が同じ長さになり、プレースホルダが placeholderRows に入る', () => {
    const { result } = renderHook(() =>
      useMultiComparison<Row>({ sides, getMatchKey, compareFields, alignRows: true }),
    );
    // 位置: A / B / C(b はプレースホルダ)/ D(base・b はプレースホルダ)。
    const b = result.current.getSide('b')!;
    const baseSide = result.current.getSide('base')!;
    expect(baseSide.visibleRows).toHaveLength(4);
    expect(b.visibleRows).toHaveLength(4);
    expect(b.placeholderRows.has(b.visibleRows[2])).toBe(true);
    expect(b.placeholderRows.has(b.visibleRows[3])).toBe(true);
    expect(baseSide.placeholderRows.has(baseSide.visibleRows[3])).toBe(true);
    expect(result.current.getDiff(b.visibleRows[2])).toBeUndefined();
  });

  it('alignRows + showDiffOnly は行位置単位で絞り、整列が保たれる', () => {
    const { result } = renderHook(() =>
      useMultiComparison<Row>({ sides, getMatchKey, compareFields, alignRows: true, showDiffOnly: true }),
    );
    // A の位置だけ除かれる → B / C / D。
    const baseSide = result.current.getSide('base')!;
    const a = result.current.getSide('a')!;
    const b = result.current.getSide('b')!;
    expect(baseSide.visibleRows[0]).toBe(base[1]);
    expect(a.visibleRows[0]).toBe(planA[1]);
    expect(b.visibleRows[0]).toBe(planB[1]);
    expect(baseSide.visibleRows).toHaveLength(3);
    expect(a.visibleRows).toHaveLength(3);
    expect(b.visibleRows).toHaveLength(3);
    expect(a.visibleRows[2]).toBe(planA[2]);
  });

  it('getDiff はどの構成の行でも引ける', () => {
    const { result } = renderHook(() => useMultiComparison<Row>({ sides, getMatchKey, compareFields }));
    expect(result.current.getDiff(base[2])?.kind).toBe('only');
    expect(result.current.getDiff(base[1])?.kind).toBe('field-diff');
    expect(result.current.getDiff(planA[2])?.kind).toBe('only');
    expect(result.current.getDiff(planB[0])?.kind).toBe('same');
    expect(result.current.getDiff(row('Z', 0))).toBeUndefined();
  });

  it('sides / compareFields をインラインで書いても結果参照が安定する', () => {
    const { result, rerender } = renderHook(() =>
      useMultiComparison<Row>({
        sides: [
          { id: 'base', rows: base, label: '現行' },
          { id: 'a', rows: planA, label: '案1' },
        ],
        getMatchKey,
        compareFields: [{ key: 'qty', label: '数量' }],
        labels: { missingInSide: '欠' },
      }),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(result.current.sides).toBe(first.sides);
    expect(result.current.compareFields).toBe(first.compareFields);
  });

  it('baseId で基準を切り替えられる', () => {
    const { result } = renderHook(() =>
      useMultiComparison<Row>({ sides, getMatchKey, compareFields, baseId: 'a' }),
    );
    expect(result.current.baseId).toBe('a');
    expect(result.current.getSide('a')?.isBase).toBe(true);
    expect(result.current.getDiff(planA[2])?.kind).toBe('only');
    expect(result.current.getDiff(planA[2])?.label).toBe('基準のみ');
  });
});
