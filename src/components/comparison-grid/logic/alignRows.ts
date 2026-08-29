// 左右整列モードの純ロジックです(React / グリッド非依存)。
//   compare() の注釈行(annotatedLeft / annotatedRight)を突き合わせ順に並べ、欠損側に
//   プレースホルダ行を挿入して「左右の同じ行位置 = 同じ突き合わせ相手」にします。
//   - 並び順: 左の行順を基準に対を作り、左と対にならなかった右行(right-only や重複の残り)を
//     右の行順で末尾に足します。
//   - キー重複で複数行が同じ相手を指す場合、相手は先に対になった行が消費し、残りは
//     プレースホルダと組みます(重複キーは compare() の duplicateKeys で報告済み)。
//   - プレースホルダは行ごとに新しいオブジェクト(既定 `{} as T`)で、行 T には書き込みません。
//     判定は placeholders の Set(同一性)で行います。差分 Map に載らないため、
//     ハイライトや差分ラベルは自動的に対象外になります。
import type {
  AlignComparisonRowsOptions,
  AlignComparisonRowsResult,
  ComparisonAlignedPair,
  ComparisonRow,
} from '../model/types';

const defaultCreatePlaceholderRow = <T>(): T => ({}) as T;

/** 左右の注釈行を突き合わせ順に整列し、欠損側へプレースホルダ行を挿入します(純関数)。 */
export function alignComparisonRows<T>(
  annotatedLeft: readonly ComparisonRow<T>[],
  annotatedRight: readonly ComparisonRow<T>[],
  options?: AlignComparisonRowsOptions<T>,
): AlignComparisonRowsResult<T> {
  const createPlaceholderRow = options?.createPlaceholderRow ?? defaultCreatePlaceholderRow;
  const pairs: ComparisonAlignedPair<T>[] = [];
  const leftPlaceholders = new Set<T>();
  const rightPlaceholders = new Set<T>();
  const consumedRight = new Set<T>();

  for (const entry of annotatedLeft) {
    const counterpart = entry.diff.counterpart;
    if (counterpart !== undefined && !consumedRight.has(counterpart)) {
      consumedRight.add(counterpart);
      pairs.push({ left: entry.row, right: counterpart });
    } else {
      const placeholder = createPlaceholderRow('right');
      rightPlaceholders.add(placeholder);
      pairs.push({ left: entry.row, right: placeholder });
    }
  }

  for (const entry of annotatedRight) {
    if (consumedRight.has(entry.row)) continue;
    const placeholder = createPlaceholderRow('left');
    leftPlaceholders.add(placeholder);
    pairs.push({ left: placeholder, right: entry.row });
  }

  return {
    pairs,
    placeholders: { left: leftPlaceholders, right: rightPlaceholders },
  };
}
