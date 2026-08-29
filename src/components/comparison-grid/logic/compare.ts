// 左右のリストをキーで突き合わせ、差分情報を付与する純ロジックです(React / グリッド非依存)。
//   - Map による O(n + m)。
//   - 行 T には書き込まず、ComparisonRow(行 + 差分)と Map<行, 差分> を返します。
//   - キー重複は既定で後勝ち(ss2602 の Map 上書きと同じ)。'first' で先勝ち。重複キーは結果に報告します。
import type {
  CompareField,
  CompareOptions,
  ComparisonDiffKind,
  ComparisonLabels,
  ComparisonResult,
  ComparisonRow,
  ComparisonRowDiff,
  ComparisonSide,
  ComparisonSideSummary,
  DiffLabelContext,
  DuplicateKeyPolicy,
} from '../model/types';

/** 既定の文言(日本語)。labels オプションで部分上書きできます。 */
export const DEFAULT_COMPARISON_LABELS: ComparisonLabels = {
  leftOnly: '左のみ',
  rightOnly: '右のみ',
  fieldDiffSeparator: '・',
  fieldDiffSuffix: '違い',
};

/** 既定のラベル生成。left-only → "左のみ" / right-only → "右のみ" /
 *  field-diff → 差分フィールドの label を区切りで連結 + 接尾辞(例: "数量・支給区分違い")/ same → ''。 */
export const formatDefaultDiffLabel = <T>(ctx: DiffLabelContext<T>): string => {
  switch (ctx.kind) {
    case 'left-only':
      return ctx.labels.leftOnly;
    case 'right-only':
      return ctx.labels.rightOnly;
    case 'field-diff':
      return (
        ctx.diffFields.map((field) => field.label).join(ctx.labels.fieldDiffSeparator) +
        ctx.labels.fieldDiffSuffix
      );
    default:
      return '';
  }
};

const EMPTY_FIELD_DIFFS: ReadonlySet<string> = new Set<string>();
const EMPTY_FIELDS: readonly never[] = [];

const readFieldValue = <T>(field: CompareField<T>, row: T): unknown => {
  if (field.getValue) return field.getValue(row);
  if (row === null || row === undefined) return undefined;
  return (row as unknown as Record<string, unknown>)[field.key];
};

type KeyIndex<T> = {
  byKey: Map<string, T>;
  duplicates: string[];
};

const indexByKey = <T>(
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

type SideResult<T> = {
  annotated: ComparisonRow<T>[];
  diffs: Map<T, ComparisonRowDiff<T>>;
  summary: ComparisonSideSummary;
};

type AnnotateContext<T> = {
  getMatchKey: (row: T) => string;
  compareFields: readonly CompareField<T>[];
  formatDiffLabel: (ctx: DiffLabelContext<T>) => string;
  labels: ComparisonLabels;
};

const annotateSide = <T>(
  side: ComparisonSide,
  rows: readonly T[],
  counterpartByKey: Map<string, T>,
  context: AnnotateContext<T>,
): SideResult<T> => {
  const { getMatchKey, compareFields, formatDiffLabel, labels } = context;
  const annotated: ComparisonRow<T>[] = [];
  const diffs = new Map<T, ComparisonRowDiff<T>>();
  const summary: ComparisonSideSummary = { total: rows.length, same: 0, only: 0, fieldDiff: 0 };

  for (const row of rows) {
    const matchKey = getMatchKey(row);
    let kind: ComparisonDiffKind;
    let counterpart: T | undefined;
    let fieldDiffs: ReadonlySet<string> = EMPTY_FIELD_DIFFS;
    let diffFields: readonly CompareField<T>[] = EMPTY_FIELDS;

    if (!counterpartByKey.has(matchKey)) {
      kind = side === 'left' ? 'left-only' : 'right-only';
      summary.only += 1;
    } else {
      counterpart = counterpartByKey.get(matchKey) as T;
      // equals の引数順は常に (左の値, 右の値)。右側の注釈でも入れ替えません。
      const leftRow = side === 'left' ? row : counterpart;
      const rightRow = side === 'left' ? counterpart : row;
      const found = new Set<string>();
      const foundFields: CompareField<T>[] = [];
      for (const field of compareFields) {
        const equals = field.equals ?? Object.is;
        if (!equals(readFieldValue(field, leftRow), readFieldValue(field, rightRow))) {
          found.add(field.key);
          foundFields.push(field);
        }
      }
      if (found.size > 0) {
        kind = 'field-diff';
        fieldDiffs = found;
        diffFields = foundFields;
        summary.fieldDiff += 1;
      } else {
        kind = 'same';
        summary.same += 1;
      }
    }

    const label = formatDiffLabel({
      side,
      kind,
      row,
      counterpart,
      fieldDiffs,
      diffFields,
      labels,
    });
    const diff: ComparisonRowDiff<T> = { side, kind, label, matchKey, fieldDiffs, counterpart };
    annotated.push({ row, diff });
    diffs.set(row, diff);
  }

  return { annotated, diffs, summary };
};

/** 左右のリストを突き合わせて差分情報を返します(純関数)。 */
export function compare<T>(
  left: readonly T[],
  right: readonly T[],
  options: CompareOptions<T>,
): ComparisonResult<T> {
  const {
    getMatchKey,
    compareFields,
    formatDiffLabel = formatDefaultDiffLabel,
    duplicateKeyPolicy = 'last',
  } = options;
  const labels: ComparisonLabels = { ...DEFAULT_COMPARISON_LABELS, ...options.labels };
  const context: AnnotateContext<T> = { getMatchKey, compareFields, formatDiffLabel, labels };

  const leftIndex = indexByKey(left, getMatchKey, duplicateKeyPolicy);
  const rightIndex = indexByKey(right, getMatchKey, duplicateKeyPolicy);

  const leftResult = annotateSide('left', left, rightIndex.byKey, context);
  const rightResult = annotateSide('right', right, leftIndex.byKey, context);

  const hasAnyDiff =
    leftResult.summary.only > 0 ||
    leftResult.summary.fieldDiff > 0 ||
    rightResult.summary.only > 0 ||
    rightResult.summary.fieldDiff > 0;

  return {
    annotatedLeft: leftResult.annotated,
    annotatedRight: rightResult.annotated,
    leftDiffs: leftResult.diffs,
    rightDiffs: rightResult.diffs,
    summary: { left: leftResult.summary, right: rightResult.summary },
    duplicateKeys: { left: leftIndex.duplicates, right: rightIndex.duplicates },
    hasAnyDiff,
  };
}
