// 例 07: エクスポート。getComparisonExportData は spreadsheet-grid の getExportData() と同形
//   ({ columns: { key, title }[], rows: { value, text }[][] })を返すので、CSV / Excel の下流処理を共用できる。
//   - rows に visibleLeft(表示中の行)を渡せば「差分のみ」の状態がそのまま出力される。
//   - 差分ラベル列は既定で含まれる(ペインの既定 false とは異なる)。
import { useState } from 'react';
import type { GridExportData } from '@ishibashi0112/spreadsheet-grid';
import { ComparisonView, getComparisonExportData, useComparison } from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css';
import { COLUMNS, COMPARE_FIELDS, CURRENT, PLAN_A, getMatchKey, type Part } from './data';

const quote = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

const toCsv = (data: GridExportData): string =>
  [data.columns.map((column) => quote(column.title)), ...data.rows.map((cells) => cells.map((cell) => quote(cell.text)))]
    .map((line) => line.join(','))
    .join('\n');

export function ExportCsvExample() {
  const [showDiffOnly, setShowDiffOnly] = useState(true);
  const [csv, setCsv] = useState('');

  const comparison = useComparison<Part>({
    left: CURRENT,
    right: PLAN_A,
    getMatchKey,
    compareFields: COMPARE_FIELDS,
    showDiffOnly,
  });

  const exportLeft = () => {
    const data = getComparisonExportData<Part>({
      rows: comparison.visibleLeft,
      diffs: comparison.leftDiffs,
      columns: COLUMNS,
      diffLabelColumn: { title: '変更箇所' },
    });
    setCsv(toCsv(data));
  };

  return (
    <section>
      <label>
        <input type="checkbox" checked={showDiffOnly} onChange={(event) => setShowDiffOnly(event.target.checked)} />
        差分のみをエクスポート
      </label>
      <button type="button" onClick={exportLeft}>
        左ペインを CSV に
      </button>
      <ComparisonView<Part> comparison={comparison} columns={COLUMNS} keyColumnKeys={['itemCode']} gridProps={{ height: 240 }} />
      <pre className="example-csv">{csv}</pre>
    </section>
  );
}
