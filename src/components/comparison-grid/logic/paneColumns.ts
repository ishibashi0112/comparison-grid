// ペインが SpreadsheetGrid へ渡す列定義 / 行クラスを合成する純ロジックです。
//   利用側の GridColumn<T> は変換せず、強調対象の列(キー列 / compareFields 対応列)だけ
//   cellClassName を「ライブラリのクラス + 利用側のクラス」に合成した新しい列オブジェクトへ差し替えます。
//   対象外の列は同一参照のまま返します。
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import type {
  CompareField,
  ComparisonDiffMap,
  ComparisonRowDiff,
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
  rowFieldDiff: 'cmpg-row-diff--field',
  /** 強調セル共通。 */
  cellDiff: 'cmpg-cell-diff',
  /** left-only / right-only 行のキー列セル。 */
  cellKeyDiff: 'cmpg-cell-diff--key',
  /** field-diff 行の差分フィールド列セル。 */
  cellFieldDiff: 'cmpg-cell-diff--field',
} as const;

/** 差分ラベル列の既定キー。 */
export const DEFAULT_DIFF_LABEL_COLUMN_KEY = 'cmpgDiffLabel';

export const getDiffRowClassName = <T>(
  diff: ComparisonRowDiff<T> | undefined,
): string | undefined => {
  if (!diff || diff.kind === 'same') return undefined;
  const modifier =
    diff.kind === 'left-only'
      ? CMPG_CLASS_NAMES.rowLeftOnly
      : diff.kind === 'right-only'
        ? CMPG_CLASS_NAMES.rowRightOnly
        : CMPG_CLASS_NAMES.rowFieldDiff;
  return `${CMPG_CLASS_NAMES.rowDiff} ${modifier}`;
};

type CellTarget = {
  isKeyColumn: boolean;
  /** この列を強調対象とする CompareField.key(無ければ undefined)。 */
  fieldKeys?: readonly string[];
};

export const getDiffCellClassName = <T>(
  diff: ComparisonRowDiff<T> | undefined,
  target: CellTarget,
): string | undefined => {
  if (!diff) return undefined;
  const classes: string[] = [];
  if (target.isKeyColumn && (diff.kind === 'left-only' || diff.kind === 'right-only')) {
    classes.push(CMPG_CLASS_NAMES.cellDiff, CMPG_CLASS_NAMES.cellKeyDiff);
  }
  if (
    target.fieldKeys &&
    diff.kind === 'field-diff' &&
    target.fieldKeys.some((key) => diff.fieldDiffs.has(key))
  ) {
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
  diffs: ComparisonDiffMap<T>,
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

export type RowClassNameGetter<T> = (row: T, rowIndex: number) => string | undefined;

/** ライブラリの行クラスと利用側 getRowClassName を合成します。 */
export const composeRowClassName = <T>(
  diffs: ComparisonDiffMap<T>,
  userGetRowClassName: RowClassNameGetter<T> | undefined,
  enableRowHighlight: boolean,
): RowClassNameGetter<T> | undefined => {
  if (!enableRowHighlight) return userGetRowClassName;
  return (row, rowIndex) =>
    cx(getDiffRowClassName(diffs.get(row)), userGetRowClassName?.(row, rowIndex));
};

/** 差分ラベル列を挿入した列配列を返します。 */
export const insertDiffLabelColumn = <T>(
  columns: readonly GridColumn<T>[],
  diffs: ComparisonDiffMap<T>,
  options: DiffLabelColumnOptions<T> | undefined,
): GridColumn<T>[] => {
  const { position = 'end', ...override } = options ?? {};
  const column: GridColumn<T> = {
    key: DEFAULT_DIFF_LABEL_COLUMN_KEY,
    title: '差分',
    width: 150,
    ...override,
    getValue: (row) => diffs.get(row)?.label ?? '',
  };
  const index =
    position === 'start'
      ? 0
      : position === 'end'
        ? columns.length
        : Math.max(0, Math.min(columns.length, Math.trunc(position)));
  return [...columns.slice(0, index), column, ...columns.slice(index)];
};
