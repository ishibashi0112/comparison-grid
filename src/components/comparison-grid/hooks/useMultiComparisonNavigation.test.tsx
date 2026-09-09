// useMultiComparisonNavigation(N 構成の差分ジャンプ)のテストです(renderHook のため jsdom)。
//   scrollToRow はモックハンドルで検証します。
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { SpreadsheetGridHandle } from '@ishibashi0112/spreadsheet-grid';
import { useMultiComparison } from './useMultiComparison';
import { useMultiComparisonNavigation } from './useMultiComparisonNavigation';
import type { CompareField, ComparisonSideId } from '../model/types';

afterEach(() => {
  cleanup();
});

type Row = { id: string; qty: number };
const row = (id: string, qty: number): Row => ({ id, qty });
const getMatchKey = (r: Row) => r.id;
const compareFields: CompareField<Row>[] = [{ key: 'qty', label: '数量' }];

// base: A(same) / B(a と違う) / C(b に無い)。a: A / B' / C / D(only)。b: A / B / E(only)。
const base = [row('A', 1), row('B', 1), row('C', 1)];
const planA = [row('A', 1), row('B', 2), row('C', 1), row('D', 1)];
const planB = [row('A', 1), row('B', 1), row('E', 1)];
const sides = [
  { id: 'base', rows: base },
  { id: 'a', rows: planA },
  { id: 'b', rows: planB },
];

const mockHandle = () =>
  ({ scrollToRow: vi.fn() }) as unknown as SpreadsheetGridHandle<Row> & {
    scrollToRow: ReturnType<typeof vi.fn>;
  };

const renderNavigation = (options?: {
  alignRows?: boolean;
  showDiffOnly?: boolean;
  useGetHandle?: boolean;
}) => {
  const handles: Record<ComparisonSideId, ReturnType<typeof mockHandle>> = {
    base: mockHandle(),
    a: mockHandle(),
    b: mockHandle(),
  };
  const utils = renderHook(() => {
    const comparison = useMultiComparison<Row>({
      sides,
      getMatchKey,
      compareFields,
      alignRows: options?.alignRows,
      showDiffOnly: options?.showDiffOnly,
    });
    return useMultiComparisonNavigation<Row>({
      comparison,
      alignRows: options?.alignRows,
      getHandle: options?.useGetHandle ? (id) => handles[id] : undefined,
    });
  });
  if (!options?.useGetHandle) {
    for (const id of Object.keys(handles)) {
      utils.result.current.getRef(id)!.current = handles[id];
    }
  }
  return { ...utils, handles };
};

describe('useMultiComparisonNavigation', () => {
  it('停止位置は基準の行順 → 基準に無い行(構成順 → 行順)で、構成ごとの index を持つ', () => {
    const { result } = renderNavigation();
    expect(result.current.diffCount).toBe(4);
    expect(result.current.canNavigate).toBe(true);
    expect(result.current.activeDiffIndex).toBe(-1);
    const [b, c, d, e] = result.current.diffStops;
    expect(b.kind).toBe('field-diff');
    expect([...b.indices]).toEqual([
      ['base', 1],
      ['a', 1],
      ['b', 1],
    ]);
    expect(c.kind).toBe('partial');
    expect([...c.indices]).toEqual([
      ['base', 2],
      ['a', 2],
    ]);
    expect(d.kind).toBe('only');
    expect([...d.indices]).toEqual([['a', 3]]);
    expect(e.kind).toBe('only');
    expect([...e.indices]).toEqual([['b', 2]]);
    expect(e.rows.get('b')).toBe(planB[2]);
  });

  it('goToNextDiff は行のある構成だけを scrollToRow し、末尾からは先頭へラップする', () => {
    const { result, handles } = renderNavigation();
    act(() => result.current.goToNextDiff());
    expect(result.current.activeDiffIndex).toBe(0);
    expect(handles.base.scrollToRow).toHaveBeenLastCalledWith(1, { align: 'center' });
    expect(handles.a.scrollToRow).toHaveBeenLastCalledWith(1, { align: 'center' });
    expect(handles.b.scrollToRow).toHaveBeenLastCalledWith(1, { align: 'center' });

    act(() => result.current.goToDiff(2)); // D(a のみ)
    expect(handles.a.scrollToRow).toHaveBeenLastCalledWith(3, { align: 'center' });
    expect(handles.base.scrollToRow).toHaveBeenCalledTimes(1);
    expect(handles.b.scrollToRow).toHaveBeenCalledTimes(1);

    act(() => result.current.goToNextDiff()); // E
    act(() => result.current.goToNextDiff()); // ラップ → B
    expect(result.current.activeDiffIndex).toBe(0);
  });

  it('goToPreviousDiff は未移動から末尾へ', () => {
    const { result } = renderNavigation();
    act(() => result.current.goToPreviousDiff());
    expect(result.current.activeDiffIndex).toBe(3);
  });

  it('alignRows では行位置順に並び、行の無い構成も同じ行位置へスクロールする', () => {
    const { result, handles } = renderNavigation({ alignRows: true });
    // 整列: A / B / C / D / E。停止は B(1) / C(2) / D(3) / E(4)。
    expect(result.current.diffStops.map((s) => Math.min(...s.indices.values()))).toEqual([1, 2, 3, 4]);
    act(() => result.current.goToDiff(2)); // D
    expect(handles.a.scrollToRow).toHaveBeenLastCalledWith(3, { align: 'center' });
    expect(handles.base.scrollToRow).toHaveBeenLastCalledWith(3, { align: 'center' });
    expect(handles.b.scrollToRow).toHaveBeenLastCalledWith(3, { align: 'center' });
  });

  it('差分のみで基準側だけ消えた行も停止になる', () => {
    const { result } = renderNavigation({ showDiffOnly: true });
    // 非整列の差分のみ: base = [B, C]、a = [B', D]、b = [E]。
    expect(result.current.diffCount).toBe(4);
    const [b, c] = result.current.diffStops;
    expect([...b.indices]).toEqual([
      ['base', 0],
      ['a', 0],
    ]);
    expect([...c.indices]).toEqual([['base', 1]]); // C は a では same なので表示から消えている
  });

  it('getHandle を渡すと refs の代わりにそこからハンドルを取る', () => {
    const { result, handles } = renderNavigation({ useGetHandle: true });
    act(() => result.current.goToNextDiff());
    expect(handles.base.scrollToRow).toHaveBeenCalledTimes(1);
  });

  it('refs は構成 ID の並びが変わらない限り安定し、データが変わると現在位置がリセットされる', () => {
    const { result, rerender } = renderHook(
      (props: { rows: Row[] }) => {
        const comparison = useMultiComparison<Row>({
          sides: [
            { id: 'base', rows: props.rows },
            { id: 'a', rows: planA },
          ],
          getMatchKey,
          compareFields,
        });
        return useMultiComparisonNavigation<Row>({ comparison });
      },
      { initialProps: { rows: base } },
    );
    const refs = result.current.refs;
    act(() => result.current.goToNextDiff());
    expect(result.current.activeDiffIndex).toBe(0);
    rerender({ rows: [row('A', 1)] });
    expect(result.current.refs).toBe(refs);
    expect(result.current.activeDiffIndex).toBe(-1);
    expect(result.current.diffCount).toBe(3); // B' / C / D が a のみ
  });
});

describe("useMultiComparisonNavigation: mode 'all'", () => {
  it('先頭の構成を軸に停止を列挙し、他ペインどうしの揺れも停止になる', () => {
    const { result } = renderHook(() => {
      const comparison = useMultiComparison<Row>({ sides, getMatchKey, compareFields, mode: 'all' });
      return useMultiComparisonNavigation<Row>({ comparison });
    });
    // base: A(same) / B(a と違う) / C(b に無い)。a: A / B' / C / D。b: A / B / E。
    //   軸 base の停止: B / C。軸に無い行: D(a のみ)/ E(b のみ)。
    expect(result.current.diffCount).toBe(4);
    const [b, c, d, e] = result.current.diffStops;
    expect(b.kind).toBe('field-diff');
    expect([...b.indices.keys()]).toEqual(['base', 'a', 'b']);
    expect(c.kind).toBe('partial');
    expect([...d.indices]).toEqual([['a', 3]]);
    expect([...e.indices]).toEqual([['b', 2]]);
  });
});
