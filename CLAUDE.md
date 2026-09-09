# CLAUDE.md — comparison-grid 開発ガイド

`@ishibashi0112/spreadsheet-grid` を表示コアに使う「構成比較」(2 構成 + 基準対各構成の N 構成)コンポーネントライブラリ(`@ishibashi0112/comparison-grid`)。**すべて日本語で対応する。** 設計判断の経緯・spreadsheet-grid への提案・Phase 2 は `docs/DESIGN_NOTES.md`、公開 API は `src/components/comparison-grid/API_REFERENCE.md` を参照。

## 技術スタック

- React 19 / TypeScript 6 / Vite 8。ツールチェーンは vite+(`vp` コマンド)。pnpm 11.12.0(`packageManager` で固定)。
- Vitest 4(`pnpm-workspace.yaml` の overrides で vp 同梱バージョンへ pin)。jsdom は `.test.tsx` のみ(先頭 docblock `// @vitest-environment jsdom`)。
- peer: `react` / `react-dom` `^19`、`@ishibashi0112/spreadsheet-grid` `>=0.29.1 <1.0.0`(0.x で minor が頻繁に上がるため `^` を使わない。0.29.1 = pointerdown の `focus({ preventScroll })` 修正)。devDependency は 0.32.0(2026-09-07 時点の npm latest。0.29.1 以降は追加のみ)。
- 構成は spreadsheet-grid リポジトリ(`~/dev/datasheet-grid`)を踏襲: ライブラリ本体は `src/components/comparison-grid/`、ルートは playground デモ(`src/App.tsx`)、配布物は `vite.lib.config.ts` + `tsconfig.lib.json` で `dist/` に生成。

## 厳守事項

- **spreadsheet-grid 本体のコードは変更しない。** 必要になった変更は `docs/DESIGN_NOTES.md` の「spreadsheet-grid への提案」に追記して報告する。
- **全ファイル LF・UTF-8**(`.gitattributes` / `.editorconfig` で固定)。コメント・UI テキスト・ドキュメントは日本語(README は英日併記)。
- TypeScript: `strict` / `verbatimModuleSyntax`(型は `import type`)/ `erasableSyntaxOnly` / `noUnusedLocals`。
- eslint baseline は **0 errors / 0 warnings**。render 中の `ref.current` 書き込みは使わない(参照安定化は `hooks/useStableValue.ts` の条件付き render 中 setState パターン)。
- 利用側の行 `T` に書き込まない(サイドカー方式: 差分は `Map<T, ComparisonRowDiff<T>>`)。グリッドへは `T[]` をそのまま渡す。
- `enable*` / `show*` の命名規約(spreadsheet-grid と同じ)。既定ラベルは日本語。
- 公開型を変えたら `API_REFERENCE.md` と README(英日)を同じ作業で更新する。使用例(`examples/`)は型検査・描画テストの対象なので、API を変えれば落ちる(直すこと)。`skills/comparison-grid/SKILL.md` の「用途 → API」表と落とし穴も同期する。`llms*.txt` は生成物(`pnpm run docs:llms`)。

## ワークフロー

1. セッション冒頭にベースライン確認(下記ゲートが全緑であること)。
2. 方針合意 → 実装 → 全ゲート検証 → コミット。1 バッチ = 1 コミット(独立に検証可能な単位)。ユーザーが「進めて」「推奨で」と言えば設計判断を委任してよい。
3. コミットメッセージ例: `feat(core): ... — batch N`。

## ゲート(全緑必須)

| ゲート | コマンド | 期待値 |
| --- | --- | --- |
| tsc(build) | `pnpm exec tsc -b` | 0 |
| tsc(test) | `pnpm run typecheck:test` | 0 |
| eslint | `pnpm lint` | 0 errors / 0 warnings |
| test | `pnpm test` | 全緑(初版: 40 tests / 4 files) |
| build | `pnpm run build:lib`(`vp build --config vite.lib.config.ts` + `tsc -p tsconfig.lib.json` + emit-layer-css) | 0 |

依存インストールは `pnpm install`。デモは `pnpm dev`。

## アーキテクチャ

```
src/components/comparison-grid/
  model/types.ts        公開型(API_REFERENCE.md と対応)
  logic/compare.ts      純ロジック: 突き合わせ + 差分判定 + ラベル生成(React 非依存)
  logic/alignRows.ts    純ロジック: 左右整列(プレースホルダ行の挿入)
  logic/compareMany.ts  純ロジック: N 構成比較(mode 'base' = 基準対各構成。2-way の compare() を構成ごとに呼んで集約 / mode 'all' = 全構成一致判定)
  logic/alignRowsMany.ts 純ロジック: N 構成の整列(構成ごとの配列 + プレースホルダ)
  logic/paneColumns.ts  純ロジック: 列定義 / 行クラスの合成、差分ラベル列(2-way / N 構成どちらの差分も受ける)
  logic/exportData.ts   純ロジック: エクスポートデータ生成(getExportData() と同形)
  logic/tree.ts         純ロジック: 階層比較(平坦な行 → 木 / 木 → パスキー付き平坦化・issues 報告)
  logic/alignTree.ts    純ロジック: 木モードの左右整列(構造マージ)
  logic/rollup.ts       純ロジック: ロールアップ(行 → 配下の差分行数)
  logic/cx.ts           className 連結
  hooks/useStableValue.ts 参照安定化(浅い構造比較)
  hooks/useComparison.ts  compare() の React 接続、alignRows / 差分のみフィルタの導出
  hooks/useTreeComparison.ts 階層比較(木)の React 接続: キー導出 / 構造整列 / 祖先を残す「差分のみ」(contextRows)
  hooks/useMultiComparison.ts N 構成比較の React 接続(compareMany + 構成ごとの差分のみ / 整列の導出)
  hooks/useComparisonNavigation.ts 差分ジャンプ(次 / 前の差分行へスクロール)
  hooks/useMultiComparisonNavigation.ts N 構成の差分ジャンプ(構成ごとの ref または group.getHandle でスクロール)
  hooks/useManualRows.ts  マニュアル入力(末尾空行維持 / 正規化 / 送信時検証)
  hooks/useComparisonPane.ts ヘッドレス層: ペインの差分合成(SpreadsheetGrid へスプレッドできる gridProps を返す。ComparisonPane の本体)
  hooks/useComparisonScrollSync.ts ヘッドレス層: スクロール同期。useComparisonScrollSyncGroup(ハンドル登録 + broadcast)/ useSyncedGridProps / useComparisonScrollSyncMany(N 構成)/ useComparisonScrollSync(2-way 便利版)
  view/ComparisonPane.tsx 片側 1 ペイン(useComparisonPane + ラッパー DOM の薄い包み)
  view/ComparisonLayout.tsx 合成コンポーネント Root / Pane / Header / Grid(Root が Context で配る。ペイン数は JSX の子の数)
  view/comparisonLayoutContext.ts 合成コンポーネントの Context / useComparisonLayout / モデル正規化(react-refresh のためコンポーネントと分離)
  view/comparisonLayoutNamespace.ts 名前空間 ComparisonLayout = { Root, Pane, Header, Grid }
  view/ComparisonView.tsx 2 ペインレイアウト(合成コンポーネントで組んだプリセット。props / DOM は従来どおり)
  styles.css            .cmpg-* クラス + --cmpg-* トークン(未レイヤー / :where)
  index.ts              公開バレル
src/App.tsx / src/demo/  ss2602(部品構成比較)再現デモ。App.tsx はモード切替(2 構成 = 木モード / N 構成 = demo/MultiComparisonDemo.tsx の合成コンポーネント + 平坦比較)
skills/comparison-grid/SKILL.md 利用側プロジェクト向けの Claude Code スキル(用途 → API / 最小コード / 落とし穴)。npm 配布物に同梱
scripts/emit-llms.mjs   llms.txt / llms-full.txt(README + API_REFERENCE + examples/README + SKILL の結合)を生成。build:lib の最終ステップ。手で編集しない
examples/               使用例(01〜08 + data.ts + README)。利用側と同じ `@ishibashi0112/comparison-grid` で import する(tsconfig.app.json の paths / vite・vitest の alias でソースへ解決)。examples.test.tsx で描画テスト。npm 配布物に同梱(package.json files)
```

- jsdom で実グリッドの行 / セルを描画させるには、`@ishibashi0112/spreadsheet-grid/testing` の `installJsdomLayoutStubs()`(v0.29.0〜)を `beforeAll` で呼ぶ(`view/ComparisonView.test.tsx` 参照。返り値のアンインストーラを `afterAll` で呼ぶ)。no-op の ResizeObserver だと列が 1 本も描画されない。
