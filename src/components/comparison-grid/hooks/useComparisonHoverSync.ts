// ホバー同期(enableHoverSync)のヘッドレス実装です。左右整列モードで「片側の行をホバーしたら、相手ペインの
//   同じ行位置も光らせる」ためのもの(整列では同じ行位置 = 同じ突き合わせ相手)。
//   - spreadsheet-grid v0.33.0 の optionally controlled な行ホバー(hoveredRowIndex / onHoveredRowChange)に乗る。
//     グループがホバー中のビュー行 index を 1 つ React state で持ち、全ペインへ controlled 値として配る。
//     どのペインで pointer が動いても onHoveredRowChange → グループ更新 → 全ペイン再描画、という 1 本の流れ。
//   - useComparisonHoverSyncGroup: 共有 state(hoveredRowIndex / setHoveredRowIndex)。合成コンポーネントの
//     Root はこれを Context で配る。
//   - useHoverSyncedGridProps: 1 グリッドぶんの hoveredRowIndex / onHoveredRowChange を group と合成した grid props。
//   - useComparisonHoverSyncMany: 構成 ID → grid props のレコードをまとめて合成(N 構成のヘッドレス利用)。
//   - useComparisonHoverSync: 2-way の便利版(left / right)。
//   利用側の onHoveredRowChange は合成して透過する。利用側の hoveredRowIndex(controlled)は enabled のとき
//   グループの値で上書きされる(同期と両立しないため)。非整列モードでは行位置が対応しないので、
//   オプションは alignRows と組で有効にすること(ライブラリ側では判定しない)。
import { useCallback, useMemo, useState } from 'react';
import type { SpreadsheetGridProps } from '@ishibashi0112/spreadsheet-grid';
import type {
  ComparisonGridProps,
  ComparisonHoverSyncGroup,
  ComparisonSideId,
  UseComparisonHoverSyncGroupOptions,
  UseComparisonHoverSyncManyOptions,
  UseComparisonHoverSyncManyResult,
  UseComparisonHoverSyncOptions,
  UseComparisonHoverSyncResult,
} from '../model/types';

type HoveredRowChangeHandler<T> = NonNullable<SpreadsheetGridProps<T>['onHoveredRowChange']>;

const EMPTY_GRID_PROPS: Readonly<Record<never, never>> = Object.freeze({});

/** ホバー中のビュー行 index を全ペインで共有するグループを返します(React state を 1 つ持つ)。 */
export function useComparisonHoverSyncGroup(
  options: UseComparisonHoverSyncGroupOptions = {},
): ComparisonHoverSyncGroup {
  const { enabled = true } = options;
  const [hoveredRowIndex, setHoveredRowIndexState] = useState<number | null>(null);
  // 同値なら setState を呼ばない(spreadsheet-grid 側も同値抑止しているが、複数ペインからの通知が
  //   同じ値で重なるケースを念のため弾く)。
  const setHoveredRowIndex = useCallback((viewRowIndex: number | null) => {
    setHoveredRowIndexState((current) => (current === viewRowIndex ? current : viewRowIndex));
  }, []);
  // 無効時は controlled 値を配らない(各グリッドは内部 state で従来どおり単独ホバー)。
  const effective = enabled ? hoveredRowIndex : null;
  return useMemo(
    () => ({ enabled, hoveredRowIndex: effective, setHoveredRowIndex }),
    [enabled, effective, setHoveredRowIndex],
  );
}

/** 1 グリッドぶんの hoveredRowIndex / onHoveredRowChange を合成した grid props を作ります(純関数)。
 *  group.enabled=false のときは入力をそのまま返します。 */
export const composeHoverSyncedGridProps = <T,>(
  group: ComparisonHoverSyncGroup,
  userProps: ComparisonGridProps<T> | undefined,
): ComparisonGridProps<T> => {
  if (!group.enabled) return userProps ?? (EMPTY_GRID_PROPS as ComparisonGridProps<T>);
  const userOnHoveredRowChange = userProps?.onHoveredRowChange;
  const onHoveredRowChange: HoveredRowChangeHandler<T> = (viewRowIndex, ctx) => {
    group.setHoveredRowIndex(viewRowIndex);
    userOnHoveredRowChange?.(viewRowIndex, ctx);
  };
  return { ...userProps, hoveredRowIndex: group.hoveredRowIndex, onHoveredRowChange };
};

/** 1 グリッドぶんの合成(useCallback / useMemo で安定化)。合成コンポーネントの Grid が使います。
 *  group.enabled=false のときは入力をそのまま返します(hoveredRowIndex / onHoveredRowChange を足さない)。 */
export function useHoverSyncedGridProps<T>(
  group: ComparisonHoverSyncGroup,
  userProps: ComparisonGridProps<T> | undefined,
): ComparisonGridProps<T> {
  const { enabled, hoveredRowIndex, setHoveredRowIndex } = group;
  const userOnHoveredRowChange = userProps?.onHoveredRowChange;
  const onHoveredRowChange = useCallback<HoveredRowChangeHandler<T>>(
    (viewRowIndex, ctx) => {
      setHoveredRowIndex(viewRowIndex);
      userOnHoveredRowChange?.(viewRowIndex, ctx);
    },
    [setHoveredRowIndex, userOnHoveredRowChange],
  );
  return useMemo(
    () =>
      enabled
        ? { ...userProps, hoveredRowIndex, onHoveredRowChange }
        : (userProps ?? (EMPTY_GRID_PROPS as ComparisonGridProps<T>)),
    [enabled, userProps, hoveredRowIndex, onHoveredRowChange],
  );
}

/** 構成 ID → grid props のレコードをまとめて合成します(N 構成のヘッドレス利用)。 */
export function useComparisonHoverSyncMany<T>(
  options: UseComparisonHoverSyncManyOptions<T>,
): UseComparisonHoverSyncManyResult<T> {
  const { sides, enabled } = options;
  const group = useComparisonHoverSyncGroup({ enabled });
  const composed = useMemo(() => {
    const record: Record<ComparisonSideId, ComparisonGridProps<T>> = {};
    for (const sideId of Object.keys(sides)) {
      record[sideId] = composeHoverSyncedGridProps(group, sides[sideId]);
    }
    return record;
  }, [group, sides]);
  return useMemo(() => ({ sides: composed, group }), [composed, group]);
}

/**
 * 2 構成のホバー同期(便利版)。両側の `hoveredRowIndex` / `onHoveredRowChange` を合成した grid props を返します。
 * 左右整列モード(`alignRows`)と組で使います(同じ行位置 = 同じ突き合わせ相手)。`enabled=false` では入力をそのまま返します。
 *
 * @example
 * ```tsx
 * const hover = useComparisonHoverSync<Row>({ leftGridProps: sync.leftGridProps, rightGridProps: sync.rightGridProps });
 * const left = useComparisonPane<Row>({ …, gridProps: hover.leftGridProps });
 * const right = useComparisonPane<Row>({ …, gridProps: hover.rightGridProps });
 * ```
 */
export function useComparisonHoverSync<T>(
  options: UseComparisonHoverSyncOptions<T> = {},
): UseComparisonHoverSyncResult<T> {
  const { enabled = true, leftGridProps, rightGridProps } = options;
  const group = useComparisonHoverSyncGroup({ enabled });
  const left = useHoverSyncedGridProps(group, leftGridProps);
  const right = useHoverSyncedGridProps(group, rightGridProps);
  return useMemo(
    () => ({ leftGridProps: left, rightGridProps: right, group }),
    [left, right, group],
  );
}
