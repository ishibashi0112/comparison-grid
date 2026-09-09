// N 構成比較の純ロジックです(React / グリッド非依存)。意味論は mode で選びます。
//   - mode 'base'(既定): 基準(base)を 1 つ選び、他の各構成を基準と 2-way の compare() で突き合わせます(pairs)。
//     基準以外のペインの行差分は、その 2-way 結果(自側 = right の注釈)を N 構成の形に写したもの。
//     基準ペインの行差分は、各構成との結果の集約: fieldDiffs は和集合、missingIn に「無い構成」を持ちます。
//   - mode 'all': 基準なし。各ペインの各行を「他の全構成」と突き合わせ、全構成に存在し全構成で一致するときだけ
//     same。内訳(missingIn / fieldDiffs / bySide)は自分から見た他の各構成。equals は (自分の値, 相手の値) の順で呼びます。
//   - kind は field-diff > partial(一部に無い)> only(どこにも無い)> same の優先順で決めます。
//   - 行 T には書き込まず、構成ごとの ComparisonMultiRow(行 + 差分)と Map<行, 差分> を返します。
//   - 計算量は構成数を k、行数を n として O(k² × n)(各構成の索引は 1 回、突き合わせは構成の対ごと)。k は高々数個。
import type {
  CompareField,
  CompareManyOptions,
  ComparisonMultiDiffKind,
  ComparisonMultiLabels,
  ComparisonMultiMode,
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
  DuplicateKeyPolicy,
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
 *  - base モードの基準以外のペイン: only → labels.sideOnly / field-diff → `数量・支給区分違い` / same → ''。
 *  - 基準ペイン、および mode 'all' の各ペイン: only → labels.baseOnly(基準)/ labels.sideOnly(mode 'all')、
 *    same → ''、partial・field-diff → 他の構成ごとの内訳を構成の入力順に連結(`案1: 数量違い / 案2: 無し`)。
 *    相手が 1 構成だけのときは構成名の接頭辞を省き、2-way と同じ見た目(`数量違い` / `無し`)になります。 */
export const formatDefaultMultiDiffLabel = <T>(ctx: MultiDiffLabelContext<T>): string => {
  const { labels } = ctx;
  if (ctx.kind === 'same') return '';
  if (ctx.kind === 'only') return ctx.isBase ? labels.baseOnly : labels.sideOnly;
  if (!ctx.isBase && ctx.mode !== 'all') return joinFieldLabels(ctx.diffFields, labels);

  const others = ctx.sides.filter((side) => side.id !== ctx.sideId);
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

const readFieldValue = <T>(field: CompareField<T>, row: T): unknown => {
  if (field.getValue) return field.getValue(row);
  if (row === null || row === undefined) return undefined;
  return (row as unknown as Record<string, unknown>)[field.key];
};

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

/** fieldDiffs / missingIn から kind を決める(優先順: field-diff > partial > only > same)。 */
const resolveKind = (
  fieldDiffCount: number,
  missingCount: number,
  otherCount: number,
): ComparisonMultiDiffKind =>
  fieldDiffCount > 0
    ? 'field-diff'
    : missingCount === 0
      ? 'same'
      : missingCount === otherCount
        ? 'only'
        : 'partial';

type KeyIndex<T> = {
  byKey: Map<string, T>;
  duplicates: string[];
};

/** 構成内の行を突き合わせキーで索引し、重複キー(出現順)も報告する(compare() と同じ規則)。 */
const indexRows = <T>(
  rows: readonly T[],
  getMatchKey: (row: T) => string,
  policy: DuplicateKeyPolicy,
): KeyIndex<T> => {
  const byKey = new Map<string, T>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const key = getMatchKey(row);
    if (byKey.has(key)) {
      duplicates.add(key);
      if (policy === 'last') byKey.set(key, row);
      continue;
    }
    byKey.set(key, row);
  }
  return { byKey, duplicates: [...duplicates] };
};

const resolveSides = <T>(
  sides: readonly ComparisonSideInput<T>[],
  mode: ComparisonMultiMode,
  baseId: ComparisonSideId | undefined,
): { infos: ComparisonSideInfo[]; baseId: ComparisonSideId | undefined; axisId: ComparisonSideId } => {
  if (sides.length === 0) throw new Error('compareMany: sides が空です。');
  const ids = new Set<string>();
  for (const side of sides) {
    if (ids.has(side.id)) throw new Error(`compareMany: 構成 ID が重複しています: ${side.id}`);
    ids.add(side.id);
  }
  if (mode === 'all') {
    return {
      infos: sides.map((side) => ({ id: side.id, label: side.label ?? side.id, isBase: false })),
      baseId: undefined,
      axisId: sides[0].id,
    };
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
  return { infos, baseId: resolvedBaseId, axisId: resolvedBaseId };
};

/** N 構成を突き合わせて差分情報を返します(純関数)。意味論は options.mode('base' / 'all')。 */
export function compareMany<T>(
  sides: readonly ComparisonSideInput<T>[],
  options: CompareManyOptions<T>,
): ComparisonMultiResult<T> {
  const {
    getMatchKey,
    compareFields,
    duplicateKeyPolicy = 'last',
    formatDiffLabel = formatDefaultMultiDiffLabel,
    mode = 'base',
  } = options;
  const labels: ComparisonMultiLabels = { ...DEFAULT_COMPARISON_MULTI_LABELS, ...options.labels };
  const { infos, baseId, axisId } = resolveSides(sides, mode, options.baseId);

  const labelOf = (
    row: T,
    partial: Omit<ComparisonMultiRowDiff<T>, 'label'>,
  ): string =>
    formatDiffLabel({
      mode,
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

  const finish = (
    row: T,
    partial: Omit<ComparisonMultiRowDiff<T>, 'label'>,
    into: { annotated: ComparisonMultiRow<T>[]; diffs: Map<T, ComparisonMultiRowDiff<T>>; summary: ComparisonMultiSideSummary },
  ): void => {
    const diff: ComparisonMultiRowDiff<T> = { ...partial, label: labelOf(row, partial) };
    into.annotated.push({ row, diff });
    into.diffs.set(row, diff);
    countKind(into.summary, diff.kind);
  };

  const results: ComparisonMultiSideResult<T>[] = [];
  const pairs = new Map<ComparisonSideId, ComparisonResult<T>>();
  let hasAnyDiff = false;

  if (mode === 'all') {
    // 全構成一致判定: 各構成を索引し、各行を他の全構成と突き合わせる。
    const indexes = new Map<ComparisonSideId, KeyIndex<T>>();
    for (const side of sides) indexes.set(side.id, indexRows(side.rows, getMatchKey, duplicateKeyPolicy));

    for (const info of infos) {
      const input = sides.find((side) => side.id === info.id) as ComparisonSideInput<T>;
      const others = infos.filter((other) => other.id !== info.id);
      const into = {
        annotated: [] as ComparisonMultiRow<T>[],
        diffs: new Map<T, ComparisonMultiRowDiff<T>>(),
        summary: createSummary(input.rows.length),
      };
      for (const row of input.rows) {
        const matchKey = getMatchKey(row);
        const missingIn = new Set<ComparisonSideId>();
        const counterparts = new Map<ComparisonSideId, T>();
        const bySide = new Map<ComparisonSideId, ComparisonRowDiff<T>>();
        const fieldDiffs = new Set<string>();
        for (const other of others) {
          const counterpart = (indexes.get(other.id) as KeyIndex<T>).byKey.get(matchKey);
          if (counterpart === undefined) {
            missingIn.add(other.id);
            bySide.set(other.id, {
              side: 'left',
              kind: 'left-only',
              label: labels.missingInSide,
              matchKey,
              fieldDiffs: EMPTY_KEY_SET,
              counterpart: undefined,
            });
            continue;
          }
          counterparts.set(other.id, counterpart);
          // equals の引数順は (自分の値, 相手の値)。
          const pairFields = compareFields.filter(
            (field) =>
              !(field.equals ?? Object.is)(readFieldValue(field, row), readFieldValue(field, counterpart)),
          );
          const pairSet = new Set(pairFields.map((field) => field.key));
          for (const key of pairSet) fieldDiffs.add(key);
          bySide.set(other.id, {
            side: 'left',
            kind: pairSet.size > 0 ? 'field-diff' : 'same',
            label: pairSet.size > 0 ? joinFieldLabels(pairFields, labels) : '',
            matchKey,
            fieldDiffs: pairSet.size > 0 ? pairSet : EMPTY_KEY_SET,
            counterpart,
          });
        }
        finish(
          row,
          {
            sideId: info.id,
            isBase: false,
            kind: resolveKind(fieldDiffs.size, missingIn.size, others.length),
            matchKey,
            fieldDiffs: fieldDiffs.size > 0 ? fieldDiffs : EMPTY_KEY_SET,
            missingIn,
            counterparts,
            bySide,
          },
          into,
        );
      }
      if (into.summary.same !== into.summary.total) hasAnyDiff = true;
      results.push({
        ...info,
        rows: input.rows,
        annotated: into.annotated,
        diffs: into.diffs,
        summary: into.summary,
        duplicateKeys: (indexes.get(info.id) as KeyIndex<T>).duplicates,
      });
    }
  } else {
    const resolvedBaseId = baseId as ComparisonSideId;
    const base = sides.find((side) => side.id === resolvedBaseId) as ComparisonSideInput<T>;
    const others = sides.filter((side) => side.id !== resolvedBaseId);

    // 基準と各構成の 2-way 比較。2-way 側の片側ラベルは N 構成の文言に合わせる。
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

    for (const info of infos) {
      const input = sides.find((side) => side.id === info.id) as ComparisonSideInput<T>;
      const into = {
        annotated: [] as ComparisonMultiRow<T>[],
        diffs: new Map<T, ComparisonMultiRowDiff<T>>(),
        summary: createSummary(input.rows.length),
      };
      let duplicateKeys: readonly string[];

      if (info.isBase) {
        // 基準ペイン: 各構成との 2-way 結果(基準側 = left の注釈)を集約する。
        duplicateKeys = indexRows(input.rows, getMatchKey, duplicateKeyPolicy).duplicates;
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
          finish(
            row,
            {
              sideId: info.id,
              isBase: true,
              kind: resolveKind(fieldDiffs.size, missingIn.size, others.length),
              matchKey: matchKey ?? getMatchKey(row),
              fieldDiffs: fieldDiffs.size > 0 ? fieldDiffs : EMPTY_KEY_SET,
              missingIn,
              counterparts,
              bySide,
            },
            into,
          );
        }
      } else {
        // 基準以外のペイン: 基準との 2-way 結果(自側 = right の注釈)をそのまま写す。
        const pair = pairs.get(info.id) as ComparisonResult<T>;
        duplicateKeys = pair.duplicateKeys.right;
        for (const entry of pair.annotatedRight) {
          const pairDiff = entry.diff;
          const counterparts = new Map<ComparisonSideId, T>();
          if (pairDiff.counterpart !== undefined) counterparts.set(resolvedBaseId, pairDiff.counterpart);
          finish(
            entry.row,
            {
              sideId: info.id,
              isBase: false,
              kind:
                pairDiff.kind === 'right-only' ? 'only' : pairDiff.kind === 'field-diff' ? 'field-diff' : 'same',
              matchKey: pairDiff.matchKey,
              fieldDiffs: pairDiff.fieldDiffs,
              missingIn: EMPTY_KEY_SET,
              counterparts,
              bySide: new Map([[resolvedBaseId, pairDiff]]),
            },
            into,
          );
        }
      }

      if (into.summary.same !== into.summary.total) hasAnyDiff = true;
      results.push({
        ...info,
        rows: input.rows,
        annotated: into.annotated,
        diffs: into.diffs,
        summary: into.summary,
        duplicateKeys,
      });
    }
  }

  return {
    mode,
    baseId,
    axisId,
    sides: results,
    sidesById: new Map(results.map((side) => [side.id, side])),
    pairs,
    hasAnyDiff,
  };
}
