// 純ロジック compareMany() を React へ接続するフックです(useComparison の N 構成版)。
//   - 「差分のみ表示」の実効値は render 中に導出します(effectiveShowDiffOnly = hasAllSides && showDiffOnly)。
//     いずれかの構成が空だと基準の行が全件 only / partial になり「差分のみ」が全件表示と同義になるため、
//     2-way と同じく hasAllSides(2 構成以上かつ全構成に行がある)を条件にします。
//   - sides / compareFields / labels は参照安定化し、インライン記述でも毎レンダー再計算しないようにします。
//   - alignRows では各構成の visibleRows を整列済み配列(プレースホルダ行つき)にし、「差分のみ」は
//     行位置の単位(いずれかの構成に same 以外があれば残す)でフィルタして整列を維持します。
import { useCallback, useMemo } from 'react';
import type {
  ComparisonMultiRowDiff,
  ComparisonMultiVisibleSide,
  ComparisonSideId,
  ComparisonSideInput,
  UseMultiComparisonOptions,
  UseMultiComparisonResult,
} from '../model/types';
import { compareMany } from '../logic/compareMany';
import { alignComparisonRowsMany } from '../logic/alignRowsMany';
import { useStableArray, useStableObject, useStableValue } from './useStableValue';

const EMPTY_SET: ReadonlySet<never> = new Set();

/** sides は要素ごとに id / rows / label を比較する(要素オブジェクトがインラインでも安定させる)。 */
const sidesEqual = <T>(
  a: readonly ComparisonSideInput<T>[],
  b: readonly ComparisonSideInput<T>[],
): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id || a[i].rows !== b[i].rows || a[i].label !== b[i].label) return false;
  }
  return true;
};

export function useMultiComparison<T>(
  options: UseMultiComparisonOptions<T>,
): UseMultiComparisonResult<T> {
  const {
    showDiffOnly = false,
    getMatchKey,
    baseId,
    formatDiffLabel,
    duplicateKeyPolicy = 'last',
    alignRows = false,
    createPlaceholderRow,
  } = options;
  const sides = useStableValue(options.sides, sidesEqual);
  const compareFields = useStableArray(options.compareFields);
  const labels = useStableObject(options.labels);

  const result = useMemo(
    () =>
      compareMany(sides, {
        getMatchKey,
        compareFields,
        baseId,
        formatDiffLabel,
        labels,
        duplicateKeyPolicy,
      }),
    [sides, getMatchKey, compareFields, baseId, formatDiffLabel, labels, duplicateKeyPolicy],
  );

  const hasAllSides = sides.length >= 2 && sides.every((side) => side.rows.length > 0);
  const effectiveShowDiffOnly = hasAllSides && showDiffOnly;
  const canShowDiffOnly = hasAllSides && result.hasAnyDiff;

  const aligned = useMemo(
    () => (alignRows ? alignComparisonRowsMany(result, { createPlaceholderRow }) : undefined),
    [alignRows, result, createPlaceholderRow],
  );

  // 整列時の「差分のみ」は行位置単位。プレースホルダ(差分 Map に載らない)を含む位置は必ず差分なので残す。
  const visibleSides = useMemo<readonly ComparisonMultiVisibleSide<T>[]>(() => {
    if (aligned) {
      const lists = result.sides.map((side) => aligned.rows.get(side.id) as readonly T[]);
      let keep: boolean[] | undefined;
      if (effectiveShowDiffOnly) {
        keep = [];
        for (let position = 0; position < aligned.rowCount; position += 1) {
          keep.push(
            result.sides.some((side, sideIndex) => {
              const diff = side.diffs.get(lists[sideIndex][position]);
              return diff ? diff.kind !== 'same' : true;
            }),
          );
        }
      }
      return result.sides.map((side, sideIndex) => {
        const list = lists[sideIndex];
        const all = aligned.placeholders.get(side.id) as ReadonlySet<T>;
        const visibleRows = keep ? list.filter((_row, position) => (keep as boolean[])[position]) : list;
        return { ...side, visibleRows, placeholderRows: all };
      });
    }
    return result.sides.map((side) => ({
      ...side,
      visibleRows: effectiveShowDiffOnly
        ? side.annotated.filter((entry) => entry.diff.kind !== 'same').map((entry) => entry.row)
        : side.rows,
      placeholderRows: EMPTY_SET,
    }));
  }, [aligned, result.sides, effectiveShowDiffOnly]);

  const sidesById = useMemo(
    () => new Map<ComparisonSideId, ComparisonMultiVisibleSide<T>>(visibleSides.map((side) => [side.id, side])),
    [visibleSides],
  );

  const getDiff = useCallback(
    (row: T): ComparisonMultiRowDiff<T> | undefined => {
      for (const side of result.sides) {
        const diff = side.diffs.get(row);
        if (diff) return diff;
      }
      return undefined;
    },
    [result.sides],
  );
  const getSide = useCallback((id: ComparisonSideId) => sidesById.get(id), [sidesById]);

  return useMemo(
    () => ({
      baseId: result.baseId,
      pairs: result.pairs,
      hasAnyDiff: result.hasAnyDiff,
      sides: visibleSides,
      sidesById,
      compareFields,
      hasAllSides,
      effectiveShowDiffOnly,
      canShowDiffOnly,
      getDiff,
      getSide,
    }),
    [
      result,
      visibleSides,
      sidesById,
      compareFields,
      hasAllSides,
      effectiveShowDiffOnly,
      canShowDiffOnly,
      getDiff,
      getSide,
    ],
  );
}
