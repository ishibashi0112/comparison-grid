// 例 06: ヘッドレス利用。DOM も配置も自前で、ライブラリからは「差分を合成した grid props」だけを受け取る。
//   - useComparisonPane: 列 / 行クラス / className を合成した gridProps を返す(SpreadsheetGrid へスプレッド)。
//   - useComparisonScrollSync: 両側の ref / onScroll を合成した grid props を返す。
//   - gridProps.className に cmpg-grid が入り、--cmpg-* トークンもそこに定義されるので .cmpg-pane 無しでも色が付く。
//   - getDiff(row) は renderCell の中で差分に応じた描画をするときに使える。
import { SpreadsheetGrid } from '@ishibashi0112/spreadsheet-grid';
import { useComparison, useComparisonPane, useComparisonScrollSync } from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css';
import { COLUMNS, COMPARE_FIELDS, CURRENT, PLAN_A, getMatchKey, type Part } from './data';

export function HeadlessOwnGridExample() {
  const comparison = useComparison<Part>({
    left: CURRENT,
    right: PLAN_A,
    getMatchKey,
    compareFields: COMPARE_FIELDS,
    alignRows: true,
  });
  const sync = useComparisonScrollSync<Part>();
  const leftPane = useComparisonPane<Part>({
    rows: comparison.visibleLeft,
    diffs: comparison.leftDiffs,
    columns: COLUMNS,
    compareFields: comparison.compareFields,
    keyColumnKeys: ['itemCode'],
    placeholderRows: comparison.placeholders.left,
    gridProps: { ...sync.leftGridProps, height: 300 },
  });
  const rightPane = useComparisonPane<Part>({
    rows: comparison.visibleRight,
    diffs: comparison.rightDiffs,
    columns: COLUMNS,
    compareFields: comparison.compareFields,
    keyColumnKeys: ['itemCode'],
    placeholderRows: comparison.placeholders.right,
    gridProps: { ...sync.rightGridProps, height: 300 },
  });

  return (
    <table className="example-own-layout">
      <thead>
        <tr>
          <th>現行</th>
          <th>案 1</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <SpreadsheetGrid<Part> {...leftPane.gridProps} />
          </td>
          <td>
            <SpreadsheetGrid<Part> {...rightPane.gridProps} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
