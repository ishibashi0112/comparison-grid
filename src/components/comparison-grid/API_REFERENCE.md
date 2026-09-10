# comparison-grid 公開 API リファレンス

> このファイルは `model/types.ts` と各実装(`logic/compare.ts` / `logic/paneColumns.ts` / `hooks/useComparison.ts` /
> `view/*.tsx`)から手で起こした公開 API のスナップショットです。**型を変更したら本ファイルも同期してください。**
> spreadsheet-grid 側の props / 型は [spreadsheet-grid の API_REFERENCE](https://github.com/ishibashi0112/datasheet-grid/blob/main/src/components/spreadsheet-grid/API_REFERENCE.md) を参照。

最終更新: 2026-09-09(batch 24: N 構成比較の全構成一致判定 `mode: 'all'`。batch 19〜22 で N 構成の純ロジック / `useMultiComparison` / 同期と差分ジャンプの N 対応 / 合成コンポーネント `ComparisonLayout`)。

## どれを使うか(用途 → API)

| やりたいこと | 使う API | 使用例 |
| --- | --- | --- |
| 2 つのリストを比べて画面に出す | `useComparison` + `ComparisonView` | [examples/01](../../../examples/01-two-way-basic.tsx) |
| 部品表(階層)を比べる。別の親の下の同じ品番を突き合わせない | `buildComparisonTree` + `useTreeComparison` + `ComparisonView` | [examples/02](../../../examples/02-tree-comparison.tsx) |
| 3 構成以上を「基準に対して」比べる | `useMultiComparison` + `ComparisonLayout.Root / .Pane / .Header / .Grid` | [examples/03](../../../examples/03-multi-base.tsx) |
| 3 構成以上で「どこかに揺れがある行」を全部出す | `useMultiComparison({ mode: 'all' })` | [examples/04](../../../examples/04-multi-all.tsx) |
| ペインの配置・数・見出しを自分で決める(2×2 など) | `ComparisonLayout`(Root の `style` / `.cmpg-view` の CSS 上書き) | [examples/05](../../../examples/05-grid-2x2-navigation.tsx) |
| 次 / 前の差分へスクロール | `useComparisonNavigation`(2 構成)/ `useMultiComparisonNavigation`(N 構成。`useComparisonScrollSyncGroup` の `getHandle` と共有可) | [examples/05](../../../examples/05-grid-2x2-navigation.tsx) |
| DOM を完全に自前にする(ライブラリからは grid props だけ受け取る) | `useComparisonPane` + `useComparisonScrollSync`(2 構成)/ `useComparisonScrollSyncMany`(N 構成) | [examples/06](../../../examples/06-headless-own-grid.tsx) |
| React なしで判定だけ使う(Node / Worker / テスト) | `compare` / `alignComparisonRows` / `compareMany` / `alignComparisonRowsMany` / `buildComparisonTree` / `flattenComparisonTree` | — |
| CSV / Excel に出す | `getComparisonExportData`(grid の `getExportData()` と同形) | [examples/07](../../../examples/07-export-csv.tsx) |
| ユーザーが手入力したリストをマスタと比べる | `useManualRows` + `useComparison` | [examples/08](../../../examples/08-manual-input.tsx) |
| 色・余白・クラスを変える | `--cmpg-*` トークン / `CMPG_CLASS_NAMES` / `.cmpg-colors-cvd` / `style.layer.css` | [README「Styles」](../../../README.md#styles) |
| Root 配下に自作のツールバー / 集計を置く | `useComparisonLayout()` / `useComparisonLayoutSide()` | [examples/04](../../../examples/04-multi-all.tsx) |

**層の構造**(下ほど自由度が高く、上ほど書く量が少ない):

```
ComparisonView(2 ペインのプリセット)
  └ ComparisonLayout.Root / .Pane / .Header / .Grid(合成コンポーネント。配置と数は JSX で決める)
      └ useComparisonPane / useSyncedGridProps / useComparisonScrollSyncGroup(ヘッドレス。grid props を返す)
          └ compare / compareMany / alignComparisonRows(Many) / buildComparisonTree(純ロジック。React 非依存)
```

**落とし穴(先に読む)**:

- 差分は行**オブジェクトの同一性**で引く。`visibleLeft` 等を `map` で複製してからペインに渡すと強調されない。
- `createPlaceholderRow` / `getMatchKey` / `getCode` などの関数は**コンポーネント外で定義**する(インラインだと毎レンダー再計算)。`compareFields` / `columns` / `labels` / `sides` は浅い比較で安定化されるのでインラインでよい。
- `useComparison` の `showDiffOnly` は「意思」。表示に使うのは `effectiveShowDiffOnly`、トグルの `disabled` は `!canShowDiffOnly`。
- `scrollToRow` は view index を使うので、グリッド側のソート / フィルター適用中は差分ジャンプの行位置がずれる。
- 木モードは「展開済み・出現 1 回 = 1 行」のデータ前提。破綻は `buildComparisonTree(...).issues` で検出されるが修復はされない。

## 設計の要点

- **サイドカー方式**: 行 `T` には書き込まず、差分は `ReadonlyMap<T, ComparisonRowDiff<T>>` で行オブジェクトに紐づけます。グリッドへ渡すのは `T[]` そのものなので、`GridColumn<T>` / `SpreadsheetGridProps<T>` を `T` の型のまま書けます。
- **判定と見た目の分離**: 判定(kind / fieldDiffs / label)は純ロジック `compare()`、見た目はクラス(`.cmpg-*`)と CSS トークン(`--cmpg-*`)で差し替えます。
- **差分のみ表示は導出**: `effectiveShowDiffOnly = hasBothSides && showDiffOnly` を render 中に導出し、片側だけのデータでは自動的に無効になります(useEffect での state 同期はしません)。
- **ヘッドレス層 → 合成コンポーネント → プリセット**: ペインの差分合成は `useComparisonPane()`(`SpreadsheetGrid` へスプレッドできる `gridProps` を返す)、スクロール同期は `useComparisonScrollSyncGroup()` / `useSyncedGridProps()` がフックとして本体を持ちます。その上に合成コンポーネント `ComparisonLayout.Root / .Pane / .Header / .Grid`(Root が Context で配り、子は役割を名乗るだけ。ペイン数は JSX の子の数)があり、`ComparisonView` はそれで組んだ 2 ペインのプリセット、`ComparisonPane` はフックにラッパー DOM を足した便利品です。DOM や配置を自分で決めたいときは一段ずつ降りられます。
- **N 構成(3・4 構成)**: 基準対各構成の意味論で、`compareMany()` → `useMultiComparison()` → `ComparisonLayout` の順に載っています。2-way の API は変更していません。

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

## N 構成比較(基準対各構成。純ロジック)

3・4 構成を比べるための層です。2-way の `compare()` / `ComparisonRowDiff` は変更せず、その上に載せています。意味論は `mode` で選びます。

| `mode` | 意味 | 使いどころ |
| --- | --- | --- |
| `'base'`(既定) | **基準(base)を 1 つ選び、他の各構成を基準と 2-way 比較する**(git の base 比較と同じ)。基準以外のペインの行差分は「基準との 2-way 結果」そのもの、基準ペインの行差分は各構成との結果の集約。 | 「現行に対して案 1・案 2 で何が変わったか」を見る画面。 |
| `'all'` | **基準なし。行は全構成に存在し、全構成でフィールドが一致するときだけ `same`**。どのペインでも揺れのある行は差分になり、内訳(`missingIn` / `fieldDiffs` / `bySide`)は「自分から見た他の各構成」。 | 「構成間でどこかに揺れがある部品を全部あぶり出す」画面。 |

例: 部品 C3001 の数量が「X = 2 / 案1 = 2 / 案2 = 3」のとき、`'base'`(基準 X)では 案1 のペインは `same`(基準とは一致)、`'all'` では 案1 のペインも `field-diff`(ラベル `案2: 数量違い`)になります。差分型は両モードで同じ `ComparisonMultiRowDiff` です。React 層は `useMultiComparison`、view 層は `ComparisonLayout`(後述)。

### `compareMany<T>(sides, options): ComparisonMultiResult<T>`

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `sides` | `readonly ComparisonSideInput<T>[]` | 構成の配列(入力順がペインの既定順)。`{ id, rows, label? }`。`id` は重複不可、`label` は表示名(既定 `id`)。 |
| `options` | `CompareManyOptions<T>` | `CompareOptions<T>` から `formatDiffLabel` / `labels` を N 構成版に置き換えたもの + `baseId`(既定 `sides[0].id`)。 |

計算量は構成数 k に対して `O(k × (基準の行数 + その構成の行数))`。空の `sides` / 重複 ID / 存在しない `baseId` は例外(日本語メッセージ)。

### `CompareManyOptions<T>`

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `getMatchKey` / `compareFields` / `duplicateKeyPolicy` | (`CompareOptions<T>` と同じ) | | 各ペアの 2-way 比較にそのまま渡される。 |
| `mode` | `'base' \| 'all'` | `'base'` | 意味論(上表)。 |
| `baseId` | `ComparisonSideId` | `sides[0].id` | 基準にする構成(`mode: 'base'` のみ。`'all'` では無視)。 |
| `formatDiffLabel` | `(ctx: MultiDiffLabelContext<T>) => string` | `formatDefaultMultiDiffLabel` | ラベル生成の差し替え(基準 / 他ペインの両方に使われる)。 |
| `labels` | `Partial<ComparisonMultiLabels>` | `DEFAULT_COMPARISON_MULTI_LABELS` | 既定文言の部分上書き。 |

### ラベル(N 構成)

```ts
type ComparisonMultiLabels = {
  fieldDiffSeparator: string;  // '・'(2-way と共通)
  fieldDiffSuffix: string;     // '違い'(2-way と共通)
  baseOnly: string;            // '基準のみ'(基準ペインで、どの構成にも無い行)
  sideOnly: string;            // 'この構成のみ'(他ペインで、基準に無い行)
  missingInSide: string;       // '無し'(基準ペインの内訳: `案1: 無し`)
  sideSeparator: string;       // ' / '(内訳の構成間区切り)
  sideLabelSeparator: string;  // ': '(構成名と内訳の区切り)
};
```

`formatDefaultMultiDiffLabel(ctx)`: `mode: 'base'` の基準以外のペインは 2-way と同じ(`only` → `sideOnly` / `field-diff` → `数量・支給区分違い` / `same` → `''`)。基準ペインと `mode: 'all'` の各ペインは `only` → `baseOnly`(基準)/ `sideOnly`(`'all'`)、`partial` / `field-diff` → 他の構成ごとの内訳を入力順に連結(`案1: 数量違い / 案2: 無し`)。**相手が 1 構成だけのときは構成名の接頭辞を省く**ため、2 構成なら 2-way と同じ見た目(`数量違い` / `無し`)になります。

`MultiDiffLabelContext<T>`: `{ mode, sideId, isBase, kind, row, fieldDiffs, diffFields, missingIn, bySide, sides, labels }`。`sides` は全構成の `{ id, label, isBase }`(入力順。`'all'` では `isBase` は全て false)。

### 結果(`ComparisonMultiResult<T>`)

| Name | Type | Description |
| --- | --- | --- |
| `mode` | `'base' \| 'all'` | 採用された意味論。 |
| `baseId` | `ComparisonSideId \| undefined` | 採用された基準(`'all'` では `undefined`)。 |
| `axisId` | `ComparisonSideId` | 整列 / 差分ジャンプの軸になる構成(`'base'` では `baseId`、`'all'` では `sides[0].id`)。 |
| `sides` | `readonly ComparisonMultiSideResult<T>[]` | 入力順の構成別結果(下記)。 |
| `sidesById` | `ReadonlyMap<ComparisonSideId, ComparisonMultiSideResult<T>>` | ID 引き。 |
| `pairs` | `ReadonlyMap<ComparisonSideId, ComparisonResult<T>>` | `'base'`: 基準以外の構成 ID → 基準との 2-way 結果(`left` = 基準、`right` = その構成。片側ラベルは `baseOnly` / `sideOnly` に置き換え済み)。`'all'` では空。 |
| `hasAnyDiff` | `boolean` | いずれかの構成に `same` 以外の行があるか。 |

`ComparisonMultiSideResult<T>` = `{ id, label, isBase, rows, annotated, diffs, summary, duplicateKeys }`。`rows` は入力と同一参照、`annotated` は入力順の `{ row, diff }`、`diffs` は `ReadonlyMap<T, ComparisonMultiRowDiff<T>>`、`summary` は `{ total, same, only, partial, fieldDiff }`(`partial` は `'base'` の基準以外のペインでは常に 0)、`duplicateKeys` はその構成内で重複した突き合わせキー。

### `ComparisonMultiRowDiff<T>`

| Name | Type | Description |
| --- | --- | --- |
| `sideId` / `isBase` | `ComparisonSideId` / `boolean` | この差分が属する構成。 |
| `kind` | `'same' \| 'only' \| 'partial' \| 'field-diff'` | `only` = 相手が無い(基準ペイン / `'all'` では他のどの構成にも無い。`'base'` の他ペインでは基準に無い)。`partial` = 一部の構成に無いが、存在する構成とは一致(基準ペイン / `'all'` の各ペイン)。`field-diff` = いずれかの相手とフィールドが違う(一部に無い場合も含む → `missingIn`)。優先順は field-diff > partial > only > same。 |
| `label` | `string` | 表示用ラベル。`same` は `''`。 |
| `matchKey` | `string` | 突き合わせキー。 |
| `fieldDiffs` | `ReadonlySet<string>` | 差分のあった `CompareField.key`(基準ペイン / `'all'` では他の各構成との**和集合**)。 |
| `missingIn` | `ReadonlySet<ComparisonSideId>` | この行が無い構成(基準ペイン / `'all'` の各ペイン。`'base'` の他ペインでは常に空)。 |
| `counterparts` | `ReadonlyMap<ComparisonSideId, T>` | 突き合わせ相手。基準ペイン / `'all'` では相手が居る構成ぶん、`'base'` の他ペインでは `baseId` の 1 件。 |
| `bySide` | `ReadonlyMap<ComparisonSideId, ComparisonRowDiff<T>>` | 内訳: 構成 ID → その構成との 2-way 差分(自側 = `left` の注釈。`left-only` = その構成に無い)。`'base'` の他ペインでは `baseId` → 2-way 差分(自側 = `right` の注釈)。`'all'` の `equals` は **(自分の値, 相手の値)** の順で呼ばれる。 |

### `alignComparisonRowsMany<T>(result, options?): AlignComparisonRowsManyResult<T>`

`compareMany()` の結果を「同じ行位置 = 同じ突き合わせ相手」になるよう構成ごとの配列へ並べ直し、欠損側へプレースホルダ行を挿入します(`alignComparisonRows` の N 構成版)。

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `result` | `ComparisonMultiResult<T>` | `compareMany()` の結果。 |
| `options.createPlaceholderRow` | `(sideId: ComparisonSideId) => T` | プレースホルダ行の生成(**呼び出しごとに新しいオブジェクト**)。既定 `{} as T`。 |

戻り値 `{ rows, placeholders, rowCount }`: `rows` は `ReadonlyMap<ComparisonSideId, readonly T[]>`(Map の順序は構成の入力順。全配列が `rowCount` の長さ)、`placeholders` は構成 ID → その配列に挿入されたプレースホルダ行の集合。並び順は**軸の構成(`axisId`。`'base'` では基準、`'all'` では先頭)の行順**に対応行を同じ位置へ置き、軸に無い行は「構成の入力順 → その構成内の行順」で末尾に足します。同じキーを持つ他構成どうしの行は同じ行位置にまとめます(基準対各構成では比較されないが、目視で並ぶよう位置だけ揃える)。キー重複で複数の基準行が同じ相手を指す場合、相手は先に対になった行が消費します。2 構成では `alignComparisonRows` と同じ並びになります。

### ペインの差分合成との関係

`composeColumns` / `composeRowClassName` / `insertDiffLabelColumn`(`useComparisonPane` の内部)は `ComparisonAnyDiffMap<T>` = `ReadonlyMap<T, ComparisonRowDiff<T> | ComparisonMultiRowDiff<T>>` を受け付けます。判定は `kind` の文字列一致ではなく「相手が無いか」(`hasMissingCounterpart`: `left-only` / `right-only` / `only` / `partial`、または `missingIn` が空でない)と「`fieldDiffs` に列があるか」で行うため、N 構成の差分でも同じクラスが付きます(行修飾子は `--only` / `--partial` が加わる)。

### `getComparisonExportData<T>(options): GridExportData`

比較結果 1 側ぶんを spreadsheet-grid の `getExportData()` と同形(`{ columns: { key, title }[], rows: { value, text }[][] }`)で返します。CSV / Excel 出力の下流処理を共用できます。

| オプション | 型 | 既定 | 説明 |
| --- | --- | --- | --- |
| `rows` | `readonly T[]` | (required) | エクスポートする行。`visibleLeft` / `annotatedLeft.map((e) => e.row)` / 整列済み配列(対順エクスポート)など。 |
| `diffs` | `ComparisonDiffMap<T>` | (required) | この側の差分 Map(`leftDiffs` / `rightDiffs`)。 |
| `columns` | `readonly GridColumn<T>[]` | (required) | 列定義。`visible: false` の列は除外。 |
| `showDiffLabelColumn` | `boolean` | **`true`** | 差分ラベル列を含める(ペインの既定 `false` と異なる)。 |
| `diffLabelColumn` | `DiffLabelColumnOptions<T>` | — | ラベル列の調整(`key` / `title` / `position` / `descendantDiffLabel` を使用)。 |
| `descendantDiffCounts` | `ReadonlyMap<T, number>` | — | 木モードのロールアップ。渡すとラベル列に配下差分ラベルが入る(ペインと同じ規則)。 |

セルの規則: `value` は `getValue ?? row[key]`、`text` は本体の**セル表示**と同じく `value == null` なら `''`(`valueFormatter` を通さない)、それ以外は `valueFormatter({ value, row, column }) ?? String(value)`。列見出しは `title ?? key`。プレースホルダ行(alignRows)は全セル空になります。

## 階層比較(木)

平坦なコア(`compare` / `alignComparisonRows`)の上に載る**入力層**です。部品表のように親子関係を持つデータで品番だけをキーにすると「別の親の下の同じ品番」が突き合ってしまうため、木から**パス**(`B2002/C3001`)を突き合わせキーとして導出します。ノードは `T` を包むだけで、`T` に `children` を要求しません(サイドカー原則)。

### `ComparisonTreeNode<T>`

`{ row: T; children?: readonly ComparisonTreeNode<T>[] }`。入れ子 JSON をそのまま使う場合は利用側で `{ row, children: row.children.map(...) }` に包みます(平坦な行からは下記 `buildComparisonTree`)。

### `buildComparisonTree<T>(rows, options): BuildComparisonTreeResult<T>`

平坦な行から木を組み立てます(純関数)。入力形は 2 つ:

| `options` | 用途 | 説明 |
| --- | --- | --- |
| `{ getLevel: (row) => number }` | 展開結果(深さ優先順 + level) | BOM 展開 API の典型。**ID 不要**。level は先頭行を 0 とした相対値で扱う(0 始まりでも 1 始まりでも可)。「行の親 = 直前の 1 段浅い行」。 |
| `{ getId, getParentId }` | 隣接リスト(各行が親を指す) | `getId` は**出現ごとに一意な行 ID**(構成テーブルの PK / 展開時の連番)。`getParentId` が `null` / `undefined` / `''` ならルート。兄弟順・ルート順は入力順。 |

戻り値 `{ roots: ComparisonTreeNode<T>[]; issues: ComparisonTreeIssue<T>[] }`。**破綻は修復せず、ベストエフォートの木と `issues` で報告**します(投げません)。

| `issue.kind` | 条件 | ベストエフォートの扱い |
| --- | --- | --- |
| `level-jump` | level が直前の行より 2 段以上深い | 直前の行の子として扱う |
| `duplicate-id` | 同じ ID の行が複数ある | 親の参照は最初の行へ解決。**品番を ID に渡した典型** |
| `missing-parent` | 親 ID の行が見つからない | ルート行として扱う |
| `cycle` | 親の参照が循環している | その行をルート行として扱う |

`ComparisonTreeIssue<T>` = `{ kind, row, rowIndex, message }`(`message` は日本語。UI に出すか処理を止めるかは利用側の判断)。

**落とし穴 — 識別 ID と突き合わせコードは別**: 同じサブ ASSY が複数箇所で使われる構成は正常ですが、展開結果の親参照に**品番**を使うと「どの出現の子か」を区別できません(`duplicate-id` として検出されます)。展開 API が level 付きで返すなら `getLevel` が最も簡単で、行 ID は不要です。なお、品目間の構成マスタ(親品番・子品番・員数)から出現ごとの行へ**展開**する処理(DAG → 木)はライブラリの範囲外です。渡すのは「展開済みの、出現 1 回 = 1 行」のデータです。

### `flattenComparisonTree<T>(roots, options): FlattenComparisonTreeResult<T>`

木を深さ優先順に平坦化し、行ごとの突き合わせキーと階層情報をサイドカーで返します(純関数)。

| `options` | 型 | 既定 | 説明 |
| --- | --- | --- | --- |
| `getCode` | `(row: T) => string` | (required) | 自ノードのコード(パスの 1 セグメント)。木の中で何度現れてもよい。 |
| `getRepresentativeCode` | `(row: T) => string \| null \| undefined` | — | 代表コード。空でない値を返すと自セグメントを置き換え、**子孫のキーへ伝播**する(親が後継品番に変わっても子が突き合う)。 |
| `separator` | `string` | `'/'`(`DEFAULT_TREE_KEY_SEPARATOR`) | セグメントの区切り。 |

戻り値:

| Name | Type | Description |
| --- | --- | --- |
| `rows` | `T[]` | 深さ優先順の行(グリッド / `compare()` へそのまま渡す)。 |
| `infos` | `ReadonlyMap<T, ComparisonTreeInfo<T>>` | 行 → `{ depth, parent, hasChildren, occurrence, matchKey }`。`depth` は 0 始まり、`parent` はルートで `undefined`。 |

キーの規則: `親のキー + separator + セグメント`。同じ親の下でセグメントが重複したときは出現順に `#n` を付けます(`B2002/C3003`, `B2002/C3003#1`。区切りは `TREE_KEY_OCCURRENCE_SEPARATOR`)。取付位置・工程などで区別できる列があるなら、それを `getCode` に含めるほうが確実です。

headless での組み合わせ:

```ts
const flatLeft = flattenComparisonTree(leftTree.roots, { getCode });
const flatRight = flattenComparisonTree(rightTree.roots, { getCode });
const result = compare(flatLeft.rows, flatRight.rows, {
  getMatchKey: (row) => flatLeft.infos.get(row)?.matchKey ?? flatRight.infos.get(row)?.matchKey ?? '',
  compareFields,
});
```

### `alignComparisonTree<T>(left, right, leftDiffs, options?): AlignComparisonRowsResult<T>`

木モードの左右整列(**構造マージ**)。戻り値の形は `alignComparisonRows` と同じ(`pairs` / `placeholders`)ですが、並びの規則が違います。

| 引数 | 型 | 説明 |
| --- | --- | --- |
| `left` / `right` | `readonly ComparisonTreeNode<T>[]` | 左右の木。 |
| `leftDiffs` | `ComparisonDiffMap<T>` | `compare()` の `leftDiffs`(`counterpart` を使う)。 |
| `options.createPlaceholderRow` | `(side) => T` | `alignComparisonRows` と同じ。 |

規則: 兄弟リスト単位で左の順に対を作り(相手は**同じ兄弟リストに居る** counterpart だけ。別の場所に居る相手は片側のみ扱い)、右にしか無いサブツリーは**直前に対になった兄弟の直後**に挿入します(先行する対が無ければ最初の対の直前、対が 1 つも無ければ末尾)。片側のみのサブツリーは丸ごと相手側プレースホルダと組みます。ASSY 内に追加された部品がその ASSY の直下に並び、左右の親子関係が崩れません。

### `collectCollapsedDescendants<T>(flattened, collapsedKeys): Set<T>`

折りたたみの純ロジック。`flattenComparisonTree` の結果と、折りたたむ行の `matchKey` の集合から、**隠れる行(折りたたんだ行の子孫。自身は含まない)** を返します。`useTreeComparison` の `collapsedKeys` が内部で使うものと同じです(headless で自前の表示配列を作るときに)。

### `countDescendantDiffs<T>(annotated, infos): Map<T, number>`

ロールアップの純ロジック。`compare()` の注釈行(`annotatedLeft` 等)と `flattenComparisonTree` の `infos` から、行ごとに**配下(子孫)の差分行数**(`kind !== 'same'` の行数。自身は数えない)を返します。配下に差分が無い行は Map に載りません。`useTreeComparison` はこれを `descendantDiffCounts` として返し、「差分のみ」の文脈行判定(自身は same で配下に差分がある行)にも使います。

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

### `useTreeComparison<T>(options): UseTreeComparisonResult<T>`

`useComparison` の**木版**。左右の木(`ComparisonTreeNode<T>[]`)を深さ優先に平坦化し、木から導出したパスキーで `compare()` を回します。利用側は `getMatchKey` を書かず、`getCode`(+ `getRepresentativeCode`)を渡すだけです。戻り値は `UseComparisonResult<T>` と同形(`ComparisonView` / `useComparisonNavigation` / `getComparisonExportData` にそのまま渡せる)で、木固有の値が加わります。

`UseTreeComparisonOptions<T>` = `UseComparisonOptions<T>` から `left` / `right` / `getMatchKey` を除き、下記を加えたもの:

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `left` / `right` | `readonly ComparisonTreeNode<T>[]` | (required) | 左右の木(`buildComparisonTree(rows, …).roots` など)。**同じ参照を渡し続ければ表示配列の参照も安定**する(`useMemo` で組み立てる)。 |
| `getCode` / `getRepresentativeCode` / `separator` | `ComparisonTreeKeyOptions<T>` | — | キー導出設定(`flattenComparisonTree` と同じ)。`getRepresentativeCode` を付け外しすると「代表品番比較」の ON / OFF になる。 |
| `collapsedKeys` | `ReadonlySet<string>` | — | 折りたたむ行の突き合わせキー(`matchKey`)の集合(利用側の state)。キーは左右共通なので 1 つのキーで両ペインの対(サブツリー)が同時に隠れる。子孫は `visibleLeft` / `visibleRight` から除かれ、折りたたんだ行自身は残る。表示行が変わるため差分ジャンプの現在位置はリセットされる。 |
| `showDiffOnly` / `alignRows` / `createPlaceholderRow` / `compareFields` / `labels` / `formatDiffLabel` / `duplicateKeyPolicy` | — | — | `useComparison` と同じ。 |

`useComparison` との挙動の違い:

- **「差分のみ」は差分行に加えて、その祖先(文脈行)を残します。** `C3001` の差分が「どの ASSY の」か分かるようにするため。文脈行は `kind === 'same'` のままで、`contextRows` に集約され `ComparisonView` が `.cmpg-row-context` を付与します(既定で文字色が薄くなる)。差分の祖先ではない `same` 行(葉も ASSY も)は落ちます。
- **`alignRows` は構造マージ(`alignComparisonTree`)。** 右にしか無いサブツリーが末尾ではなく兄弟の位置に入ります。「差分のみ」との併用は対の単位でフィルタ(どちらかの側が残す行なら対ごと残す)。
- **折りたたみ(`collapsedKeys`)** は行位置ではなくキーで持つため、データの差し替えや整列 / フィルタの切り替えをまたいで維持されます。展開ボタンはライブラリが描画せず、利用側の列で `getTreeInfo(row).hasChildren` / `isCollapsed(row)` / `getTreeInfo(row).matchKey` を使って組みます(README レシピ)。「差分のみ」との併用では、折りたたんだ文脈行は残り配下だけ隠れます。
- `visibleLeft` / `visibleRight` は平坦化した配列で、入力(木)と同一参照にはなりません。

戻り値に加わるもの:

| Name | Type | Description |
| --- | --- | --- |
| `contextRows` | `{ left: ReadonlySet<T>; right: ReadonlySet<T> }` | 「差分のみ」で残した文脈行(OFF のときは空 Set)。`ComparisonView` へ `comparison` を渡せば自動で配線される。 |
| `getTreeInfo` | `(row: T) => ComparisonTreeInfo<T> \| undefined` | 左右どちらの行でも階層情報(`depth` / `parent` / `hasChildren` / `occurrence` / `matchKey`)を引ける(Level 列のインデント等に。プレースホルダ行は `undefined`)。 |
| `descendantDiffCounts` | `{ left: ReadonlyMap<T, number>; right: ReadonlyMap<T, number> }` | ロールアップ(行 → 配下の差分行数)。`ComparisonView` へ `comparison` を渡せば、自身は same で配下に差分がある行へ `.cmpg-row-rollup` が付き、差分ラベル列に配下差分ラベル(既定 `配下に差分 n 件`)が出る。 |
| `getDescendantDiffCount` | `(row: T) => number` | 左右どちらの行でも配下の差分行数を引ける(無ければ `0`。自作列の「配下に差分あり」マーク等に)。 |
| `isCollapsed` | `(row: T) => boolean` | その行が折りたたまれているか(`collapsedKeys` にその行の `matchKey` が含まれるか)。展開ボタンの向きに。 |

```tsx
const leftTree = useMemo(() => buildComparisonTree(leftRows, { getLevel }), [leftRows]);
const rightTree = useMemo(() => buildComparisonTree(rightRows, { getLevel }), [rightRows]);
const comparison = useTreeComparison<BomRow>({
  left: leftTree.roots,
  right: rightTree.roots,
  getCode,                                                       // (row) => row.itemCode
  getRepresentativeCode: useRepresentative ? getReprCode : undefined,
  compareFields,
  showDiffOnly,
  alignRows,
});
const navigation = useComparisonNavigation({ comparison, alignRows });
<ComparisonView comparison={comparison} columns={columns} … />
```

**メモ化**: `left` / `right`(木)/ `getCode` / `getRepresentativeCode` / `separator` は参照(同一性)で依存を判定します。アクセサはコンポーネント外で定義してください。`buildComparisonTree` は毎回新しい木を返すので `useMemo` で包みます。

### `useMultiComparison<T>(options): UseMultiComparisonResult<T>`

`compareMany()` の React 接続(`useComparison` の N 構成版)。`sides` / `compareFields` / `labels` を参照安定化し、「差分のみ」と整列を導出します。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `sides` | `readonly ComparisonSideInput<T>[]` | (required) | 構成の配列(入力順がペインの既定順)。要素の `id` / `rows` / `label` を比較して参照安定化されるため、配列も要素もインラインで書いてよい(`rows` 自体は同一参照であること)。 |
| `getMatchKey` / `compareFields` / `duplicateKeyPolicy` / `mode` / `baseId` / `formatDiffLabel` / `labels` | (`CompareManyOptions<T>` と同じ) | | `mode: 'all'` で全構成一致判定。 |
| `showDiffOnly` | `boolean` | `false` | 「差分のみ表示」の意思。実効値は `effectiveShowDiffOnly`。 |
| `alignRows` | `boolean` | `false` | 整列モード。全構成の `visibleRows` を同じ長さ(同じ行位置 = 同じ突き合わせ相手)にし、欠損側へプレースホルダ行を入れる(`alignComparisonRowsMany`)。 |
| `createPlaceholderRow` | `(sideId: ComparisonSideId) => T` | `{} as T` | プレースホルダ行の生成。コンポーネント外で定義すること(インラインだと毎レンダー再整列)。 |

戻り値(`UseMultiComparisonResult<T>`): `ComparisonMultiResult<T>` の `mode` / `baseId` / `axisId` / `pairs` / `hasAnyDiff` に加えて:

| Name | Type | Description |
| --- | --- | --- |
| `sides` | `readonly ComparisonMultiVisibleSide<T>[]` | 入力順の構成別結果。`ComparisonMultiSideResult<T>` + `visibleRows`(差分のみ / 整列を適用した表示行。フィルタ無し・alignRows OFF のときは `rows` と同一参照)+ `placeholderRows`(整列で挿入されたプレースホルダ行の Set)。 |
| `sidesById` / `getSide(id)` | `ReadonlyMap` / 関数 | ID 引き。 |
| `compareFields` | `readonly CompareField<T>[]` | 参照安定化済み(ペインのセル強調に渡す)。 |
| `hasAllSides` | `boolean` | 2 構成以上あり、全構成に行があるか(`useComparison` の `hasBothSides` に相当)。いずれかの構成が空だと基準の行が全件 `only` / `partial` になり「差分のみ」が全件表示と同義になるため、実効値の条件にしている。 |
| `effectiveShowDiffOnly` | `boolean` | `hasAllSides && showDiffOnly`。 |
| `canShowDiffOnly` | `boolean` | `hasAllSides && hasAnyDiff`(トグルの `disabled` に)。 |
| `getDiff(row)` | `(row: T) => ComparisonMultiRowDiff<T> \| undefined` | どの構成の行でも差分を引ける(プレースホルダ行は `undefined`)。 |

「差分のみ」は非整列では構成ごとに `same` 行を除き、整列では**行位置の単位**で「いずれかの構成に `same` 以外(プレースホルダを含む)があれば残す」ため、整列が保たれます。各構成の `visibleRows` / `diffs` / `placeholderRows` / `compareFields` を `useComparisonPane` に渡せば、2-way と同じ差分ハイライトが付きます(view 層の合成コンポーネントは後続バッチ)。

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
| `diffStops` | `readonly ComparisonDiffStop<T>[]` | 停止位置(`visibleLeft` の行順 → 左に無い右行は `visibleRight` の行順で末尾。平坦な alignRows の対順と同じ規則)。`alignRows: true` では左右の index が同じ行位置を指すため**行位置順**に並ぶ(木モードの構造整列で右のみが途中に入っても表示順どおりになる)。各停止は `kind` / `leftIndex` / `rightIndex` / `leftRow` / `rightRow` を持つ。 |
| `diffCount` / `canNavigate` | `number` / `boolean` | 停止数 / `diffCount > 0`(ボタンの `disabled` に)。 |
| `activeDiffIndex` | `number` | 現在の停止位置(未移動は `-1`)。表示行が変わるとリセット。 |
| `goToNextDiff()` / `goToPreviousDiff()` / `goToDiff(index)` | `() => void` 等 | 移動(範囲外はラップ: 末尾の次は先頭、未移動からの「前」は末尾)。 |

**注意**: `scrollToRow` は view index を受け取るため、**グリッド側のソート / フィルター**(`enableSorting` / `enableColumnFilter` 等)を適用中は行位置がずれます。差分ジャンプは比較結果の並びのまま表示している画面で使ってください。

### `useMultiComparisonNavigation<T>(options): UseMultiComparisonNavigationResult<T>`

N 構成の差分ジャンプ(`useComparisonNavigation` の N 構成版)。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `comparison` | `Pick<UseMultiComparisonResult<T>, 'sides' \| 'axisId'>` | (required) | `useMultiComparison` の戻り値。 |
| `alignRows` | `boolean` | `false` | 整列モード利用時に `true`。停止は行位置順になり、行の無い構成も同じ行位置へスクロールする。 |
| `align` | `ScrollAlign` | `'center'` | `scrollToRow` の align。 |
| `getHandle` | `(sideId) => SpreadsheetGridHandle<T> \| null \| undefined` | — | ハンドルの取得先を差し替える(`useComparisonScrollSyncGroup` の `getHandle` を渡すと ref の配線が不要)。省略時は `refs`。 |

戻り値: `refs`(構成 ID → `RefObject`。`gridProps={{ ref: navigation.getRef('a') }}` で配線。構成 ID の並びが変わらない限り安定)/ `getRef(id)` / `diffStops`(`ComparisonMultiDiffStop<T>` = `{ kind, indices: ReadonlyMap<sideId, number>, rows: ReadonlyMap<sideId, T> }`)/ `diffCount` / `activeDiffIndex` / `canNavigate` / `goToDiff(index)` / `goToNextDiff()` / `goToPreviousDiff()`。

停止位置は**軸の構成(`axisId`)の行順**(`same` 以外の行。各構成の行位置は `counterparts` から引く)→ 軸に無い行を「構成の入力順 → 行順」で末尾(同じ突き合わせキーを持つ他構成の行は 1 つの停止にまとめる。`alignComparisonRowsMany` と同じ規則)。純ロジック部分は `collectMultiDiffStops(sides, axisId, alignRows)` として公開。

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

### `useComparisonPane<T extends object>(options): UseComparisonPaneResult<T>`

片側 1 ペインぶんの差分合成をヘッドレスに行います(`ComparisonPane` の本体)。DOM を持たず、`SpreadsheetGrid` へそのままスプレッドできる `gridProps` を返します。

```tsx
const pane = useComparisonPane<Row>({
  rows: comparison.visibleLeft,
  diffs: comparison.leftDiffs,
  columns,
  compareFields: comparison.compareFields,
  keyColumnKeys: ['id'],
  placeholderRows: comparison.placeholders.left,
  gridProps: { theme: 'dark', getRowClassName: (r) => (r.flag ? 'mine' : undefined) },
});
<SpreadsheetGrid<Row> {...pane.gridProps} />;
```

`UseComparisonPaneOptions<T>` = `ComparisonPaneProps<T>` から `side` / `header` / `showHeader` / `className` / `style` を除いたもの(`rows` / `diffs` / `columns` / `compareFields` / `keyColumnKeys` / `placeholderRows` / `contextRows` / `descendantDiffCounts` / `gridProps` / `enable*` / `showDiffLabelColumn` / `diffLabelColumn`。各項目の意味は `ComparisonPane` を参照)。

| 戻り値 | Type | Description |
| --- | --- | --- |
| `gridProps` | `ComparisonPaneGridProps<T>`(`ComparisonGridProps<T> & { rows; columns; className }`) | `SpreadsheetGrid` へそのままスプレッドできる props。オプションの `gridProps` を引き継ぎ、`rows` / `columns` / `getRowClassName` / `className`(`'cmpg-grid your-class'`)をライブラリが与える。入力が同じなら参照は安定(`columns` / `compareFields` / `keyColumnKeys` / `diffLabelColumn` は浅い構造比較)。 |
| `columns` | `GridColumn<T>[]` | 差分クラスを合成した列(`showDiffLabelColumn` なら差分ラベル列を含む)。`gridProps.columns` と同じ参照。 |
| `getRowClassName` | `SpreadsheetGridProps<T>['getRowClassName']` | ライブラリの行クラスと利用側 `getRowClassName` を合成した関数。付与するものが無ければ利用側のものをそのまま返す。 |
| `getDiff` | `(row: T) => ComparisonAnyRowDiff<T> \| undefined` | この側の差分を引く参照関数。`renderCell` 内で差分に応じた描画をするときに。batch 22 から `diffs` は 2-way / N 構成のどちらの Map でも受け付けるため、型は Union(`'side' in diff` で 2-way と判別)。 |

差分ハイライトの CSS トークン(`--cmpg-*`)は `.cmpg-pane` に加えて `.cmpg-grid`(= `gridProps.className`)にも定義されているため、ラッパー無しでもハイライトが効きます。`.cmpg-colors-cvd` もグリッド root(またはその祖先)に付与できます。

### `useComparisonScrollSync<T>(options?): UseComparisonScrollSyncResult<T>`

両ペインのスクロール同期をヘッドレスに行います(`ComparisonView` の `enableScrollSync` の本体)。各側の `SpreadsheetGrid`(または `useComparisonPane` の `gridProps` の元)へ渡す `ref` / `onScroll` を合成した grid props を返します。

```tsx
const sync = useComparisonScrollSync<Row>({
  syncHorizontal: stacked,
  leftGridProps: { ref: navigation.leftRef },
  rightGridProps: { ref: navigation.rightRef },
});
const leftPane = useComparisonPane<Row>({ ..., gridProps: sync.leftGridProps });
const rightPane = useComparisonPane<Row>({ ..., gridProps: sync.rightGridProps });
```

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | `false` のときは `leftGridProps` / `rightGridProps` をそのまま返す(未指定なら空オブジェクト)。 |
| `syncHorizontal` | `boolean` | `false` | 縦(`top`)に加えて横(`left`)も同期する。列が上下に揃う縦並びレイアウト向け(`ComparisonView` は `layout='vertical'` で `true`)。 |
| `leftGridProps` / `rightGridProps` | `ComparisonGridProps<T>` | — | 合成元。利用側の `ref`(オブジェクト / 関数 / cleanup を返す関数 ref)と `onScroll` はそのまま透過・合成される。 |

戻り値 `{ leftGridProps, rightGridProps }`。`source: 'user'` のスクロールだけ相手の `setScrollPosition()` へ伝え、`'api'` 由来は無視してループを防ぎます(spreadsheet-grid v0.29.0 のスクロール API)。ハンドルの参照は ref callback / イベントハンドラ内でのみ行います。入力が同じなら参照は安定します。

### N 構成のスクロール同期(`useComparisonScrollSyncGroup` / `useSyncedGridProps` / `useComparisonScrollSyncMany`)

`useComparisonScrollSync` の内部を N 構成向けに公開したもの。2-way の `useComparisonScrollSync` はこれらの上に載っており、振る舞いは従来どおり。

| API | 説明 |
| --- | --- |
| `useComparisonScrollSyncGroup<T>({ enabled?, syncHorizontal? })` | 構成 ID ごとのハンドル登録(`register(sideId, handle) → 解除関数`)と伝播(`broadcast(fromSideId, params)`: `source === 'user'` のとき発火側以外の全ハンドルへ `setScrollPosition`)を持つ共有オブジェクト `ComparisonScrollSyncGroup<T>` を返す。`enabled=false` でも**登録は行われ**(`getHandle(sideId)` が使える)、`broadcast` だけ止まる。参照は `enabled` / `syncHorizontal` が変わらない限り安定。合成コンポーネントの Root はこれを Context で配る。 |
| `useSyncedGridProps<T>(group, sideId, userProps?)` | 1 グリッドぶんの `ref` / `onScroll` を group と合成した `ComparisonGridProps<T>`(利用側の `ref` / `onScroll` は透過)。 |
| `useComparisonScrollSyncMany<T>({ sides, enabled?, syncHorizontal? })` | `sides: Record<sideId, ComparisonGridProps<T> \| undefined>` をまとめて合成し `{ sides: Record<sideId, ComparisonGridProps<T>>, group }` を返す。`sides` の参照が変わると全構成の `ref` / `onScroll` が作り直されるため `useMemo` で保持すること。純関数版 `composeSyncedGridProps(group, sideId, userProps)` も公開。 |

```tsx
const multi = useMultiComparison({ sides, getMatchKey, compareFields, alignRows: true });
const sync = useComparisonScrollSyncMany<Row>({ sides: useMemo(() => ({ base: undefined, a: undefined, b: undefined }), []) });
const navigation = useMultiComparisonNavigation({ comparison: multi, alignRows: true, getHandle: sync.group.getHandle });
// 各構成: useComparisonPane({ rows: side.visibleRows, diffs: side.diffs, placeholderRows: side.placeholderRows, gridProps: sync.sides[side.id], ... })
```

### 合成コンポーネント `ComparisonLayout`(`ComparisonLayoutRoot` / `ComparisonLayoutPane` / `ComparisonLayoutHeader` / `ComparisonLayoutGrid`)

HeroUI の `Dropdown.Trigger / .Popover` と同じ **Compound Components** の形です。Root が Context で比較結果・列・ハイライト設定・スクロール同期グループを配り、Pane / Header / Grid は役割を名乗るだけで、配置・階層・追加要素は利用側の JSX が決めます。**ペインの数は JSX の子の数**なので、2-way(`useComparison` / `useTreeComparison`)でも N 構成(`useMultiComparison`)でも同じ書き方です。名前付き export が主(tree-shaking のため)で、名前空間 `ComparisonLayout = { Root, Pane, Header, Grid }` は同じ実体の別名です。

```tsx
const multi = useMultiComparison({ sides, getMatchKey, compareFields, alignRows });
<ComparisonLayout.Root<Row> comparison={multi} columns={columns} keyColumnKeys={['id']} enableScrollSync showDiffLabelColumn>
  {multi.sides.map((side) => (
    <ComparisonLayout.Pane key={side.id} side={side.id}>
      <ComparisonLayout.Header>{side.label}</ComparisonLayout.Header>
      <ComparisonLayout.Grid<Row> gridProps={{ height: 480 }} />
    </ComparisonLayout.Pane>
  ))}
</ComparisonLayout.Root>
```

**`ComparisonLayoutRoot<T>`**(`ComparisonLayoutRootProps<T>`)

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `comparison` | `ComparisonLayoutModel<T>` | (required) | `useComparison` / `useTreeComparison` の戻り値(2-way。side は `'left'` / `'right'`)か `useMultiComparison` の戻り値(N 構成。side は構成 ID)。`'sides' in comparison` で判別。正規化の依存はモデルの中身なので、インラインで組んだオブジェクトでも再正規化されない。 |
| `columns` / `keyColumnKeys` | `GridColumn<T>[]` / `string[]` | | `ComparisonView` と同じ。 |
| `layout` | `'horizontal' \| 'vertical'` | `'horizontal'` | 横並びは**子の数だけ等幅カラム**(`grid-auto-flow: column`)、縦並びは 1 カラムに積む。 |
| `enableScrollSync` | `boolean` | `false` | 全ペインのスクロール同期(軸は layout に依る)。Root が `useComparisonScrollSyncGroup` を生成する。 |
| `scrollSyncGroup` | `ComparisonScrollSyncGroup<T>` | — | 外で作ったグループを注入(`useMultiComparisonNavigation({ getHandle: group.getHandle })` と共有するとき)。渡すと `enableScrollSync` / layout の軸設定は無視され、グループ自身の設定が使われる。 |
| `enableRowHighlight` / `enableKeyCellHighlight` / `enableFieldCellHighlight` / `showDiffLabelColumn` / `diffLabelColumn` | | | `ComparisonView` と同じ(全ペイン共通)。 |
| `gridProps` | `ComparisonGridProps<T>` | — | 全ペイン共通の grid props(Grid の `gridProps` が上にマージ)。 |
| `className` / `style` / `children` | | | ルート `.cmpg-view .cmpg-view--{layout}`(`data-cmpg-layout`)。 |

**`ComparisonLayoutPane`**(`{ side, className?, style?, children? }`): `.cmpg-pane .cmpg-pane--{side}`(`data-cmpg-side`)。配下の Grid に `side` を供給する。`--{side}` 修飾子は ID が `[A-Za-z0-9_-]` のときだけ付く(`data-cmpg-side` は常に付く)。

**`ComparisonLayoutHeader`**(`{ className?, style?, children? }`): `.cmpg-pane-header` スロット。指定したペインにだけ描画される(両ペインの上端を揃えたい場合は利用側で両方に置く。`ComparisonView` はそうしている)。

**`ComparisonLayoutGrid<T>`**(`ComparisonLayoutGridProps<T>` = `{ side?, gridProps?, className?, style? }`): `.cmpg-pane-body` + `SpreadsheetGrid`。`side` は Pane 配下では省略可、Pane 無し(自前ラッパー)では必須。本体は `useComparisonPane` + `useSyncedGridProps`(同期 OFF でもハンドルは同期グループに登録されるため、`useMultiComparisonNavigation` の `getHandle` で引ける)。Root 外・存在しない構成 ID・side 不明は日本語メッセージの例外。

**フック / 補助**: `useComparisonLayout<T>()`(Root が配る `ComparisonLayoutContextValue<T>` = `{ sides, getSide, columns, keyColumnKeys, compareFields, highlight, gridProps, layout, scrollSyncGroup }`。自作のツールバー / 集計表示に)/ `useComparisonLayoutSide()`(現在の Pane の構成 ID)/ `normalizeLayoutSides(model)`(2-way / N 構成のモデルを `ComparisonLayoutSide<T>[]` に正規化する純関数)。

### `ComparisonView<T extends object>`

2 ペイン + ヘッダースロットの CSS Grid レイアウトです。既定は左右 2 カラム(横並び)で、`layout='vertical'` で上下 2 行(縦並び)になります。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `comparison` | `ComparisonViewModel<T>` | (required) | `useComparison` / `useTreeComparison` の戻り値をそのまま渡す(`visibleLeft` / `visibleRight` / `leftDiffs` / `rightDiffs` / `compareFields`、alignRows 利用時は `placeholders`、木モードでは `contextRows` / `descendantDiffCounts` も使用)。 |
| `columns` | `readonly GridColumn<T>[]` | (required) | 利用側の列定義(両ペイン共通)。参照安定化(浅い構造比較)される。 |
| `keyColumnKeys` | `readonly string[]` | — | 突き合わせキー相当の列キー。`left-only` / `right-only` 行でその列のセルを強調。 |
| `layout` | `ComparisonViewLayout`(`'horizontal' \| 'vertical'`) | `'horizontal'` | ペイン配置。`'vertical'` で上下 2 ペイン(left が上、right が下)になる。API 上の名前は配置に依らず left / right のまま。縦並びの行は auto(各ペインが内容の高さ = グリッドの `height` / `maxHeight` で積まれる)。ビューの高さを両ペインで等分したいときは利用側 CSS で `.cmpg-view--vertical { grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }` を上書きし、`gridProps={{ height: '100%' }}` を併用する。 |
| `leftHeader` / `rightHeader` | `ReactNode` | — | ペイン上部のスロット。片側だけ指定しても両ペインに(空の)スロットを描画して上端を揃える。 |
| `gridProps` | `ComparisonGridProps<T>` | — | 両ペイン共通の `SpreadsheetGrid` props(下記「gridProps の透過」)。 |
| `leftGridProps` / `rightGridProps` | `ComparisonGridProps<T>` | — | 片側だけの上書き(`gridProps` の上に浅くマージ)。`ref` を片側ずつ渡す用途など。 |
| `showDiffLabelColumn` | `boolean` | `false` | 差分ラベル列を自動追加する。 |
| `diffLabelColumn` | `DiffLabelColumnOptions<T>` | `{ key: 'cmpgDiffLabel', title: '差分', width: 150, position: 'end' }` | ラベル列の調整(`GridColumn` の任意プロパティ + `position: 'start' \| 'end' \| number` + `descendantDiffLabel: (count) => string`)。`getValue` はライブラリが与える。木モードでは自身のラベルが空で配下に差分がある行に `descendantDiffLabel(count)`(既定 `配下に差分 n 件`)を出す。 |
| `enableRowHighlight` | `boolean` | `true` | `same` 以外の行へ `.cmpg-row-diff` を付与。 |
| `enableKeyCellHighlight` | `boolean` | `true` | `keyColumnKeys` 列のセル強調。 |
| `enableFieldCellHighlight` | `boolean` | `true` | `compareFields` 対応列のセル強調。 |
| `enableScrollSync` | `boolean` | `false` | 両ペインのスクロールを同期する(`alignRows` との併用を想定)。同期する軸は `layout` に依る: `'horizontal'` は**縦**(top)のみ(横は同期しない)、`'vertical'` は**縦横**(top / left)両方(縦並びでは列が上下に揃うため横も合わせる)。`source: 'user'` のスクロールだけ相手の `setScrollPosition()` へ伝え、`'api'` 由来は無視してループを防ぐ(spreadsheet-grid v0.29.0 のスクロール API)。利用側の `ref` / `onScroll`(`gridProps` / 片側 props)はそのまま透過・合成される。 |
| `className` / `style` | `string` / `CSSProperties` | — | ルート(`.cmpg-view`)へ。 |

`ComparisonView` は batch 22 から合成コンポーネントで組んだプリセットです(props / DOM / 振る舞いは従来どおり)。3 ペイン以上や独自配置は `ComparisonLayout` を直接使ってください。

### `ComparisonPane<T extends object>`

片側 1 ペイン。`ComparisonView` を使わず自分でレイアウトしたいときに使います。実体は `useComparisonPane(options)` + ラッパー DOM(`.cmpg-pane` / ヘッダースロット / `.cmpg-pane-body`)で、ラッパーも要らなければフックだけを使います。

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `side` | `'left' \| 'right'` | (required) | `.cmpg-pane--left` / `--right` と `data-cmpg-side` を付与。 |
| `rows` | `readonly T[]` | (required) | 表示行(`visibleLeft` 等)。 |
| `diffs` | `ComparisonDiffMap<T>` | (required) | この側の差分 Map(`leftDiffs` 等)。 |
| `columns` | `readonly GridColumn<T>[]` | (required) | 列定義。 |
| `compareFields` | `readonly CompareField<T>[]` | — | セル強調の対応付け(`useComparison().compareFields`)。 |
| `keyColumnKeys` | `readonly string[]` | — | 同上。 |
| `placeholderRows` | `ReadonlySet<T>` | — | この側の `rows` に含まれるプレースホルダ行(`placeholders.left` 等)。`.cmpg-row-placeholder` を付与する。 |
| `contextRows` | `ReadonlySet<T>` | — | この側の `rows` に含まれる文脈行(`useTreeComparison().contextRows.left` 等)。`.cmpg-row-context` を付与する。 |
| `descendantDiffCounts` | `ReadonlyMap<T, number>` | — | この側のロールアップ(`useTreeComparison().descendantDiffCounts.left` 等)。自身が same で配下に差分がある行へ `.cmpg-row-rollup` を付け、差分ラベル列に配下差分ラベルを出す。 |
| `header` | `ReactNode` | — | ヘッダースロット。 |
| `showHeader` | `boolean` | `header !== undefined` | スロットの描画有無(片側だけヘッダーがある場合の高さ揃えに)。 |
| `gridProps` | `ComparisonGridProps<T>` | — | 透過 props。 |
| `showDiffLabelColumn` / `diffLabelColumn` / `enable*` | — | — | `ComparisonView` と同じ。 |
| `className` / `style` | — | — | ルート(`.cmpg-pane`)へ。 |

### gridProps の透過(`ComparisonGridProps<T>`)

`Omit<SpreadsheetGridProps<T>, 'rows' | 'columns' | 'dataSource'>`。合成の実体は `useComparisonPane` で、`ComparisonPane` / `ComparisonView` 経由でもフック直接でも同じ規則です。

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
| `.cmpg-view` / `.cmpg-view--horizontal` / `.cmpg-view--vertical` | ルート | CSS Grid(横並び = 子の数だけ等幅カラム。明示 2 カラム + `grid-auto-flow: column` の暗黙カラム / 縦並び = 1 カラム)。`layout` に応じた修飾子と `data-cmpg-layout` 属性が付く。 |
| `.cmpg-pane` / `.cmpg-pane--left` / `.cmpg-pane--right` / `.cmpg-pane--{sideId}` | ペイン | 縦 flex。`data-cmpg-side` 属性も付く(N 構成では構成 ID)。 |
| `.cmpg-pane-header` / `.cmpg-pane-body` | ペイン内 | ヘッダースロット / グリッド領域。 |
| `.cmpg-grid` | グリッド root(`.ssg-root`) | 利用側 `className` と合成。差分ハイライトのトークンはここにも定義される(`useComparisonPane` のヘッドレス利用でラッパー `.cmpg-pane` が無くても効く)。 |
| `.cmpg-row-diff` | 行コンテナ + 各データセル | `same` 以外の行。修飾子 `--left-only` / `--right-only` / `--field`(2-way)、`--only` / `--partial` / `--field`(N 構成)。 |
| `.cmpg-cell-diff` | セル | 強調セル共通。修飾子 `--key`(キー列 × 相手の無い行)/ `--field`(差分フィールド列 × `fieldDiffs` にその列がある行)。 |
| `.cmpg-row-placeholder` | 行コンテナ + 各データセル | alignRows で欠損側に入るプレースホルダ行。差分ハイライトとは独立で、`enableRowHighlight={false}` でも付与される。 |
| `.cmpg-row-context` | 行コンテナ + 各データセル | 木モードの「差分のみ」で差分行の祖先として残る文脈行(`kind` は `same`)。差分ハイライトとは独立で、`enableRowHighlight={false}` でも付与される。 |
| `.cmpg-row-rollup` | 行コンテナ + 各データセル | 木モードで、自身は `same` だが配下に差分がある行(ロールアップ)。差分ハイライトの一種で `enableRowHighlight` に従う。差分行クラスとは同時に付かない。 |

ハイライトの実体は `.ssg-body-cell.cmpg-row-diff { background }` / `.ssg-body-cell.cmpg-cell-diff { color; font-weight }`(特異度 (0,2,0))。行ホバーは `.ssg-body-cell.cmpg-row-diff.ssg-body-cell--row-hovered` で `--cmpg-diff-row-hover-bg` に切り替わります。

### トークン

| トークン | 定義場所 | 既定(light) | 既定(dark: `.ssg-theme-dark` 配下) |
| --- | --- | --- | --- |
| `--cmpg-view-gap` | `:where(.cmpg-view)` | `16px` | — |
| `--cmpg-pane-header-min-height` | `:where(.cmpg-pane, .cmpg-grid)` | `24px` | — |
| `--cmpg-pane-header-gap-x` / `-gap-y` | `:where(.cmpg-pane, .cmpg-grid)` | `16px` / `4px` | — |
| `--cmpg-pane-header-margin-bottom` | `:where(.cmpg-pane, .cmpg-grid)` | `4px` | — |
| `--cmpg-diff-row-bg` | `:where(.cmpg-pane, .cmpg-grid)` | `#fef9c3` | `rgba(250, 204, 21, 0.14)` |
| `--cmpg-diff-row-hover-bg` | `:where(.cmpg-pane, .cmpg-grid)` | `#fef08a` | `rgba(250, 204, 21, 0.22)` |
| `--cmpg-diff-text` | `:where(.cmpg-pane, .cmpg-grid)` | `#dc2626` | `#f87171` |
| `--cmpg-diff-font-weight` | `:where(.cmpg-pane, .cmpg-grid)` | `700` | — |
| `--cmpg-placeholder-row-bg` | `:where(.cmpg-pane, .cmpg-grid)` | `#f3f4f6` | `rgba(148, 163, 184, 0.1)` |
| `--cmpg-placeholder-row-hover-bg` | `:where(.cmpg-pane, .cmpg-grid)` | `#e5e7eb` | `rgba(148, 163, 184, 0.18)` |
| `--cmpg-context-row-text` | `:where(.cmpg-pane, .cmpg-grid)` | `#6b7280` | `#9ca3af` |
| `--cmpg-rollup-row-bg` | `:where(.cmpg-pane, .cmpg-grid)` | `#fefce8` | `rgba(250, 204, 21, 0.07)` |
| `--cmpg-rollup-row-hover-bg` | `:where(.cmpg-pane, .cmpg-grid)` | `#fef9c3` | `rgba(250, 204, 21, 0.12)` |

上書きは `.cmpg-pane { --cmpg-diff-row-bg: ... }`(light)/ `.cmpg-pane .ssg-theme-dark { ... }`(dark)。ヘッドレス利用(ラッパー無し)では `.cmpg-grid { ... }` / `.cmpg-grid.ssg-theme-dark { ... }`。`:where()` 定義のため読み込み順に依らず勝ちます。

### 配色プリセット(`.cmpg-colors-cvd`)

色覚多様性向けのオプトインプリセット。**利用側が** `.cmpg-view` / `.cmpg-pane` / `.cmpg-grid`(または任意の祖先)へ `cmpg-colors-cvd` クラスを付与すると:

- 差分行の黄系 → **青系**(light: blue-100 `#dbeafe` / hover blue-200)、強調文字の赤 → **橙系**(orange-800 `#9a3412`。白地でコントラスト比 約 7:1)。ダークは青 α / orange-300 に差し替え。ロールアップ行は blue-50 `#eff6ff` / hover blue-100。
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
- 木モード(`useTreeComparison`)の `visibleLeft` / `visibleRight` は平坦化した配列で、入力と同一参照にはなりません(木の参照が同じなら安定)。渡す木は `useMemo` で組み立ててください。
- 木モードは「展開済みの、出現 1 回 = 1 行」のデータを前提にします。行が深さ優先順に並んでいない・親参照に品番を使っている等の破綻は `buildComparisonTree(...).issues` で**検出**できますが**修復**はされません。品目間の構成マスタ(DAG)からの展開はライブラリの範囲外です。
- 配布物(`dist/index.js`)は単一モジュールで、先頭で `SpreadsheetGrid` を import します。比較フックを初期バンドルに、`ComparisonView` を `React.lazy` のチャンクに分けると、バンドラはモジュール単位で配置するためライブラリ丸ごと(+ spreadsheet-grid)が初期バンドル側に入り、分割が効きません。フックとビューは同じチャンク(画面単位の lazy)に置いてください(`docs/DESIGN_NOTES.md` 7 章)。

## Phase 2

初版時の候補はすべて実装済みです: 左右整列モード(`alignRows`)/ スクロール同期(`enableScrollSync`)/ エクスポート(`getComparisonExportData`)/ 差分ジャンプ(`useComparisonNavigation`)/ マニュアル入力(`useManualRows`)/ 色覚多様性プリセット(`.cmpg-colors-cvd`)。経緯と設計判断は `docs/DESIGN_NOTES.md` を参照。

階層比較(`buildComparisonTree` / `flattenComparisonTree` / `alignComparisonTree` / `useTreeComparison`)は batch 15、ロールアップ(`countDescendantDiffs` / `.cmpg-row-rollup` / 配下差分ラベル)は batch 16a、折りたたみ(`collapsedKeys` / `isCollapsed` / `collectCollapsedDescendants`)は batch 16b で追加。展開ボタンの UI は利用側の列で組む(README レシピ)。

ヘッドレス層(`useComparisonPane` / `useComparisonScrollSync`)は batch 18(2026-09-07)で追加。`ComparisonPane` / `ComparisonView` の振る舞いは変えず、本体をフックへ移して薄い包みにした。

N 構成比較(3・4 構成)は batch 19(2026-09-07)で純ロジック(`compareMany` / `alignComparisonRowsMany`)、batch 20 で React 接続(`useMultiComparison`)、batch 21 でスクロール同期と差分ジャンプの N 対応(`useComparisonScrollSyncGroup` / `useComparisonScrollSyncMany` / `useMultiComparisonNavigation`)、batch 22 で合成コンポーネント(`ComparisonLayout.Root / .Pane / .Header / .Grid`。`ComparisonView` はそのプリセットに)を追加。batch 24(2026-09-09)で全構成一致判定 `mode: 'all'` を追加。木モードの N 化は後続(`docs/DESIGN_NOTES.md` 6 章)。
