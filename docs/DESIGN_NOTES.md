# 設計ノート(comparison-grid)

引き継ぎ書 `comparison-grid_handoff_prompt.md` を起点に、2026-08-29 のセッションで確認・決定した事項の記録です。Web 版 / ローカルのどちらで作業を続ける場合も本書を正とします。

## 1. 引き継ぎ書からの変更点(合意済み)

| 項目 | 引き継ぎ書 | 決定 | 理由 |
| --- | --- | --- | --- |
| 行の表現 | `ComparisonRow<T>` で行を包み、`ComparisonPane` が列定義を自動ラップ | **サイドカー方式**: グリッドへ `T[]` をそのまま渡し、差分は `Map<T, ComparisonRowDiff<T>>` で横持ち | `GridColumn<T>` の `row` を受け取るコールバックが 12 種以上(getValue / setValue / renderCell / cellClassName / valueFormatter / filterFn / validate / estimateCellWidth / parseClipboardValue / formatClipboardValue / editor の per-row options / aggFunc)+ `gridProps` 側(getRowClassName / onRowsChange / createRow / getContextMenuItems …)あり、spreadsheet-grid の minor 更新ごとにラップ漏れが起きる。サイドカーなら `gridProps` が `SpreadsheetGridProps<T>` のまま透過できる |
| `counterpart` の型 | `unknown` | `T \| undefined` | `unknown` にする理由がない |
| 結果配列の名前 | `annotatedLeft` / `annotatedRight`(hook)| `compare()` も同名(`annotatedLeft` / `annotatedRight`) | hook が result をスプレッドするため統一 |
| 件数 | `hasAnyDiff` のみ | `summary: { left, right }`(片側ごとに `total / same / only / fieldDiff`)+ `hasAnyDiff` | キー重複時に「ペア」が定義できないため片側単位で数える |
| キー重複 | 決めて文書化 | 既定 `'last'`(後勝ち・ss2602 互換)、`duplicateKeyPolicy: 'first'` あり。重複キーは `duplicateKeys` に報告 | — |
| トグル無効条件 | `hasAnyDiff` / `hasBothSides` を返す | 加えて `canShowDiffOnly = hasBothSides && hasAnyDiff` を返す | ss2602 の `isDiffSwitchDisabled` を 1 値で置き換え |
| 差分ラベル列 | 言及なし | `showDiffLabelColumn` / `diffLabelColumn` で自動挿入(既定 OFF)+ `getDiff(row)` で自作列も可 | 行に `diffLabel` が無いため利用側が列を書けない |
| セル強調の対応列 | `compareFields.key` と列キーの一致 | 加えて `CompareField.columnKey` で別列を指定可 | `getValue` で計算値を比較するケース |
| peer 範囲 | 最新に合わせる | `>=0.28.1 <1.0.0` | 0.x で minor が頻繁に上がる(`^0.28` だと 0.29 で弾かれる) |

## 2. API の決定事項(補足)

- `equals` の引数順は左右どちらの注釈でも `(左の値, 右の値)`。非対称な判定(許容差など)を書けるようにするため。
- `visibleLeft` / `visibleRight` はフィルタ無しのとき入力配列と同一参照(グリッドの `autoSizeColumns: 'onDataChange'` や undo 履歴が「外部差し替え」と誤認しないように)。
- 参照安定化: `compareFields` / `labels` / `columns` / `keyColumnKeys` / `diffLabelColumn` は浅い構造比較で安定化(`hooks/useStableValue.ts`)。インライン記述でも列定義の再生成(= グリッドの「columns 変化」扱い)を起こさない。関数はインラインだと毎レンダー再計算されるため README で注意喚起。
- 列定義は差分 Map を閉じ込めた `cellClassName` を持つため、データ(= 差分)が変わるたびに強調対象列のオブジェクトが更新される。頻度はデータ差し替え時のみで許容範囲(render 中の ref 書き込みで回避する案は eslint baseline を汚すため不採用)。
- `ComparisonGridProps<T>` から `dataSource` も除外(serverSide モードは比較と両立しない)。
- ヘッダースロットは片側だけ指定しても両ペインに描画して上端を揃える(ss2602 の `min-h-6` スペーサー相当)。

## 3. CSS

- spreadsheet-grid と同じ方針: 未レイヤー / `:where()` トークン / 連結セレクタでグリッド既定に勝つ / `style.layer.css` 二本立て(`@layer cmpg-base`)。
- 既定色は ss2602 実績(行: yellow-100 `#fef9c3` / 差分値: red-600 `#dc2626` 太字)。ダークは `.ssg-theme-dark` 配下でトークン差し替え。
- 行ホバー色は spreadsheet-grid の内部クラス `.ssg-body-cell--row-hovered` に依存(下記提案 6)。

## 4. spreadsheet-grid への提案(本リポジトリでは実装しない)

作業中に「あると楽 / 型が緩い / API が足りない」と感じた点。優先度順。spreadsheet-grid 側へ渡す詳細版(背景 / 現状 / API 案 / 互換性)は `docs/SPREADSHEET_GRID_PROPOSALS.md`。

**採用状況(2026-08-29 追記)**: spreadsheet-grid v0.29.0(コミット「proposals batch 1〜6」)で 1・2・3・5・6・8 が採用、7 は (b)(現状維持 + API_REFERENCE への明記)を採用。4 は既存の `rowKeyGetter` prop が該当していた(0.28.1 時点で存在。提案書の「現状」認識が誤り)ため変更なし。採用時の本リポジトリ側の対応(`GridCellStyleContext` の再エクスポート化 / `rows as T[]` キャスト削除 / `installJsdomLayoutStubs()` への置換 / peer 下限 `>=0.29.0`)は反映済み。項目ごとの詳細は `docs/SPREADSHEET_GRID_PROPOSALS.md` の「採用結果」を参照。

1. **`CellStyleContext` をバレルから公開する。** `GridColumn.cellClassName` の関数版の引数型が未公開のため、`GridCellStyleContext<T> = Parameters<Exclude<NonNullable<GridColumn<T>['cellClassName']>, string>>[0]` で導出していた(`model/types.ts`)。v0.29.0 で公開され、再エクスポートへ差し替え済み。
2. **`rows` / `columns` を `readonly` 配列で受け付ける。** `useMemo` 由来の `readonly T[]` を渡すのにキャストが要った(`ComparisonPane` の `rows as T[]`)。v0.29.0 で readonly 化され(`filterOptions` も)、キャストは削除済み。
3. **jsdom テスト用のレイアウトスタブを公式化する。** 列仮想化が ResizeObserver の通知だけで幅を得るため、no-op スタブでは列が 1 本も描画されない(本リポジトリの `ComparisonView.test.tsx` に「observe 時に即時コールバックする ResizeObserver + clientWidth/Height + getBoundingClientRect」のスタブがある)。`@ishibashi0112/spreadsheet-grid/testing` の `installJsdomLayoutStubs()` のようなヘルパー、または README の「Testing」節として提供すると、利用側(ss2602 など)の結合テストが書きやすくなる。v0.29.0 で `/testing` サブパスとして公開され、`ComparisonView.test.tsx` の自前スタブは公式ヘルパーへ置換済み。
4. **`getRowKey`(利用側の行キー)prop。** 現状の行キーは内部導出で利用側から指定できない。Phase 2 のマニュアル入力ペイン(編集で行オブジェクトが差し替わる)や、比較結果の行選択状態を維持したい場面で、安定した行 ID が欲しくなる。
5. **`getRowClassName` のコンテキスト版。** `cellClassName` は `CellStyleContext`(`sourceRowIndex` / `rowKey` 付き)を受け取るのに対し `getRowClassName` は `(row, rowIndex)` のみ。`(ctx: RowStyleContext<T>) => string` のオーバーロードがあると対称になる(本ライブラリはサイドカーで行オブジェクトから引けるため未使用)。
6. **状態クラスの公開契約化。** `.ssg-body-cell--row-hovered` / `--readonly` / `--invalid` などをホバー色の連結に使っている。API_REFERENCE に「スタイル用の状態クラス一覧」として載せておくと、利用側が安心して連結できる。
7. **`title: ''` の列ヘッダーが `key` にフォールバックする。** ボタン専用列(ss2602 の `__detail`)で空タイトルにすると `__detail` が見出しに出る。空文字は「見出しなし」として扱うか、API_REFERENCE に明記すると親切(デモでは `title: 'マスタ'` で回避)。
8. **スクロール同期 API(Phase 2 向け)。** 左右整列モードでは 2 グリッドの縦スクロールを同期したい。ハンドルに `getScrollPosition()` / `setScrollPosition({ top, left })`、props に `onScroll` があると実装できる(現状は `scrollToRow` / `scrollToCell` のみ)。

## 5. Phase 2 候補と実装記録

### 実装済み(2026-08-29・spreadsheet-grid v0.29.0 対応後)

- **左右整列モード(`alignRows`)+ スクロール同期(`enableScrollSync`)**。決定事項:
  - 並び順は**左の行順を基準**に対を作り、左と対にならなかった右行(right-only / キー重複の残り)を右の行順で末尾に置く(LCS のような順序保存はしない。キーの Map 突き合わせと整合する最も単純な規則)。
  - キー重複で複数行が同じ相手を指す場合、相手は**先に対になった行が消費**し、残りはプレースホルダと組む(左右の行数保存を優先)。
  - プレースホルダは行ごとに新しいオブジェクト(既定 `{} as T`、`createPlaceholderRow` で差し替え)。差分 Map には載せず(`getDiff` は `undefined`)、`placeholders` の Set(同一性)で判定する。行クラス `.cmpg-row-placeholder` は差分ハイライトと独立で `enableRowHighlight={false}` でも付く。
  - 「差分のみ」は**対の単位**でフィルタし整列を維持(same の対だけ落ちる)。
  - `visibleLeft` / `visibleRight` の「フィルタ無しで入力と同一参照」の保証は alignRows OFF のときのみ(§2 の補足)。
  - スクロール同期は**縦のみ**(列幅・横スクロールはペインごとに独立のため)。`onScroll` の `source: 'user'` だけを相手の `setScrollPosition({ top })` へ伝え、`'api'` 由来は無視してループを防ぐ(提案 8 の想定パターンそのまま)。同期は `ComparisonView` の内部 ref で完結し、利用側の `ref` / `onScroll` は合成して透過。eslint の `react-hooks/refs`(render 中に ref を関数へ渡さない)に合わせ、ハンドル ref は `useScrollSyncGridProps` フック内に閉じ、参照は ref callback / イベントハンドラ内のみ。
  - デモ(App.tsx)に「左右整列」「スクロール同期」トグルを追加。renderCell を持つ列(Level / 品目M ボタン)はプレースホルダ行で空表示に落とす(既定 getValue 列は undefined → 空セルのため対応不要)。

### 実装済み(同日・batch 10〜13。これで初版時の Phase 2 候補は全件完了)

- **`getComparisonExportData()`(batch 10)**: `{ rows, diffs, columns }` を受けて本体の `getExportData()` と同形を返す純関数。差分ラベル列は既定で含める(`insertDiffLabelColumn` を流用)。`text` は本体の**セル表示**の規則(`value == null` は `valueFormatter` を通さず `''`)を採用 — エクスポート実装(formatter 無条件適用)ではなく表示側に合わせたのは、プレースホルダ行の `undefined` を formatter が「undefined 個」等に整形してしまうため。整列済み配列を渡せば対順エクスポート。
- **差分ジャンプ `useComparisonNavigation`(batch 11)**: 停止位置は「visibleLeft の行順 → 左に無い右行を visibleRight の行順で末尾」(alignRows の対順と同じ規則で、整列表示と順序が一致する)。field-diff の対は 1 停止に重複排除。ハンドル ref は**フックが生成して返す**(`react-hooks/refs` が render 中の ref 引数渡しを禁じるため。`ComparisonView` が利用側 ref を合成するので `enableScrollSync` と共存できる)。範囲外はラップ、表示行が変わると位置リセット。**グリッド側ソート / フィルター適用中は view index がずれる**制約を API_REFERENCE に明記。
- **`useManualRows`(batch 12)**: 末尾空行維持(既存の空行オブジェクトを再利用して参照を保つ)/ `normalizeRow`(変更不要なら同一参照を返す契約)/ `validateRow`(空行は評価しない)。`rows`(空行込み)をグリッドへ、`dataRows`(空行除外)を `useComparison` へ渡す二層構え。
- **色覚多様性プリセット `.cmpg-colors-cvd`(batch 13)**: 利用側がクラスを付与するオプトイン方式。黄 / 赤 → 青(blue-100)/ 橙(orange-800)+ 差分セルに**下線**(色に依らない手掛かり)。トークンは特異度 0 で基底より後に定義(基底に勝ち、利用側上書きに負ける)。

## 6. 環境メモ

- spreadsheet-grid: `~/dev/datasheet-grid`(GitHub `ishibashi0112/datasheet-grid`)。v0.29.0 = npm latest(2026-08-29・提案対応リリース「proposals batch 1〜6」)。ss2602 は `^0.16.0` 固定なので、ライブラリ導入時に 0.29 系へ上げる必要がある(0.17〜0.28 で export scope の改名や既定値変更あり)。
- 引き継ぎ書と ss2602 の repomix は UTF-8 → Latin-1 の文字化け状態で受領したが内容は復元済み。Web 版へ持ち込む際は UTF-8 保存を確認。
- パッケージ名 `@ishibashi0112/comparison-grid` は npm 未使用(2026-08-29 時点)。`package.json` の `repository` URL は `ishibashi0112/comparison-grid` を仮置き(リポジトリ作成後に確定)。
