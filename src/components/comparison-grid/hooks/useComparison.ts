// 純ロジック compare() を React へ接続するフックです。
//   - 「差分のみ表示」の実効値は state を同期せず render 中に導出します
//     (effectiveShowDiffOnly = hasBothSides && showDiffOnly。ss2602 の学び)。
//   - 片側のみのデータでは全件が left-only / right-only になり「差分のみ」が全件表示と同義になるため、
//     トグルの有効条件 canShowDiffOnly(= hasBothSides && hasAnyDiff)を返します。
//   - compareFields / labels は参照安定化し、インライン記述でも毎レンダー再計算しないようにします。
import { useCallback, useMemo } from 'react';
import type {
  ComparisonRowDiff,
  UseComparisonOptions,
  UseComparisonResult,
} from '../model/types';
import { compare } from '../logic/compare';
import { useStableArray, useStableObject } from './useStableValue';

export function useComparison<T>(options: UseComparisonOptions<T>): UseComparisonResult<T> {
  const {
    left,
    right,
    showDiffOnly = false,
    getMatchKey,
    formatDiffLabel,
    duplicateKeyPolicy = 'last',
  } = options;
  const compareFields = useStableArray(options.compareFields);
  const labels = useStableObject(options.labels);

  const result = useMemo(
    () =>
      compare(left, right, {
        getMatchKey,
        compareFields,
        formatDiffLabel,
        labels,
        duplicateKeyPolicy,
      }),
    [left, right, getMatchKey, compareFields, formatDiffLabel, labels, duplicateKeyPolicy],
  );

  const hasBothSides = left.length > 0 && right.length > 0;
  const effectiveShowDiffOnly = hasBothSides && showDiffOnly;
  const canShowDiffOnly = hasBothSides && result.hasAnyDiff;

  const visibleLeft = useMemo<readonly T[]>(
    () =>
      effectiveShowDiffOnly
        ? result.annotatedLeft.filter((entry) => entry.diff.kind !== 'same').map((entry) => entry.row)
        : left,
    [effectiveShowDiffOnly, result.annotatedLeft, left],
  );
  const visibleRight = useMemo<readonly T[]>(
    () =>
      effectiveShowDiffOnly
        ? result.annotatedRight.filter((entry) => entry.diff.kind !== 'same').map((entry) => entry.row)
        : right,
    [effectiveShowDiffOnly, result.annotatedRight, right],
  );

  const getDiff = useCallback(
    (row: T): ComparisonRowDiff<T> | undefined =>
      result.leftDiffs.get(row) ?? result.rightDiffs.get(row),
    [result],
  );

  return useMemo(
    () => ({
      ...result,
      compareFields,
      visibleLeft,
      visibleRight,
      hasBothSides,
      effectiveShowDiffOnly,
      canShowDiffOnly,
      getDiff,
    }),
    [
      result,
      compareFields,
      visibleLeft,
      visibleRight,
      hasBothSides,
      effectiveShowDiffOnly,
      canShowDiffOnly,
      getDiff,
    ],
  );
}
