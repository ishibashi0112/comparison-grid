// useComparisonScrollSyncGroup / useSyncedGridProps / useComparisonScrollSyncMany(N 構成の同期)のテストです
//   (renderHook のため jsdom)。グリッドのハンドルはモックで与え、broadcast の伝播先を検証します。
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import type {
  GridScrollEventParams,
  SpreadsheetGridHandle,
} from '@ishibashi0112/spreadsheet-grid';
import {
  useComparisonScrollSyncGroup,
  useComparisonScrollSyncMany,
  useSyncedGridProps,
} from './useComparisonScrollSync';
import type { ComparisonGridProps } from '../model/types';

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

const attach = (props: ComparisonGridProps<Row>, handle: SpreadsheetGridHandle<Row>) => {
  const ref = props.ref;
  if (typeof ref !== 'function') throw new Error('ref callback が返されていません');
  return ref(handle);
};

const sides = { base: undefined, a: undefined, b: undefined };

describe('useComparisonScrollSyncMany', () => {
  it('発火側以外の全構成へ user スクロールだけを伝える', () => {
    const { result } = renderHook(() => useComparisonScrollSyncMany<Row>({ sides }));
    const handles = { base: mockHandle(), a: mockHandle(), b: mockHandle() };
    attach(result.current.sides.base, handles.base);
    attach(result.current.sides.a, handles.a);
    attach(result.current.sides.b, handles.b);

    result.current.sides.a.onScroll?.(scrollParams('user', 120, 30));
    expect(handles.base.setScrollPosition).toHaveBeenCalledWith({ top: 120 });
    expect(handles.b.setScrollPosition).toHaveBeenCalledWith({ top: 120 });
    expect(handles.a.setScrollPosition).not.toHaveBeenCalled();

    result.current.sides.base.onScroll?.(scrollParams('api', 500, 0));
    expect(handles.a.setScrollPosition).not.toHaveBeenCalled();
    expect(handles.b.setScrollPosition).toHaveBeenCalledTimes(1);
  });

  it('syncHorizontal で left も伝え、enabled=false では伝えないがハンドルは登録される', () => {
    const { result, rerender } = renderHook(
      (props: { enabled: boolean }) =>
        useComparisonScrollSyncMany<Row>({ sides, syncHorizontal: true, enabled: props.enabled }),
      { initialProps: { enabled: true } },
    );
    const a = mockHandle();
    const b = mockHandle();
    attach(result.current.sides.a, a);
    attach(result.current.sides.b, b);
    result.current.sides.a.onScroll?.(scrollParams('user', 10, 20));
    expect(b.setScrollPosition).toHaveBeenCalledWith({ top: 10, left: 20 });

    rerender({ enabled: false });
    // ref は作り直されるため再アタッチ(SpreadsheetGrid の ref 差し替え相当)。
    attach(result.current.sides.a, a);
    attach(result.current.sides.b, b);
    result.current.sides.a.onScroll?.(scrollParams('user', 99, 0));
    expect(b.setScrollPosition).toHaveBeenCalledTimes(1);
    expect(result.current.group.getHandle('b')).toBe(b);
    expect(result.current.group.enabled).toBe(false);
  });

  it('利用側の ref / onScroll / その他 props を合成して透過し、解除で登録も消える', () => {
    const userRef = createRef<SpreadsheetGridHandle<Row>>();
    const userOnScroll = vi.fn();
    const sidesWithUser = {
      base: { ref: userRef, onScroll: userOnScroll, theme: 'dark' } as ComparisonGridProps<Row>,
      a: undefined,
    };
    const { result } = renderHook(() => useComparisonScrollSyncMany<Row>({ sides: sidesWithUser }));
    const handle = mockHandle();
    const cleanupRef = attach(result.current.sides.base, handle);
    expect(userRef.current).toBe(handle);
    expect(result.current.sides.base.theme).toBe('dark');
    expect(result.current.group.getHandle('base')).toBe(handle);

    result.current.sides.base.onScroll?.(scrollParams('api', 5, 0));
    expect(userOnScroll).toHaveBeenCalledTimes(1);

    if (typeof cleanupRef === 'function') cleanupRef();
    expect(userRef.current).toBeNull();
    expect(result.current.group.getHandle('base')).toBeNull();
  });

  it('sides の参照が同じなら返り値は安定する', () => {
    const { result, rerender } = renderHook(() => useComparisonScrollSyncMany<Row>({ sides }));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(result.current.sides.a).toBe(first.sides.a);
  });
});

describe('useComparisonScrollSyncGroup + useSyncedGridProps', () => {
  it('group を共有した複数の useSyncedGridProps が互いに同期する', () => {
    const { result } = renderHook(() => {
      const group = useComparisonScrollSyncGroup<Row>();
      const x = useSyncedGridProps(group, 'x', undefined);
      const y = useSyncedGridProps(group, 'y', { theme: 'dark' });
      return { group, x, y };
    });
    const hx = mockHandle();
    const hy = mockHandle();
    attach(result.current.x, hx);
    attach(result.current.y, hy);
    result.current.x.onScroll?.(scrollParams('user', 7, 0));
    expect(hy.setScrollPosition).toHaveBeenCalledWith({ top: 7 });
    expect(result.current.y.theme).toBe('dark');
    expect(result.current.group.getHandle('x')).toBe(hx);
  });

  it('同じ構成 ID に別ハンドルが登録されたあと、古い方の解除で新しい登録は消えない', () => {
    const { result } = renderHook(() => useComparisonScrollSyncGroup<Row>());
    const oldHandle = mockHandle();
    const newHandle = mockHandle();
    const unregisterOld = result.current.register('x', oldHandle);
    result.current.register('x', newHandle);
    unregisterOld();
    expect(result.current.getHandle('x')).toBe(newHandle);
  });
});
