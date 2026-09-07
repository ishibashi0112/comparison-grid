// ペインが SpreadsheetGrid へ渡す列定義 / 行クラスを合成する純ロジックです。
//   利用側の GridColumn<T> は変換せず、強調対象の列(キー列 / compareFields 対応列)だけ
//   cellClassName を「ライブラリのクラス + 利用側のクラス」に合成した新しい列オブジェクトへ差し替えます。
//   対象外の列は同一参照のまま返します。
//   差分は 2-way(ComparisonRowDiff)/ N 構成(ComparisonMultiRowDiff)のどちらでも受け付けます。判定は
//   kind の文字列一致ではなく「相手が無いか」(hasMissingCounterpart)と「fieldDiffs に列があるか」で行います。
import type { GridColumn, RowStyleContext } from '@ishibashi0112/spreadsheet-grid';
import type {
  CompareField,
  ComparisonAnyDiffMap,
  ComparisonAnyRowDiff,
  DiffLabelColumnOptions,
  GridCellStyleContext,
} from '../model/types';
import { cx } from './cx';

/** ライブラリが付与するクラス名(styles.css と対応)。 */
export const CMPG_CLASS_NAMES = {
  /** same 以外の行(行コンテナ + 各データセル)。 */
  rowDiff: 'cmpg-row-diff',
  rowLeftOnly: 'cmpg-row-diff--left-only',
  rowRightOnly: 'cmpg-row-diff--right-only',
  /** N 構成: 突き合わせ相手が無い行(基準ペインではどの構成にも無い / 他ペインでは基準に無い)。 */
  rowOnly: 'cmpg-row-diff--only',
  /** N 構成の基準ペインで、一部の構成に無い行。 */
  rowPartial: 'cmpg-row-diff--partial',
  rowFieldDiff: 'cmpg-row-diff--field',
  /** 強調セル共通。 */
  cellDiff: 'cmpg-cell-diff',
  /** 相手の無い行(left-only / right-only / only / partial、または missingIn が空でない基準行)のキー列セル。 */
  cellKeyDiff: 'cmpg-cell-diff--key',
  /** field-diff 行の差分フィールド列セル。 */
  cellFieldDiff: 'cmpg-cell-diff--field',
  /** alignRows で欠損側に入るプレースホルダ行(行コンテナ + 各データセル)。 */
  rowPlaceholder: 'cmpg-row-placeholder',
  /** 木モードの「差分のみ」で差分行の祖先として残る文脈行(行コンテナ + 各データセル)。 */
  rowContext: 'cmpg-row-context',
  /** 木モードで、自身は same だが配下に差分がある行(ロールアップ。行コンテナ + 各データセル)。 */
  rowRollup: 'cmpg-row-rollup',
} as const;

/** 差分ラベル列の既定キー。 */
export const DEFAULT_DIFF_LABEL_COLUMN_KEY = 'cmpgDiffLabel';

/** 配下差分ラベルの既定(木モードの差分ラベル列で、自身は same だが配下に差分がある行に出す)。 */
export const formatDefaultDescendantDiffLabel = (count: number): string => `配下に差分 ${count} 件`;

/** ロールアップの行クラス。自身が same(差分クラスが付かない)で配下に差分があるときだけ付ける。 */
export const getRollupRowClassName = <T>(
  diff: ComparisonAnyRowDiff<T> | undefined,
  descendantDiffCount: number | undefined,
): string | undefined =>
  diff?.kind === 'same' && descendantDiffCount !== undefined && descendantDiffCount > 0
    ? CMPG_CLASS_NAMES.rowRollup
    : undefined;

/** その行に突き合わせ相手が無い(片側のみ / どこにも無い / 一部の構成に無い)か。キー列強調の条件。 */
export const hasMissingCounterpart = <T>(diff: ComparisonAnyRowDiff<T>): boolean => {
  switch (diff.kind) {
    case 'left-only':
    case 'right-only':
    case 'only':
    case 'partial':
      return true;
    default:
      return 'missingIn' in diff && diff.missingIn.size > 0;
  }
};

const ROW_KIND_MODIFIERS: Record<Exclude<ComparisonAnyRowDiff<never>['kind'], 'same'>, string> = {
  'left-only': CMPG_CLASS_NAMES.rowLeftOnly,
  'right-only': CMPG_CLASS_NAMES.rowRightOnly,
  only: CMPG_CLASS_NAMES.rowOnly,
  partial: CMPG_CLASS_NAMES.rowPartial,
  'field-diff': CMPG_CLASS_NAMES.rowFieldDiff,
};

export const getDiffRowClassName = <T>(
  diff: ComparisonAnyRowDiff<T> | undefined,
): string | undefined => {
  if (!diff || diff.kind === 'same') return undefined;
  return `${CMPG_CLASS_NAMES.rowDiff} ${ROW_KIND_MODIFIERS[diff.kind]}`;
};

type CellTarget = {
  isKeyColumn: boolean;
  /** この列を強調対象とする CompareField.key(無ければ undefined)。 */
  fieldKeys?: readonly string[];
};

export const getDiffCellClassName = <T>(
  diff: ComparisonAnyRowDiff<T> | undefined,
  target: CellTarget,
): string | undefined => {
  if (!diff) return undefined;
  const classes: string[] = [];
  if (target.isKeyColumn && hasMissingCounterpart(diff)) {
    classes.push(CMPG_CLASS_NAMES.cellDiff, CMPG_CLASS_NAMES.cellKeyDiff);
  }
  if (target.fieldKeys && target.fieldKeys.some((key) => diff.fieldDiffs.has(key))) {
    if (classes.length === 0) classes.push(CMPG_CLASS_NAMES.cellDiff);
    classes.push(CMPG_CLASS_NAMES.cellFieldDiff);
  }
  return classes.length > 0 ? classes.join(' ') : undefined;
};

/** 列キー → その列を強調対象とする CompareField.key の一覧。 */
export const buildFieldColumnIndex = <T>(
  compareFields: readonly CompareField<T>[] | undefined,
): Map<string, string[]> => {
  const index = new Map<string, string[]>();
  if (!compareFields) return index;
  for (const field of compareFields) {
    const columnKey = field.columnKey ?? field.key;
    const keys = index.get(columnKey);
    if (keys) keys.push(field.key);
    else index.set(columnKey, [field.key]);
  }
  return index;
};

export type ComposeColumnsOptions<T> = {
  compareFields?: readonly CompareField<T>[];
  keyColumnKeys?: readonly string[];
  enableKeyCellHighlight?: boolean;
  enableFieldCellHighlight?: boolean;
};

const EMPTY_KEY_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_FIELD_INDEX: ReadonlyMap<string, string[]> = new Map<string, string[]>();

/** 強調対象の列だけ cellClassName を合成した列配列を返します(対象外は同一参照)。 */
export const composeColumns = <T>(
  columns: readonly GridColumn<T>[],
  diffs: ComparisonAnyDiffMap<T>,
  options: ComposeColumnsOptions<T>,
): GridColumn<T>[] => {
  const {
    compareFields,
    keyColumnKeys,
    enableKeyCellHighlight = true,
    enableFieldCellHighlight = true,
  } = options;
  const keySet: ReadonlySet<string> =
    enableKeyCellHighlight && keyColumnKeys ? new Set(keyColumnKeys) : EMPTY_KEY_SET;
  const fieldIndex: ReadonlyMap<string, string[]> = enableFieldCellHighlight
    ? buildFieldColumnIndex(compareFields)
    : EMPTY_FIELD_INDEX;

  return columns.map((column) => {
    const isKeyColumn = keySet.has(column.key);
    const fieldKeys = fieldIndex.get(column.key);
    if (!isKeyColumn && !fieldKeys) return column;
    const userClassName = column.cellClassName;
    const target: CellTarget = { isKeyColumn, fieldKeys };
    return {
      ...column,
      cellClassName: (ctx: GridCellStyleContext<T>) =>
        cx(
          getDiffCellClassName(diffs.get(ctx.row), target),
          typeof userClassName === 'function' ? userClassName(ctx) : userClassName,
        ),
    };
  });
};

/** SpreadsheetGridProps.getRowClassName と同シグネチャ(v0.29.0 で第 3 引数 ctx が追加)。 */
export type RowClassNameGetter<T> = (
  row: T,
  rowIndex: number,
  ctx: RowStyleContext<T>,
) => string | undefined;

/** ライブラリの行クラス(差分 / プレースホルダ / 文脈行 / ロールアップ)と利用側 getRowClassName を合成します
 *  (ctx は利用側へ透過)。プレースホルダ行 / 文脈行のクラスは差分ハイライトではないため enableRowHighlight に
 *  依らず付与し、ロールアップは差分ハイライトの一種として enableRowHighlight に従います。 */
export const composeRowClassName = <T>(
  diffs: ComparisonAnyDiffMap<T>,
  userGetRowClassName: RowClassNameGetter<T> | undefined,
  enableRowHighlight: boolean,
  placeholderRows?: ReadonlySet<T>,
  contextRows?: ReadonlySet<T>,
  descendantDiffCounts?: ReadonlyMap<T, number>,
): RowClassNameGetter<T> | undefined => {
  const hasPlaceholders = placeholderRows !== undefined && placeholderRows.size > 0;
  const hasContext = contextRows !== undefined && contextRows.size > 0;
  if (!enableRowHighlight && !hasPlaceholders && !hasContext) return userGetRowClassName;
  const hasRollup =
    enableRowHighlight && descendantDiffCounts !== undefined && descendantDiffCounts.size > 0;
  return (row, rowIndex, ctx) => {
    const diff = diffs.get(row);
    return cx(
      hasPlaceholders && placeholderRows.has(row) ? CMPG_CLASS_NAMES.rowPlaceholder : undefined,
      hasContext && contextRows.has(row) ? CMPG_CLASS_NAMES.rowContext : undefined,
      enableRowHighlight ? getDiffRowClassName(diff) : undefined,
      hasRollup ? getRollupRowClassName(diff, descendantDiffCounts.get(row)) : undefined,
      userGetRowClassName?.(row, rowIndex, ctx),
    );
  };
};

/** 差分ラベル列を挿入した列配列を返します。descendantDiffCounts を渡すと、自身のラベルが空で配下に差分がある行に
 *  配下差分ラベル(既定 `配下に差分 n 件`)を出します。 */
export const insertDiffLabelColumn = <T>(
  columns: readonly GridColumn<T>[],
  diffs: ComparisonAnyDiffMap<T>,
  options: DiffLabelColumnOptions<T> | undefined,
  descendantDiffCounts?: ReadonlyMap<T, number>,
): GridColumn<T>[] => {
  const {
    position = 'end',
    descendantDiffLabel = formatDefaultDescendantDiffLabel,
    ...override
  } = options ?? {};
  const column: GridColumn<T> = {
    key: DEFAULT_DIFF_LABEL_COLUMN_KEY,
    title: '差分',
    width: 150,
    ...override,
    getValue: (row) => {
      const label = diffs.get(row)?.label ?? '';
      if (label !== '' || !descendantDiffCounts) return label;
      const count = descendantDiffCounts.get(row) ?? 0;
      return count > 0 ? descendantDiffLabel(count) : '';
    },
  };
  const index =
    position === 'start'
      ? 0
      : position === 'end'
        ? columns.length
        : Math.max(0, Math.min(columns.length, Math.trunc(position)));
  return [...columns.slice(0, index), column, ...columns.slice(index)];
};
