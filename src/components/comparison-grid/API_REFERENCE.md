# comparison-grid 公開 API リファレンス

> このファイルは `model/types.ts` と各実装(`logic/compare.ts` / `logic/paneColumns.ts` / `hooks/useComparison.ts` /
> `view/*.tsx`)から手で起こした公開 API のスナップショットです。**型を変更したら本ファイルも同期してください。**
> spreadsheet-grid 側の props / 型は [spreadsheet-grid の API_REFERENCE](https://github.com/ishibashi0112/datasheet-grid/blob/main/src/components/spreadsheet-grid/API_REFERENCE.md) を参照。

最終更新: 初版(0.1.0)。

## 設計の要点

- **サイドカー方式**: 行 `T` には書き込まず、差分は `ReadonlyMap<T, ComparisonRowDiff<T>>` で行オブジェクトに紐づけます。グリッドへ渡すのは `T[]` そのものなので、`GridColumn<T>` / `SpreadsheetGridProps<T>` を `T` の型のまま書けます。
- **判定と見た目の分離**: 判定(kind / fieldDiffs / label)は純ロジック `compare()`、見た目はクラス(`.cmpg-*`)と CSS トークン(`--cmpg-*`)で差し替えます。
- **差分のみ表示は導出**: `effectiveShowDiffOnly = hasBothSides && showDiffOnly` を render 中に導出し、片側だけのデータでは自動的に無効になります(useEffect での state 同期はしません)。

## 純ロジック(React 非依存)

### `compare<T>(left, right, options): ComparisonResult<T>`

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `left` / `right` | `readonly T[]` | 突き合わせる 2 つのリスト。 |
| `options` | `CompareOptions<T>` | 下記。 |

計算量は Map による `O(n + m)`。入力順は保持されます。

### `CompareOptions<T>`

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `getMatchKey` | `(row: T) => string` | (required) | 突き合わせキー。「代表品番比較」のような別規則はこの関数の差し替えで表現する(README レシピ)。 |
| `compareFields` | `readonly CompareField<T>[]` | (required) | 差分を見るフィールド。空なら `same` / `left-only` / `right-only` だけになる。 |
| `formatDiffLabel` | `(ctx: DiffLabelContext<T>) => string` | `formatDefaultDiffLabel` | ラベル生成の差し替え。 |
| `labels` | `Partial<ComparisonLabels>` | `DEFAULT_COMPARISON_LABELS` | 既定文言の部分上書き(`formatDefaultDiffLabel` が参照)。 |
| `duplicateKeyPolicy` | `'last' \| 'first'` | `'last'` | 同一側にキー重複があるときの相手の選び方。`'last'` = 後勝ち(ss2602 互換)。重複キーは `result.duplicateKeys` に報告される。 |

### `CompareField<T>`

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `key` | `string` | (required) | `fieldDiffs` での識別子。既定の値アクセサ(`row[key]`)と既定の強調対象列キーを兼ねる。 |
| `label` | `string` | (required) | ラベル生成に使う表示名(例: `'数量'`)。 |
| `getValue` | `(row: T) => unknown` | `row[key]` | 値アクセサ(計算値の比較に)。 |
| `equals` | `(leftValue, rightValue) => boolean` | `Object.is` | 等価判定。**引数順は左右どちらの注釈でも `(左の値, 右の値)`**。 |
| `columnKey` | `string` | `key` | セル強調をかける `GridColumn.key`(比較キーと列キーが異なるときに指定)。判定には影響しない。 |

### ラベル

```ts
type ComparisonLabels = {
  leftOnly: string;            // '左のみ'
  rightOnly: string;           // '右のみ'
  fieldDiffSeparator: string;  // '・'
  fieldDiffSuffix: string;     // '違い'
};
```

`formatDefaultDiffLabel(ctx)`: `left-only` → `labels.leftOnly` / `right-only` → `labels.rightOnly` / `field-diff` → 差分フィールドの `label` を `fieldDiffSeparator` で連結し `fieldDiffSuffix` を付ける(例: `'数量・支給区分違い'`。順序は `compareFields` の宣言順)/ `same` → `''`。

`DiffLabelContext<T>`: `{ side, kind, row, counterpart?, fieldDiffs, diffFields, labels }`。`diffFields` は差分のあった `CompareField` の配列(宣言順)。

### 結果(`ComparisonResult<T>`)

| Name | Type | Description |
| --- | --- | --- |
| `annotatedLeft` / `annotatedRight` | `ComparisonRow<T>[]` | 入力順の `{ row, diff }`。反復 / エクスポート用。 |
| `leftDiffs` / `rightDiffs` | `ComparisonDiffMap<T>` = `ReadonlyMap<T, ComparisonRowDiff<T>>` | 行オブジェクト → 差分。同じオブジェクトが同じ側に複数回現れた場合は後の差分で上書き。 |
| `summary` | `{ left: ComparisonSideSummary; right: ComparisonSideSummary }` | 片側ごとの件数 `{ total, same, only, fieldDiff }`。`only` は左なら left-only、右なら right-only の件数。キー重複がある場合は「行」単位で数える(左右で `fieldDiff` が一致しないことがある)。 |
| `duplicateKeys` | `{ left: readonly string[]; right: readonly string[] }` | 同一側で重複した突き合わせキー。 |
| `hasAnyDiff` | `boolean` | 左右いずれかに `same` 以外の行があるか。 |

### `ComparisonRowDiff<T>`

| Name | Type | Description |
| --- | --- | --- |
| `side` | `'left' \| 'right'` | この差分が属する側。 |
| `kind` | `'same' \| 'left-only' \| 'right-only' \| 'field-diff'` | 差分種別。 |
| `label` | `string` | 表示用ラベル。`same` は `''`。 |
| `matchKey` | `string` | `getMatchKey` の返り値。 |
| `fieldDiffs` | `ReadonlySet<string>` | 差分のあった `CompareField.key`(`field-diff` 以外は空)。 |
| `counterpart` | `T \| undefined` | 突き合わせ相手の行(片側のみの行では `undefined`)。 |

## React 層

### `useComparison<T>(options): UseComparisonResult<T>`

`UseComparisonOptions<T>` = `CompareOptions<T>` + 下記。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `left` / `right` | `readonly T[]` | (required) | 左右のデータ。 |
| `showDiffOnly` | `boolean` | `false` | 「差分のみ表示」の意思(利用側の state)。 |

戻り値は `ComparisonResult<T>` に以下を加えたもの:

| Name | Type | Description |
| --- | --- | --- |
| `compareFields` | `readonly CompareField<T>[]` | 参照安定化済みの `compareFields`(ペインのセル強調に使う)。 |
| `visibleLeft` / `visibleRight` | `readonly T[]` | `effectiveShowDiffOnly` 適用後の表示行(`kind !== 'same'` を残す)。フィルタ無しのときは入力配列と**同一参照**(グリッドの `autoSizeColumns: 'onDataChange'` 等と相性がよい)。 |
| `hasBothSides` | `boolean` | `left.length > 0 && right.length > 0`。 |
| `effectiveShowDiffOnly` | `boolean` | `hasBothSides && showDiffOnly`。チェックボックスの `checked` に渡す。 |
| `canShowDiffOnly` | `boolean` | `hasBothSides && hasAnyDiff`。トグルの `disabled={!canShowDiffOnly}` に渡す(片側のみ / 差分なしで無効化 = ss2602 の `isDiffSwitchDisabled` の否定)。 |
| `getDiff` | `(row: T) => ComparisonRowDiff<T> \| undefined` | 左右どちらの行でも差分を引ける参照関数(自作列の `getValue` 等に)。 |

**メモ化**: `left` / `right` / `getMatchKey` / `formatDiffLabel` / `duplicateKeyPolicy` は参照(同一性)で、`compareFields` / `labels` は**浅い構造比較**で依存を判定します。つまり `compareFields: [{ key: 'qty', label: '数量' }]` のようなインライン記述は毎レンダー書き直しても再計算されませんが、`getValue` / `equals` / `getMatchKey` をインライン関数で書くと毎レンダー再計算されます(コンポーネント外か `useCallback` で定義してください)。

### `ComparisonView<T extends object>`

左右 2 ペイン + ヘッダースロットの CSS Grid 2 カラムレイアウトです。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `comparison` | `ComparisonViewModel<T>` | (required) | `useComparison` の戻り値をそのまま渡す(`visibleLeft` / `visibleRight` / `leftDiffs` / `rightDiffs` / `compareFields` を使用)。 |
| `columns` | `readonly GridColumn<T>[]` | (required) | 利用側の列定義(両ペイン共通)。参照安定化(浅い構造比較)される。 |
| `keyColumnKeys` | `readonly string[]` | — | 突き合わせキー相当の列キー。`left-only` / `right-only` 行でその列のセルを強調。 |
| `leftHeader` / `rightHeader` | `ReactNode` | — | ペイン上部のスロット。片側だけ指定しても両ペインに(空の)スロットを描画して上端を揃える。 |
| `gridProps` | `ComparisonGridProps<T>` | — | 両ペイン共通の `SpreadsheetGrid` props(下記「gridProps の透過」)。 |
| `leftGridProps` / `rightGridProps` | `ComparisonGridProps<T>` | — | 片側だけの上書き(`gridProps` の上に浅くマージ)。`ref` を片側ずつ渡す用途など。 |
| `showDiffLabelColumn` | `boolean` | `false` | 差分ラベル列を自動追加する。 |
| `diffLabelColumn` | `DiffLabelColumnOptions<T>` | `{ key: 'cmpgDiffLabel', title: '差分', width: 150, position: 'end' }` | ラベル列の調整(`GridColumn` の任意プロパティ + `position: 'start' \| 'end' \| number`)。`getValue` はライブラリが与える。 |
| `enableRowHighlight` | `boolean` | `true` | `same` 以外の行へ `.cmpg-row-diff` を付与。 |
| `enableKeyCellHighlight` | `boolean` | `true` | `keyColumnKeys` 列のセル強調。 |
| `enableFieldCellHighlight` | `boolean` | `true` | `compareFields` 対応列のセル強調。 |
| `className` / `style` | `string` / `CSSProperties` | — | ルート(`.cmpg-view`)へ。 |

### `ComparisonPane<T extends object>`

片側 1 ペイン。`ComparisonView` を使わず自分でレイアウトしたいときに使います。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `'left' \| 'right'` | (required) | `.cmpg-pane--left` / `--right` と `data-cmpg-side` を付与。 |
| `rows` | `readonly T[]` | (required) | 表示行(`visibleLeft` 等)。 |
| `diffs` | `ComparisonDiffMap<T>` | (required) | この側の差分 Map(`leftDiffs` 等)。 |
| `columns` | `readonly GridColumn<T>[]` | (required) | 列定義。 |
| `compareFields` | `readonly CompareField<T>[]` | — | セル強調の対応付け(`useComparison().compareFields`)。 |
| `keyColumnKeys` | `readonly string[]` | — | 同上。 |
| `header` | `ReactNode` | — | ヘッダースロット。 |
| `showHeader` | `boolean` | `header !== undefined` | スロットの描画有無(片側だけヘッダーがある場合の高さ揃えに)。 |
| `gridProps` | `ComparisonGridProps<T>` | — | 透過 props。 |
| `showDiffLabelColumn` / `diffLabelColumn` / `enable*` | — | — | `ComparisonView` と同じ。 |
| `className` / `style` | — | — | ルート(`.cmpg-pane`)へ。 |

### gridProps の透過(`ComparisonGridProps<T>`)

`Omit<SpreadsheetGridProps<T>, 'rows' | 'columns' | 'dataSource'>`。

| prop | 扱い |
| --- | --- |
| `rows` / `columns` | ライブラリが与える(型から除外)。 |
| `dataSource` | serverSide モードは比較と両立しないため除外。 |
| `getRowClassName` | ライブラリの行クラスと**合成**(`'cmpg-row-diff cmpg-row-diff--field your-class'`)。 |
| `className` | `'cmpg-grid your-class'` に合成。 |
| 列の `cellClassName` | 強調対象列だけライブラリのクラスと合成(文字列 / 関数どちらも可)。対象外の列は同一参照で通過。 |
| それ以外 | そのまま透過(`theme` / `density` / `enable*` / `show*` / `ref` / `onStateChange` / `getContextMenuItems` …)。 |

`ref` を使う場合は `leftGridProps={{ ref }}` / `rightGridProps={{ ref }}` で片側ずつ渡します。

### 型ユーティリティ

- `GridCellStyleContext<T>` — `GridColumn<T>['cellClassName']`(関数版)の引数型。spreadsheet-grid が `CellStyleContext` をバレル公開していないため列型から導出しています。

## クラスとトークン(styles.css)

### クラス(`CMPG_CLASS_NAMES`)

| クラス | 付与先 | 意味 |
| --- | --- | --- |
| `.cmpg-view` | ルート | 2 カラムの CSS Grid。 |
| `.cmpg-pane` / `.cmpg-pane--left` / `.cmpg-pane--right` | ペイン | 縦 flex。`data-cmpg-side` 属性も付く。 |
| `.cmpg-pane-header` / `.cmpg-pane-body` | ペイン内 | ヘッダースロット / グリッド領域。 |
| `.cmpg-grid` | グリッド root(`.ssg-root`) | 利用側 `className` と合成。 |
| `.cmpg-row-diff` | 行コンテナ + 各データセル | `same` 以外の行。修飾子 `--left-only` / `--right-only` / `--field`。 |
| `.cmpg-cell-diff` | セル | 強調セル共通。修飾子 `--key`(キー列 × 片側のみ行)/ `--field`(差分フィールド列 × field-diff 行)。 |

ハイライトの実体は `.ssg-body-cell.cmpg-row-diff { background }` / `.ssg-body-cell.cmpg-cell-diff { color; font-weight }`(特異度 (0,2,0))。行ホバーは `.ssg-body-cell.cmpg-row-diff.ssg-body-cell--row-hovered` で `--cmpg-diff-row-hover-bg` に切り替わります。

### トークン

| トークン | 定義場所 | 既定(light) | 既定(dark: `.ssg-theme-dark` 配下) |
| --- | --- | --- | --- |
| `--cmpg-view-gap` | `:where(.cmpg-view)` | `16px` | — |
| `--cmpg-pane-header-min-height` | `:where(.cmpg-pane)` | `24px` | — |
| `--cmpg-pane-header-gap-x` / `-gap-y` | `:where(.cmpg-pane)` | `16px` / `4px` | — |
| `--cmpg-pane-header-margin-bottom` | `:where(.cmpg-pane)` | `4px` | — |
| `--cmpg-diff-row-bg` | `:where(.cmpg-pane)` | `#fef9c3` | `rgba(250, 204, 21, 0.14)` |
| `--cmpg-diff-row-hover-bg` | `:where(.cmpg-pane)` | `#fef08a` | `rgba(250, 204, 21, 0.22)` |
| `--cmpg-diff-text` | `:where(.cmpg-pane)` | `#dc2626` | `#f87171` |
| `--cmpg-diff-font-weight` | `:where(.cmpg-pane)` | `700` | — |

上書きは `.cmpg-pane { --cmpg-diff-row-bg: ... }`(light)/ `.cmpg-pane .ssg-theme-dark { ... }`(dark)。`:where()` 定義のため読み込み順に依らず勝ちます。

### 配布物

- `dist/style.css` — 未レイヤー版(推奨)。
- `dist/style.layer.css` — `@import url("./style.css") layer(cmpg-base);` の 1 行(Tailwind v4 等でレイヤー順を自分で宣言する用)。

## 既知の制約 / 注意

- 差分は行**オブジェクトの同一性**で引きます。`useComparison` の `visibleLeft` / `visibleRight` をそのままペインへ渡し、途中で `map` 等で複製しないでください(複製した行は強調されません)。
- `T` はオブジェクトである必要があります(`SpreadsheetGrid<T extends object>` の要求と同じ。`compare()` 単体は任意の `T` で動きます)。
- 左右の行の**位置は揃えません**(ss2602 と同じ)。整列モード / スクロール同期は Phase 2 の候補です(`docs/DESIGN_NOTES.md`)。
- グリッドの行グルーピング(`rowGroup`)を有効にした場合、グループ行には差分クラスは付きません(leaf 行のみ)。

## Phase 2(未実装・設計だけ壊さない)

- マニュアル入力ペイン(編集可能グリッド + 末尾空行維持 + 正規化フック + 送信時検証)。
- `getComparisonExportData()`(spreadsheet-grid の `getExportData()` と同じ思想。現状は `annotatedLeft` / `annotatedRight` から利用側で整形可能)。
- 差分ジャンプ(`scrollToRow` を使った次 / 前の差分行への移動)、左右整列モード + スクロール同期。
