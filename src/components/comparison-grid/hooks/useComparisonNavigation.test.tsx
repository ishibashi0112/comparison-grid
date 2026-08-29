// useComparisonNavigation(差分ジャンプ)のテストです(renderHook のため jsdom)。
//   scrollToRow はモックハンドルで検証します(スクロール自体は spreadsheet-grid 側でテスト済み)。
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { SpreadsheetGridHandle } from '@ishibashi0112/spreadsheet-grid';
import { useComparison } from './useComparison';
import { useComparisonNavigation } from './useComparisonNavigation';

afterEach(() => {
  cleanup();
});

type Row = { id: string; qty: number };
const row = (id: string, qty: number): Row => ({ id, qty });
const getMatchKey = (r: Row) => r.id;

// left: A(same) / B(qty 差分) / C(left-only)。right: A / B / D(right-only)。
const left = [row('A', 1), row('B', 1), row('C', 1)];
const right = [row('A', 1), row('B', 2), row('D', 1)];

const mockHandle = () =>
  ({ scrollToRow: vi.fn() }) as unknown as SpreadsheetGridHandle<Row> & {
    scrollToRow: ReturnType<typeof vi.fn>;
  };

const renderNavigation = (options?: { alignRows?: boolean; showDiffOnly?: boolean }) => {
  const utils = renderHook(
    (props: { left: Row[]; right: Row[] }) => {
      const comparison = useComparison<Row>({
        left: props.left,
        right: props.right,
        getMatchKey,
        compareFields: [{ key: 'qty', label: '数量' }],
        alignRows: options?.alignRows,
        showDiffOnly: options?.showDiffOnly,
      });
      return useComparisonNavigation<Row>({ comparison, alignRows: options?.alignRows });
    },
    { initialProps: { left, right } },
  );
  const leftHandle = mockHandle();
  const rightHandle = mockHandle();
  utils.result.current.leftRef.current = leftHandle;
  utils.result.current.rightRef.current = rightHandle;
  return { ...utils, leftHandle, rightHandle };
};

describe('useComparisonNavigation', () => {
  it('停止位置は左の行順 → 右のみ行の順で、対の index を持つ', () => {
    const { result } = renderNavigation();
    expect(result.current.diffCount).toBe(3);
    expect(result.current.canNavigate).toBe(true);
    expect(result.current.activeDiffIndex).toBe(-1);
    const [b, c, d] = result.current.diffStops;
    expect(b).toMatchObject({ kind: 'field-diff', leftIndex: 1, rightIndex: 1 });
    expect(c).toMatchObject({ kind: 'left-only', leftIndex: 2 });
    expect(c.rightIndex).toBeUndefined();
    expect(d).toMatchObject({ kind: 'right-only', rightIndex: 2 });
    expect(d.leftIndex).toBeUndefined();
  });

  it('goToNextDiff は両ペインを scrollToRow し、末尾からは先頭へラップする', () => {
    const { result, leftHandle, rightHandle } = renderNavigation();
    act(() => result.current.goToNextDiff());
    expect(result.current.activeDiffIndex).toBe(0);
    expect(leftHandle.scrollToRow).toHaveBeenLastCalledWith(1, { align: 'center' });
    expect(rightHandle.scrollToRow).toHaveBeenLastCalledWith(1, { align: 'center' });

    // left-only: 左だけスクロール(alignRows 無しでは相手位置が無い)。
    act(() => result.current.goToNextDiff());
    expect(result.current.activeDiffIndex).toBe(1);
    expect(leftHandle.scrollToRow).toHaveBeenLastCalledWith(2, { align: 'center' });
    expect(rightHandle.scrollToRow).toHaveBeenCalledTimes(1);

    act(() => result.current.goToNextDiff());
    expect(result.current.activeDiffIndex).toBe(2);
    act(() => result.current.goToNextDiff());
    expect(result.current.activeDiffIndex).toBe(0);
  });

  it('goToPreviousDiff は未移動なら末尾へ移動する', () => {
    const { result } = renderNavigation();
    act(() => result.current.goToPreviousDiff());
    expect(result.current.activeDiffIndex).toBe(2);
    act(() => result.current.goToPreviousDiff());
    expect(result.current.activeDiffIndex).toBe(1);
  });

  it('alignRows では片側のみの停止でも同じ行位置で両ペインをスクロールする', () => {
    const { result, leftHandle, rightHandle } = renderNavigation({ alignRows: true });
    // 停止 1 = C(left-only・整列上の行 2)。右はプレースホルダ位置(同じ 2)へ。
    act(() => result.current.goToDiff(1));
    expect(leftHandle.scrollToRow).toHaveBeenLastCalledWith(2, { align: 'center' });
    expect(rightHandle.scrollToRow).toHaveBeenLastCalledWith(2, { align: 'center' });
    // 停止 2 = D(right-only・整列上の行 3)。左はプレースホルダ位置へ。
    act(() => result.current.goToDiff(2));
    expect(leftHandle.scrollToRow).toHaveBeenLastCalledWith(3, { align: 'center' });
    expect(rightHandle.scrollToRow).toHaveBeenLastCalledWith(3, { align: 'center' });
  });

  it('showDiffOnly ではフィルタ後の行 index になる', () => {
    const { result, leftHandle } = renderNavigation({ showDiffOnly: true });
    // visibleLeft = [B, C] → B の停止は index 0。
    act(() => result.current.goToDiff(0));
    expect(leftHandle.scrollToRow).toHaveBeenLastCalledWith(0, { align: 'center' });
  });

  it('データが変わると activeDiffIndex がリセットされる', () => {
    const { result, rerender } = renderNavigation();
    act(() => result.current.goToNextDiff());
    expect(result.current.activeDiffIndex).toBe(0);
    rerender({ left: [row('A', 1)], right: [row('A', 2)] });
    expect(result.current.activeDiffIndex).toBe(-1);
    // field-diff の対は左右で 1 停止に重複排除される。
    expect(result.current.diffCount).toBe(1);
  });

  it('差分が無ければ canNavigate=false で goTo* は何もしない', () => {
    const { result } = renderHook(() => {
      const comparison = useComparison<Row>({
        left,
        right: left.map((r) => ({ ...r })),
        getMatchKey,
        compareFields: [{ key: 'qty', label: '数量' }],
      });
      return useComparisonNavigation<Row>({ comparison });
    });
    expect(result.current.canNavigate).toBe(false);
    act(() => result.current.goToNextDiff());
    expect(result.current.activeDiffIndex).toBe(-1);
  });
});
