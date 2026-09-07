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
9. **pointerdown 時の `focus()` に `preventScroll: true`(2026-08-30・v0.29.0 で確認)。** グリッド root(`.ssg-shell`)が viewport に収まりきっていない状態でセルを 1 回クリックすると、`focus()` の既定動作でページがスクロールし、ポインタ直下に来たセルへの `pointerenter` が `selection` ドラッグ中の `updateSelection` を呼んで**単クリックが数行の範囲選択になる**(Playwright + Chrome で再現: viewport 900px / root 下端 934px → スクロール 33px・選択 2 行)。`useGridPointerInteractions.ts` の pointerdown 3 箇所を `focus({ preventScroll: true })` にすれば解消(capture 段階の先行フォーカスで検証済み)。詳細は `docs/SPREADSHEET_GRID_PROPOSALS.md` #9。**v0.29.1(2026-08-30)で採用済み**: peer 範囲を `>=0.29.1 <1.0.0` へ更新し、実ブラウザで解消を確認(暫定回避は入れていない)。

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

### 実装済み(2026-08-30・batch 14。デモの大量データセット)

- **デモ専用の大量 BOM 生成器**(`src/demo/bomData.ts` の `generateLargeBomPair`)。既存データ(A1000 系)は 14〜15 行で `maxHeight: 720` / `rowHeight: 25`(約 28 行分)に収まりきり、スクロール同期・差分ジャンプが手元で確認できなかったため追加。決定事項:
  - 旧構成はシード固定の疑似乱数(mulberry32)で生成し、新構成(Rev.2)は旧構成から**行位置の規則**だけで派生(乱数不使用)。毎回同じ内容・同じ差分位置になるため、目視確認とテストの両方で再現できる。
  - 差分の種類を全部含める: 数量 / 支給区分の変更(項目違い)、level 2 以下のサブツリー削除(左のみ)、ASSY 直下への新規部品追加(右のみ)、子を持たない level 2 部品の後継品番置換(`reprItemCode` で旧品番を指す → 代表品番比較 ON で突き合う)。後継品番の置換対象を**葉に限定**したのは、ss2602 の代表品番キー(`itemPath` 中の自品番だけを置換)では親が置換された子行が突き合わないため。
  - 行 100〜199 / 400〜499 / … を**変更なしゾーン**として一切変更しない。差分ジャンプで大きく飛ぶ区間と、同一行が続く中でのスクロール同期を目視しやすくするため。
  - 登録: `L5000` / `L5000-R2`(70 ASSY・約 500 行)と `L9000` / `L9000-R2`(400 ASSY・約 3,000 行。仮想スクロールの性能確認用)。デモのツールバーに**プリセットボタン**(標準 / 大量 / 超大量)を追加し、左右の品番を入れ替えてそのまま展開する。
  - ライブラリ本体・公開 API には変更なし(`src/demo/` と `App.tsx` / `App.css` のみ)。

### 実装済み(2026-08-30・batch 15a。階層比較の純ロジック)

背景: 左右整列・差分ジャンプは `getMatchKey` の文字列一致に完全に依存しており、階層の妥当性はキー設計(利用側)任せだった。デモの `itemPath` / `replace` ベースの代表品番キーには「親の後継化が子に伝播しない」「`replace` の部分一致」という穴があった。ss2602 は本ライブラリの規約に合わせて書き直す前提のため、互換より正しさを優先して**木を階層比較の第一級の契約**にした。

- **構造**: コア(`compare` / `alignComparisonRows` / ナビゲーション)は平坦な `T[]` のまま(表示コアが `T[]`、階層を持たない 2 リスト比較も正当な用途)。木はその上の**入力層**で、`ComparisonTreeNode<T> = { row: T; children? }` が `T` を包む(`T` に `children` を要求しない = サイドカー原則)。「型で形を案内する」案(`T extends { itemPath, levelNo }`)は、フィールド名が API 依存で、深さ優先順・伝播といった本当に守りたい制約を型で表せないため不採用。
- **平坦な行 → 木(`buildComparisonTree`)**: DB は親子を行で持つしかないため必須。入力形は (b) 深さ優先順 + level(展開 API の典型。ID 不要)と (a) 隣接リスト(出現ごとに一意な行 ID + 親 ID)。**識別 ID と突き合わせコードは別概念**(同じサブ ASSY が複数箇所で使われる構成は正常で、親参照に品番を使った瞬間に出現を区別できなくなる)。破綻(level 飛び / ID 重複 / 親未解決 / 循環)は**修復せず検出して `issues` で報告**し、木はベストエフォート(推奨 5 の決定)。構成マスタ(DAG)からの展開は範囲外。
- **キー導出(`flattenComparisonTree`)**: パス = 親キー + 区切り + セグメント。セグメントは代表コードで置換するため親の置換が子孫へ伝播する。同じ親の下の同セグメントは出現順 `#n` で区別(推奨 3: 後勝ちで行が黙って落ちるより、出現順 + 報告のほうが安全。位置・工程列があれば `getCode` に含めるのが最善)。
- **構造整列(`alignComparisonTree`)**: 兄弟リスト単位のマージ。右のみサブツリーは**直前に対になった兄弟の直後**、先行する対が無ければ最初の対の直前、対が無ければ末尾(平坦版と同じ)。相手は同じ兄弟リストに居る counterpart のみ(キーがパスなら必ずそうなる。別規則のキーでも壊れない)。
- React 層(`useTreeComparison` / 文脈行 / デモ置き換え)は batch 15b。

### 実装済み(2026-08-30・batch 15b。階層比較の React 層 + デモの木化)

- **`useTreeComparison`**: `useComparison` の木版。木 → `flattenComparisonTree` → 導出キーで `compare()`。戻り値は `UseComparisonResult` と同形 + `contextRows` / `getTreeInfo`。`ComparisonView` / `useComparisonNavigation` / `getComparisonExportData` にそのまま渡せる。`useComparison` を内部で呼ばず独立実装にしたのは、整列(構造マージ)と「差分のみ」(祖先を残す)の規則が平坦版と異なるため(共通化すると平坦版に木の概念が漏れる)。
- **「差分のみ」で祖先を残す(推奨 1)**: 差分行 + その祖先(文脈行)。文脈行は `kind === 'same'` のまま `contextRows` に集約し、`ComparisonView` → `ComparisonPane` → `composeRowClassName` で `.cmpg-row-context`(文字色 `--cmpg-context-row-text`、gray-500)を付与。プレースホルダ行と同じく差分ハイライトとは独立(`enableRowHighlight={false}` でも付く)。`alignRows` との併用は「どちらかの側が残す行なら対ごと残す」。
- **ロールアップ(推奨 2)**: 祖先の保持に必要な「配下に差分あり」の計算は `collectKeptRows` に内在するが、公開はしていない(表示マーカーは残候補。`getTreeInfo` + `getDiff` で利用側でも書ける)。
- **ナビゲーション**: `useComparisonNavigation` は `alignRows: true` のとき停止を**行位置順**に安定ソートする(木の構造整列では右のみが途中に入るため。平坦版では右のみが末尾に居るので並びは変わらない)。
- **デモの木化**: `BomRow` から `itemPath` を廃止(行型は API の素の形へ)。`buildComparisonTree(rows, { getLevel })` + `useTreeComparison`。A1000-R2 の「モーターASSY」を ASSY ごと後継品番(`B2002A`、代表 `B2002`、子は同じ)にし、通常比較ではサブツリー丸ごと左のみ + 右のみ、代表品番比較 ON で子同士が突き合う(伝播)ことを目視できるようにした。`issues` 件数をサマリ行に表示。大量データ生成器の「後継品番は葉に限定」はデータ安定のため据え置き(キー規則上の制約ではなくなった)。
- 残候補(batch 16 以降): 親への差分ロールアップ表示 / サブツリーの折りたたみ。

### 実装済み(2026-08-30・batch 16a。ロールアップ = 親への差分表示)

- **`countDescendantDiffs`(純ロジック)**: 行 → 配下の差分行数(自身は数えない)。`useTreeComparison` の「差分のみ」の文脈行判定(自身は same で配下に差分がある行)をこれに置き換え、祖先の保持とロールアップが同じ計算になった(15b で「内在するが公開していない」としていたもの)。
- **表示**: 自身が same で配下に差分がある行に `.cmpg-row-rollup`(差分行より薄い黄 yellow-50。CVD は blue-50)。差分行クラスとは同時に付かない(自身が差分なら差分クラスが優先)。ロールアップは差分ハイライトの一種として `enableRowHighlight` に従う(プレースホルダ / 文脈行は構造的なので従わない、という線引きを維持)。
- **差分ラベル列**: 自身のラベルが空で配下に差分がある行に `descendantDiffLabel(count)`(既定 `配下に差分 n 件`)。`DiffLabelColumnOptions.descendantDiffLabel` で差し替え。`getComparisonExportData` にも `descendantDiffCounts` を渡せば同じ規則でエクスポートされる。
- 配線は `ComparisonView` → `ComparisonPane`(`descendantDiffCounts` prop)→ `composeRowClassName` / `insertDiffLabelColumn`。`ComparisonPane` を直接使う場合は `descendantDiffCounts={comparison.descendantDiffCounts.left}` を渡す。

### 実装済み(2026-08-30・batch 16b。サブツリーの折りたたみ)

- **state はキー(`matchKey`)の `Set` を利用側が持つ**(fully controlled)。行オブジェクトや行位置ではなくキーにしたのは、(1) キーが左右共通なので 1 つのキーで両ペインの対が同時に畳まれる、(2) データ差し替え(再展開)や整列 / フィルタの切り替えをまたいで維持できる、ため。トグル用のヘルパーフックは作らない(`useState` + `Set` の 5 行で足り、API を増やさない)。
- **純ロジック `collectCollapsedDescendants`**: 深さ優先順(親が子より先)を利用した 1 パスで「隠れる行 = 折りたたんだ行の子孫」を返す。折りたたんだ行自身は残す。
- **フックでの適用**: 平坦 / 整列の両方で「隠れる行」を除く。整列では対の単位(どちらかの側が隠れる対は落とす)。「差分のみ」と併用しても文脈行は残り、配下だけ隠れる(ロールアップの件数は表示に依らず全子孫を数える)。
- **展開ボタンはライブラリが描画しない。** 列は利用側のもの(サイドカー原則)なので、`getTreeInfo(row).hasChildren` / `isCollapsed(row)` / `matchKey` を使って利用側の列に組む(README レシピ / デモの Level 列)。デモでは Level 列を `createLevelColumn(アクセサ)` で組み立て、インデントも `getTreeInfo(row).depth` に切り替えた。「すべて展開」ボタンを追加。
- 差分ジャンプは表示行が変わると現在位置がリセットされる既存挙動のまま(折りたたみで停止位置が変わるため妥当)。

### 実装済み(2026-08-30・batch 17。縦並びレイアウト `layout='vertical'`)

- **`ComparisonView` に `layout?: 'horizontal' | 'vertical'`(既定 `'horizontal'`)。** 列数が多く 2 カラムでは横に収まらない表向けに、ペインを上下に積む(left が上)。boolean(`enableVerticalLayout` 等)ではなく enum にしたのは、`enable*` は「機能の ON/OFF」の規約で、これは配置の選択(第 3 の配置が来ても壊れない)ため。API 上の名前は配置に依らず left / right のまま(データの意味は変わらないため。`.cmpg-view--horizontal` / `--vertical` と `data-cmpg-layout` を root に付与)。
- **縦並びの行は auto(各ペインが内容の高さで積まれる)。** 横並びの `1fr 1fr` と対称に `grid-template-rows: 1fr 1fr` とはしなかった: グリッドの高さは props(`height` / `maxHeight`)で決まりコンテナに追従しないため、高さ未指定のビューで行を fr にすると短いペインが最長ペインまで引き伸ばされ空白が出る。ビューの高さを等分したい利用側は `.cmpg-view--vertical { grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }` + `gridProps={{ height: '100%' }}` で上書きできる(API_REFERENCE に記載)。
- **スクロール同期の軸はレイアウトに追従。** 横並びは従来どおり縦(top)のみ(列幅・横スクロールはペインごとに独立)。縦並びは縦横(top / left)両方 — 列が上下に揃うため横同期が「行が左右に揃うから縦同期」の対応物になり、縦同期も alignRows 併用時に両ペインが同じ行窓を映す用途で残す。軸選択の独立オプションは足さない(必要になったら `onScroll` / `ref` の透過で利用側実装が可能)。
- デモ(App.tsx)に「縦並び」トグルを追加。

### 実装済み(2026-09-07・batch 18。ヘッドレス層 `useComparisonPane` / `useComparisonScrollSync`)

- **動機**: 実務メニューへの採用にあたり「View の DOM / 配置がライブラリ固定で、微調整のたびにライブラリ改修になるのでは」という懸念に応える。差分判定(`compare` / `alignComparisonRows`)はもともとヘッドレスだったが、「差分をグリッドへどう配線するか」(列 / 行クラスの合成)と「スクロール同期」は `ComparisonPane` / `ComparisonView` のコンポーネント内に閉じていた。
- **`useComparisonPane(options)`**: `ComparisonPane` の本体をフックに移し、`SpreadsheetGrid` へそのままスプレッドできる `gridProps`(`rows` / 合成済み `columns` / 合成済み `getRowClassName` / `'cmpg-grid …'` の `className` + 利用側 `gridProps` の残り)と、`columns` / `getRowClassName` / `getDiff` を返す。`ComparisonPane` はラッパー DOM(`.cmpg-pane` / ヘッダースロット)を足すだけの薄い包みに。TanStack Table などと同じ「フックが本体、コンポーネントは便利品」の形。
- **`useComparisonScrollSync(options)`**: `ComparisonView` 内部の `useScrollSyncGridProps` を公開フックに昇格。`{ enabled, syncHorizontal, leftGridProps, rightGridProps }` を受けて合成済みの `{ leftGridProps, rightGridProps }` を返す。`ComparisonView` はこれの利用側になった。片側ぶんの合成を `useSyncedSide` に括り出し、左右で同じコードを共有。
- **CSS**: `--cmpg-*` トークンを `:where(.cmpg-pane)` に加えて `:where(.cmpg-grid)`(グリッド root)にも定義。`.cmpg-grid` と `.ssg-theme-dark` は同じ root 要素に付くため、ダークは `.cmpg-grid.ssg-theme-dark` で切り替わる。これによりラッパー無しのヘッドレス利用でもハイライトが効く(`.cmpg-colors-cvd` も同様に root へ付与可)。
- **API を足したのは 2 フック + 型 5 つのみ。** `ComparisonPane` / `ComparisonView` の props と振る舞いは変えていない(既存テスト全緑のまま)。`ComparisonPaneProps` は `UseComparisonPaneOptions & { side; header; showHeader; className; style }` に再定義した(内容は同じ)。
- 見送り: `renderCell` の引数に差分を注入すること(spreadsheet-grid の `renderCell` シグネチャは変えられない。`getDiff` をクロージャで使えば足りる)。クラス名の合成規則そのものの差し替えポイント(必要になったら `useComparisonPane` にオプションを足す形で後付け可)。

- spreadsheet-grid: `~/dev/datasheet-grid`(GitHub `ishibashi0112/datasheet-grid`)。v0.29.0 = 2026-08-29 の提案対応リリース(「proposals batch 1〜6」)。2026-09-07 時点の npm latest は v0.32.0(0.30: タッチ対応 / 0.31: 展開行 `detailRow` / 0.32: 行ドラッグ `enableRowDrag`。0.29.1 以降は公開 API の削除・改名なし)で、本リポジトリの devDependency を 0.32.0 に上げて全ゲート緑を確認済み。peer は `>=0.29.1 <1.0.0` のまま(新機能を使っていないため)。ss2602 は `^0.16.0` 固定なので、ライブラリ導入時に 0.29 系へ上げる必要がある(0.17〜0.28 で export scope の改名や既定値変更あり)。
- 引き継ぎ書と ss2602 の repomix は UTF-8 → Latin-1 の文字化け状態で受領したが内容は復元済み。Web 版へ持ち込む際は UTF-8 保存を確認。
- パッケージ名 `@ishibashi0112/comparison-grid` は npm 未使用(2026-08-29 時点)。`package.json` の `repository` URL は `ishibashi0112/comparison-grid` を仮置き(リポジトリ作成後に確定)。
