// 使用例(examples/)を画面で確認するためのモードです。各例はそのまま import して描画するだけで、
//   デモ側は選択 UI しか持ちません(例のコードが「動く一次情報」であることを保つため)。
//   examples/ は利用側と同じ `@ishibashi0112/comparison-grid` で import しているので、vite の alias で解決されます。
import { useState } from 'react';
import { TwoWayBasicExample } from '../../examples/01-two-way-basic';
import { TreeComparisonExample } from '../../examples/02-tree-comparison';
import { MultiBaseExample } from '../../examples/03-multi-base';
import { MultiAllExample } from '../../examples/04-multi-all';
import { Grid2x2NavigationExample } from '../../examples/05-grid-2x2-navigation';
import { HeadlessOwnGridExample } from '../../examples/06-headless-own-grid';
import { ExportCsvExample } from '../../examples/07-export-csv';
import { ManualInputExample } from '../../examples/08-manual-input';

const EXAMPLES = [
  { id: '01', file: '01-two-way-basic.tsx', title: '2 構成の基本(useComparison + ComparisonView)', Component: TwoWayBasicExample },
  { id: '02', file: '02-tree-comparison.tsx', title: '階層比較(buildComparisonTree + useTreeComparison)', Component: TreeComparisonExample },
  { id: '03', file: '03-multi-base.tsx', title: '基準対 3 構成(useMultiComparison + ComparisonLayout)', Component: MultiBaseExample },
  { id: '04', file: '04-multi-all.tsx', title: "全構成一致判定(mode: 'all')+ Root 配下の自作パーツ", Component: MultiAllExample },
  { id: '05', file: '05-grid-2x2-navigation.tsx', title: '4 構成を 2×2 に配置 + 同期グループを差分ジャンプと共有', Component: Grid2x2NavigationExample },
  { id: '06', file: '06-headless-own-grid.tsx', title: '完全ヘッドレス(自前 DOM の SpreadsheetGrid)', Component: HeadlessOwnGridExample },
  { id: '07', file: '07-export-csv.tsx', title: 'CSV エクスポート(getComparisonExportData)', Component: ExportCsvExample },
  { id: '08', file: '08-manual-input.tsx', title: 'マニュアル入力(useManualRows)', Component: ManualInputExample },
] as const;

type ExampleId = (typeof EXAMPLES)[number]['id'];

// URL の ?example=05 で初期選択を指定できる。
const readInitialId = (): ExampleId => {
  const id = new URLSearchParams(window.location.search).get('example');
  return EXAMPLES.some((example) => example.id === id) ? (id as ExampleId) : '01';
};

export function ExamplesDemo() {
  const [selectedId, setSelectedId] = useState<ExampleId>(readInitialId);
  const selected = EXAMPLES.find((example) => example.id === selectedId) ?? EXAMPLES[0];
  const { Component } = selected;

  return (
    <>
      <header className="demo-header">
        <h1 className="demo-title">使用例</h1>
        <nav className="demo-form" aria-label="使用例の一覧">
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              className={example.id === selectedId ? 'demo-button demo-button--primary' : 'demo-button'}
              onClick={() => setSelectedId(example.id)}
              title={example.title}
            >
              {example.id}
            </button>
          ))}
        </nav>
        <p className="demo-summary">
          {`${selected.title} — ソース: examples/${selected.file}(そのままコピーして使えます)`}
        </p>
      </header>
      <main className="demo-main demo-example">
        <Component key={selected.id} />
      </main>
    </>
  );
}
