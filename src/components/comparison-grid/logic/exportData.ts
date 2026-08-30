// 比較結果のエクスポートデータを生成する純ロジックです(React / グリッド非依存)。
//   spreadsheet-grid の getExportData() と同形の { columns, rows: { value, text }[][] } を返します。
//   - value は column.getValue ?? row[key]。text は本体の「セル表示」と同じ規則:
//     value == null は valueFormatter を通さず ''、それ以外は valueFormatter ?? String(value)。
//     (プレースホルダ行の undefined を formatter が整形してしまわないように。)列見出しは title ?? key。
//   - 差分ラベル列は既定で含めます(insertDiffLabelColumn を流用。位置 / 見出しはペインと同じ規則)。
//   - alignRows の整列済み配列を渡せば対順のエクスポートになります(プレースホルダ行は全セル空)。
import type { GridColumn, GridExportData } from '@ishibashi0112/spreadsheet-grid';
import type { ComparisonExportOptions } from '../model/types';
import { insertDiffLabelColumn } from './paneColumns';

const readCellValue = <T>(column: GridColumn<T>, row: T): unknown => {
  if (column.getValue) return column.getValue(row);
  if (row === null || row === undefined) return undefined;
  return (row as Record<string, unknown>)[column.key];
};

/** 比較結果 1 側ぶんのエクスポートデータを返します(純関数)。 */
export function getComparisonExportData<T>(options: ComparisonExportOptions<T>): GridExportData {
  const {
    rows,
    diffs,
    columns,
    showDiffLabelColumn = true,
    diffLabelColumn,
    descendantDiffCounts,
  } = options;
  const visibleColumns = columns.filter((column) => column.visible !== false);
  const exportColumns = showDiffLabelColumn
    ? insertDiffLabelColumn(visibleColumns, diffs, diffLabelColumn, descendantDiffCounts)
    : visibleColumns;

  return {
    columns: exportColumns.map((column) => ({
      key: column.key,
      title: column.title ?? column.key,
    })),
    rows: rows.map((row) =>
      exportColumns.map((column) => {
        const value = readCellValue(column, row);
        const text =
          value === null || value === undefined
            ? ''
            : column.valueFormatter
              ? column.valueFormatter({ value, row, column })
              : String(value);
        return { value, text };
      }),
    ),
  };
}
