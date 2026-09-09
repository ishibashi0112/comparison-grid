// 例 04: 全構成一致判定(mode: 'all')+ Root 配下の自作パーツ(useComparisonLayout)。
//   - 基準なし。行は全構成に存在し全構成で一致するときだけ same。揺れのある行はどのペインでも差分になる。
//   - Root の Context は useComparisonLayout() で取り出せるので、ツールバーや集計表示を Root の中に自作できる。
import { ComparisonLayout, useComparisonLayout, useMultiComparison } from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css';
import { COLUMNS, COMPARE_FIELDS, CURRENT, PLAN_A, PLAN_B, getMatchKey, type Part } from './data';

const SIDES = [
  { id: 'x', rows: CURRENT, label: 'X' },
  { id: 'y', rows: PLAN_A, label: 'Y' },
  { id: 'z', rows: PLAN_B, label: 'Z' },
];

/** Root の中で使う自作の集計行。構成ごとの表示行数と、差分のある行数を出す。 */
function DiffCounts() {
  const layout = useComparisonLayout<Part>();
  return (
    <ul className="example-diff-counts">
      {layout.sides.map((side) => {
        const diffRows = side.rows.filter((row) => side.diffs.get(row)?.kind !== 'same').length;
        return <li key={side.id}>{`${side.id}: ${side.rows.length} 行中 ${diffRows} 行に揺れ`}</li>;
      })}
    </ul>
  );
}

export function MultiAllExample() {
  const comparison = useMultiComparison<Part>({
    sides: SIDES,
    mode: 'all',
    getMatchKey,
    compareFields: COMPARE_FIELDS,
    alignRows: true,
  });

  return (
    <ComparisonLayout.Root<Part>
      comparison={comparison}
      columns={COLUMNS}
      keyColumnKeys={['itemCode']}
      showDiffLabelColumn
      diffLabelColumn={{ title: '揺れ', width: 170 }}
      gridProps={{ height: 320 }}
    >
      {/* Root の子は Pane でなくてもよい(Grid 以外の要素も置ける)。ただし CSS Grid のセルになる点に注意。 */}
      <DiffCounts />
      {comparison.sides.map((side) => (
        <ComparisonLayout.Pane key={side.id} side={side.id}>
          <ComparisonLayout.Header>{side.label}</ComparisonLayout.Header>
          <ComparisonLayout.Grid<Part> />
        </ComparisonLayout.Pane>
      ))}
    </ComparisonLayout.Root>
  );
}
