// useComparison の結合テストです(renderHook のため jsdom)。
//   - effectiveShowDiffOnly / canShowDiffOnly の導出
//   - 差分のみフィルタ
//   - インライン記述でも結果参照が安定すること(参照安定化)
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useComparison } from './useComparison';
import type { UseComparisonOptions } from '../model/types';

afterEach(() => {
  cleanup();
});

type Row = { id: string; qty: number };
const row = (id: string, qty: number): Row => ({ id, qty });
const getMatchKey = (r: Row) => r.id;

const left = [row('A', 1), row('B', 1), row('C', 1)];
const right = [row('A', 1), row('B', 2), row('D', 1)];

describe('useComparison', () => {
  it('片側が空なら showDiffOnly=true でも実効値は false で、入力配列がそのまま表示される', () => {
    const { result } = renderHook(() =>
      useComparison<Row>({
        left,
        right: [],
        getMatchKey,
        compareFields: [{ key: 'qty', label: '数量' }],
        showDiffOnly: true,
      }),
    );
    expect(result.current.hasBothSides).toBe(false);
    expect(result.current.effectiveShowDiffOnly).toBe(false);
    expect(result.current.canShowDiffOnly).toBe(false);
    expect(result.current.hasAnyDiff).toBe(true);
    expect(result.current.visibleLeft).toBe(left);
  });

  it('両側あり + showDiffOnly で same 行が除かれ、相手側も同様に絞られる', () => {
    const { result } = renderHook(() =>
      useComparison<Row>({
        left,
        right,
        getMatchKey,
        compareFields: [{ key: 'qty', label: '数量' }],
        showDiffOnly: true,
      }),
    );
    expect(result.current.effectiveShowDiffOnly).toBe(true);
    expect(result.current.canShowDiffOnly).toBe(true);
    expect(result.current.visibleLeft.map((r) => r.id)).toEqual(['B', 'C']);
    expect(result.current.visibleRight.map((r) => r.id)).toEqual(['B', 'D']);
    expect(result.current.getDiff(left[1])?.label).toBe('数量違い');
    expect(result.current.getDiff(right[2])?.label).toBe('右のみ');
  });

  it('差分が無いときは canShowDiffOnly が false', () => {
    const { result } = renderHook(() =>
      useComparison<Row>({
        left,
        right: left.map((r) => ({ ...r })),
        getMatchKey,
        compareFields: [{ key: 'qty', label: '数量' }],
      }),
    );
    expect(result.current.hasAnyDiff).toBe(false);
    expect(result.current.canShowDiffOnly).toBe(false);
    expect(result.current.visibleLeft).toBe(left);
  });

  it('compareFields / labels をインラインで書き直しても中身が同じなら結果参照が安定する', () => {
    const { result, rerender } = renderHook(
      (props: UseComparisonOptions<Row>) => useComparison<Row>(props),
      {
        initialProps: {
          left,
          right,
          getMatchKey,
          compareFields: [{ key: 'qty', label: '数量' }],
          labels: { leftOnly: 'L' },
        },
      },
    );
    const first = result.current;
    rerender({
      left,
      right,
      getMatchKey,
      compareFields: [{ key: 'qty', label: '数量' }],
      labels: { leftOnly: 'L' },
    });
    expect(result.current.annotatedLeft).toBe(first.annotatedLeft);
    expect(result.current.leftDiffs).toBe(first.leftDiffs);
    expect(result.current.compareFields).toBe(first.compareFields);
    expect(result.current).toBe(first);
  });

  it('getMatchKey / compareFields の中身が変わると再計算される', () => {
    const { result, rerender } = renderHook(
      (props: UseComparisonOptions<Row>) => useComparison<Row>(props),
      {
        initialProps: {
          left,
          right,
          getMatchKey,
          compareFields: [{ key: 'qty', label: '数量' }],
        },
      },
    );
    const first = result.current;
    rerender({ left, right, getMatchKey, compareFields: [] });
    expect(result.current.annotatedLeft).not.toBe(first.annotatedLeft);
    expect(result.current.getDiff(left[1])?.kind).toBe('same');

    rerender({ left, right, getMatchKey: () => 'all', compareFields: [] });
    expect(result.current.duplicateKeys.left).toEqual(['all']);
  });
});
