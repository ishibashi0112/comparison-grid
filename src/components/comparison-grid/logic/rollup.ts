// 木モードのロールアップ(配下の差分行数)の純ロジックです(React / グリッド非依存)。
//   compare() の注釈行と flattenComparisonTree の階層情報から、行ごとに「配下(子孫)にある same 以外の行数」を
//   数えます。自身が same でも配下に差分があれば 1 以上になり、「配下に差分あり」の表示や、
//   「差分のみ」で祖先(文脈行)を残す判定に使います。配下に差分が無い行は Map に載りません。
import type { ComparisonRow, ComparisonTreeInfo } from '../model/types';

/** 行 → 配下(子孫)の差分行数(自身は数えない)。O(差分行数 × 深さ)。 */
export function countDescendantDiffs<T>(
  annotated: readonly ComparisonRow<T>[],
  infos: ReadonlyMap<T, ComparisonTreeInfo<T>>,
): Map<T, number> {
  const counts = new Map<T, number>();
  for (const { row, diff } of annotated) {
    if (diff.kind === 'same') continue;
    let parent = infos.get(row)?.parent;
    while (parent !== undefined) {
      counts.set(parent, (counts.get(parent) ?? 0) + 1);
      parent = infos.get(parent)?.parent;
    }
  }
  return counts;
}
