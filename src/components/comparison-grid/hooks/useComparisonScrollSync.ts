// スクロール同期(enableScrollSync)のヘッドレス実装です。
//   - useComparisonScrollSyncGroup: 構成 ID ごとのハンドル登録 + 発火側以外への伝播(broadcast)を持つ
//     共有オブジェクト。source が 'user' のスクロールだけを相手の setScrollPosition() へ伝えます
//     ('api' 由来は無視してループを防ぐ。spreadsheet-grid v0.29.0 のスクロール API)。
//     syncHorizontal では top に加えて left も伝えます。合成コンポーネントの Root はこれを Context で配ります。
//   - useSyncedGridProps: 1 グリッドぶんの ref / onScroll を group と合成した grid props を返します。
//   - useComparisonScrollSyncMany: 構成 ID → grid props のレコードをまとめて合成(N 構成のヘッドレス利用)。
//   - useComparisonScrollSync: 2-way の便利版(left / right)。振る舞いは従来どおり。
//   利用側の ref / onScroll は合成してそのまま透過します。ref の参照はすべて ref callback / イベントハンドラ
//   内で行い、render 中には触りません。
import { useCallback, useMemo, useRef, type Ref, type RefCallback } from 'react';
import type {
  GridScrollEventParams,
  SpreadsheetGridHandle,
} from '@ishibashi0112/spreadsheet-grid';
import type {
  ComparisonGridProps,
  ComparisonScrollSyncGroup,
  ComparisonSideId,
  UseComparisonScrollSyncGroupOptions,
  UseComparisonScrollSyncManyOptions,
  UseComparisonScrollSyncManyResult,
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

/** 構成 ID ごとのハンドル登録とスクロール伝播を持つ共有オブジェクトを返します。 */
export function useComparisonScrollSyncGroup<T>(
  options: UseComparisonScrollSyncGroupOptions = {},
): ComparisonScrollSyncGroup<T> {
  const { enabled = true, syncHorizontal = false } = options;
  const handlesRef = useRef<Map<ComparisonSideId, SpreadsheetGridHandle<T>>>(new Map());

  const register = useCallback((sideId: ComparisonSideId, handle: SpreadsheetGridHandle<T>) => {
    handlesRef.current.set(sideId, handle);
    return () => {
      if (handlesRef.current.get(sideId) === handle) handlesRef.current.delete(sideId);
    };
  }, []);

  const broadcast = useCallback(
    (fromSideId: ComparisonSideId, params: GridScrollEventParams) => {
      if (!enabled || params.source !== 'user') return;
      const position = syncHorizontal
        ? { top: params.top, left: params.left }
        : { top: params.top };
      for (const [sideId, handle] of handlesRef.current) {
        if (sideId !== fromSideId) handle.setScrollPosition(position);
      }
    },
    [enabled, syncHorizontal],
  );

  const getHandle = useCallback(
    (sideId: ComparisonSideId) => handlesRef.current.get(sideId) ?? null,
    [],
  );

  return useMemo(
    () => ({ enabled, syncHorizontal, register, broadcast, getHandle }),
    [enabled, syncHorizontal, register, broadcast, getHandle],
  );
}

/** 1 グリッドぶんの ref / onScroll を合成した grid props を作ります(純関数。フック版は useSyncedGridProps)。 */
export const composeSyncedGridProps = <T,>(
  group: ComparisonScrollSyncGroup<T>,
  sideId: ComparisonSideId,
  userProps: ComparisonGridProps<T> | undefined,
): ComparisonGridProps<T> => {
  const userRef = userProps?.ref;
  const userOnScroll = userProps?.onScroll;
  const ref: RefCallback<SpreadsheetGridHandle<T>> = (handle) => {
    const unregister = handle ? group.register(sideId, handle) : undefined;
    const cleanup = setRefValue(userRef, handle);
    return () => {
      unregister?.();
      if (cleanup) cleanup();
      else setRefValue(userRef, null);
    };
  };
  const onScroll = (params: GridScrollEventParams) => {
    group.broadcast(sideId, params);
    userOnScroll?.(params);
  };
  return { ...userProps, ref, onScroll };
};

/** 1 グリッドぶんの合成(useCallback で ref / onScroll を安定化)。合成コンポーネントの Grid が使います。
 *  group.enabled に依らずハンドルは登録される(差分ジャンプが getHandle で引けるように)。 */
export function useSyncedGridProps<T>(
  group: ComparisonScrollSyncGroup<T>,
  sideId: ComparisonSideId,
  userProps: ComparisonGridProps<T> | undefined,
): ComparisonGridProps<T> {
  const userRef = userProps?.ref;
  const userOnScroll = userProps?.onScroll;

  const ref = useCallback<RefCallback<SpreadsheetGridHandle<T>>>(
    (handle) => {
      const unregister = handle ? group.register(sideId, handle) : undefined;
      const cleanup = setRefValue(userRef, handle);
      return () => {
        unregister?.();
        if (cleanup) cleanup();
        else setRefValue(userRef, null);
      };
    },
    [group, sideId, userRef],
  );

  const onScroll = useCallback(
    (params: GridScrollEventParams) => {
      group.broadcast(sideId, params);
      userOnScroll?.(params);
    },
    [group, sideId, userOnScroll],
  );

  return useMemo(() => ({ ...userProps, ref, onScroll }), [userProps, ref, onScroll]);
}

/** 構成 ID → grid props のレコードをまとめて合成します(N 構成のヘッドレス利用)。 */
export function useComparisonScrollSyncMany<T>(
  options: UseComparisonScrollSyncManyOptions<T>,
): UseComparisonScrollSyncManyResult<T> {
  const { sides, enabled, syncHorizontal } = options;
  const group = useComparisonScrollSyncGroup<T>({ enabled, syncHorizontal });
  const composed = useMemo(() => {
    const record: Record<ComparisonSideId, ComparisonGridProps<T>> = {};
    for (const sideId of Object.keys(sides)) {
      record[sideId] = composeSyncedGridProps(group, sideId, sides[sideId]);
    }
    return record;
  }, [group, sides]);
  return useMemo(() => ({ sides: composed, group }), [composed, group]);
}

/**
 * 2 構成のスクロール同期(便利版)。両側の `ref` / `onScroll` を合成した grid props を返します。
 * `enabled=false` では入力をそのまま返します(ref / onScroll を足さない)。
 *
 * @example
 * ```tsx
 * const sync = useComparisonScrollSync<Row>({ syncHorizontal: false });
 * const left = useComparisonPane<Row>({ …, gridProps: sync.leftGridProps });
 * const right = useComparisonPane<Row>({ …, gridProps: sync.rightGridProps });
 * ```
 */
export function useComparisonScrollSync<T>(
  options: UseComparisonScrollSyncOptions<T> = {},
): UseComparisonScrollSyncResult<T> {
  const { enabled = true, syncHorizontal = false, leftGridProps, rightGridProps } = options;
  const group = useComparisonScrollSyncGroup<T>({ enabled, syncHorizontal });
  const left = useSyncedGridProps(group, 'left', leftGridProps);
  const right = useSyncedGridProps(group, 'right', rightGridProps);

  return useMemo(
    () =>
      enabled
        ? { leftGridProps: left, rightGridProps: right }
        : {
            leftGridProps: leftGridProps ?? (EMPTY_GRID_PROPS as ComparisonGridProps<T>),
            rightGridProps: rightGridProps ?? (EMPTY_GRID_PROPS as ComparisonGridProps<T>),
          },
    [enabled, left, right, leftGridProps, rightGridProps],
  );
}
