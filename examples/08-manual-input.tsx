// 例 08: マニュアル入力。右ペインをユーザーが直接編集し、左のマスタと比較する。
//   - useManualRows が末尾空行の維持 / 正規化 / 送信時検証を担う。dataRows(空行を除いた確定行)を useComparison へ。
//   - manual.gridProps(onRowsChange / createRow)を右ペインの gridProps にスプレッドする。
//   - 行の同一性: 編集で行オブジェクトが差し替わっても、差分 Map はその時点の rows から作り直されるので問題ない。
import { useState } from 'react';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { ComparisonView, useComparison, useManualRows } from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css';
import { COMPARE_FIELDS, CURRENT, getMatchKey, type Part } from './data';

const createRow = (): Part => ({ level: 1, itemCode: '', itemName: '', qty: 0, shikiyuKbn: '無' });
const isEmptyRow = (row: Part) => row.itemCode.trim() === '';
const normalizeRow = (row: Part): Part => {
  const itemCode = row.itemCode.trim().toUpperCase();
  return itemCode === row.itemCode ? row : { ...row, itemCode }; // 変更が不要なら同じ参照を返す
};
const validateRow = (row: Part) => (row.qty <= 0 ? '数量は 1 以上にしてください' : null);

// 列は editable + editor で編集を許可する(左のマスタ側は gridProps.readOnly で丸ごと読み取り専用にする)。
const EDITABLE_COLUMNS: GridColumn<Part>[] = [
  { key: 'itemCode', title: '品目コード', width: 110, editable: true },
  { key: 'itemName', title: '品目名', width: 150, editable: true },
  {
    key: 'shikiyuKbn',
    title: '支給',
    width: 60,
    editable: true,
    editor: { type: 'select', options: [{ value: '有', label: '有' }, { value: '無', label: '無' }] },
  },
  { key: 'qty', title: '数量', width: 60, align: 'right', editable: true, editor: { type: 'number', min: 0 } },
];

export function ManualInputExample() {
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const manual = useManualRows<Part>({
    initialRows: [CURRENT[0], { ...CURRENT[1], qty: 2 }],
    createRow,
    isEmptyRow,
    normalizeRow,
    validateRow,
  });

  const comparison = useComparison<Part>({
    left: CURRENT,
    right: manual.dataRows,
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
      <button type="button" disabled={!manual.isValid} onClick={() => window.alert(`${manual.dataRows.length} 行を送信`)}>
        送信
      </button>
      {manual.errors.map((error) => (
        <p key={error.rowIndex}>{`${error.rowIndex + 1} 行目: ${error.message}`}</p>
      ))}
      <ComparisonView<Part>
        comparison={comparison}
        columns={EDITABLE_COLUMNS}
        keyColumnKeys={['itemCode']}
        showDiffLabelColumn
        leftHeader={<strong>マスタ</strong>}
        rightHeader={<strong>入力(編集できます)</strong>}
        gridProps={{ height: 300, readOnly: true }}
        rightGridProps={{ ...manual.gridProps, readOnly: false }}
      />
    </section>
  );
}
