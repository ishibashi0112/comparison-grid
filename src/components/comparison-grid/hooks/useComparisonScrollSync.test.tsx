// useComparisonScrollSync(スクロール同期のヘッドレス版)のテストです(renderHook のため jsdom)。
//   グリッドのハンドルはモックで与え(ref callback を直接呼ぶ)、onScroll の伝播を検証します。
//   実グリッドを使った結合テストは view/ComparisonView.scrollSync.test.tsx にあります。
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import type {
  GridScrollEventParams,
  SpreadsheetGridHandle,
} from '@ishibashi0112/spreadsheet-grid';
import { useComparisonScrollSync } from './useComparisonScrollSync';
import type { ComparisonGridProps, UseComparisonScrollSyncOptions } from '../model/types';

afterEach(() => {
  cleanup();
});

type Row = { id: string };

const mockHandle = () =>
  ({ setScrollPosition: vi.fn() }) as unknown as SpreadsheetGridHandle<Row> & {
    setScrollPosition: ReturnType<typeof vi.fn>;
  };

const scrollParams = (
  source: GridScrollEventParams['source'],
  top: number,
  left: number,
): GridScrollEventParams => ({ source, top, left }) as GridScrollEventParams;

// 返された ref callback にモックハンドルを流し込む(SpreadsheetGrid のマウント相当)。
const attach = (props: ComparisonGridProps<Row>, handle: SpreadsheetGridHandle<Row>) => {
  const ref = props.ref;
  if (typeof ref !== 'function') throw new Error('ref callback が返されていません');
  return ref(handle);
};

describe('useComparisonScrollSync', () => {
  it('source が user のスクロールだけを相手の setScrollPosition へ伝える(既定は top のみ)', () => {
    const { result } = renderHook(() => useComparisonScrollSync<Row>());
    const leftHandle = mockHandle();
    const rightHandle = mockHandle();
    attach(result.current.leftGridProps, leftHandle);
    attach(result.current.rightGridProps, rightHandle);

    result.current.leftGridProps.onScroll?.(scrollParams('user', 120, 30));
    expect(rightHandle.setScrollPosition).toHaveBeenCalledWith({ top: 120 });
    expect(leftHandle.setScrollPosition).not.toHaveBeenCalled();

    result.current.rightGridProps.onScroll?.(scrollParams('api', 500, 0));
    expect(leftHandle.setScrollPosition).not.toHaveBeenCalled();

    result.current.rightGridProps.onScroll?.(scrollParams('user', 80, 0));
    expect(leftHandle.setScrollPosition).toHaveBeenCalledWith({ top: 80 });
  });

  it('syncHorizontal で left も伝える', () => {
    const { result } = renderHook(() => useComparisonScrollSync<Row>({ syncHorizontal: true }));
    const rightHandle = mockHandle();
    attach(result.current.rightGridProps, rightHandle);
    result.current.leftGridProps.onScroll?.(scrollParams('user', 10, 20));
    expect(rightHandle.setScrollPosition).toHaveBeenCalledWith({ top: 10, left: 20 });
  });

  it('利用側の ref / onScroll / その他 props を合成して透過する', () => {
    const userRef = createRef<SpreadsheetGridHandle<Row>>();
    const userOnScroll = vi.fn();
    const leftGridProps: ComparisonGridProps<Row> = { ref: userRef, onScroll: userOnScroll, theme: 'dark' };
    const { result } = renderHook(() => useComparisonScrollSync<Row>({ leftGridProps }));
    const leftHandle = mockHandle();
    const cleanupRef = attach(result.current.leftGridProps, leftHandle);
    expect(userRef.current).toBe(leftHandle);
    expect(result.current.leftGridProps.theme).toBe('dark');

    result.current.leftGridProps.onScroll?.(scrollParams('api', 5, 0));
    expect(userOnScroll).toHaveBeenCalledTimes(1);

    if (typeof cleanupRef === 'function') cleanupRef();
    expect(userRef.current).toBeNull();
  });

  it('enabled=false では入力をそのまま返す(ref / onScroll を足さない)', () => {
    const leftGridProps: ComparisonGridProps<Row> = { theme: 'dark' };
    const { result } = renderHook(() =>
      useComparisonScrollSync<Row>({ enabled: false, leftGridProps }),
    );
    expect(result.current.leftGridProps).toBe(leftGridProps);
    expect(result.current.rightGridProps).toEqual({});
    expect(result.current.rightGridProps.ref).toBeUndefined();
  });

  it('入力が同じなら返り値の参照は安定する', () => {
    const { result, rerender } = renderHook(
      (options: UseComparisonScrollSyncOptions<Row>) => useComparisonScrollSync<Row>(options),
      { initialProps: { syncHorizontal: false } },
    );
    const first = result.current;
    rerender({ syncHorizontal: false });
    expect(result.current).toBe(first);
    expect(result.current.leftGridProps).toBe(first.leftGridProps);
  });
});
