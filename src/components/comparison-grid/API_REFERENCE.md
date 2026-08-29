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

### `alignComparisonRows<T>(annotatedLeft, annotatedRight, options?): AlignComparisonRowsResult<T>`

`compare()` の注釈行を突き合わせ順に整列し、欠損側へ**プレースホルダ行**を挿入します(左右整列モードの純ロジック。`useComparison` の `alignRows: true` が内部で使うものと同じ)。

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `annotatedLeft` / `annotatedRight` | `readonly ComparisonRow<T>[]` | `compare()` の結果。 |
| `options.createPlaceholderRow` | `(side: ComparisonSide) => T` | プレースホルダ行の生成。**呼び出しごとに新しいオブジェクト**を返すこと(同一性で判定するため)。既定は `{} as T`(`row[key]` が `undefined` になり空セルとして描画される。入れ子アクセスする `getValue` / `renderCell` がある場合は安全な行を返す実装を渡す)。 |

戻り値:

| Name | Type | Description |
| --- | --- | --- |
| `pairs` | `{ left: T; right: T }[]` | 突き合わせ順の対。**左の行順**を基準に対を作り、左と対にならなかった右行(right-only / キー重複の残り)を**右の行順**で末尾に並べる。キー重複で複数行が同じ相手を指す場合、相手は先に対になった行が消費する。 |
| `placeholders` | `ComparisonPlaceholders<T>` = `{ left: ReadonlySet<T>; right: ReadonlySet<T> }` | 各側の配列に挿入されたプレースホルダ行の集合。プレースホルダは差分 Map に載らないため、ハイライト / 差分ラベルは自動的に対象外。 |

### `getComparisonExportData<T>(options): GridExportData`

比較結果 1 側ぶんを spreadsheet-grid の `getExportData()` と同形(`{ columns: { key, title }[], rows: { value, text }[][] }`)で返します。CSV / Excel 出力の下流処理を共用できます。

| オプション | 型 | 既定 | 説明 |
| --- | --- | --- | --- |
| `rows` | `readonly T[]` | (required) | エクスポートする行。`visibleLeft` / `annotatedLeft.map((e) => e.row)` / 整列済み配列(対順エクスポート)など。 |
| `diffs` | `ComparisonDiffMap<T>` | (required) | この側の差分 Map(`leftDiffs` / `rightDiffs`)。 |
| `columns` | `readonly GridColumn<T>[]` | (required) | 列定義。`visible: false` の列は除外。 |
| `showDiffLabelColumn` | `boolean` | **`true`** | 差分ラベル列を含める(ペインの既定 `false` と異なる)。 |
| `diffLabelColumn` | `DiffLabelColumnOptions<T>` | — | ラベル列の調整(`key` / `title` / `position` を使用)。 |

セルの規則: `value` は `getValue ?? row[key]`、`text` は本体の**セル表示**と同じく `value == null` なら `''`(`valueFormatter` を通さない)、それ以外は `valueFormatter({ value, row, column }) ?? String(value)`。列見出しは `title ?? key`。プレースホルダ行(alignRows)は全セル空になります。

## React 層

### `useComparison<T>(options): UseComparisonResult<T>`

`UseComparisonOptions<T>` = `CompareOptions<T>` + 下記。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `left` / `right` | `readonly T[]` | (required) | 左右のデータ。 |
| `showDiffOnly` | `boolean` | `false` | 「差分のみ表示」の意思(利用側の state)。 |
| `alignRows` | `boolean` | `false` | 左右整列モード。`visibleLeft` / `visibleRight` が整列済み配列(常に同じ長さ・欠損側はプレースホルダ行)になる。「差分のみ」は**対の単位**でフィルタされ整列が保たれる。 |
| `createPlaceholderRow` | `(side: ComparisonSide) => T` | `() => ({} as T)` | `alignRows` 時のプレースホルダ行生成(`alignComparisonRows` と同じ)。 |

戻り値は `ComparisonResult<T>` に以下を加えたもの:

| Name | Type | Description |
| --- | --- | --- |
| `compareFields` | `readonly CompareField<T>[]` | 参照安定化済みの `compareFields`(ペインのセル強調に使う)。 |
| `visibleLeft` / `visibleRight` | `readonly T[]` | `effectiveShowDiffOnly` 適用後の表示行(`kind !== 'same'` を残す)。フィルタ無し・`alignRows` OFF のときは入力配列と**同一参照**(グリッドの `autoSizeColumns: 'onDataChange'` 等と相性がよい)。`alignRows` ON では整列済み配列(プレースホルダ行を含む・常に同じ長さ)。 |
| `placeholders` | `ComparisonPlaceholders<T>` | `alignRows` で各側の表示配列に挿入されたプレースホルダ行(OFF のときは空 Set)。`ComparisonView` へ `comparison` を渡せば自動で配線される。 |
| `hasBothSides` | `boolean` | `left.length > 0 && right.length > 0`。 |
| `effectiveShowDiffOnly` | `boolean` | `hasBothSides && showDiffOnly`。チェックボックスの `checked` に渡す。 |
| `canShowDiffOnly` | `boolean` | `hasBothSides && hasAnyDiff`。トグルの `disabled={!canShowDiffOnly}` に渡す(片側のみ / 差分なしで無効化 = ss2602 の `isDiffSwitchDisabled` の否定)。 |
| `getDiff` | `(row: T) => ComparisonRowDiff<T> \| undefined` | 左右どちらの行でも差分を引ける参照関数(自作列の `getValue` 等に)。 |

**メモ化**: `left` / `right` / `getMatchKey` / `formatDiffLabel` / `duplicateKeyPolicy` / `createPlaceholderRow` は参照(同一性)で、`compareFields` / `labels` は**浅い構造比較**で依存を判定します。つまり `compareFields: [{ key: 'qty', label: '数量' }]` のようなインライン記述は毎レンダー書き直しても再計算されませんが、`getValue` / `equals` / `getMatchKey` / `createPlaceholderRow` をインライン関数で書くと毎レンダー再計算されます(コンポーネント外か `useCallback` で定義してください。特に `createPlaceholderRow` はプレースホルダ行の同一性が毎レンダー変わり、グリッドが行の差し替えと誤認します)。

### `useComparisonNavigation<T>(options): UseComparisonNavigationResult<T>`

差分ジャンプ(次 / 前の差分行へのスクロール)。グリッドのハンドル `ref` は**フックが生成して返す**ので、`leftGridProps={{ ref: leftRef }}` / `rightGridProps={{ ref: rightRef }}` で配線します(`enableScrollSync` の内部 ref とは自動で合成されます)。

| オプション | 型 | 既定 | 説明 |
| --- | --- | --- | --- |
| `comparison` | `Pick<UseComparisonResult<T>, 'visibleLeft' \| 'visibleRight' \| 'leftDiffs' \| 'rightDiffs'>` | (required) | `useComparison` の戻り値をそのまま渡せる。 |
| `alignRows` | `boolean` | `false` | `useComparison` と同じ値を渡す。true なら片側のみの停止(left-only / right-only)でも同じ行位置で両ペインをスクロールする(整列表示ではプレースホルダ位置)。 |
| `align` | `ScrollAlign` | `'center'` | `scrollToRow` の align。 |

戻り値:

| Name | Type | Description |
| --- | --- | --- |
| `leftRef` / `rightRef` | `RefObject<SpreadsheetGridHandle<T> \| null>` | 各ペインへ渡すハンドル ref。 |
| `diffStops` | `readonly ComparisonDiffStop<T>[]` | 停止位置(`visibleLeft` の行順 → 左に無い右行は `visibleRight` の行順で末尾。alignRows の対順と同じ規則)。各停止は `kind` / `leftIndex` / `rightIndex` / `leftRow` / `rightRow` を持つ。 |
| `diffCount` / `canNavigate` | `number` / `boolean` | 停止数 / `diffCount > 0`(ボタンの `disabled` に)。 |
| `activeDiffIndex` | `number` | 現在の停止位置(未移動は `-1`)。表示行が変わるとリセット。 |
| `goToNextDiff()` / `goToPreviousDiff()` / `goToDiff(index)` | `() => void` 等 | 移動(範囲外はラップ: 末尾の次は先頭、未移動からの「前」は末尾)。 |

**注意**: `scrollToRow` は view index を受け取るため、**グリッド側のソート / フィルター**(`enableSorting` / `enableColumnFilter` 等)を適用中は行位置がずれます。差分ジャンプは比較結果の並びのまま表示している画面で使ってください。

### `useManualRows<T>(options): UseManualRowsResult<T>`

マニュアル入力ペイン(編集可能グリッド)用の行 state ヘルパー。**末尾空行の維持 / 変更時の正規化 / 送信時検証**を担います。`rows`(空行込み)を編集ペインへ、`dataRows`(空行除外)を `useComparison` の `left` / `right` へ渡します。

```tsx
const manual = useManualRows<Row>({ createRow, isEmptyRow, normalizeRow, validateRow });
const comparison = useComparison<Row>({ left: manual.dataRows, right, ... });
// 編集側は ComparisonPane を直接使う(rows は比較結果ではなく manual.rows)
<ComparisonPane side="left" rows={manual.rows} diffs={comparison.leftDiffs} columns={columns}
  gridProps={{ ...manual.gridProps, readOnly: false }} />
```

| オプション | 型 | 既定 | 説明 |
| --- | --- | --- | --- |
| `initialRows` | `readonly T[]` | `[]` | 初期行(末尾空行は含めなくてよい)。 |
| `createRow` | `() => T` | (required) | 空行の生成(毎回新しいオブジェクトを返すこと)。 |
| `isEmptyRow` | `(row: T) => boolean` | (required) | 空行判定(末尾空行の維持 / `dataRows` の除外に使用)。 |
| `normalizeRow` | `(row: T) => T` | — | 変更時の正規化(トリム等)。**変更不要なら同じ参照を返す**こと。 |
| `validateRow` | `(row, rowIndex) => string \| null \| undefined` | — | エラーメッセージを返す(空行は評価しない)。 |
| `trailingEmptyRows` | `number` | `1` | 維持する末尾空行数。`0` で維持しない。 |

戻り値: `rows` / `dataRows` / `onRowsChange`(正規化 + 末尾空行維持。既存の空行オブジェクトは再利用して参照を保つ)/ `setRows`(外部差し替え。正規化はしない)/ `clear` / `errors: { row, rowIndex, message }[]` / `isValid` / `gridProps`(`{ onRowsChange, createRow }` をそのままスプレッド)。

**注意**: `createRow` / `isEmptyRow` / `normalizeRow` / `validateRow` はコンポーネント外か `useCallback` で定義してください(インラインだと毎レンダー再導出)。

### `ComparisonView<T extends object>`

左右 2 ペイン + ヘッダースロットの CSS Grid 2 カラムレイアウトです。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `comparison` | `ComparisonViewModel<T>` | (required) | `useComparison` の戻り値をそのまま渡す(`visibleLeft` / `visibleRight` / `leftDiffs` / `rightDiffs` / `compareFields`、alignRows 利用時は `placeholders` も使用)。 |
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
| `enableScrollSync` | `boolean` | `false` | 左右ペインの**縦**スクロールを同期する(`alignRows` との併用を想定。横は同期しない)。`source: 'user'` のスクロールだけ相手の `setScrollPosition({ top })` へ伝え、`'api'` 由来は無視してループを防ぐ(spreadsheet-grid v0.29.0 のスクロール API)。利用側の `ref` / `onScroll`(`gridProps` / 片側 props)はそのまま透過・合成される。 |
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
| `placeholderRows` | `ReadonlySet<T>` | — | この側の `rows` に含まれるプレースホルダ行(`placeholders.left` 等)。`.cmpg-row-placeholder` を付与する。 |
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
| `getRowClassName` | ライブラリの行クラスと**合成**(`'cmpg-row-diff cmpg-row-diff--field your-class'`)。第 3 引数 `ctx: RowStyleContext<T>`(spreadsheet-grid v0.29.0)も利用側の関数へそのまま透過。 |
| `className` | `'cmpg-grid your-class'` に合成。 |
| 列の `cellClassName` | 強調対象列だけライブラリのクラスと合成(文字列 / 関数どちらも可)。対象外の列は同一参照で通過。 |
| それ以外 | そのまま透過(`theme` / `density` / `enable*` / `show*` / `ref` / `onStateChange` / `getContextMenuItems` …)。 |

`ref` を使う場合は `leftGridProps={{ ref }}` / `rightGridProps={{ ref }}` で片側ずつ渡します。

### 型ユーティリティ

- `GridCellStyleContext<T>` — `GridColumn<T>['cellClassName']`(関数版)の引数型。spreadsheet-grid v0.29.0 で公開された `CellStyleContext<T>` の別名です(公開前は列型からの導出で代替していました)。

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
| `.cmpg-row-placeholder` | 行コンテナ + 各データセル | alignRows で欠損側に入るプレースホルダ行。差分ハイライトとは独立で、`enableRowHighlight={false}` でも付与される。 |

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
| `--cmpg-placeholder-row-bg` | `:where(.cmpg-pane)` | `#f3f4f6` | `rgba(148, 163, 184, 0.1)` |
| `--cmpg-placeholder-row-hover-bg` | `:where(.cmpg-pane)` | `#e5e7eb` | `rgba(148, 163, 184, 0.18)` |

上書きは `.cmpg-pane { --cmpg-diff-row-bg: ... }`(light)/ `.cmpg-pane .ssg-theme-dark { ... }`(dark)。`:where()` 定義のため読み込み順に依らず勝ちます。

### 配色プリセット(`.cmpg-colors-cvd`)

色覚多様性向けのオプトインプリセット。**利用側が** `.cmpg-view` / `.cmpg-pane`(または任意の祖先)へ `cmpg-colors-cvd` クラスを付与すると:

- 差分行の黄系 → **青系**(light: blue-100 `#dbeafe` / hover blue-200)、強調文字の赤 → **橙系**(orange-800 `#9a3412`。白地でコントラスト比 約 7:1)。ダークは青 α / orange-300 に差し替え。
- 差分セル(`.cmpg-cell-diff`)に**下線**を追加(色に依らない手掛かり)。

トークンは特異度 0 のため、利用側の `--cmpg-*` 上書きはプリセットにも勝ちます。プレースホルダ行の灰系は共通です。

### 配布物

- `dist/style.css` — 未レイヤー版(推奨)。
- `dist/style.layer.css` — `@import url("./style.css") layer(cmpg-base);` の 1 行(Tailwind v4 等でレイヤー順を自分で宣言する用)。

## 既知の制約 / 注意

- 差分は行**オブジェクトの同一性**で引きます。`useComparison` の `visibleLeft` / `visibleRight` をそのままペインへ渡し、途中で `map` 等で複製しないでください(複製した行は強調されません)。
- `T` はオブジェクトである必要があります(`SpreadsheetGrid<T extends object>` の要求と同じ。`compare()` 単体は任意の `T` で動きます)。
- 左右の行の位置は既定では揃えません(ss2602 と同じ)。揃えたい場合は `alignRows: true`(左右整列モード)。プレースホルダ行は差分 Map に載らないため `getDiff()` は `undefined` を返します(`placeholders` の Set で判定してください)。
- `alignRows` のプレースホルダ行は既定で `{} as T` です。`row.foo.bar` のような入れ子アクセスをする `getValue` / `renderCell` / `valueFormatter` がある列では `createPlaceholderRow` で安全な行を返してください。
- グリッドの行グルーピング(`rowGroup`)を有効にした場合、グループ行には差分クラスは付きません(leaf 行のみ)。

## Phase 2

初版時の候補はすべて実装済みです: 左右整列モード(`alignRows`)/ スクロール同期(`enableScrollSync`)/ エクスポート(`getComparisonExportData`)/ 差分ジャンプ(`useComparisonNavigation`)/ マニュアル入力(`useManualRows`)/ 色覚多様性プリセット(`.cmpg-colors-cvd`)。経緯と設計判断は `docs/DESIGN_NOTES.md` を参照。
