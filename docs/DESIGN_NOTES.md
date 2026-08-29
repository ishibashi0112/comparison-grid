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

1. **`CellStyleContext` をバレルから公開する。** `GridColumn.cellClassName` の関数版の引数型が未公開のため、`GridCellStyleContext<T> = Parameters<Exclude<NonNullable<GridColumn<T>['cellClassName']>, string>>[0]` で導出している(`model/types.ts`)。公開されたら差し替える。
2. **`rows` / `columns` を `readonly` 配列で受け付ける。** `useMemo` 由来の `readonly T[]` を渡すのにキャストが要る(`ComparisonPane` の `rows as T[]`)。グリッドは配列を変更しないので `readonly T[]` / `readonly GridColumn<T>[]` にしても実装は変わらないはず。
3. **jsdom テスト用のレイアウトスタブを公式化する。** 列仮想化が ResizeObserver の通知だけで幅を得るため、no-op スタブでは列が 1 本も描画されない(本リポジトリの `ComparisonView.test.tsx` に「observe 時に即時コールバックする ResizeObserver + clientWidth/Height + getBoundingClientRect」のスタブがある)。`@ishibashi0112/spreadsheet-grid/testing` の `installJsdomLayoutStubs()` のようなヘルパー、または README の「Testing」節として提供すると、利用側(ss2602 など)の結合テストが書きやすくなる。spreadsheet-grid 自身の validation テストも「仮想化行が jsdom で描画されない」前提で書かれているので、同じ手当てで本体テストも DOM 検証に広げられる。
4. **`getRowKey`(利用側の行キー)prop。** 現状の行キーは内部導出で利用側から指定できない。Phase 2 のマニュアル入力ペイン(編集で行オブジェクトが差し替わる)や、比較結果の行選択状態を維持したい場面で、安定した行 ID が欲しくなる。
5. **`getRowClassName` のコンテキスト版。** `cellClassName` は `CellStyleContext`(`sourceRowIndex` / `rowKey` 付き)を受け取るのに対し `getRowClassName` は `(row, rowIndex)` のみ。`(ctx: RowStyleContext<T>) => string` のオーバーロードがあると対称になる(本ライブラリはサイドカーで行オブジェクトから引けるため未使用)。
6. **状態クラスの公開契約化。** `.ssg-body-cell--row-hovered` / `--readonly` / `--invalid` などをホバー色の連結に使っている。API_REFERENCE に「スタイル用の状態クラス一覧」として載せておくと、利用側が安心して連結できる。
7. **`title: ''` の列ヘッダーが `key` にフォールバックする。** ボタン専用列(ss2602 の `__detail`)で空タイトルにすると `__detail` が見出しに出る。空文字は「見出しなし」として扱うか、API_REFERENCE に明記すると親切(デモでは `title: 'マスタ'` で回避)。
8. **スクロール同期 API(Phase 2 向け)。** 左右整列モードでは 2 グリッドの縦スクロールを同期したい。ハンドルに `getScrollPosition()` / `setScrollPosition({ top, left })`、props に `onScroll` があると実装できる(現状は `scrollToRow` / `scrollToCell` のみ)。

## 5. Phase 2 候補(今回のスコープ外)

- マニュアル入力ペイン: `ComparisonPane` に `gridProps={{ onRowsChange, createRow, readOnly: false }}` を渡せば編集自体は今でも可能。ライブラリ側で担うなら「末尾空行維持 / 正規化フック / 送信時検証」のヘルパー(`useManualRows`)を hooks に追加する形。
- `getComparisonExportData()`: `annotatedLeft` / `annotatedRight` + 列定義から `{ columns, rows: { value, text }[][] }` を返す(spreadsheet-grid の `getExportData()` と同形)。差分ラベル列を含める。
- 差分ジャンプ(`useComparisonNavigation`: `scrollToRow` で次 / 前の差分行へ)。
- 左右整列モード(`alignRows`): 突き合わせ順に並べ、欠損側にプレースホルダ行を入れる + スクロール同期(提案 7 が前提)。
- ダークテーマ以外のプリセット(色覚多様性向けの配色)。

## 6. 環境メモ

- spreadsheet-grid: `~/dev/datasheet-grid`(GitHub `ishibashi0112/datasheet-grid`)。v0.28.1 = npm latest(2026-08-27)。ss2602 は `^0.16.0` 固定なので、ライブラリ導入時に 0.28 系へ上げる必要がある(0.17〜0.28 で export scope の改名や既定値変更あり)。
- 引き継ぎ書と ss2602 の repomix は UTF-8 → Latin-1 の文字化け状態で受領したが内容は復元済み。Web 版へ持ち込む際は UTF-8 保存を確認。
- パッケージ名 `@ishibashi0112/comparison-grid` は npm 未使用(2026-08-29 時点)。`package.json` の `repository` URL は `ishibashi0112/comparison-grid` を仮置き(リポジトリ作成後に確定)。
