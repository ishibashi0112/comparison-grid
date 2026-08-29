# @ishibashi0112/comparison-grid

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Side-by-side **two-list comparison** for **React 19**, built on top of [`@ishibashi0112/spreadsheet-grid`](https://www.npmjs.com/package/@ishibashi0112/spreadsheet-grid). Match two lists by key, highlight the rows and cells that differ, filter to differences only — by passing **your row type, your data, your column definitions and a minimal compare config**.

**React 19** 製の「2 構成比較」コンポーネント。左右のリストをキーで突き合わせ、差分行 / 差分セルのハイライトと「差分のみ表示」を、**行の型・データ・列定義・最小限の比較設定を渡すだけ**で組み立てます。

**English** | [日本語](#日本語)

---

## Features

- **Headless diff core** — `compare()` is a pure, React-free function (Map-based `O(n + m)`). Rows are never mutated: diffs live in a side map keyed by row object, so your `T` stays exactly `T`.
- **Four diff kinds** — `same` / `left-only` / `right-only` / `field-diff`, with a generated label (`"左のみ"`, `"数量・支給区分違い"`, …) that you can reword or replace.
- **`useComparison()`** — derives `visibleLeft` / `visibleRight` (diff-only filter), `effectiveShowDiffOnly` (never `true` when one side is empty), `canShowDiffOnly` (for disabling the toggle), per-side counts and duplicate-key reports.
- **Aligned mode (`alignRows`)** — both panes get the same length in match order, with placeholder rows (styled `.cmpg-row-placeholder`) inserted on the missing side; the diff-only filter works per pair so alignment is preserved.
- **Scroll sync (`enableScrollSync`)** — keeps both panes' vertical scroll in lockstep (user scrolls propagate, API-driven ones are ignored to prevent loops). Pairs naturally with `alignRows`.
- **`ComparisonView` / `ComparisonPane`** — two `SpreadsheetGrid`s with row highlight, key-column highlight for one-sided rows, field-cell highlight for differing values, and an optional auto-inserted diff-label column. You write plain `GridColumn<T>[]`; the library composes its classes with yours.
- **Every grid feature stays available** — `gridProps` passes `SpreadsheetGridProps<T>` through (sorting, filters, theme, density, context menu, imperative `ref`…). Only `rows` / `columns` / `dataSource` are reserved.
- **Themeable** — colors and gaps are CSS custom properties (`--cmpg-*`) defined at zero specificity; a dark preset follows `theme="dark"` automatically. Unlayered CSS plus a `style.layer.css` variant for Tailwind v4 cascade layers.
- TypeScript-first, fully controlled.

## Installation

```sh
npm install @ishibashi0112/comparison-grid @ishibashi0112/spreadsheet-grid
# pnpm add @ishibashi0112/comparison-grid @ishibashi0112/spreadsheet-grid
```

Peer dependencies: **react** / **react-dom** `>= 19` and **@ishibashi0112/spreadsheet-grid** `>= 0.29.0 < 1`.

## Styles

Import both stylesheets once (for example, in your app entry):

```ts
import '@ishibashi0112/spreadsheet-grid/style.css'
import '@ishibashi0112/comparison-grid/style.css'
```

The library CSS is plain (unlayered) CSS scoped to `.cmpg-*` classes. Highlights are applied by chaining the grid's base cell class (`.ssg-body-cell.cmpg-row-diff`), so they win over grid defaults regardless of import order. All tokens are defined at zero specificity, so your overrides always win:

```css
.cmpg-pane {
  --cmpg-diff-row-bg: #fff7ed;   /* rows that differ */
  --cmpg-diff-text: #b91c1c;     /* key cells / differing field cells */
  --cmpg-diff-font-weight: 600;
}
.cmpg-pane .ssg-theme-dark {
  --cmpg-diff-row-bg: rgba(251, 146, 60, 0.18);
}
```

### Using with Tailwind CSS v4 / HeroUI / Mantine

Works out of the box. If you want Tailwind utilities to override the defaults without `!`, put both stylesheets into a layer below `utilities`:

```css
@import 'tailwindcss';
@import '@ishibashi0112/spreadsheet-grid/style.css' layer(components);
@import '@ishibashi0112/comparison-grid/style.css' layer(components);
```

Or use the pre-layered variants and declare the order yourself:

```css
@layer theme, base, ssg-base, cmpg-base, components, utilities;
@import 'tailwindcss';
@import '@ishibashi0112/spreadsheet-grid/style.layer.css';
@import '@ishibashi0112/comparison-grid/style.layer.css';
```

## Quick start

```tsx
import { useState } from 'react';
import { useComparison, ComparisonView } from '@ishibashi0112/comparison-grid';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';

type BomRow = {
  itemPath: string;
  itemCode: string;
  itemName: string;
  shikiyuKbn: string;
  qty: string;
};

// Column definitions are written against your own T — nothing to wrap.
const columns: GridColumn<BomRow>[] = [
  { key: 'itemCode', title: 'Item', width: 120 },
  { key: 'itemName', title: 'Name', width: 220 },
  { key: 'shikiyuKbn', title: 'Supply', width: 70 },
  { key: 'qty', title: 'Qty', width: 70, align: 'right' },
];

function BomComparison({ leftRows, rightRows }: { leftRows: BomRow[]; rightRows: BomRow[] }) {
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  // 1. Compare config: how to match rows, which fields to diff.
  const comparison = useComparison<BomRow>({
    left: leftRows,
    right: rightRows,
    getMatchKey: (row) => row.itemPath,
    compareFields: [
      { key: 'qty', label: '数量' },
      { key: 'shikiyuKbn', label: '支給区分' },
    ],
    showDiffOnly, // your state; the effective value is derived (false while one side is empty)
  });

  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={comparison.effectiveShowDiffOnly}
          disabled={!comparison.canShowDiffOnly}
          onChange={(e) => setShowDiffOnly(e.target.checked)}
        />
        Differences only
      </label>
      {/* 2. Two panes + highlights + diff-label column. */}
      <ComparisonView
        comparison={comparison}
        columns={columns}
        keyColumnKeys={['itemCode']}
        showDiffLabelColumn
        diffLabelColumn={{ title: '変更箇所', width: 150 }}
        leftHeader={<h3>Before</h3>}
        rightHeader={<h3>After</h3>}
        gridProps={{ rowHeight: 25, headerHeight: 25, maxHeight: 720 }}
      />
    </>
  );
}
```

What you get by default:

| Element | Behaviour | Class |
| --- | --- | --- |
| Row highlight | every row whose kind is not `same` (row container + each data cell) | `.cmpg-row-diff` + `--left-only` / `--right-only` / `--field` |
| Key-cell highlight | cells of `keyColumnKeys` columns on `left-only` / `right-only` rows | `.cmpg-cell-diff.cmpg-cell-diff--key` |
| Field-cell highlight | cells of the column mapped from each differing `CompareField` (`columnKey ?? key`) | `.cmpg-cell-diff.cmpg-cell-diff--field` |
| Diff label | `"左のみ"` / `"右のみ"` / `"数量・支給区分違い"` / `""` — shown in the optional label column and available via `getDiff(row).label` | — |

## Headless usage

```ts
import { compare } from '@ishibashi0112/comparison-grid';

const result = compare(left, right, {
  getMatchKey: (row) => row.id,
  compareFields: [{ key: 'qty', label: 'Qty' }],
});
result.annotatedLeft;     // { row, diff }[] in input order
result.leftDiffs.get(row); // ComparisonRowDiff | undefined (keyed by row object)
result.summary.left;      // { total, same, only, fieldDiff }
result.duplicateKeys;     // { left: string[], right: string[] }
```

## Recipes

### Swap the match key at runtime (e.g. "compare by representative part number")

The core knows nothing about your domain. Express alternative matching rules by swapping `getMatchKey`:

```ts
const byPath = (row: BomRow) => row.itemPath;
const byRepresentative = (row: BomRow) =>
  row.itemPath.replace(row.itemCode, row.reprItemCode || row.itemCode);

useComparison({ ..., getMatchKey: useRepresentative ? byRepresentative : byPath });
```

Define the functions outside the component (or memoize them) — a new function identity re-runs the comparison.

### Compare numbers stored as strings

```ts
{ key: 'qty', label: 'Qty', equals: (a, b) => Number(a) === Number(b) }
```

`equals` always receives `(leftValue, rightValue)`, on both sides.

### Compare a derived value and highlight a different column

```ts
{ key: 'total', label: 'Total', getValue: (row) => row.qty * row.unitPrice, columnKey: 'amount' }
```

### Custom labels

```ts
useComparison({
  ...,
  labels: { leftOnly: 'Left only', rightOnly: 'Right only', fieldDiffSeparator: ', ', fieldDiffSuffix: ' differ' },
  // or take over completely:
  formatDiffLabel: (ctx) => (ctx.kind === 'field-diff' ? ctx.diffFields.map((f) => f.label).join(' / ') : ctx.kind),
});
```

### Show counts in a toolbar

```tsx
const { summary } = comparison;
<span>{`left-only ${summary.left.only} / right-only ${summary.right.only} / changed ${summary.left.fieldDiff}`}</span>
```

### Keep every grid feature

```tsx
<ComparisonView
  gridProps={{ enableSorting: true, enableColumnFilter: true, theme: 'dark', density: 'compact' }}
  leftGridProps={{ ref: leftGridRef }}
/>
```

`gridProps` is `SpreadsheetGridProps<T>` minus `rows` / `columns` / `dataSource`. `getRowClassName`, per-column `cellClassName` and `className` are **composed** with the library's classes, not replaced.

### Rows must keep their identity

Diffs are looked up by row **object identity**. Pass the same arrays from `useComparison` (`visibleLeft` / `visibleRight`) to the panes and do not clone rows in between.

## API reference

See [`API_REFERENCE.md`](./src/components/comparison-grid/API_REFERENCE.md) (Japanese) for every prop, type and CSS token.

## License

MIT

---

## 日本語

### 特徴

- **headless な差分コア** — `compare()` は React 非依存の純関数(Map による `O(n + m)`)。行には一切書き込まず、差分は行オブジェクトをキーにした横持ちの Map で返すため、利用側の `T` は `T` のままです。
- **4 種類の差分** — `same` / `left-only` / `right-only` / `field-diff` と、生成ラベル(`"左のみ"`、`"数量・支給区分違い"` など)。文言の差し替え / 完全カスタムが可能。
- **`useComparison()`** — `visibleLeft` / `visibleRight`(差分のみフィルタ)、`effectiveShowDiffOnly`(片側が空なら常に `false`)、`canShowDiffOnly`(トグルの無効化条件)、片側ごとの件数、キー重複の報告を導出します。
- **左右整列モード(`alignRows`)** — 両ペインを突き合わせ順の同じ長さに揃え、欠損側へプレースホルダ行(`.cmpg-row-placeholder`)を挿入。「差分のみ」は対の単位でフィルタされ、整列が保たれます。
- **スクロール同期(`enableScrollSync`)** — 左右ペインの縦スクロールを同期(ユーザー操作のみ伝播し、API 由来は無視してループを防止)。`alignRows` との併用を想定。
- **`ComparisonView` / `ComparisonPane`** — 2 つの `SpreadsheetGrid` に、差分行ハイライト / 片側のみ行のキー列強調 / 差分フィールドセルの強調 / 差分ラベル列(任意)を配線。利用側は素の `GridColumn<T>[]` を書くだけで、ライブラリのクラスは利用側のクラスと合成されます。
- **グリッドの全機能をそのまま利用可** — `gridProps` で `SpreadsheetGridProps<T>` を透過(ソート / フィルター / テーマ / 密度 / コンテキストメニュー / 命令的 `ref` …)。予約するのは `rows` / `columns` / `dataSource` だけ。
- **テーマ対応** — 色と余白は特異度 0 で定義した CSS 変数(`--cmpg-*`)。`theme="dark"` に自動追従するダークプリセット付き。未レイヤー CSS と、Tailwind v4 向けの `style.layer.css` の二本立て。
- TypeScript ファースト、完全 controlled。

### インストール

```sh
npm install @ishibashi0112/comparison-grid @ishibashi0112/spreadsheet-grid
# pnpm add @ishibashi0112/comparison-grid @ishibashi0112/spreadsheet-grid
```

peer dependencies: **react** / **react-dom** `>= 19`、**@ishibashi0112/spreadsheet-grid** `>= 0.29.0 < 1`。

### スタイル

両方の CSS をアプリのエントリ等で 1 度だけ import してください:

```ts
import '@ishibashi0112/spreadsheet-grid/style.css'
import '@ishibashi0112/comparison-grid/style.css'
```

ライブラリの CSS は `.cmpg-*` クラスにスコープした未レイヤーの素の CSS です。ハイライトはグリッドの基底セルクラスとの連結セレクタ(`.ssg-body-cell.cmpg-row-diff`)でかけるため、読み込み順に依らずグリッド既定に勝ちます。トークンはすべて特異度 0 で定義されているので、上書きは必ず勝ちます:

```css
.cmpg-pane {
  --cmpg-diff-row-bg: #fff7ed;   /* 差分のある行 */
  --cmpg-diff-text: #b91c1c;     /* キー列セル / 差分フィールドセル */
  --cmpg-diff-font-weight: 600;
}
.cmpg-pane .ssg-theme-dark {
  --cmpg-diff-row-bg: rgba(251, 146, 60, 0.18);
}
```

#### Tailwind CSS v4 / HeroUI / Mantine との共存

そのままで動作します。Tailwind ユーティリティで `!` なしに既定を上書きしたい場合は、両方の CSS を `utilities` より下のレイヤーへ入れてください:

```css
@import 'tailwindcss';
@import '@ishibashi0112/spreadsheet-grid/style.css' layer(components);
@import '@ishibashi0112/comparison-grid/style.css' layer(components);
```

もしくはレイヤー済みバリアントを使い、順序を自分で宣言します:

```css
@layer theme, base, ssg-base, cmpg-base, components, utilities;
@import 'tailwindcss';
@import '@ishibashi0112/spreadsheet-grid/style.layer.css';
@import '@ishibashi0112/comparison-grid/style.layer.css';
```

### クイックスタート

```tsx
import { useState } from 'react';
import { useComparison, ComparisonView } from '@ishibashi0112/comparison-grid';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';

type BomRow = {
  itemPath: string;
  itemCode: string;
  itemName: string;
  shikiyuKbn: string;
  qty: string;
};

// 列定義は利用側の T に対してそのまま書く(ラップ不要)。
const columns: GridColumn<BomRow>[] = [
  { key: 'itemCode', title: '品目コード', width: 120 },
  { key: 'itemName', title: '品目名', width: 220 },
  { key: 'shikiyuKbn', title: '支給', width: 70 },
  { key: 'qty', title: '数量', width: 70, align: 'right' },
];

function BomComparison({ leftRows, rightRows }: { leftRows: BomRow[]; rightRows: BomRow[] }) {
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  // 1. 比較設定: キーの取り方と「差分を見る」フィールドを宣言するだけ。
  const comparison = useComparison<BomRow>({
    left: leftRows,
    right: rightRows,
    getMatchKey: (row) => row.itemPath,
    compareFields: [
      { key: 'qty', label: '数量' },
      { key: 'shikiyuKbn', label: '支給区分' },
    ],
    showDiffOnly, // 利用側の state。実効値はフックが導出(片側が空なら false)
  });

  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={comparison.effectiveShowDiffOnly}
          disabled={!comparison.canShowDiffOnly}
          onChange={(e) => setShowDiffOnly(e.target.checked)}
        />
        差分のみ
      </label>
      {/* 2. 2 ペイン + 差分ハイライト + 差分ラベル列。 */}
      <ComparisonView
        comparison={comparison}
        columns={columns}
        keyColumnKeys={['itemCode']}
        showDiffLabelColumn
        diffLabelColumn={{ title: '変更箇所', width: 150 }}
        leftHeader={<h3>変更前</h3>}
        rightHeader={<h3>変更後</h3>}
        gridProps={{ rowHeight: 25, headerHeight: 25, maxHeight: 720 }}
      />
    </>
  );
}
```

既定で得られるもの:

| 要素 | 挙動 | クラス |
| --- | --- | --- |
| 行ハイライト | `same` 以外のすべての行(行コンテナ + 各データセル) | `.cmpg-row-diff` + `--left-only` / `--right-only` / `--field` |
| キー列セル強調 | `left-only` / `right-only` 行の `keyColumnKeys` 列のセル | `.cmpg-cell-diff.cmpg-cell-diff--key` |
| 差分フィールドセル強調 | 差分のあった `CompareField` に対応する列(`columnKey ?? key`)のセル | `.cmpg-cell-diff.cmpg-cell-diff--field` |
| 差分ラベル | `"左のみ"` / `"右のみ"` / `"数量・支給区分違い"` / `""` — 任意のラベル列に表示。`getDiff(row).label` でも取得可 | — |

### headless で使う

```ts
import { compare } from '@ishibashi0112/comparison-grid';

const result = compare(left, right, {
  getMatchKey: (row) => row.id,
  compareFields: [{ key: 'qty', label: '数量' }],
});
result.annotatedLeft;      // 入力順の { row, diff }[]
result.leftDiffs.get(row); // ComparisonRowDiff | undefined(行オブジェクトで引く)
result.summary.left;       // { total, same, only, fieldDiff }
result.duplicateKeys;      // { left: string[], right: string[] }
```

### レシピ

#### 突き合わせキーを実行時に切り替える(例: 代表品番比較)

コアはドメインを知りません。別の突き合わせ規則は `getMatchKey` の差し替えで表現します:

```ts
const byPath = (row: BomRow) => row.itemPath;
const byRepresentative = (row: BomRow) =>
  row.itemPath.replace(row.itemCode, row.reprItemCode || row.itemCode);

useComparison({ ..., getMatchKey: useRepresentative ? byRepresentative : byPath });
```

関数はコンポーネント外で定義する(またはメモ化する)こと — 関数の同一性が変わると比較が再実行されます。

#### 文字列で持っている数値を比較する

```ts
{ key: 'qty', label: '数量', equals: (a, b) => Number(a) === Number(b) }
```

`equals` の引数順は左右どちらの注釈でも常に `(左の値, 右の値)` です。

#### 計算値を比較して別の列を強調する

```ts
{ key: 'total', label: '金額', getValue: (row) => row.qty * row.unitPrice, columnKey: 'amount' }
```

#### ラベルのカスタマイズ

```ts
useComparison({
  ...,
  labels: { leftOnly: 'Left only', rightOnly: 'Right only', fieldDiffSeparator: ', ', fieldDiffSuffix: ' differ' },
  // 完全に差し替える場合:
  formatDiffLabel: (ctx) => (ctx.kind === 'field-diff' ? ctx.diffFields.map((f) => f.label).join(' / ') : ctx.kind),
});
```

#### ツールバーに件数を出す

```tsx
const { summary } = comparison;
<span>{`左のみ ${summary.left.only} / 右のみ ${summary.right.only} / 項目違い ${summary.left.fieldDiff}`}</span>
```

#### グリッドの機能をそのまま使う

```tsx
<ComparisonView
  gridProps={{ enableSorting: true, enableColumnFilter: true, theme: 'dark', density: 'compact' }}
  leftGridProps={{ ref: leftGridRef }}
/>
```

`gridProps` は `SpreadsheetGridProps<T>` から `rows` / `columns` / `dataSource` を除いたものです。`getRowClassName`、列の `cellClassName`、`className` はライブラリのクラスと**合成**されます(置き換えではありません)。

#### 行の同一性を保つ

差分は行**オブジェクトの同一性**で引きます。`useComparison` が返す配列(`visibleLeft` / `visibleRight`)をそのままペインへ渡し、途中で行を複製しないでください。

### API リファレンス

すべての props / 型 / CSS トークンは [`API_REFERENCE.md`](./src/components/comparison-grid/API_REFERENCE.md) を参照してください。

### ライセンス

MIT
