---
name: comparison-grid
description: "@ishibashi0112/comparison-grid の使い方。2 つ以上のリスト / 部品表(BOM)構成をキーで突き合わせ、差分行・差分セルを spreadsheet-grid 上でハイライトする UI を作る・直すときに使う(2 構成、階層比較、基準対 N 構成、全構成一致判定、合成コンポーネントでの独自配置、ヘッドレス利用、CSV エクスポート、手入力ペイン)。"
---

# comparison-grid の使い方(AI アシスタント向け)

このスキルは、利用側プロジェクトで `@ishibashi0112/comparison-grid` を使うコードを書く / 直すときの手引きです。
一次情報は同梱の次のファイルにあります。**迷ったらまず使用例を開いてください**(型検査・描画テスト済みで、そのままコピーできます)。

- 使用例: `node_modules/@ishibashi0112/comparison-grid/examples/`(索引は `examples/README.md`)
- 全文リファレンス: `node_modules/@ishibashi0112/comparison-grid/llms-full.txt`(README + API リファレンス + 使用例索引)
- 型と JSDoc(`@example` つき): `node_modules/@ishibashi0112/comparison-grid/dist/index.d.ts` と `dist/**/*.d.ts`
- 表示コア: `@ishibashi0112/spreadsheet-grid`(peer。列定義 `GridColumn<T>` と grid props はそちらの型)

## 1. 何を使うか(用途 → API)

| やりたいこと | 使う API | 使用例 |
| --- | --- | --- |
| 2 つのリストを比べて画面に出す | `useComparison` + `ComparisonView` | `examples/01-two-way-basic.tsx` |
| 部品表(階層)を比べる | `buildComparisonTree` + `useTreeComparison` + `ComparisonView` | `examples/02-tree-comparison.tsx` |
| 3 構成以上を「基準に対して」比べる | `useMultiComparison` + `ComparisonLayout.Root / .Pane / .Header / .Grid` | `examples/03-multi-base.tsx` |
| 3 構成以上で「どこかに揺れがある行」を全部出す | `useMultiComparison({ mode: 'all' })` | `examples/04-multi-all.tsx` |
| ペインの配置・数を自分で決める(2×2 など) | `ComparisonLayout`(Root の `style` で CSS Grid を上書き) | `examples/05-grid-2x2-navigation.tsx` |
| 次 / 前の差分へスクロール | `useComparisonNavigation` / `useMultiComparisonNavigation` | `examples/05-grid-2x2-navigation.tsx` |
| DOM を完全に自前にする | `useComparisonPane` + `useComparisonScrollSync`(N 構成は `useComparisonScrollSyncMany`) | `examples/06-headless-own-grid.tsx` |
| React なしで判定だけ | `compare` / `compareMany` / `alignComparisonRows(Many)` | — |
| CSV / Excel | `getComparisonExportData` | `examples/07-export-csv.tsx` |
| 手入力ペインをマスタと比べる | `useManualRows` + `useComparison` | `examples/08-manual-input.tsx` |

層の構造(下ほど自由、上ほど短い): `ComparisonView`(プリセット)→ `ComparisonLayout`(合成コンポーネント)→ `useComparisonPane` などのフック(ヘッドレス)→ `compare` などの純ロジック。**必要な自由度の層まで降りる**のが原則で、それより下を自作しないこと。

## 2. 最小コード

```tsx
import { useComparison, ComparisonView } from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css'; // Tailwind v4 のレイヤーを使うなら style.layer.css

const comparison = useComparison<Row>({
  left, right,
  getMatchKey: (row) => row.id,                     // 突き合わせキー(コンポーネント外で定義)
  compareFields: [{ key: 'qty', label: '数量' }],  // 差分を見るフィールド。label はラベル文言に使われる
  showDiffOnly,                                     // 「意思」。実効値は comparison.effectiveShowDiffOnly
});
<ComparisonView<Row> comparison={comparison} columns={columns} keyColumnKeys={['id']} showDiffLabelColumn />;
```

3 構成以上は `useMultiComparison({ sides: [{ id, rows, label }, …] })` と `ComparisonLayout.Root` に `sides.map` でペインを並べる(`examples/03`)。

## 3. 守ること(落とし穴)

1. **行オブジェクトの同一性**で差分を引く。`comparison.visibleLeft` などをそのままペインに渡す。`map` で複製すると強調されない。
2. `getMatchKey` / `getCode` / `createPlaceholderRow` / `equals` などの関数は**コンポーネント外で定義**する。`compareFields` / `columns` / `labels` / `sides` は浅い比較で安定化されるのでインラインでよい。
3. 「差分のみ」トグルは `checked={comparison.effectiveShowDiffOnly}` / `disabled={!comparison.canShowDiffOnly}`(片側が空のとき自動で無効になる)。
4. 列は素の `GridColumn<T>[]` を書く。ライブラリが `cellClassName` / `getRowClassName` を合成するので、独自クラスと共存する。`rows` / `columns` / `dataSource` は `gridProps` に渡さない(予約)。
5. 差分ジャンプ(`scrollToRow`)は view index を使う。グリッド側のソート / フィルターと同時に使わない。
6. 木モードは「展開済み・出現 1 回 = 1 行」のデータ前提。破綻は `buildComparisonTree(...).issues` に出るが修復されない。
7. 3 構成以上の意味論: `mode: 'base'`(既定)は「基準から見て何が変わったか」、`mode: 'all'` は「全構成に存在し全構成で一致するときだけ同一」。ユーザーの意図がどちらか確認してから選ぶ。
8. 色は CSS 変数 `--cmpg-*`(`.cmpg-pane` / `.cmpg-grid` に定義)で上書きする。クラス名は `CMPG_CLASS_NAMES` を参照し、文字列を直書きしない。
9. **lazy 分割**: 配布物は単一モジュールなので、比較フック(`useComparison` 等)を初期バンドルに、`ComparisonView` を `React.lazy` のチャンクに分けると、ライブラリ丸ごと(+ spreadsheet-grid)が初期バンドル側に入って分割が効かない。フックとビューは同じチャンクに置く(画面単位で lazy にする)。
10. **jsdom テストの行数**: ピン留め列(`pinned`)があると `.ssg-body-row` はセクションごとに描画され行数が倍に見える。行数は `data-row-index` の一意な数で数える。

## 4. 差分の形(判定結果を自作 UI で使うとき)

- 2 構成: `ComparisonRowDiff<T>` = `{ side: 'left' | 'right', kind: 'same' | 'left-only' | 'right-only' | 'field-diff', label, matchKey, fieldDiffs: Set<string>, counterpart?: T }`。`comparison.getDiff(row)` で引く。
- N 構成: `ComparisonMultiRowDiff<T>` = `{ sideId, isBase, kind: 'same' | 'only' | 'partial' | 'field-diff', label, matchKey, fieldDiffs(和集合), missingIn: Set<sideId>, counterparts: Map<sideId, T>, bySide: Map<sideId, ComparisonRowDiff<T>> }`。`multi.getDiff(row)` で引く。
- 件数: 2 構成は `comparison.summary.left / .right` = `{ total, same, only, fieldDiff }`、N 構成は `side.summary` = `{ total, same, only, partial, fieldDiff }`。
