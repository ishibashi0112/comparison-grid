// useComparisonHoverSync(ホバー同期のヘッドレス版)のテストです(renderHook のため jsdom)。
//   グリッドは使わず、返された onHoveredRowChange を直接呼んで controlled 値(hoveredRowIndex)の伝播を検証します。
//   実グリッドを使った結合テストは view/ComparisonView.hoverSync.test.tsx にあります。
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import {
  useComparisonHoverSync,
  useComparisonHoverSyncMany,
} from './useComparisonHoverSync';
import type { ComparisonGridProps, UseComparisonHoverSyncOptions } from '../model/types';

afterEach(() => {
  cleanup();
});

type Row = { id: string };
const ctx = { source: 'pointer' as const };

describe('useComparisonHoverSync', () => {
  it('片側の onHoveredRowChange が両側の hoveredRowIndex(controlled 値)になる', () => {
    const { result } = renderHook(() => useComparisonHoverSync<Row>());
    expect(result.current.leftGridProps.hoveredRowIndex).toBeNull();
    expect(result.current.rightGridProps.hoveredRowIndex).toBeNull();

    act(() => result.current.leftGridProps.onHoveredRowChange?.(2, ctx));
    expect(result.current.leftGridProps.hoveredRowIndex).toBe(2);
    expect(result.current.rightGridProps.hoveredRowIndex).toBe(2);
    expect(result.current.group.hoveredRowIndex).toBe(2);

    act(() => result.current.rightGridProps.onHoveredRowChange?.(null, ctx));
    expect(result.current.leftGridProps.hoveredRowIndex).toBeNull();
    expect(result.current.rightGridProps.hoveredRowIndex).toBeNull();
  });

  it('利用側の onHoveredRowChange は合成して透過し、それ以外の props はそのまま残る', () => {
    const userHandler = vi.fn();
    const leftGridProps: ComparisonGridProps<Row> = { theme: 'dark', onHoveredRowChange: userHandler };
    const { result } = renderHook(() => useComparisonHoverSync<Row>({ leftGridProps }));
    act(() => result.current.leftGridProps.onHoveredRowChange?.(1, ctx));
    expect(userHandler).toHaveBeenCalledWith(1, ctx);
    expect(result.current.leftGridProps.theme).toBe('dark');
    expect(result.current.rightGridProps.hoveredRowIndex).toBe(1);
  });

  it('enabled=false では入力をそのまま返す(hoveredRowIndex / onHoveredRowChange を足さない)', () => {
    const leftGridProps: ComparisonGridProps<Row> = { theme: 'dark' };
    const { result } = renderHook(() =>
      useComparisonHoverSync<Row>({ enabled: false, leftGridProps }),
    );
    expect(result.current.leftGridProps).toBe(leftGridProps);
    expect('hoveredRowIndex' in result.current.rightGridProps).toBe(false);
    expect(result.current.group.enabled).toBe(false);
  });

  it('同値の通知では参照が変わらず、入力が同じなら参照は安定する', () => {
    const { result, rerender } = renderHook(
      (options: UseComparisonHoverSyncOptions<Row>) => useComparisonHoverSync<Row>(options),
      { initialProps: {} },
    );
    act(() => result.current.leftGridProps.onHoveredRowChange?.(3, ctx));
    const first = result.current;
    act(() => result.current.rightGridProps.onHoveredRowChange?.(3, ctx));
    expect(result.current).toBe(first);
    rerender({});
    expect(result.current).toBe(first);
  });
});

describe('useComparisonHoverSyncMany', () => {
  it('構成 ID ごとの props に同じ hoveredRowIndex を配り、どの構成からでも更新できる', () => {
    const sides = { base: undefined, a: { theme: 'dark' } as ComparisonGridProps<Row>, b: undefined };
    const { result } = renderHook(() => useComparisonHoverSyncMany<Row>({ sides }));
    expect(Object.keys(result.current.sides)).toEqual(['base', 'a', 'b']);
    act(() => result.current.sides.b.onHoveredRowChange?.(5, ctx));
    expect(result.current.sides.base.hoveredRowIndex).toBe(5);
    expect(result.current.sides.a.hoveredRowIndex).toBe(5);
    expect(result.current.sides.a.theme).toBe('dark');
    expect(result.current.group.hoveredRowIndex).toBe(5);
  });
});
