// 片側 1 ペインです。利用側の T[] と GridColumn<T>[] をそのまま受け取り、差分ハイライト
//   (行クラス / キー列セル / 差分フィールドセル)と差分ラベル列を合成して SpreadsheetGrid へ流します。
//   gridProps は rows / columns 以外をそのまま透過します(getRowClassName / className は合成)。
import { useMemo } from 'react';
import { SpreadsheetGrid, type GridColumn } from '@ishibashi0112/spreadsheet-grid';
import type { ComparisonPaneProps } from '../model/types';
import {
  composeColumns,
  composeRowClassName,
  insertDiffLabelColumn,
} from '../logic/paneColumns';
import { useStableArray, useStableObject } from '../hooks/useStableValue';
import { cx } from '../logic/cx';
import '../styles.css';

export function ComparisonPane<T extends object>(props: ComparisonPaneProps<T>) {
  const {
    side,
    rows,
    diffs,
    header,
    showHeader = header !== undefined,
    gridProps,
    className,
    style,
    enableRowHighlight = true,
    enableKeyCellHighlight = true,
    enableFieldCellHighlight = true,
    showDiffLabelColumn = false,
  } = props;
  const columns = useStableArray(props.columns);
  const compareFields = useStableArray(props.compareFields);
  const keyColumnKeys = useStableArray(props.keyColumnKeys);
  const diffLabelColumn = useStableObject(props.diffLabelColumn);

  const composedColumns = useMemo<GridColumn<T>[]>(() => {
    const composed = composeColumns(columns, diffs, {
      compareFields,
      keyColumnKeys,
      enableKeyCellHighlight,
      enableFieldCellHighlight,
    });
    return showDiffLabelColumn ? insertDiffLabelColumn(composed, diffs, diffLabelColumn) : composed;
  }, [
    columns,
    diffs,
    compareFields,
    keyColumnKeys,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    showDiffLabelColumn,
    diffLabelColumn,
  ]);

  const userGetRowClassName = gridProps?.getRowClassName;
  const getRowClassName = useMemo(
    () => composeRowClassName(diffs, userGetRowClassName, enableRowHighlight),
    [diffs, userGetRowClassName, enableRowHighlight],
  );

  return (
    <div
      className={cx('cmpg-pane', `cmpg-pane--${side}`, className)}
      style={style}
      data-cmpg-side={side}
    >
      {showHeader ? <div className="cmpg-pane-header">{header}</div> : null}
      <div className="cmpg-pane-body">
        <SpreadsheetGrid<T>
          {...gridProps}
          // 注記: SpreadsheetGridProps.rows は T[](mutable)のため readonly からキャストします。
          //   グリッドは rows を変更しません(編集は onRowsChange で新配列を返す設計)。
          rows={rows as T[]}
          columns={composedColumns}
          getRowClassName={getRowClassName}
          className={cx('cmpg-grid', gridProps?.className)}
        />
      </div>
    </div>
  );
}
