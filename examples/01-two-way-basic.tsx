// 例 01: 2 構成の基本形。useComparison(判定)+ ComparisonView(2 ペイン表示)。
//   - 「差分のみ」トグルは effectiveShowDiffOnly(実効値)と canShowDiffOnly(無効条件)をフックから受け取る。
//   - summary(件数)と duplicateKeys(キー重複)もフックの戻り値にある。
import { useState } from 'react';
import { ComparisonView, useComparison } from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css';
import { COLUMNS, COMPARE_FIELDS, CURRENT, PLAN_A, getMatchKey, type Part } from './data';

export function TwoWayBasicExample() {
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  const comparison = useComparison<Part>({
    left: CURRENT,
    right: PLAN_A,
    getMatchKey,
    compareFields: COMPARE_FIELDS,
    showDiffOnly,
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
      <p>
        {`左 ${comparison.summary.left.total} 件(同一 ${comparison.summary.left.same} / 左のみ ${comparison.summary.left.only} / 項目違い ${comparison.summary.left.fieldDiff})`}
      </p>
      <ComparisonView<Part>
        comparison={comparison}
        columns={COLUMNS}
        keyColumnKeys={['itemCode']}
        showDiffLabelColumn
        leftHeader={<strong>現行</strong>}
        rightHeader={<strong>案 1</strong>}
        gridProps={{ height: 320 }}
      />
    </section>
  );
}
