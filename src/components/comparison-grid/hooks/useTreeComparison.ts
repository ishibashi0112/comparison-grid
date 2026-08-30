// 階層比較(木)を React へ接続するフックです(useComparison の木版)。
//   - 左右の木を flattenComparisonTree で深さ優先に平坦化し、導出したパスキーで compare() を回します。
//     利用側は getMatchKey を書かず、getCode(+ getRepresentativeCode)を渡すだけです。
//   - alignRows では alignComparisonTree(構造マージ)で整列します(右のみサブツリーは兄弟の位置へ)。
//   - 「差分のみ」は差分行に加えて**その祖先(文脈行)**を残します。C3001 の差分が「どの ASSY の」か
//     分かるようにするためで、文脈行は contextRows で返し ComparisonView が .cmpg-row-context を付与します。
//     alignRows では対の単位でフィルタし整列を維持します。
//   - ロールアップ(行 → 配下の差分行数)を descendantDiffCounts で返します。文脈行の判定もこれを使います
//     (文脈行 = 自身は same で配下に差分がある行)。ComparisonView は .cmpg-row-rollup と配下差分ラベルに使います。
//   - getTreeInfo(row) で深さ / 親 / 子の有無 / 出現番号 / キーを引けます(サイドカー。T には書きません)。
//   - visibleLeft / visibleRight は平坦化した配列で、入力(木)と同一参照にはなりません(木が同じ参照なら安定)。
import { useCallback, useMemo } from 'react';
import type {
  ComparisonContextRows,
  ComparisonDescendantDiffCounts,
  ComparisonPlaceholders,
  ComparisonRow,
  ComparisonRowDiff,
  ComparisonTreeInfo,
  UseTreeComparisonOptions,
  UseTreeComparisonResult,
} from '../model/types';
import { compare } from '../logic/compare';
import { flattenComparisonTree } from '../logic/tree';
import { alignComparisonTree } from '../logic/alignTree';
import { countDescendantDiffs } from '../logic/rollup';
import { useStableArray, useStableObject } from './useStableValue';

const EMPTY_SET: ReadonlySet<never> = new Set();
const EMPTY_PLACEHOLDERS: ComparisonPlaceholders<never> = { left: EMPTY_SET, right: EMPTY_SET };
const EMPTY_CONTEXT: ComparisonContextRows<never> = { left: EMPTY_SET, right: EMPTY_SET };

type KeptRows<T> = {
  /** 表示に残す行(差分行 + 文脈行)。 */
  rows: ReadonlySet<T>;
  /** そのうち文脈行(kind は same だが差分行の祖先)。 */
  context: ReadonlySet<T>;
};

/** 「差分のみ」で残す行を集める: 差分行 + 文脈行(自身は same だが配下に差分がある行 = ロールアップ > 0)。 */
const collectKeptRows = <T>(
  annotated: readonly ComparisonRow<T>[],
  descendantDiffCounts: ReadonlyMap<T, number>,
): KeptRows<T> => {
  const rows = new Set<T>();
  const context = new Set<T>();
  for (const { row, diff } of annotated) {
    if (diff.kind !== 'same') {
      rows.add(row);
    } else if (descendantDiffCounts.has(row)) {
      rows.add(row);
      context.add(row);
    }
  }
  return { rows, context };
};

export function useTreeComparison<T>(
  options: UseTreeComparisonOptions<T>,
): UseTreeComparisonResult<T> {
  const {
    left,
    right,
    getCode,
    getRepresentativeCode,
    separator,
    showDiffOnly = false,
    formatDiffLabel,
    duplicateKeyPolicy = 'last',
    alignRows = false,
    createPlaceholderRow,
  } = options;
  const compareFields = useStableArray(options.compareFields);
  const labels = useStableObject(options.labels);

  const flatLeft = useMemo(
    () => flattenComparisonTree(left, { getCode, getRepresentativeCode, separator }),
    [left, getCode, getRepresentativeCode, separator],
  );
  const flatRight = useMemo(
    () => flattenComparisonTree(right, { getCode, getRepresentativeCode, separator }),
    [right, getCode, getRepresentativeCode, separator],
  );

  // 突き合わせキーはサイドカー(infos)から引く。木に無い行(通常は来ない)は自コードにフォールバック。
  const getMatchKey = useCallback(
    (row: T): string =>
      flatLeft.infos.get(row)?.matchKey ?? flatRight.infos.get(row)?.matchKey ?? getCode(row),
    [flatLeft, flatRight, getCode],
  );

  const result = useMemo(
    () =>
      compare(flatLeft.rows, flatRight.rows, {
        getMatchKey,
        compareFields,
        formatDiffLabel,
        labels,
        duplicateKeyPolicy,
      }),
    [flatLeft, flatRight, getMatchKey, compareFields, formatDiffLabel, labels, duplicateKeyPolicy],
  );

  const hasBothSides = flatLeft.rows.length > 0 && flatRight.rows.length > 0;
  const effectiveShowDiffOnly = hasBothSides && showDiffOnly;
  const canShowDiffOnly = hasBothSides && result.hasAnyDiff;

  const aligned = useMemo(
    () =>
      alignRows ? alignComparisonTree(left, right, result.leftDiffs, { createPlaceholderRow }) : undefined,
    [alignRows, left, right, result, createPlaceholderRow],
  );

  const descendantDiffCounts = useMemo<ComparisonDescendantDiffCounts<T>>(
    () => ({
      left: countDescendantDiffs(result.annotatedLeft, flatLeft.infos),
      right: countDescendantDiffs(result.annotatedRight, flatRight.infos),
    }),
    [result, flatLeft, flatRight],
  );

  const kept = useMemo(
    () =>
      effectiveShowDiffOnly
        ? {
            left: collectKeptRows(result.annotatedLeft, descendantDiffCounts.left),
            right: collectKeptRows(result.annotatedRight, descendantDiffCounts.right),
          }
        : undefined,
    [effectiveShowDiffOnly, result, descendantDiffCounts],
  );

  // alignRows では対の単位でフィルタし、左右の行位置対応を保つ(どちらかの側が残す行なら対ごと残す)。
  const visiblePairs = useMemo(() => {
    if (!aligned) return undefined;
    if (!kept) return aligned.pairs;
    return aligned.pairs.filter(
      (pair) => kept.left.rows.has(pair.left) || kept.right.rows.has(pair.right),
    );
  }, [aligned, kept]);

  const visibleLeft = useMemo<readonly T[]>(() => {
    if (visiblePairs) return visiblePairs.map((pair) => pair.left);
    if (!kept) return flatLeft.rows;
    return flatLeft.rows.filter((row) => kept.left.rows.has(row));
  }, [visiblePairs, kept, flatLeft]);
  const visibleRight = useMemo<readonly T[]>(() => {
    if (visiblePairs) return visiblePairs.map((pair) => pair.right);
    if (!kept) return flatRight.rows;
    return flatRight.rows.filter((row) => kept.right.rows.has(row));
  }, [visiblePairs, kept, flatRight]);

  const placeholders = aligned?.placeholders ?? EMPTY_PLACEHOLDERS;
  const contextRows = useMemo<ComparisonContextRows<T>>(
    () => (kept ? { left: kept.left.context, right: kept.right.context } : EMPTY_CONTEXT),
    [kept],
  );

  const getDiff = useCallback(
    (row: T): ComparisonRowDiff<T> | undefined =>
      result.leftDiffs.get(row) ?? result.rightDiffs.get(row),
    [result],
  );
  const getTreeInfo = useCallback(
    (row: T): ComparisonTreeInfo<T> | undefined =>
      flatLeft.infos.get(row) ?? flatRight.infos.get(row),
    [flatLeft, flatRight],
  );
  const getDescendantDiffCount = useCallback(
    (row: T): number =>
      descendantDiffCounts.left.get(row) ?? descendantDiffCounts.right.get(row) ?? 0,
    [descendantDiffCounts],
  );

  return useMemo(
    () => ({
      ...result,
      compareFields,
      visibleLeft,
      visibleRight,
      placeholders,
      contextRows,
      hasBothSides,
      effectiveShowDiffOnly,
      canShowDiffOnly,
      getDiff,
      getTreeInfo,
      descendantDiffCounts,
      getDescendantDiffCount,
    }),
    [
      result,
      compareFields,
      visibleLeft,
      visibleRight,
      placeholders,
      contextRows,
      hasBothSides,
      effectiveShowDiffOnly,
      canShowDiffOnly,
      getDiff,
      getTreeInfo,
      descendantDiffCounts,
      getDescendantDiffCount,
    ],
  );
}
