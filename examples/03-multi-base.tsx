// 例 03: 3 構成以上(基準対各構成)。useMultiComparison + 合成コンポーネント ComparisonLayout。
//   - sides の先頭(または baseId)が基準。基準以外のペインは「基準との違い」、基準ペインは各構成との集約を示す。
//   - ペインは JSX に置いた数だけ並ぶ(横並びは子の数だけ等幅カラム)。
import { useState } from 'react';
import { ComparisonLayout, useMultiComparison } from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css';
import { COLUMNS, COMPARE_FIELDS, CURRENT, PLAN_A, PLAN_B, getMatchKey, type Part } from './data';

const SIDES = [
  { id: 'current', rows: CURRENT, label: '現行' },
  { id: 'planA', rows: PLAN_A, label: '案1' },
  { id: 'planB', rows: PLAN_B, label: '案2' },
];

export function MultiBaseExample() {
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [alignRows, setAlignRows] = useState(true);

  const comparison = useMultiComparison<Part>({
    sides: SIDES,
    getMatchKey,
    compareFields: COMPARE_FIELDS,
    showDiffOnly,
    alignRows,
  });

  return (
    <section>
      <label>
        <input
          type="checkbox"
          checked={comparison.effectiveShowDiffOnly}
          disabled={!comparison.canShowDiffOnly}
          onChange={(event) => setShowDiffOnly(event.target.checked)}
        />
        差分のみ
      </label>
      <label>
        <input type="checkbox" checked={alignRows} onChange={(event) => setAlignRows(event.target.checked)} />
        整列
      </label>
      <ComparisonLayout.Root<Part>
        comparison={comparison}
        columns={COLUMNS}
        keyColumnKeys={['itemCode']}
        showDiffLabelColumn
        diffLabelColumn={{ title: '変更箇所', width: 170 }}
        enableScrollSync
        gridProps={{ height: 320 }}
      >
        {comparison.sides.map((side) => (
          <ComparisonLayout.Pane key={side.id} side={side.id}>
            <ComparisonLayout.Header>
              <strong>{side.isBase ? `${side.label}(基準)` : side.label}</strong>
              <span>{`同一 ${side.summary.same} / 項目違い ${side.summary.fieldDiff}`}</span>
            </ComparisonLayout.Header>
            <ComparisonLayout.Grid<Part> />
          </ComparisonLayout.Pane>
        ))}
      </ComparisonLayout.Root>
    </section>
  );
}
