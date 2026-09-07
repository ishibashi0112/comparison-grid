# @ishibashi0112/comparison-grid

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Side-by-side **list comparison** (two lists, or three and more against a base) for **React 19**, built on top of [`@ishibashi0112/spreadsheet-grid`](https://www.npmjs.com/package/@ishibashi0112/spreadsheet-grid). Match lists by key, highlight the rows and cells that differ, filter to differences only — by passing **your row type, your data, your column definitions and a minimal compare config**. Compose the panes yourself with the compound `ComparisonLayout` components, or use the two-pane `ComparisonView` preset.

**React 19** 製の「構成比較」コンポーネント(2 構成、または基準に対する 3 構成以上)。リストをキーで突き合わせ、差分行 / 差分セルのハイライトと「差分のみ表示」を、**行の型・データ・列定義・最小限の比較設定を渡すだけ**で組み立てます。ペインの配置は合成コンポーネント `ComparisonLayout` で自由に組め、2 ペインのプリセット `ComparisonView` も使えます。

**English** | [日本語](#日本語)

---

## Features

- **Headless diff core** — `compare()` is a pure, React-free function (Map-based `O(n + m)`). Rows are never mutated: diffs live in a side map keyed by row object, so your `T` stays exactly `T`.
- **Four diff kinds** — `same` / `left-only` / `right-only` / `field-diff`, with a generated label (`"左のみ"`, `"数量・支給区分違い"`, …) that you can reword or replace.
- **`useComparison()`** — derives `visibleLeft` / `visibleRight` (diff-only filter), `effectiveShowDiffOnly` (never `true` when one side is empty), `canShowDiffOnly` (for disabling the toggle), per-side counts and duplicate-key reports.
- **Aligned mode (`alignRows`)** — both panes get the same length in match order, with placeholder rows (styled `.cmpg-row-placeholder`) inserted on the missing side; the diff-only filter works per pair so alignment is preserved.
- **3+ configurations (`compareMany()` / `alignComparisonRowsMany()`)** — pick one side as the base and every other side is compared against it. Non-base rows carry the plain two-way diff; base rows aggregate it (`fieldDiffs` is the union, `missingIn` lists the sides that lack the row, `bySide` keeps the per-side detail) with labels like `案1: 数量違い / 案2: 無し`. `useMultiComparison()` adds the diff-only filter, aligned mode and `hasAllSides` on top, per side; feed each side's `visibleRows` / `diffs` to `useComparisonPane`. Scroll sync (`useComparisonScrollSyncMany()`) and diff navigation (`useMultiComparisonNavigation()`) work across any number of sides, and `ComparisonLayout` renders as many panes as you put in the JSX.
- **Hierarchical comparison (`useTreeComparison()`)** — for BOM-like trees. Build a tree from flat rows (`buildComparisonTree`: depth-first + level, or adjacency list), and the library derives **path keys** (`B2002/C3001`) so the same part under a different parent never pairs; representative-code substitution propagates to descendants; sibling duplicates get an occurrence suffix; broken input is reported as `issues`, never repaired. Aligned mode becomes a structural merge (right-only subtrees land next to their siblings) and the diff-only filter keeps ancestors as dimmed context rows. Unchanged parents with changes below get a `.cmpg-row-rollup` tint and a `配下に差分 n 件` label in the diff-label column (`getDescendantDiffCount(row)` for your own columns). Collapse subtrees with `collapsedKeys` — a `Set` of path keys, so one key folds the pair on both panes.
- **Scroll sync (`enableScrollSync`)** — keeps both panes' scroll in lockstep (user scrolls propagate, API-driven ones are ignored to prevent loops). Pairs naturally with `alignRows`. Which axes sync follows the layout: side-by-side syncs vertical only; stacked (`layout='vertical'`) syncs both axes so the columns stay aligned too.
- **Export (`getComparisonExportData()`)** — one side's rows + diff label column in the same `{ columns, rows: { value, text }[][] }` shape as the grid's `getExportData()`, so downstream CSV/Excel code can be shared.
- **Diff navigation (`useComparisonNavigation()`)** — next/previous-diff jumping that scrolls both panes to the matching pair (wraps around; understands `alignRows` placeholders).
- **Manual input helper (`useManualRows()`)** — row state for an editable pane: keeps a trailing empty row, normalizes edits, validates on submit; `dataRows` (blanks excluded) feeds `useComparison`.
- **`ComparisonView` / `ComparisonPane`** — two `SpreadsheetGrid`s with row highlight, key-column highlight for one-sided rows, field-cell highlight for differing values, and an optional auto-inserted diff-label column. You write plain `GridColumn<T>[]`; the library composes its classes with yours. Panes sit side by side by default, or stack top/bottom with `layout='vertical'` (left pane on top) — handy for wide tables.
- **Compound components (`ComparisonLayout.Root` / `.Pane` / `.Header` / `.Grid`)** — the same shape as HeroUI's `Dropdown.Trigger` / `.Popover`: `Root` provides the comparison, columns and scroll-sync group through context, and each `Pane` / `Header` / `Grid` just names its role, so you decide the DOM, the order and how many panes there are. Works with `useComparison` (`side="left"` / `"right"`) and `useMultiComparison` (any side id) alike; `ComparisonView` is the two-pane preset built on it.
- **Headless view layer (`useComparisonPane()` / `useComparisonScrollSync()`)** — the panes and scroll sync are hooks first, components second. `useComparisonPane` returns `gridProps` you spread onto your own `SpreadsheetGrid` (composed columns, row classes, `getDiff`), and `useComparisonScrollSync` returns the composed `ref` / `onScroll` pair. `ComparisonPane` / `ComparisonView` are thin wrappers over them, so you can drop down a level whenever you need your own DOM or layout without losing any highlighting or sync.
- **Every grid feature stays available** — `gridProps` passes `SpreadsheetGridProps<T>` through (sorting, filters, theme, density, context menu, imperative `ref`…). Only `rows` / `columns` / `dataSource` are reserved.
- **Themeable** — colors and gaps are CSS custom properties (`--cmpg-*`) defined at zero specificity; a dark preset follows `theme="dark"` automatically, and an opt-in color-vision-deficiency preset (`.cmpg-colors-cvd`: blue/orange plus underlined diff cells) is included. Unlayered CSS plus a `style.layer.css` variant for Tailwind v4 cascade layers.
- TypeScript-first, fully controlled.

## Installation

```sh
npm install @ishibashi0112/comparison-grid @ishibashi0112/spreadsheet-grid
# pnpm add @ishibashi0112/comparison-grid @ishibashi0112/spreadsheet-grid
```

Peer dependencies: **react** / **react-dom** `>= 19` and **@ishibashi0112/spreadsheet-grid** `>= 0.29.1 < 1`.

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

Three or more sides: `compareMany` takes `{ id, rows, label? }[]`, compares every side against the base (the first one, or `baseId`), and `alignComparisonRowsMany` lines them up with placeholders:

```ts
import { compareMany, alignComparisonRowsMany } from '@ishibashi0112/comparison-grid';

const multi = compareMany(
  [
    { id: 'base', rows: current, label: '現行' },
    { id: 'a', rows: planA, label: '案1' },
    { id: 'b', rows: planB, label: '案2' },
  ],
  { getMatchKey: (row) => row.id, compareFields: [{ key: 'qty', label: '数量' }] },
);
multi.sidesById.get('base')!.diffs.get(row); // { kind: 'same' | 'only' | 'partial' | 'field-diff', missingIn, fieldDiffs, bySide, label }
multi.sidesById.get('a')!.summary;          // { total, same, only, partial, fieldDiff }
const aligned = alignComparisonRowsMany(multi);
aligned.rows.get('a');                       // rows for side 'a', same length as every other side
```

In React, `useMultiComparison` wraps both and derives the visible rows per side:

```tsx
const multi = useMultiComparison({ sides, getMatchKey: (r) => r.id, compareFields, showDiffOnly, alignRows: true });
multi.hasAllSides;             // false when any side is empty → diff-only is forced off
for (const side of multi.sides) {
  side.visibleRows;            // filtered / aligned rows for this side
  side.diffs; side.placeholderRows; // → useComparisonPane({ rows: side.visibleRows, diffs: side.diffs, placeholderRows: side.placeholderRows, ... })
}
const sync = useComparisonScrollSyncMany<Row>({ sides: syncSides }); // syncSides = useMemo(() => ({ base: undefined, a: undefined, b: undefined }), [])
const nav = useMultiComparisonNavigation({ comparison: multi, alignRows: true, getHandle: sync.group.getHandle });
// pass sync.sides[side.id] as gridProps to each pane; nav.goToNextDiff() scrolls every side
```

Or let the compound components do the wiring — `Root` owns the scroll-sync group, and each `Grid` registers its handle with it:

```tsx
import { ComparisonLayout, useMultiComparison, useComparisonScrollSyncGroup, useMultiComparisonNavigation } from '@ishibashi0112/comparison-grid';

const multi = useMultiComparison({ sides, getMatchKey: (r) => r.id, compareFields, alignRows: true });
const group = useComparisonScrollSyncGroup<Row>();                       // optional: share it with navigation
const nav = useMultiComparisonNavigation({ comparison: multi, alignRows: true, getHandle: group.getHandle });

<ComparisonLayout.Root<Row> comparison={multi} columns={columns} keyColumnKeys={['id']} scrollSyncGroup={group} showDiffLabelColumn>
  {multi.sides.map((side) => (
    <ComparisonLayout.Pane key={side.id} side={side.id}>
      <ComparisonLayout.Header>{side.label}</ComparisonLayout.Header>
      <ComparisonLayout.Grid<Row> gridProps={{ height: 480 }} />
    </ComparisonLayout.Pane>
  ))}
</ComparisonLayout.Root>;
```

The view layer is headless too. `useComparisonPane` gives you everything `ComparisonPane` would wire into the grid, as props you spread yourself, and `useComparisonScrollSync` gives you the composed `ref` / `onScroll` for both sides. Use them when you want your own DOM, headers or layout:

```tsx
import { SpreadsheetGrid } from '@ishibashi0112/spreadsheet-grid';
import { useComparison, useComparisonPane, useComparisonScrollSync } from '@ishibashi0112/comparison-grid';

const comparison = useComparison({ left, right, getMatchKey: (r) => r.id, compareFields, alignRows: true });
const sync = useComparisonScrollSync<Row>();          // { leftGridProps, rightGridProps }
const leftPane = useComparisonPane<Row>({
  rows: comparison.visibleLeft,
  diffs: comparison.leftDiffs,
  columns,
  compareFields: comparison.compareFields,
  keyColumnKeys: ['id'],
  placeholderRows: comparison.placeholders.left,
  gridProps: { ...sync.leftGridProps, theme: 'dark' },
});
const rightPane = useComparisonPane<Row>({ /* same with the right side */ });

<section className="my-layout">
  <MyHeader side="left" />
  <SpreadsheetGrid<Row> {...leftPane.gridProps} />
  <MyHeader side="right" />
  <SpreadsheetGrid<Row> {...rightPane.gridProps} />
</section>;
```

`leftPane.gridProps.className` carries `cmpg-grid`, which also hosts the `--cmpg-*` tokens, so highlighting works without the `.cmpg-pane` wrapper. `leftPane.getDiff(row)` is handy inside your `renderCell`.

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

### Hierarchical data (BOM trees): match by path, not by code

Matching by part number alone pairs "the same child under a *different* parent". Build a tree and use `useTreeComparison` — the library derives **path keys** (`B2002/C3001`), representative-code substitution propagates to descendants, aligned mode becomes a structural merge, and the diff-only filter keeps ancestors as context rows (`.cmpg-row-context`).

```tsx
import { buildComparisonTree, useTreeComparison, ComparisonView } from '@ishibashi0112/comparison-grid';

const getLevel = (r: BomRow) => r.levelNo;
const getCode = (r: BomRow) => r.itemCode;
const getRepresentativeCode = (r: BomRow) => r.reprItemCode;

// Expansion output (depth-first order + level) — no ids needed. Adjacency lists work too:
//   buildComparisonTree(rows, { getId: (r) => r.rowId, getParentId: (r) => r.parentRowId })
//   (ids must be unique per occurrence — never the part number).
const leftTree = useMemo(() => buildComparisonTree(leftRows, { getLevel }), [leftRows]);
const rightTree = useMemo(() => buildComparisonTree(rightRows, { getLevel }), [rightRows]);
leftTree.issues; // level-jump / duplicate-id / missing-parent / cycle — reported, never repaired

const comparison = useTreeComparison<BomRow>({
  left: leftTree.roots,
  right: rightTree.roots,
  getCode,
  getRepresentativeCode: useRepresentative ? getRepresentativeCode : undefined,
  compareFields,
  showDiffOnly,
  alignRows,
});
comparison.getTreeInfo(row); // { depth, parent, hasChildren, occurrence, matchKey }
comparison.getDescendantDiffCount(row); // changed rows below (> 0 on an unchanged parent)
<ComparisonView comparison={comparison} columns={columns} showDiffLabelColumn />
```

Collapsing is state you own — a `Set` of path keys — and the expander lives in your own column:

```tsx
const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(() => new Set());
const comparison = useTreeComparison<BomRow>({ ..., collapsedKeys });
const toggle = (key: string) =>
  setCollapsedKeys((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

const levelColumn: GridColumn<BomRow> = {
  key: 'levelNo', title: 'Level', width: 76,
  renderCell: ({ row }) => {
    const info = comparison.getTreeInfo(row); // undefined on placeholder rows
    if (!info) return null;
    return (
      <span style={{ paddingLeft: info.depth * 12 }}>
        {info.hasChildren && (
          <button onClick={() => toggle(info.matchKey)}>{comparison.isCollapsed(row) ? '▸' : '▾'}</button>
        )}
        {row.levelNo}
      </span>
    );
  },
};
```

Headless: `flattenComparisonTree(roots, { getCode })` gives depth-first `rows` plus an `infos` map with each row's `matchKey`; feed them to `compare()`, `alignComparisonTree()` and `collectCollapsedDescendants()`.

Siblings with the same code under one parent get an occurrence suffix (`#1`, `#2`) instead of colliding; include a position/process field in `getCode` when you have one. Expanding an item-level BOM master (parent/child edges) into per-occurrence rows is outside the library — pass the expanded rows.

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
- **3 構成以上の比較(`compareMany()` / `alignComparisonRowsMany()`)** — 1 つを基準にして他の各構成を基準と比較します。基準以外の行は素の 2-way 差分、基準の行はその集約(`fieldDiffs` は和集合、`missingIn` に「無い構成」、`bySide` に構成別の内訳)で、ラベルは `案1: 数量違い / 案2: 無し` のようになります。`useMultiComparison()` が構成ごとの差分のみフィルタ / 整列 / `hasAllSides` を導出するので、各構成の `visibleRows` / `diffs` を `useComparisonPane` に渡せば表示できます。スクロール同期(`useComparisonScrollSyncMany()`)と差分ジャンプ(`useMultiComparisonNavigation()`)も構成数に依らず使え、`ComparisonLayout` は JSX に置いた数だけペインを描画します。
- **階層比較(`useTreeComparison()`)** — 部品表のような木構造向け。平坦な行から木を組み立て(`buildComparisonTree`: 深さ優先順 + level、または隣接リスト)、ライブラリが**パスキー**(`B2002/C3001`)を導出するので、別の親の下の同じ品番が突き合うことがありません。代表品番の置き換えは子孫へ伝播、兄弟の重複には出現番号、入力の破綻は修復せず `issues` で報告。整列モードは構造マージ(右のみサブツリーが兄弟の位置に入る)になり、「差分のみ」では祖先が薄い文脈行として残ります。自身は同一でも配下に差分がある親には `.cmpg-row-rollup` の淡い色と、差分ラベル列に `配下に差分 n 件` が出ます(自作列には `getDescendantDiffCount(row)`)。サブツリーの折りたたみは `collapsedKeys`(パスキーの `Set`。1 つのキーで両ペインの対が畳まれます)。
- **スクロール同期(`enableScrollSync`)** — 両ペインのスクロールを同期(ユーザー操作のみ伝播し、API 由来は無視してループを防止)。`alignRows` との併用を想定。同期する軸はレイアウトに追従: 横並びは縦のみ、縦並び(`layout='vertical'`)は列も上下に揃うため縦横両方。
- **エクスポート(`getComparisonExportData()`)** — 片側の行 + 差分ラベル列を、本体の `getExportData()` と同形(`{ columns, rows: { value, text }[][] }`)で返します。CSV / Excel 出力の下流処理を共用できます。
- **差分ジャンプ(`useComparisonNavigation()`)** — 次 / 前の差分へ両ペインを対でスクロール(末尾からは先頭へラップ。`alignRows` のプレースホルダ位置も理解します)。
- **マニュアル入力ヘルパー(`useManualRows()`)** — 編集可能ペイン用の行 state: 末尾空行の維持 / 変更時の正規化 / 送信時検証。空行を除いた `dataRows` を `useComparison` に渡します。
- **`ComparisonView` / `ComparisonPane`** — 2 つの `SpreadsheetGrid` に、差分行ハイライト / 片側のみ行のキー列強調 / 差分フィールドセルの強調 / 差分ラベル列(任意)を配線。利用側は素の `GridColumn<T>[]` を書くだけで、ライブラリのクラスは利用側のクラスと合成されます。ペインは既定で左右に並び、`layout='vertical'` で上下(left が上)に積めます — 列数の多い表に便利。
- **合成コンポーネント(`ComparisonLayout.Root` / `.Pane` / `.Header` / `.Grid`)** — HeroUI の `Dropdown.Trigger` / `.Popover` と同じ形。`Root` が比較結果・列・スクロール同期グループを Context で配り、`Pane` / `Header` / `Grid` は役割を名乗るだけなので、DOM・順序・ペインの数は利用側が決められます。`useComparison`(`side="left"` / `"right"`)でも `useMultiComparison`(任意の構成 ID)でも同じ書き方で、`ComparisonView` はこれで組んだ 2 ペインのプリセットです。
- **ヘッドレスな View 層(`useComparisonPane()` / `useComparisonScrollSync()`)** — ペインとスクロール同期はフックが本体で、コンポーネントは便利品。`useComparisonPane` は自前の `SpreadsheetGrid` にスプレッドできる `gridProps`(合成済みの列 / 行クラス / `getDiff`)を返し、`useComparisonScrollSync` は合成済みの `ref` / `onScroll` を返します。`ComparisonPane` / `ComparisonView` はその薄い包みなので、DOM や配置を自分で決めたくなったらハイライトも同期も失わずに一段降りられます。
- **グリッドの全機能をそのまま利用可** — `gridProps` で `SpreadsheetGridProps<T>` を透過(ソート / フィルター / テーマ / 密度 / コンテキストメニュー / 命令的 `ref` …)。予約するのは `rows` / `columns` / `dataSource` だけ。
- **テーマ対応** — 色と余白は特異度 0 で定義した CSS 変数(`--cmpg-*`)。`theme="dark"` に自動追従するダークプリセットに加え、色覚多様性向けのオプトインプリセット(`.cmpg-colors-cvd`: 青 / 橙系 + 差分セル下線)付き。未レイヤー CSS と、Tailwind v4 向けの `style.layer.css` の二本立て。
- TypeScript ファースト、完全 controlled。

### インストール

```sh
npm install @ishibashi0112/comparison-grid @ishibashi0112/spreadsheet-grid
# pnpm add @ishibashi0112/comparison-grid @ishibashi0112/spreadsheet-grid
```

peer dependencies: **react** / **react-dom** `>= 19`、**@ishibashi0112/spreadsheet-grid** `>= 0.29.1 < 1`。

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

3 構成以上は `compareMany` に `{ id, rows, label? }[]` を渡します。基準(先頭、または `baseId`)と各構成を比較し、`alignComparisonRowsMany` でプレースホルダ付きに整列できます:

```ts
import { compareMany, alignComparisonRowsMany } from '@ishibashi0112/comparison-grid';

const multi = compareMany(
  [
    { id: 'base', rows: current, label: '現行' },
    { id: 'a', rows: planA, label: '案1' },
    { id: 'b', rows: planB, label: '案2' },
  ],
  { getMatchKey: (row) => row.id, compareFields: [{ key: 'qty', label: '数量' }] },
);
multi.sidesById.get('base')!.diffs.get(row); // { kind: 'same' | 'only' | 'partial' | 'field-diff', missingIn, fieldDiffs, bySide, label }
multi.sidesById.get('a')!.summary;          // { total, same, only, partial, fieldDiff }
const aligned = alignComparisonRowsMany(multi);
aligned.rows.get('a');                       // 構成 'a' の行。全構成が同じ長さ
```

React では `useMultiComparison` が両方を包み、構成ごとの表示行を導出します:

```tsx
const multi = useMultiComparison({ sides, getMatchKey: (r) => r.id, compareFields, showDiffOnly, alignRows: true });
multi.hasAllSides;             // いずれかの構成が空なら false → 「差分のみ」は強制 OFF
for (const side of multi.sides) {
  side.visibleRows;            // この構成のフィルタ / 整列済みの行
  side.diffs; side.placeholderRows; // → useComparisonPane({ rows: side.visibleRows, diffs: side.diffs, placeholderRows: side.placeholderRows, ... })
}
const sync = useComparisonScrollSyncMany<Row>({ sides: syncSides }); // syncSides = useMemo(() => ({ base: undefined, a: undefined, b: undefined }), [])
const nav = useMultiComparisonNavigation({ comparison: multi, alignRows: true, getHandle: sync.group.getHandle });
// 各ペインの gridProps に sync.sides[side.id] を渡す。nav.goToNextDiff() は全構成をスクロールする
```

配線は合成コンポーネントに任せることもできます。`Root` がスクロール同期グループを持ち、各 `Grid` がハンドルを登録します:

```tsx
import { ComparisonLayout, useMultiComparison, useComparisonScrollSyncGroup, useMultiComparisonNavigation } from '@ishibashi0112/comparison-grid';

const multi = useMultiComparison({ sides, getMatchKey: (r) => r.id, compareFields, alignRows: true });
const group = useComparisonScrollSyncGroup<Row>();                       // 任意: 差分ジャンプと共有するとき
const nav = useMultiComparisonNavigation({ comparison: multi, alignRows: true, getHandle: group.getHandle });

<ComparisonLayout.Root<Row> comparison={multi} columns={columns} keyColumnKeys={['id']} scrollSyncGroup={group} showDiffLabelColumn>
  {multi.sides.map((side) => (
    <ComparisonLayout.Pane key={side.id} side={side.id}>
      <ComparisonLayout.Header>{side.label}</ComparisonLayout.Header>
      <ComparisonLayout.Grid<Row> gridProps={{ height: 480 }} />
    </ComparisonLayout.Pane>
  ))}
</ComparisonLayout.Root>;
```

View 層も headless です。`useComparisonPane` は `ComparisonPane` がグリッドへ配線するものすべてを「自分でスプレッドする props」として返し、`useComparisonScrollSync` は両側ぶんの合成済み `ref` / `onScroll` を返します。DOM / ヘッダー / 配置を自分で決めたいときに使います:

```tsx
import { SpreadsheetGrid } from '@ishibashi0112/spreadsheet-grid';
import { useComparison, useComparisonPane, useComparisonScrollSync } from '@ishibashi0112/comparison-grid';

const comparison = useComparison({ left, right, getMatchKey: (r) => r.id, compareFields, alignRows: true });
const sync = useComparisonScrollSync<Row>();          // { leftGridProps, rightGridProps }
const leftPane = useComparisonPane<Row>({
  rows: comparison.visibleLeft,
  diffs: comparison.leftDiffs,
  columns,
  compareFields: comparison.compareFields,
  keyColumnKeys: ['id'],
  placeholderRows: comparison.placeholders.left,
  gridProps: { ...sync.leftGridProps, theme: 'dark' },
});
const rightPane = useComparisonPane<Row>({ /* 右側も同様 */ });

<section className="my-layout">
  <MyHeader side="left" />
  <SpreadsheetGrid<Row> {...leftPane.gridProps} />
  <MyHeader side="right" />
  <SpreadsheetGrid<Row> {...rightPane.gridProps} />
</section>;
```

`leftPane.gridProps.className` には `cmpg-grid` が含まれ、`--cmpg-*` トークンはそこにも定義されているので、`.cmpg-pane` ラッパー無しでもハイライトが効きます。`renderCell` の中では `leftPane.getDiff(row)` で差分を引けます。

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

#### 階層データ(部品表の木)はコードでなくパスで突き合わせる

品番だけで突き合わせると「*別の親*の下の同じ品番」同士が対になってしまいます。木を組み立てて `useTreeComparison` を使うと、ライブラリが**パスキー**(`B2002/C3001`)を導出し、代表コードの置き換えは子孫へ伝播、整列モードは構造マージになり、「差分のみ」では祖先が文脈行(`.cmpg-row-context`)として残ります。

```tsx
import { buildComparisonTree, useTreeComparison, ComparisonView } from '@ishibashi0112/comparison-grid';

const getLevel = (r: BomRow) => r.levelNo;
const getCode = (r: BomRow) => r.itemCode;
const getRepresentativeCode = (r: BomRow) => r.reprItemCode;

// 展開結果(深さ優先順 + level)から — ID 不要。隣接リストも可:
//   buildComparisonTree(rows, { getId: (r) => r.rowId, getParentId: (r) => r.parentRowId })
//   (ID は出現ごとに一意な行 ID。品番は不可)。
const leftTree = useMemo(() => buildComparisonTree(leftRows, { getLevel }), [leftRows]);
const rightTree = useMemo(() => buildComparisonTree(rightRows, { getLevel }), [rightRows]);
leftTree.issues; // level-jump / duplicate-id / missing-parent / cycle — 修復せず報告

const comparison = useTreeComparison<BomRow>({
  left: leftTree.roots,
  right: rightTree.roots,
  getCode,
  getRepresentativeCode: useRepresentative ? getRepresentativeCode : undefined,
  compareFields,
  showDiffOnly,
  alignRows,
});
comparison.getTreeInfo(row); // { depth, parent, hasChildren, occurrence, matchKey }
comparison.getDescendantDiffCount(row); // 配下の差分行数(同一の親でも配下に差分があれば > 0)
<ComparisonView comparison={comparison} columns={columns} showDiffLabelColumn />
```

折りたたみの state(パスキーの `Set`)は利用側が持ち、展開ボタンは利用側の列で組みます:

```tsx
const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(() => new Set());
const comparison = useTreeComparison<BomRow>({ ..., collapsedKeys });
const toggle = (key: string) =>
  setCollapsedKeys((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

const levelColumn: GridColumn<BomRow> = {
  key: 'levelNo', title: 'Level', width: 76,
  renderCell: ({ row }) => {
    const info = comparison.getTreeInfo(row); // プレースホルダ行は undefined
    if (!info) return null;
    return (
      <span style={{ paddingLeft: info.depth * 12 }}>
        {info.hasChildren && (
          <button onClick={() => toggle(info.matchKey)}>{comparison.isCollapsed(row) ? '▸' : '▾'}</button>
        )}
        {row.levelNo}
      </span>
    );
  },
};
```

headless で使う場合は `flattenComparisonTree(roots, { getCode })` が深さ優先順の `rows` と、行ごとの `matchKey` を持つ `infos` を返すので、`compare()` / `alignComparisonTree()` / `collectCollapsedDescendants()` に渡します。

同じ親の下に同じコードの兄弟が複数ある場合は衝突させず出現番号(`#1`, `#2`)を付けます。取付位置・工程の列があるなら `getCode` に含めてください。品目間の構成マスタ(親品番・子品番)から出現ごとの行へ**展開**する処理はライブラリの範囲外です(展開済みの行を渡します)。

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
