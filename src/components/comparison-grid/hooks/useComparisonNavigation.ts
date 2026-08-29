// 差分ジャンプ(次 / 前の差分行へのスクロール)のフックです。
//   - 停止位置は visibleLeft の行順に対を作り、左に無い右行(right-only 等)を visibleRight の
//     行順で末尾に置きます(alignRows の対順と同じ規則。整列表示でも順序が一致します)。
//   - グリッドのハンドル ref はこのフックが生成して返します(leftGridProps={{ ref: leftRef }} で
//     配線)。ref の参照はイベントハンドラ(goTo*)内に限定し、render 中には触りません。
//   - scrollToRow は view index を受け取るため、グリッド側のソート / フィルターを併用すると
//     行位置がずれます(API_REFERENCE の注意を参照)。
import { useCallback, useMemo, useRef, useState } from 'react';
import type { SpreadsheetGridHandle } from '@ishibashi0112/spreadsheet-grid';
import type {
  ComparisonDiffStop,
  UseComparisonNavigationOptions,
  UseComparisonNavigationResult,
} from '../model/types';

export function useComparisonNavigation<T>(
  options: UseComparisonNavigationOptions<T>,
): UseComparisonNavigationResult<T> {
  const { comparison, alignRows = false, align = 'center' } = options;
  const { visibleLeft, visibleRight, leftDiffs, rightDiffs } = comparison;
  const leftRef = useRef<SpreadsheetGridHandle<T> | null>(null);
  const rightRef = useRef<SpreadsheetGridHandle<T> | null>(null);

  const diffStops = useMemo<readonly ComparisonDiffStop<T>[]>(() => {
    const leftIndexByRow = new Map<T, number>();
    visibleLeft.forEach((row, index) => leftIndexByRow.set(row, index));
    const rightIndexByRow = new Map<T, number>();
    visibleRight.forEach((row, index) => rightIndexByRow.set(row, index));

    const stops: ComparisonDiffStop<T>[] = [];
    visibleLeft.forEach((row, index) => {
      const diff = leftDiffs.get(row);
      if (!diff) return;
      const kind = diff.kind;
      if (kind === 'same') return;
      const counterpart = diff.counterpart;
      const rightIndex =
        counterpart !== undefined ? rightIndexByRow.get(counterpart) : undefined;
      stops.push({
        kind,
        leftIndex: index,
        leftRow: row,
        rightIndex,
        rightRow: rightIndex !== undefined ? counterpart : undefined,
      });
    });
    visibleRight.forEach((row, index) => {
      const diff = rightDiffs.get(row);
      if (!diff) return;
      const kind = diff.kind;
      if (kind === 'same') return;
      // 左の走査で対として拾えた行(counterpart が左に見えている)は重複させない。
      if (kind !== 'right-only') {
        const counterpart = diff.counterpart;
        if (counterpart !== undefined && leftIndexByRow.has(counterpart)) return;
      }
      stops.push({ kind, rightIndex: index, rightRow: row });
    });
    return stops;
  }, [visibleLeft, visibleRight, leftDiffs, rightDiffs]);

  // データ(= diffStops)が変わったら現在位置をリセットする(条件付き render 中 setState パターン)。
  const [active, setActive] = useState<{
    stops: readonly ComparisonDiffStop<T>[];
    index: number;
  }>({ stops: diffStops, index: -1 });
  if (active.stops !== diffStops) {
    setActive({ stops: diffStops, index: -1 });
  }
  const activeDiffIndex = active.stops === diffStops ? active.index : -1;

  const goToDiff = useCallback(
    (index: number) => {
      const count = diffStops.length;
      if (count === 0) return;
      const wrapped = ((index % count) + count) % count;
      const stop = diffStops[wrapped];
      const leftIndex = stop.leftIndex ?? (alignRows ? stop.rightIndex : undefined);
      const rightIndex = stop.rightIndex ?? (alignRows ? stop.leftIndex : undefined);
      if (leftIndex !== undefined) leftRef.current?.scrollToRow(leftIndex, { align });
      if (rightIndex !== undefined) rightRef.current?.scrollToRow(rightIndex, { align });
      setActive({ stops: diffStops, index: wrapped });
    },
    [diffStops, alignRows, align],
  );
  const goToNextDiff = useCallback(() => {
    goToDiff(activeDiffIndex + 1);
  }, [goToDiff, activeDiffIndex]);
  const goToPreviousDiff = useCallback(() => {
    goToDiff((activeDiffIndex === -1 ? 0 : activeDiffIndex) - 1);
  }, [goToDiff, activeDiffIndex]);

  return useMemo(
    () => ({
      leftRef,
      rightRef,
      diffStops,
      diffCount: diffStops.length,
      activeDiffIndex,
      canNavigate: diffStops.length > 0,
      goToDiff,
      goToNextDiff,
      goToPreviousDiff,
    }),
    [diffStops, activeDiffIndex, goToDiff, goToNextDiff, goToPreviousDiff],
  );
}
