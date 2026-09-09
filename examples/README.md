# 使用例 / Examples

利用側と同じ import パス(`@ishibashi0112/comparison-grid`)で書いた、そのままコピーして使える例です。すべて型検査(`pnpm exec tsc -b`)と描画テスト(`examples/examples.test.tsx`)の対象なので、公開 API と食い違うことはありません。共通のデータ・列定義は [`data.ts`](./data.ts)。

Copy-paste-ready examples written with the same import path a consumer uses (`@ishibashi0112/comparison-grid`). Every file is type-checked and rendered in `examples/examples.test.tsx`, so they cannot drift from the public API. Shared data and columns live in [`data.ts`](./data.ts).

| ファイル / File | 何を示すか | What it shows |
| --- | --- | --- |
| [01-two-way-basic.tsx](./01-two-way-basic.tsx) | 2 構成の基本形。`useComparison` + `ComparisonView`、差分のみトグル、件数 | Two-list basics: `useComparison` + `ComparisonView`, diff-only toggle, counts |
| [02-tree-comparison.tsx](./02-tree-comparison.tsx) | 階層比較。`buildComparisonTree` + `useTreeComparison`、折りたたみ、文脈行、ロールアップ | Hierarchical (BOM) comparison with path keys, collapse, context rows, rollup |
| [03-multi-base.tsx](./03-multi-base.tsx) | 3 構成(基準対各構成)。`useMultiComparison` + `ComparisonLayout` | Three sides against a base with the compound `ComparisonLayout` |
| [04-multi-all.tsx](./04-multi-all.tsx) | 全構成一致判定 `mode: 'all'` と、Root 配下の自作パーツ(`useComparisonLayout`) | `mode: 'all'` plus a custom part inside `Root` via `useComparisonLayout` |
| [05-grid-2x2-navigation.tsx](./05-grid-2x2-navigation.tsx) | 4 構成を 2×2 に配置。同期グループを差分ジャンプと共有 | Four sides in a 2×2 grid; scroll-sync group shared with diff navigation |
| [06-headless-own-grid.tsx](./06-headless-own-grid.tsx) | ヘッドレス。自前 DOM の `SpreadsheetGrid` に `useComparisonPane` / `useComparisonScrollSync` を配線 | Headless: your own DOM and `SpreadsheetGrid`, wired with the hooks |
| [07-export-csv.tsx](./07-export-csv.tsx) | エクスポート。`getComparisonExportData` → CSV | Export: `getComparisonExportData` to CSV |
| [08-manual-input.tsx](./08-manual-input.tsx) | マニュアル入力。`useManualRows` で編集ペインを作りマスタと比較 | Manual input: an editable pane via `useManualRows` compared against a master list |

自分のプロジェクトで使うときは、`./data` の型・データを自分のものに置き換えるだけです。CSS は `import '@ishibashi0112/comparison-grid/style.css'`(Tailwind v4 では `style.layer.css`)。

To reuse in your project, replace the `./data` types and rows with your own. Styles come from `import '@ishibashi0112/comparison-grid/style.css'` (`style.layer.css` for Tailwind v4 layers).
