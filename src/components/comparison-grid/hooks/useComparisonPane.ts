// 片側 1 ペインぶんの「差分の合成」をヘッドレスに行うフックです(ComparisonPane の本体)。
//   利用側の columns / gridProps を受け取り、差分クラスを合成した columns・行クラスを合成した
//   getRowClassName・`cmpg-grid` を足した className を、SpreadsheetGrid へそのままスプレッドできる
//   gridProps として返します。DOM(ラッパー / ヘッダー)は一切持たないため、自前レイアウトの
//   SpreadsheetGrid にも同じ差分ハイライトを配線できます。
import { useMemo } from 'react';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import type {
  ComparisonPaneGridProps,
  ComparisonRowDiff,
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

  const composedGridProps = useMemo<ComparisonPaneGridProps<T>>(
    () => ({
      ...gridProps,
      rows,
      columns: composedColumns,
      getRowClassName,
      className,
    }),
    [gridProps, rows, composedColumns, getRowClassName, className],
  );

  const getDiff = useMemo(
    () =>
      (row: T): ComparisonRowDiff<T> | undefined =>
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
