// N 構成比較(基準対各構成)の純ロジックです(React / グリッド非依存)。
//   - 基準(base)を 1 つ選び、他の各構成を基準と 2-way の compare() で突き合わせます(pairs)。
//   - 基準以外のペインの行差分は、その 2-way 結果(自側 = right の注釈)を N 構成の形に写したもの。
//   - 基準ペインの行差分は、各構成との結果の集約: fieldDiffs は和集合、missingIn に「無い構成」を持ち、
//     kind は field-diff > partial(一部に無い)> only(どこにも無い)> same の優先順で決めます。
//   - 行 T には書き込まず、構成ごとの ComparisonMultiRow(行 + 差分)と Map<行, 差分> を返します。
//   - 計算量は構成数を k として O(k × (基準の行数 + その構成の行数))。基準の索引は構成ごとに作り直しますが、
//     k は高々数個のため許容しています。
import type {
  CompareField,
  CompareManyOptions,
  ComparisonMultiDiffKind,
  ComparisonMultiLabels,
  ComparisonMultiResult,
  ComparisonMultiRow,
  ComparisonMultiRowDiff,
  ComparisonMultiSideResult,
  ComparisonMultiSideSummary,
  ComparisonResult,
  ComparisonRowDiff,
  ComparisonSideId,
  ComparisonSideInfo,
  ComparisonSideInput,
  MultiDiffLabelContext,
} from '../model/types';
import { compare, DEFAULT_COMPARISON_LABELS } from './compare';

/** N 構成比較の既定文言(日本語)。labels オプションで部分上書きできます。 */
export const DEFAULT_COMPARISON_MULTI_LABELS: ComparisonMultiLabels = {
  fieldDiffSeparator: DEFAULT_COMPARISON_LABELS.fieldDiffSeparator,
  fieldDiffSuffix: DEFAULT_COMPARISON_LABELS.fieldDiffSuffix,
  baseOnly: '基準のみ',
  sideOnly: 'この構成のみ',
  missingInSide: '無し',
  sideSeparator: ' / ',
  sideLabelSeparator: ': ',
};

const joinFieldLabels = <T>(
  fields: readonly CompareField<T>[],
  labels: ComparisonMultiLabels,
): string => fields.map((field) => field.label).join(labels.fieldDiffSeparator) + labels.fieldDiffSuffix;

/** 既定のラベル生成。
 *  - 基準以外のペイン: only → labels.sideOnly / field-diff → `数量・支給区分違い` / same → ''。
 *  - 基準ペイン: only → labels.baseOnly / same → '' / partial・field-diff → 構成ごとの内訳を
 *    構成の入力順に連結(`案1: 数量違い / 案2: 無し`)。基準以外が 1 構成だけのときは構成名の接頭辞を
 *    省き、2-way と同じ見た目(`数量違い` / `無し`)になります。 */
export const formatDefaultMultiDiffLabel = <T>(ctx: MultiDiffLabelContext<T>): string => {
  const { labels } = ctx;
  if (ctx.kind === 'same') return '';
  if (ctx.kind === 'only') return ctx.isBase ? labels.baseOnly : labels.sideOnly;
  if (!ctx.isBase) return joinFieldLabels(ctx.diffFields, labels);

  const others = ctx.sides.filter((side) => !side.isBase);
  const withPrefix = others.length > 1;
  const parts: string[] = [];
  for (const side of others) {
    let detail: string | undefined;
    if (ctx.missingIn.has(side.id)) {
      detail = labels.missingInSide;
    } else {
      const pair = ctx.bySide.get(side.id);
      if (pair && pair.kind === 'field-diff') {
        // 2-way 側のラベルは fieldDiffSeparator / fieldDiffSuffix を共有しているためそのまま使える。
        detail = pair.label;
      }
    }
    if (detail === undefined) continue;
    parts.push(withPrefix ? `${side.label}${labels.sideLabelSeparator}${detail}` : detail);
  }
  return parts.join(labels.sideSeparator);
};

const EMPTY_KEY_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_FIELDS: readonly never[] = [];

const pickDiffFields = <T>(
  compareFields: readonly CompareField<T>[],
  fieldDiffs: ReadonlySet<string>,
): readonly CompareField<T>[] =>
  fieldDiffs.size === 0 ? EMPTY_FIELDS : compareFields.filter((field) => fieldDiffs.has(field.key));

const createSummary = (total: number): ComparisonMultiSideSummary => ({
  total,
  same: 0,
  only: 0,
  partial: 0,
  fieldDiff: 0,
});

const countKind = (summary: ComparisonMultiSideSummary, kind: ComparisonMultiDiffKind): void => {
  if (kind === 'same') summary.same += 1;
  else if (kind === 'only') summary.only += 1;
  else if (kind === 'partial') summary.partial += 1;
  else summary.fieldDiff += 1;
};

/** 構成内で重複した突き合わせキー(出現順)。 */
const findDuplicateKeys = <T>(rows: readonly T[], getMatchKey: (row: T) => string): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const key = getMatchKey(row);
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }
  return [...duplicates];
};

const resolveSides = <T>(
  sides: readonly ComparisonSideInput<T>[],
  baseId: ComparisonSideId | undefined,
): { infos: ComparisonSideInfo[]; baseId: ComparisonSideId } => {
  if (sides.length === 0) throw new Error('compareMany: sides が空です。');
  const ids = new Set<string>();
  for (const side of sides) {
    if (ids.has(side.id)) throw new Error(`compareMany: 構成 ID が重複しています: ${side.id}`);
    ids.add(side.id);
  }
  const resolvedBaseId = baseId ?? sides[0].id;
  if (!ids.has(resolvedBaseId)) {
    throw new Error(`compareMany: baseId "${resolvedBaseId}" が sides にありません。`);
  }
  const infos = sides.map<ComparisonSideInfo>((side) => ({
    id: side.id,
    label: side.label ?? side.id,
    isBase: side.id === resolvedBaseId,
  }));
  return { infos, baseId: resolvedBaseId };
};

/** N 構成を基準対各構成で突き合わせて差分情報を返します(純関数)。 */
export function compareMany<T>(
  sides: readonly ComparisonSideInput<T>[],
  options: CompareManyOptions<T>,
): ComparisonMultiResult<T> {
  const {
    getMatchKey,
    compareFields,
    duplicateKeyPolicy = 'last',
    formatDiffLabel = formatDefaultMultiDiffLabel,
  } = options;
  const labels: ComparisonMultiLabels = { ...DEFAULT_COMPARISON_MULTI_LABELS, ...options.labels };
  const { infos, baseId } = resolveSides(sides, options.baseId);
  const base = sides.find((side) => side.id === baseId) as ComparisonSideInput<T>;
  const others = sides.filter((side) => side.id !== baseId);

  // 基準と各構成の 2-way 比較。2-way 側の片側ラベルは N 構成の文言に合わせる。
  const pairs = new Map<ComparisonSideId, ComparisonResult<T>>();
  for (const other of others) {
    pairs.set(
      other.id,
      compare(base.rows, other.rows, {
        getMatchKey,
        compareFields,
        duplicateKeyPolicy,
        labels: {
          leftOnly: labels.baseOnly,
          rightOnly: labels.sideOnly,
          fieldDiffSeparator: labels.fieldDiffSeparator,
          fieldDiffSuffix: labels.fieldDiffSuffix,
        },
      }),
    );
  }

  const labelOf = (
    row: T,
    partial: Omit<ComparisonMultiRowDiff<T>, 'label'>,
  ): string =>
    formatDiffLabel({
      sideId: partial.sideId,
      isBase: partial.isBase,
      kind: partial.kind,
      row,
      fieldDiffs: partial.fieldDiffs,
      diffFields: pickDiffFields(compareFields, partial.fieldDiffs),
      missingIn: partial.missingIn,
      bySide: partial.bySide,
      sides: infos,
      labels,
    });

  const results: ComparisonMultiSideResult<T>[] = [];
  let hasAnyDiff = false;

  for (const info of infos) {
    const input = sides.find((side) => side.id === info.id) as ComparisonSideInput<T>;
    const annotated: ComparisonMultiRow<T>[] = [];
    const diffs = new Map<T, ComparisonMultiRowDiff<T>>();
    const summary = createSummary(input.rows.length);
    let duplicateKeys: readonly string[];

    if (info.isBase) {
      // 基準ペイン: 各構成との 2-way 結果(基準側 = left の注釈)を集約する。
      duplicateKeys = findDuplicateKeys(input.rows, getMatchKey);
      for (const row of input.rows) {
        const missingIn = new Set<ComparisonSideId>();
        const counterparts = new Map<ComparisonSideId, T>();
        const bySide = new Map<ComparisonSideId, ComparisonRowDiff<T>>();
        const fieldDiffs = new Set<string>();
        let matchKey: string | undefined;
        for (const other of others) {
          const pairDiff = (pairs.get(other.id) as ComparisonResult<T>).leftDiffs.get(row);
          if (!pairDiff) continue;
          matchKey = pairDiff.matchKey;
          bySide.set(other.id, pairDiff);
          if (pairDiff.kind === 'left-only') {
            missingIn.add(other.id);
            continue;
          }
          if (pairDiff.counterpart !== undefined) counterparts.set(other.id, pairDiff.counterpart);
          for (const key of pairDiff.fieldDiffs) fieldDiffs.add(key);
        }
        const kind: ComparisonMultiDiffKind =
          fieldDiffs.size > 0
            ? 'field-diff'
            : missingIn.size === 0
              ? 'same'
              : missingIn.size === others.length
                ? 'only'
                : 'partial';
        const partial: Omit<ComparisonMultiRowDiff<T>, 'label'> = {
          sideId: info.id,
          isBase: true,
          kind,
          matchKey: matchKey ?? getMatchKey(row),
          fieldDiffs: fieldDiffs.size > 0 ? fieldDiffs : EMPTY_KEY_SET,
          missingIn,
          counterparts,
          bySide,
        };
        const diff: ComparisonMultiRowDiff<T> = { ...partial, label: labelOf(row, partial) };
        annotated.push({ row, diff });
        diffs.set(row, diff);
        countKind(summary, kind);
      }
    } else {
      // 基準以外のペイン: 基準との 2-way 結果(自側 = right の注釈)をそのまま写す。
      const pair = pairs.get(info.id) as ComparisonResult<T>;
      duplicateKeys = pair.duplicateKeys.right;
      for (const entry of pair.annotatedRight) {
        const pairDiff = entry.diff;
        const kind: ComparisonMultiDiffKind =
          pairDiff.kind === 'right-only' ? 'only' : pairDiff.kind === 'field-diff' ? 'field-diff' : 'same';
        const counterparts = new Map<ComparisonSideId, T>();
        if (pairDiff.counterpart !== undefined) counterparts.set(baseId, pairDiff.counterpart);
        const partial: Omit<ComparisonMultiRowDiff<T>, 'label'> = {
          sideId: info.id,
          isBase: false,
          kind,
          matchKey: pairDiff.matchKey,
          fieldDiffs: pairDiff.fieldDiffs,
          missingIn: EMPTY_KEY_SET,
          counterparts,
          bySide: new Map([[baseId, pairDiff]]),
        };
        const diff: ComparisonMultiRowDiff<T> = { ...partial, label: labelOf(entry.row, partial) };
        annotated.push({ row: entry.row, diff });
        diffs.set(entry.row, diff);
        countKind(summary, kind);
      }
    }

    if (summary.same !== summary.total) hasAnyDiff = true;
    results.push({ ...info, rows: input.rows, annotated, diffs, summary, duplicateKeys });
  }

  return {
    baseId,
    sides: results,
    sidesById: new Map(results.map((side) => [side.id, side])),
    pairs,
    hasAnyDiff,
  };
}
