// 2 ペイン + ペインごとのヘッダースロットを並べる薄いレイアウトです(CSS Grid)。
//   layout='horizontal'(既定)は左右 2 カラム、'vertical' は上下 2 行(left が上)。
//   ヘッダースロットは片側だけ指定されても両ペインに描画し、上端を揃えます。
//   enableScrollSync では両グリッドのハンドルを内部 ref で捕まえ、source が 'user' の
//   スクロールだけを相手の setScrollPosition() へ伝えます('api' 由来は無視して
//   ループを防ぐ。spreadsheet-grid v0.29.0 のスクロール API)。同期軸は layout に依り、
//   横並びは top のみ、縦並びは top / left 両方(列が上下に揃うため横も合わせる)。
import { useCallback, useMemo, useRef, type Ref, type RefCallback } from 'react';
import type {
  GridScrollEventParams,
  SpreadsheetGridHandle,
} from '@ishibashi0112/spreadsheet-grid';
import type { ComparisonGridProps, ComparisonViewProps } from '../model/types';
import { ComparisonPane } from './ComparisonPane';
import { cx } from '../logic/cx';

const mergeGridProps = <T,>(
  base: ComparisonGridProps<T> | undefined,
  override: ComparisonGridProps<T> | undefined,
): ComparisonGridProps<T> | undefined => {
  if (!override) return base;
  if (!base) return override;
  return { ...base, ...override };
};

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

/** enableScrollSync の実装フックです。両グリッドのハンドルをこのフック内の ref に閉じ込め、
 *  source が 'user' のスクロールだけを相手の setScrollPosition() へ伝えます
 *  ('api' 由来は無視してループを防ぐ。spreadsheet-grid v0.29.0 のスクロール API)。
 *  syncHorizontal(縦並びレイアウト)では top に加えて left も伝えます。
 *  ref の参照はすべて ref callback / イベントハンドラ内で行い、render 中には触りません。 */
function useScrollSyncGridProps<T>(
  mergedLeft: ComparisonGridProps<T> | undefined,
  mergedRight: ComparisonGridProps<T> | undefined,
  enabled: boolean,
  syncHorizontal: boolean,
): [ComparisonGridProps<T> | undefined, ComparisonGridProps<T> | undefined] {
  const leftHandleRef = useRef<SpreadsheetGridHandle<T> | null>(null);
  const rightHandleRef = useRef<SpreadsheetGridHandle<T> | null>(null);
  const userLeftRef = mergedLeft?.ref;
  const userRightRef = mergedRight?.ref;
  const userLeftOnScroll = mergedLeft?.onScroll;
  const userRightOnScroll = mergedRight?.onScroll;

  const syncedLeftRef = useCallback<RefCallback<SpreadsheetGridHandle<T>>>(
    (handle) => {
      leftHandleRef.current = handle;
      const cleanup = setRefValue(userLeftRef, handle);
      return () => {
        leftHandleRef.current = null;
        if (cleanup) cleanup();
        else setRefValue(userLeftRef, null);
      };
    },
    [userLeftRef],
  );
  const syncedRightRef = useCallback<RefCallback<SpreadsheetGridHandle<T>>>(
    (handle) => {
      rightHandleRef.current = handle;
      const cleanup = setRefValue(userRightRef, handle);
      return () => {
        rightHandleRef.current = null;
        if (cleanup) cleanup();
        else setRefValue(userRightRef, null);
      };
    },
    [userRightRef],
  );

  const syncedLeftOnScroll = useCallback(
    (params: GridScrollEventParams) => {
      if (params.source === 'user') {
        rightHandleRef.current?.setScrollPosition(
          syncHorizontal ? { top: params.top, left: params.left } : { top: params.top },
        );
      }
      userLeftOnScroll?.(params);
    },
    [userLeftOnScroll, syncHorizontal],
  );
  const syncedRightOnScroll = useCallback(
    (params: GridScrollEventParams) => {
      if (params.source === 'user') {
        leftHandleRef.current?.setScrollPosition(
          syncHorizontal ? { top: params.top, left: params.left } : { top: params.top },
        );
      }
      userRightOnScroll?.(params);
    },
    [userRightOnScroll, syncHorizontal],
  );

  const leftProps = useMemo(
    () =>
      enabled
        ? { ...mergedLeft, ref: syncedLeftRef, onScroll: syncedLeftOnScroll }
        : mergedLeft,
    [enabled, mergedLeft, syncedLeftRef, syncedLeftOnScroll],
  );
  const rightProps = useMemo(
    () =>
      enabled
        ? { ...mergedRight, ref: syncedRightRef, onScroll: syncedRightOnScroll }
        : mergedRight,
    [enabled, mergedRight, syncedRightRef, syncedRightOnScroll],
  );
  return [leftProps, rightProps];
}

export function ComparisonView<T extends object>(props: ComparisonViewProps<T>) {
  const {
    comparison,
    columns,
    keyColumnKeys,
    leftHeader,
    rightHeader,
    gridProps,
    leftGridProps,
    rightGridProps,
    className,
    style,
    layout = 'horizontal',
    enableRowHighlight,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    enableScrollSync = false,
    showDiffLabelColumn,
    diffLabelColumn,
  } = props;
  const showHeader = leftHeader !== undefined || rightHeader !== undefined;
  const mergedLeft = useMemo(
    () => mergeGridProps(gridProps, leftGridProps),
    [gridProps, leftGridProps],
  );
  const mergedRight = useMemo(
    () => mergeGridProps(gridProps, rightGridProps),
    [gridProps, rightGridProps],
  );
  const [leftProps, rightProps] = useScrollSyncGridProps(
    mergedLeft,
    mergedRight,
    enableScrollSync,
    layout === 'vertical',
  );
  const highlight = {
    enableRowHighlight,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    showDiffLabelColumn,
    diffLabelColumn,
  };

  return (
    <div
      className={cx('cmpg-view', `cmpg-view--${layout}`, className)}
      style={style}
      data-cmpg-layout={layout}
    >
      <ComparisonPane<T>
        side="left"
        rows={comparison.visibleLeft}
        diffs={comparison.leftDiffs}
        columns={columns}
        compareFields={comparison.compareFields}
        keyColumnKeys={keyColumnKeys}
        placeholderRows={comparison.placeholders?.left}
        contextRows={comparison.contextRows?.left}
        descendantDiffCounts={comparison.descendantDiffCounts?.left}
        header={leftHeader}
        showHeader={showHeader}
        gridProps={leftProps}
        {...highlight}
      />
      <ComparisonPane<T>
        side="right"
        rows={comparison.visibleRight}
        diffs={comparison.rightDiffs}
        columns={columns}
        compareFields={comparison.compareFields}
        keyColumnKeys={keyColumnKeys}
        placeholderRows={comparison.placeholders?.right}
        contextRows={comparison.contextRows?.right}
        descendantDiffCounts={comparison.descendantDiffCounts?.right}
        header={rightHeader}
        showHeader={showHeader}
        gridProps={rightProps}
        {...highlight}
      />
    </div>
  );
}
