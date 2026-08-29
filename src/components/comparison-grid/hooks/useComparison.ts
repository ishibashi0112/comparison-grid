// 純ロジック compare() を React へ接続するフックです。
//   - 「差分のみ表示」の実効値は state を同期せず render 中に導出します
//     (effectiveShowDiffOnly = hasBothSides && showDiffOnly。ss2602 の学び)。
//   - 片側のみのデータでは全件が left-only / right-only になり「差分のみ」が全件表示と同義になるため、
//     トグルの有効条件 canShowDiffOnly(= hasBothSides && hasAnyDiff)を返します。
//   - compareFields / labels は参照安定化し、インライン記述でも毎レンダー再計算しないようにします。
//   - alignRows(左右整列モード)では visibleLeft / visibleRight を整列済み配列(プレースホルダ行つき)
//     にし、「差分のみ」は対の単位でフィルタして整列を維持します。
import { useCallback, useMemo } from 'react';
import type {
  ComparisonPlaceholders,
  ComparisonRowDiff,
  UseComparisonOptions,
  UseComparisonResult,
} from '../model/types';
import { compare } from '../logic/compare';
import { alignComparisonRows } from '../logic/alignRows';
import { useStableArray, useStableObject } from './useStableValue';

const EMPTY_SET: ReadonlySet<never> = new Set();
const EMPTY_PLACEHOLDERS: ComparisonPlaceholders<never> = { left: EMPTY_SET, right: EMPTY_SET };

export function useComparison<T>(options: UseComparisonOptions<T>): UseComparisonResult<T> {
  const {
    left,
    right,
    showDiffOnly = false,
    getMatchKey,
    formatDiffLabel,
    duplicateKeyPolicy = 'last',
    alignRows = false,
    createPlaceholderRow,
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

  const aligned = useMemo(
    () =>
      alignRows
        ? alignComparisonRows(result.annotatedLeft, result.annotatedRight, { createPlaceholderRow })
        : undefined,
    [alignRows, result, createPlaceholderRow],
  );

  // alignRows では「差分のみ」も対の単位でフィルタし、左右の行位置対応を保つ。
  //   左がプレースホルダの対(= 右が right-only)は diffs に載らないため常に残す。
  const visiblePairs = useMemo(() => {
    if (!aligned) return undefined;
    if (!effectiveShowDiffOnly) return aligned.pairs;
    return aligned.pairs.filter((pair) => {
      const diff = result.leftDiffs.get(pair.left);
      return diff ? diff.kind !== 'same' : true;
    });
  }, [aligned, effectiveShowDiffOnly, result.leftDiffs]);

  const visibleLeft = useMemo<readonly T[]>(() => {
    if (visiblePairs) return visiblePairs.map((pair) => pair.left);
    if (!effectiveShowDiffOnly) return left;
    return result.annotatedLeft.filter((entry) => entry.diff.kind !== 'same').map((entry) => entry.row);
  }, [visiblePairs, effectiveShowDiffOnly, result.annotatedLeft, left]);
  const visibleRight = useMemo<readonly T[]>(() => {
    if (visiblePairs) return visiblePairs.map((pair) => pair.right);
    if (!effectiveShowDiffOnly) return right;
    return result.annotatedRight.filter((entry) => entry.diff.kind !== 'same').map((entry) => entry.row);
  }, [visiblePairs, effectiveShowDiffOnly, result.annotatedRight, right]);

  const placeholders = aligned?.placeholders ?? EMPTY_PLACEHOLDERS;

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
      placeholders,
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
      placeholders,
      hasBothSides,
      effectiveShowDiffOnly,
      canShowDiffOnly,
      getDiff,
    ],
  );
}
