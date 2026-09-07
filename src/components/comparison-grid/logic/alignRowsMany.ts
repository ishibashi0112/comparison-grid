// N 構成の整列モードの純ロジックです(React / グリッド非依存)。alignComparisonRows の N 構成版。
//   compareMany() の結果を「同じ行位置 = 同じ突き合わせ相手」になるよう構成ごとの配列へ並べ直し、
//   欠損側にプレースホルダ行を挿入します。
//   - 並び順: 基準の行順を軸に、各構成の対応行(基準行の counterparts)を同じ行位置へ置く。
//     基準に無い行は「構成の入力順 → その構成内の行順」で末尾に足し、同じ突き合わせキーを持つ他構成の
//     行は同じ行位置にまとめる(基準対各構成では比較されないが、目視で並ぶよう位置だけ揃える)。
//   - キー重複で複数の基準行が同じ相手を指す場合、相手は先に対になった行が消費し、残りはプレースホルダと組む。
//   - プレースホルダは行ごとに新しいオブジェクト(既定 `{} as T`)で、差分 Map には載らない。
//     判定は placeholders の Set(同一性)で行う。
import type {
  AlignComparisonRowsManyOptions,
  AlignComparisonRowsManyResult,
  ComparisonMultiResult,
  ComparisonSideId,
} from '../model/types';

const defaultCreatePlaceholderRow = <T>(): T => ({}) as T;

/** compareMany() の結果を構成ごとの整列済み配列にします(純関数)。 */
export function alignComparisonRowsMany<T>(
  result: ComparisonMultiResult<T>,
  options?: AlignComparisonRowsManyOptions<T>,
): AlignComparisonRowsManyResult<T> {
  const createPlaceholderRow = options?.createPlaceholderRow ?? defaultCreatePlaceholderRow;
  const { baseId, sides } = result;
  const base = result.sidesById.get(baseId);
  if (!base) throw new Error(`alignComparisonRowsMany: baseId "${baseId}" が結果にありません。`);
  const others = sides.filter((side) => !side.isBase);

  // 行位置ごとの「構成 ID → 行」。
  const positions: Map<ComparisonSideId, T>[] = [];
  const consumed = new Set<T>();

  // 1) 基準の行順を軸に対を作る。
  for (const entry of base.annotated) {
    const cells = new Map<ComparisonSideId, T>([[baseId, entry.row]]);
    for (const other of others) {
      const counterpart = entry.diff.counterparts.get(other.id);
      if (counterpart !== undefined && !consumed.has(counterpart)) {
        consumed.add(counterpart);
        cells.set(other.id, counterpart);
      }
    }
    positions.push(cells);
  }

  // 2) 基準に無い行(only / キー重複の残り)を末尾へ。同じキーの他構成の行は同じ行位置にまとめる。
  const queues = new Map<ComparisonSideId, Map<string, T[]>>();
  for (const other of others) {
    const byKey = new Map<string, T[]>();
    for (const entry of other.annotated) {
      if (consumed.has(entry.row)) continue;
      const list = byKey.get(entry.diff.matchKey);
      if (list) list.push(entry.row);
      else byKey.set(entry.diff.matchKey, [entry.row]);
    }
    queues.set(other.id, byKey);
  }
  others.forEach((other, index) => {
    for (const entry of other.annotated) {
      if (consumed.has(entry.row)) continue;
      consumed.add(entry.row);
      const cells = new Map<ComparisonSideId, T>([[other.id, entry.row]]);
      for (const later of others.slice(index + 1)) {
        const list = queues.get(later.id)?.get(entry.diff.matchKey);
        if (!list) continue;
        const candidate = list.find((row) => !consumed.has(row));
        if (candidate === undefined) continue;
        consumed.add(candidate);
        cells.set(later.id, candidate);
      }
      positions.push(cells);
    }
  });

  // 3) 構成ごとの配列に展開し、欠損をプレースホルダで埋める。
  const rows = new Map<ComparisonSideId, readonly T[]>();
  const placeholders = new Map<ComparisonSideId, ReadonlySet<T>>();
  for (const side of sides) {
    const placeholderSet = new Set<T>();
    const list = positions.map((cells) => {
      const row = cells.get(side.id);
      if (row !== undefined) return row;
      const placeholder = createPlaceholderRow(side.id);
      placeholderSet.add(placeholder);
      return placeholder;
    });
    rows.set(side.id, list);
    placeholders.set(side.id, placeholderSet);
  }

  return { rows, placeholders, rowCount: positions.length };
}
