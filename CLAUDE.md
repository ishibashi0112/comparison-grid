# CLAUDE.md — comparison-grid 開発ガイド

`@ishibashi0112/spreadsheet-grid` を表示コアに使う「2 構成比較」コンポーネントライブラリ(`@ishibashi0112/comparison-grid`)。**すべて日本語で対応する。** 設計判断の経緯・spreadsheet-grid への提案・Phase 2 は `docs/DESIGN_NOTES.md`、公開 API は `src/components/comparison-grid/API_REFERENCE.md` を参照。

## 技術スタック

- React 19 / TypeScript 6 / Vite 8。ツールチェーンは vite+(`vp` コマンド)。pnpm 11.12.0(`packageManager` で固定)。
- Vitest 4(`pnpm-workspace.yaml` の overrides で vp 同梱バージョンへ pin)。jsdom は `.test.tsx` のみ(先頭 docblock `// @vitest-environment jsdom`)。
- peer: `react` / `react-dom` `^19`、`@ishibashi0112/spreadsheet-grid` `>=0.29.0 <1.0.0`(0.x で minor が頻繁に上がるため `^` を使わない)。
- 構成は spreadsheet-grid リポジトリ(`~/dev/datasheet-grid`)を踏襲: ライブラリ本体は `src/components/comparison-grid/`、ルートは playground デモ(`src/App.tsx`)、配布物は `vite.lib.config.ts` + `tsconfig.lib.json` で `dist/` に生成。

## 厳守事項

- **spreadsheet-grid 本体のコードは変更しない。** 必要になった変更は `docs/DESIGN_NOTES.md` の「spreadsheet-grid への提案」に追記して報告する。
- **全ファイル LF・UTF-8**(`.gitattributes` / `.editorconfig` で固定)。コメント・UI テキスト・ドキュメントは日本語(README は英日併記)。
- TypeScript: `strict` / `verbatimModuleSyntax`(型は `import type`)/ `erasableSyntaxOnly` / `noUnusedLocals`。
- eslint baseline は **0 errors / 0 warnings**。render 中の `ref.current` 書き込みは使わない(参照安定化は `hooks/useStableValue.ts` の条件付き render 中 setState パターン)。
- 利用側の行 `T` に書き込まない(サイドカー方式: 差分は `Map<T, ComparisonRowDiff<T>>`)。グリッドへは `T[]` をそのまま渡す。
- `enable*` / `show*` の命名規約(spreadsheet-grid と同じ)。既定ラベルは日本語。
- 公開型を変えたら `API_REFERENCE.md` と README(英日)を同じ作業で更新する。

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
  logic/paneColumns.ts  純ロジック: 列定義 / 行クラスの合成、差分ラベル列
  logic/cx.ts           className 連結
  hooks/useStableValue.ts 参照安定化(浅い構造比較)
  hooks/useComparison.ts  compare() の React 接続、差分のみフィルタの導出
  view/ComparisonPane.tsx 片側 1 ペイン(SpreadsheetGrid ラッパー)
  view/ComparisonView.tsx 2 ペインレイアウト
  styles.css            .cmpg-* クラス + --cmpg-* トークン(未レイヤー / :where)
  index.ts              公開バレル
src/App.tsx / src/demo/  ss2602(部品構成比較)再現デモ
```

- jsdom で実グリッドの行 / セルを描画させるには、`view/ComparisonView.test.tsx` の `beforeAll` で `@ishibashi0112/spreadsheet-grid/testing` の `installJsdomLayoutStubs()`(0.29.0 で公式化された公式スタブ)を呼ぶ。no-op の ResizeObserver だと列が 1 本も描画されない。
