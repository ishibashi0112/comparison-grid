// 片側 1 ペインぶんの「差分の合成」をヘッドレスに行うフックです(ComparisonPane の本体)。
//   利用側の columns / gridProps を受け取り、差分クラスを合成した columns・行クラスを合成した
//   getRowClassName・`cmpg-grid` を足した className を、SpreadsheetGrid へそのままスプレッドできる
//   gridProps として返します。DOM(ラッパー / ヘッダー)は一切持たないため、自前レイアウトの
//   SpreadsheetGrid にも同じ差分ハイライトを配線できます。
import { useMemo } from 'react';
import type { GridColumn, SpreadsheetGridProps } from '@ishibashi0112/spreadsheet-grid';
import type {
  ComparisonAnyRowDiff,
  ComparisonPaneGridProps,
  UseComparisonPaneOptions,
  UseComparisonPaneResult,
} from '../model/types';
import {
  composeColumns,
  composeRowClassName,
  insertDiffLabelColumn,
} from '../logic/paneColumns';
import { useStableArray, useStableObject } from './useStableValue';
import { cx } from '../logic/cx';
import '../styles.css';

/**
 * 片側 1 ペインぶんの差分合成(ヘッドレス)。DOM を持たず、`SpreadsheetGrid` へそのままスプレッドできる
 * `gridProps`(合成済みの列 / 行クラス / `cmpg-grid` クラス)を返します。`diffs` は 2-way でも N 構成でも可。
 *
 * @example
 * ```tsx
 * const pane = useComparisonPane<Row>({
 *   rows: comparison.visibleLeft, diffs: comparison.leftDiffs, columns,
 *   compareFields: comparison.compareFields, keyColumnKeys: ['id'],
 *   placeholderRows: comparison.placeholders.left,
 *   gridProps: { height: 400 },
 * });
 * <SpreadsheetGrid<Row> {...pane.gridProps} />;
 * ```
 */
export function useComparisonPane<T extends object>(
  options: UseComparisonPaneOptions<T>,
): UseComparisonPaneResult<T> {
  const {
    rows,
    diffs,
    gridProps,
    placeholderRows,
    contextRows,
    descendantDiffCounts,
    enableRowHighlight = true,
    enableKeyCellHighlight = true,
    enableFieldCellHighlight = true,
    showDiffLabelColumn = false,
    excludePlaceholderRowsOnCopy = false,
  } = options;
  const columns = useStableArray(options.columns);
  const compareFields = useStableArray(options.compareFields);
  const keyColumnKeys = useStableArray(options.keyColumnKeys);
  const diffLabelColumn = useStableObject(options.diffLabelColumn);

  const composedColumns = useMemo<GridColumn<T>[]>(() => {
    const composed = composeColumns(columns, diffs, {
      compareFields,
      keyColumnKeys,
      enableKeyCellHighlight,
      enableFieldCellHighlight,
    });
    return showDiffLabelColumn
      ? insertDiffLabelColumn(composed, diffs, diffLabelColumn, descendantDiffCounts)
      : composed;
  }, [
    columns,
    diffs,
    compareFields,
    keyColumnKeys,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    showDiffLabelColumn,
    diffLabelColumn,
    descendantDiffCounts,
  ]);

  const userGetRowClassName = gridProps?.getRowClassName;
  const getRowClassName = useMemo(
    () =>
      composeRowClassName(
        diffs,
        userGetRowClassName,
        enableRowHighlight,
        placeholderRows,
        contextRows,
        descendantDiffCounts,
      ),
    [diffs, userGetRowClassName, enableRowHighlight, placeholderRows, contextRows, descendantDiffCounts],
  );

  const userClassName = gridProps?.className;
  const className = useMemo(
    () => cx('cmpg-grid', userClassName) ?? 'cmpg-grid',
    [userClassName],
  );

  // コピー / エクスポートの行フィルタ(spreadsheet-grid v0.33.0 の isRowExportable)。excludePlaceholderRowsOnCopy
  //   のときだけプレースホルダ判定を流し、利用側の isRowExportable があれば AND で合成する。付与するものが
  //   無ければ利用側のものをそのまま返す(undefined を含む)。
  const userIsRowExportable = gridProps?.isRowExportable;
  const isRowExportable = useMemo<SpreadsheetGridProps<T>['isRowExportable']>(() => {
    if (!excludePlaceholderRowsOnCopy || !placeholderRows) return userIsRowExportable;
    return (row, ctx) =>
      !placeholderRows.has(row) && (userIsRowExportable ? userIsRowExportable(row, ctx) : true);
  }, [excludePlaceholderRowsOnCopy, placeholderRows, userIsRowExportable]);

  const composedGridProps = useMemo<ComparisonPaneGridProps<T>>(
    () => ({
      ...gridProps,
      // isRowExportable は付与するものがあるときだけ載せる(無ければ gridProps のまま = キーを増やさない)。
      ...(isRowExportable ? { isRowExportable } : undefined),
      rows,
      columns: composedColumns,
      getRowClassName,
      className,
    }),
    [gridProps, isRowExportable, rows, composedColumns, getRowClassName, className],
  );

  const getDiff = useMemo(
    () =>
      (row: T): ComparisonAnyRowDiff<T> | undefined =>
        diffs.get(row),
    [diffs],
  );

  return useMemo(
    () => ({
      gridProps: composedGridProps,
      columns: composedColumns,
      getRowClassName,
      getDiff,
    }),
    [composedGridProps, composedColumns, getRowClassName, getDiff],
  );
}
