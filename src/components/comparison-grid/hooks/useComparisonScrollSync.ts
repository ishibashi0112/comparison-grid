// 両ペインのスクロール同期(enableScrollSync)のヘッドレス実装です。
//   両グリッドのハンドルをこのフック内の ref に閉じ込め、source が 'user' のスクロールだけを
//   相手の setScrollPosition() へ伝えます('api' 由来は無視してループを防ぐ。
//   spreadsheet-grid v0.29.0 のスクロール API)。syncHorizontal では top に加えて left も伝えます。
//   利用側の ref / onScroll(leftGridProps 等)は合成してそのまま透過します。
//   ref の参照はすべて ref callback / イベントハンドラ内で行い、render 中には触りません。
//   ComparisonView はこのフックの利用側で、自前レイアウトでも同じ同期が使えます。
import { useCallback, useMemo, useRef, type Ref, type RefCallback, type RefObject } from 'react';
import type {
  GridScrollEventParams,
  SpreadsheetGridHandle,
} from '@ishibashi0112/spreadsheet-grid';
import type {
  ComparisonGridProps,
  UseComparisonScrollSyncOptions,
  UseComparisonScrollSyncResult,
} from '../model/types';

// 利用側 ref(leftGridProps={{ ref }} 等)への転送。関数 ref が cleanup を返す場合
//   (React 19)はそれを返し、返さない場合は呼び出し側が null 代入で解除します。
const setRefValue = <V,>(ref: Ref<V> | undefined, value: V | null): (() => void) | undefined => {
  if (!ref) return undefined;
  if (typeof ref === 'function') {
    const cleanup = ref(value);
    return typeof cleanup === 'function' ? cleanup : undefined;
  }
  ref.current = value;
  return undefined;
};

const EMPTY_GRID_PROPS: Readonly<Record<never, never>> = Object.freeze({});

/** 片側ぶんの合成(ハンドル捕捉 ref + 相手へ伝える onScroll)。 */
function useSyncedSide<T>(
  ownHandleRef: RefObject<SpreadsheetGridHandle<T> | null>,
  otherHandleRef: RefObject<SpreadsheetGridHandle<T> | null>,
  userProps: ComparisonGridProps<T> | undefined,
  enabled: boolean,
  syncHorizontal: boolean,
): ComparisonGridProps<T> {
  const userRef = userProps?.ref;
  const userOnScroll = userProps?.onScroll;

  const syncedRef = useCallback<RefCallback<SpreadsheetGridHandle<T>>>(
    (handle) => {
      ownHandleRef.current = handle;
      const cleanup = setRefValue(userRef, handle);
      return () => {
        ownHandleRef.current = null;
        if (cleanup) cleanup();
        else setRefValue(userRef, null);
      };
    },
    [ownHandleRef, userRef],
  );

  const syncedOnScroll = useCallback(
    (params: GridScrollEventParams) => {
      if (params.source === 'user') {
        otherHandleRef.current?.setScrollPosition(
          syncHorizontal ? { top: params.top, left: params.left } : { top: params.top },
        );
      }
      userOnScroll?.(params);
    },
    [otherHandleRef, userOnScroll, syncHorizontal],
  );

  return useMemo(
    () =>
      enabled
        ? { ...userProps, ref: syncedRef, onScroll: syncedOnScroll }
        : (userProps ?? (EMPTY_GRID_PROPS as ComparisonGridProps<T>)),
    [enabled, userProps, syncedRef, syncedOnScroll],
  );
}

export function useComparisonScrollSync<T>(
  options: UseComparisonScrollSyncOptions<T> = {},
): UseComparisonScrollSyncResult<T> {
  const { enabled = true, syncHorizontal = false, leftGridProps, rightGridProps } = options;
  const leftHandleRef = useRef<SpreadsheetGridHandle<T> | null>(null);
  const rightHandleRef = useRef<SpreadsheetGridHandle<T> | null>(null);

  const left = useSyncedSide(leftHandleRef, rightHandleRef, leftGridProps, enabled, syncHorizontal);
  const right = useSyncedSide(
    rightHandleRef,
    leftHandleRef,
    rightGridProps,
    enabled,
    syncHorizontal,
  );

  return useMemo(() => ({ leftGridProps: left, rightGridProps: right }), [left, right]);
}
