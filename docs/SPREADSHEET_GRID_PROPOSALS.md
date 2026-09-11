# spreadsheet-grid への提案書(comparison-grid 開発からのフィードバック)

- 提出元: `@ishibashi0112/comparison-grid`(リポジトリ `ishibashi0112/comparison-grid`)の初版開発(2026-08-29)
- 対象: `@ishibashi0112/spreadsheet-grid` **v0.28.1**(リポジトリ `ishibashi0112/datasheet-grid`)。#10・#11(2026-09-11 追記)は **v0.32.0** で確認
- 位置づけ: comparison-grid は spreadsheet-grid を表示コアに使う派生ライブラリで、本体には手を入れない方針です。開発中に「あると楽 / 型が緩い / API が足りない」と感じた点を、**そのまま実装検討に入れる粒度**でまとめました。採否は spreadsheet-grid 側の判断に委ねます。
- 読み方: 各項目は「背景 → 現状 → 提案 → 影響範囲 / 後方互換 → 採用時の comparison-grid 側の対応」の順。優先度は comparison-grid 視点(高 = 今すぐ効く / 中 = 品質向上 / 低 = Phase 2 で必要)。

## 一覧

| # | 提案 | 種別 | 優先度 | 互換性 |
| --- | --- | --- | --- | --- |
| 1 | `CellStyleContext` をバレルから公開する | 型の公開 | 高 | 追加のみ |
| 2 | `rows` / `columns` を `readonly` 配列で受け付ける | 型の緩和 | 高 | 追加のみ(緩和) |
| 3 | jsdom テスト用レイアウトスタブの公式化(`/testing` サブパス or README) | テスト支援 | 高 | 追加のみ |
| 4 | 利用側の行キー `getRowKey` prop | 機能追加 | 中 | 追加のみ(既定は現状維持) |
| 5 | `getRowClassName` のコンテキスト版 | API 対称化 | 中 | 追加のみ(オーバーロード) |
| 6 | スタイル用の状態クラスを公開契約にする | ドキュメント | 中 | なし |
| 7 | `title: ''` の列見出しが `key` にフォールバックする挙動 | 仕様明確化 / 小修正 | 低 | 挙動変更(要判断) |
| 8 | スクロール位置の取得 / 設定 / 通知 API | 機能追加 | 低(Phase 2 で必要) | 追加のみ |
| 9 | pointerdown 時の `focus()` に `preventScroll: true`(ページスクロールで単クリックが範囲選択になる) | 不具合修正 | 高 | なし(挙動修正) |
| 10 | 行ホバーの controlled 化(`hoveredRowIndex` / `onHoveredRowChange`)。左右整列モードのホバー同期に必要 | 機能追加 | 中(comparison-grid のオプション機能) | 追加のみ |
| 11 | コピー / CSV / getExportData の行フィルタ `isRowExportable`。プレースホルダ行を除いたコピーに必要 | 機能追加 | 中(comparison-grid のオプション機能) | 追加のみ |

## 採用結果(2026-08-29 追記)

spreadsheet-grid **v0.29.0**(コミット「proposals batch 1〜6」・2026-08-29 npm 公開)で全 8 件が処理された。

| # | 結果 | 内容 |
| --- | --- | --- |
| 1 | ✅ 採用(batch 1) | `CellStyleContext`(および `RowStyleContext`)をバレルから公開 |
| 2 | ✅ 採用(batch 2) | `rows` / `columns` / `filterOptions` を readonly 配列で受け付け |
| 3 | ✅ 採用(batch 5) | `/testing` サブパスで `installJsdomLayoutStubs({ width?, height? })` を公開(既定 1200×600・scrollTo スタブ含む・restore 関数を返す)。API_REFERENCE「Testing(jsdom)」節 + website ガイド付き |
| 4 | 変更なし(既存で充足) | 既存の `rowKeyGetter?: (row, index) => GridRowKey` prop が該当(0.28.1 時点で存在し `RowModel.getRowKey` / `cellClassName` の `ctx.rowKey` に配線済み)。本提案書の「現状」認識が誤りだった |
| 5 | ✅ 採用(batch 3) | `getRowClassName` に第 3 引数 `ctx: RowStyleContext<T>`(`row` / `rowIndex` / `sourceRowIndex` / `rowKey` / `isSelected`。提案の `isGroupRow` は含まれない) |
| 6 | ✅ 採用(batch 4) | API_REFERENCE / website に「スタイリング用の状態クラス(公開契約)」節(変更時 breaking 扱い) |
| 7 | ✅ (b) 採用(batch 4) | 挙動は現状維持のうえ、`title` 未指定 / 空文字時の `key` フォールバックを API_REFERENCE に明記((a) の `title ?? key` 化は別途検討) |
| 8 | ✅ 採用(batch 6) | `handle.getScrollPosition()`(未マウント時 `null`)/ `handle.setScrollPosition()`(クランプあり)/ `props.onScroll`(rAF 間引き・`source: 'user' \| 'api'`) |
| 9 | ✅ 採用(batch 7・**v0.29.1**・2026-08-30) | pointerdown 系 4 箇所(セル / 行ヘッダー / 列ヘッダー / コーナー)の `focus()` に `{ preventScroll: true }`。回帰テスト 3 件(`HTMLElement.prototype.focus` の spy)。公開 API 変更なし |

採用時の comparison-grid 側の対応は同日反映済み: #1 `GridCellStyleContext<T>` を `CellStyleContext<T>` の別名に変更、#2 `ComparisonPane` の `rows as T[]` キャスト削除、#3 `ComparisonView.test.tsx` の自前スタブを `installJsdomLayoutStubs()` へ置換、peer 範囲を `>=0.29.0 <1.0.0` へ更新。#8 により Phase 2「左右整列モード」のスクロール同期が実装可能になった。

#9 は v0.29.1 公開後に comparison-grid 側で peer 範囲を `>=0.29.1 <1.0.0` へ更新し、同じ Playwright スクリプト(viewport 900px / root 下端 934px でセルを 1 クリック)で **スクロール 0 / 選択 1 行** を確認済み(修正前は 33px / 2 行)。comparison-grid 側の暫定回避は入れていなかったため、外すものはない。

#10・#11 は 2026-09-11 に追記し、同日 spreadsheet-grid **v0.33.0**(proposals batch 8 / 9)で採用された。

| # | 結果 | 内容 |
| --- | --- | --- |
| 10 | ✅ 採用(batch 8・**v0.33.0**・2026-09-11) | `hoveredRowIndex?: number \| null`(optionally controlled)/ `onHoveredRowChange?: (viewRowIndex, { source: 'pointer' })`(同値抑止・`enableRowHover: false` では無効・`GridState` / ハンドルには載せない)。提案どおりの形 |
| 11 | ✅ 採用(batch 9・**v0.33.0**・2026-09-11) | `isRowExportable?: (row, { viewRowIndex, rowKey }) => boolean`。コピー(全選択 / セル範囲 / 行選択 / 列選択)/ `exportCsv` / `getExportData` の 3 経路共通、行単位、貼り付けと全選択判定には影響なし(scope `'raw'` のみ `viewRowIndex` がソース index) |

採用時の comparison-grid 側の対応: peer 範囲を `>=0.33.0 <1.0.0` へ更新し、#11 は batch 31 で `excludePlaceholderRowsOnCopy`(`useComparisonPane` が `isRowExportable` を合成)、#10 は batch 32 で `enableHoverSync` / `useComparisonHoverSync` 系(グループの state を全ペインへ controlled 値として配る)を接続。回り道は入れていなかったため、外すものはない。

---

## 1. `CellStyleContext` をバレルから公開する

**背景**: comparison-grid は利用側の `GridColumn<T>.cellClassName` をライブラリのクラスと合成するため、関数版 `cellClassName` の引数型が必要です。

**現状**: `model/gridTypes.ts` に `CellStyleContext<T>` は定義済み(`CellRenderContext` から `setValue` を除いた読み取り専用版)ですが、`index.ts` のバレルは `CellRenderContext` / `HeaderRenderContext` のみ公開しており `CellStyleContext` が無い。API_REFERENCE の `cellClassName` 行では「`ctx` には … `sourceRowIndex` / `rowKey` が入る(「補助型」節参照)」と案内されているため、型が公開されている前提の文面になっています。

comparison-grid では次の導出で回避しています(`src/components/comparison-grid/model/types.ts`):

```ts
export type GridCellStyleContext<T> = Parameters<
  Exclude<NonNullable<GridColumn<T>['cellClassName']>, string>
>[0];
```

**提案**: `index.ts` の `export type { ... }` に `CellStyleContext` を追加し、API_REFERENCE「補助型」節に shape を記載する。

```ts
// index.ts
export type {
  CellRenderContext,
  CellStyleContext, // 追加
  HeaderRenderContext,
  ...
} from './model/gridTypes';
```

**影響範囲 / 互換**: 追加のみ。website の API リファレンス(`website/content/docs/api/`)の同期が必要。

**採用時の comparison-grid 側の対応**: `GridCellStyleContext<T>` を `CellStyleContext<T>` の再エクスポートに置き換える(peer 下限を公開バージョンへ上げる)。

## 2. `rows` / `columns` を `readonly` 配列で受け付ける

**背景**: `useMemo` / `filter` で作った配列や、`as const` 系の列定義は TypeScript 上 `readonly T[]` になりがちです。comparison-grid の hook は `visibleLeft: readonly T[]` を返し、ペインで `rows as T[]` とキャストして渡しています(`view/ComparisonPane.tsx`)。

**現状**: `SpreadsheetGridProps<T>` は `rows?: T[]` / `columns: GridColumn<T>[]`。グリッドは配列を in-place で変更しない設計(編集は `onRowsChange` で新配列を返す)なので、mutable を要求する理由が実装側に無いはずです。

**提案**: 入力側の配列型を `readonly` にする。

```ts
rows?: readonly T[];
columns: readonly GridColumn<T>[];
// 併せて、配列を受ける他の props も同様に(例: filterOptions?: readonly GridSelectFilterOption[])
```

内部で `rows.map` / `columns.filter` 等は `readonly` でもそのまま動きます。`onRowsChange?: (nextRows: T[]) => void` のような**出力側**は mutable のままで問題ありません(利用側が state に入れる)。

**影響範囲 / 互換**: 型の緩和なので既存利用側は壊れません。内部で `rows.push` / `columns.splice` のような破壊的操作があれば、そこだけコピーに変える必要があります(`tsc` が検出します)。

**採用時の comparison-grid 側の対応**: `rows as T[]` のキャストと注記コメントを削除。

## 3. jsdom テスト用レイアウトスタブの公式化

**背景**: comparison-grid では「実グリッドを描画して行 / セルに付いたクラスを検証する」結合テストを jsdom で書きました。最初は本体行が 1 行も描画されず、原因調査に時間がかかりました。

**現状**:
- 縦方向は `SpreadsheetGrid.tsx` の effect(約 1611〜1632 行)が `el.clientHeight` / `el.clientWidth` を読み、以後 `ResizeObserver` で追従。jsdom では `clientHeight` が 0 なので行が出ない。
- 横方向(列)は `@tanstack/react-virtual` の `useVirtualizer`(約 1643 行)がスクロール要素の矩形を **ResizeObserver の通知**から得るため、`observe()` が no-op のスタブだと幅 0 のまま **列が 1 本も描画されない**(`getBoundingClientRect` をスタブしても不足)。
- spreadsheet-grid 自身の `SpreadsheetGrid.validation.integration.test.tsx` も「mark のセル表示は仮想化行が jsdom で描画されないため、getInvalidCells と純ロジックで担保」とコメントしており、DOM 検証を諦めている箇所があります。

comparison-grid で動作確認済みのスタブ(`src/components/comparison-grid/view/ComparisonView.test.tsx` の `beforeAll`):

```ts
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1200 });
Element.prototype.getBoundingClientRect = () =>
  ({ x: 0, y: 0, top: 0, left: 0, bottom: 600, right: 1200, width: 1200, height: 600, toJSON: () => ({}) }) as DOMRect;

type ResizeObserverCallbackLike = (entries: unknown[], observer: unknown) => void;
class ResizeObserverStub {
  private readonly callback: ResizeObserverCallbackLike;
  constructor(callback: ResizeObserverCallbackLike) { this.callback = callback; }
  observe(target: Element): void {
    const size = { inlineSize: 1200, blockSize: 600 };
    // observe 時に即時コールバック。react-virtual はここから矩形を得る。
    this.callback([{ target, contentRect: { width: 1200, height: 600, top: 0, left: 0 }, borderBoxSize: [size], contentBoxSize: [size] }], this);
  }
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
```

これで実グリッドが本体行 / 全列を描画し、`.ssg-body-cell` に付与されたクラスやセル文字列を DOM で検証できます。

**提案**(どちらか、または両方):
- (a) `@ishibashi0112/spreadsheet-grid/testing` サブパスで `installJsdomLayoutStubs({ width?, height? })` を公開する(`package.json` の `exports` に追加。`dist/testing.js` は React 非依存の小さなモジュール)。
- (b) README / API_REFERENCE に「Testing(jsdom)」節を追加し、上記スタブを掲載する。

**影響範囲 / 互換**: 追加のみ。spreadsheet-grid 本体のテストにも同じスタブを入れれば、validation の mark 表示や `cellClassName` の配線など「描画結果」を DOM で検証できるようになります(既存テストの前提コメントの見直し)。

**採用時の comparison-grid 側の対応**: 自前スタブを `installJsdomLayoutStubs()` に置き換える。

## 4. 利用側の行キー `getRowKey` prop

**背景**: comparison-grid の Phase 2(マニュアル入力ペイン: 編集可能グリッドで行オブジェクトが差し替わる)や、比較結果に対する行選択の維持で「安定した行 ID」が必要になります。

**現状**: `GridRowKey = string | number` は公開されているが、行キーは内部導出(`RowModel.getRowKey(viewIndex)`)で、`SpreadsheetGridProps` に利用側が指定する口が無い。`cellClassName` の `ctx.rowKey` や `getSelectedRowKeys()` が返すキーは、利用側の ID と対応づけられない。

**提案**:

```ts
// SpreadsheetGridProps<T>
/** 行の安定キー。未指定時は従来どおり内部導出(source index 基準)。 */
getRowKey?: (row: T, sourceRowIndex: number) => GridRowKey;
```

- clientSide: `RowModel.getRowKey` がこの関数を使う。行選択(`enableRowSelection`)の選択集合・`getSelectedRowKeys()` / `getSelectedRowData()`・`scrollToRow` 系の外部照合がユーザー ID で安定する。
- serverSide: `getRows` の結果行にも同じ関数を適用(ブロック再取得で行オブジェクトが変わっても選択が維持できる)。
- React の `key` にも流用できれば、行の差し替え時の再マウント抑制にもつながる(要検討)。

**影響範囲 / 互換**: 追加のみ(未指定なら現状維持)。キー重複時の扱い(警告 / 後勝ち)を API_REFERENCE に明記。

## 5. `getRowClassName` のコンテキスト版

**背景**: `cellClassName`(関数版)は `CellStyleContext`(`row / rowIndex / sourceRowIndex / rowKey / …`)を受け取れるのに、`getRowClassName` は `(row: T, rowIndex: number)` だけで、ソート / フィルター適用時の source 行基準の突き合わせ(`sourceRowIndex` / `rowKey`)ができません(`model/gridTypes.ts` 約 1570 行)。

**提案**: 引数を 1 つ増やすか、コンテキスト型のオーバーロードを追加する。

```ts
export type RowStyleContext<T> = {
  row: T;
  rowIndex: number;        // view index
  sourceRowIndex: number;
  rowKey: GridRowKey;
  isSelected: boolean;     // 行選択(チェックボックス)状態
  isGroupRow: boolean;     // grouping 有効時のグループ行
};
getRowClassName?: (row: T, rowIndex: number, ctx: RowStyleContext<T>) => string | undefined;
```

第 3 引数追加なら完全後方互換(既存の 2 引数関数はそのまま動く)。`GridBodyLayer.tsx` 約 984 行の呼び出し箇所を変えるだけです。

**影響範囲 / 互換**: 第 3 引数追加なら互換。comparison-grid はサイドカー(行オブジェクト → 差分の Map)で引けるため必須ではありませんが、利用側が `getInvalidCells()` の結果と行を突き合わせるようなケースで効きます。

## 6. スタイル用の状態クラスを公開契約にする

**背景**: comparison-grid の差分行ハイライトは `.ssg-body-cell.cmpg-row-diff { background }` で基底に勝たせ、行ホバー時の色は `.ssg-body-cell.cmpg-row-diff.ssg-body-cell--row-hovered` で切り替えています。つまり **内部の状態クラス名に依存**しています。

**現状**: `GridBodyLayer.tsx` の `cx('ssg-body-cell', ...)` で `ssg-body-cell--align-center / --align-right / --autoheight / --readonly / --invalid / --row-hovered` などが付与されますが、API_REFERENCE には `classNames` スロット(`root / iconButton / bodyCell / bodyRow`)の記載のみで、状態クラスの一覧はありません。

**提案**: API_REFERENCE(と website)に「スタイリング用の状態クラス」節を追加し、下記を公開契約(変更時は breaking 扱い)として明記する。

| クラス | 付与条件 |
| --- | --- |
| `.ssg-body-cell--readonly` | 読み取り専用セル(非選択時) |
| `.ssg-body-cell--invalid` | validation mark 表示中 |
| `.ssg-body-cell--row-hovered` | 行ホバー中(`enableRowHover`) |
| `.ssg-body-cell--autoheight` | auto-height 列のセル |
| `.ssg-body-cell--align-center` / `--align-right` | `column.align` |
| `.ssg-body-row` / `.ssg-row-header-cell` | 行コンテナ / 行ヘッダー(`getRowClassName` の付与先) |
| `.ssg-theme-dark` | `theme="dark"` 時に root と各ポータルへ |

**影響範囲 / 互換**: ドキュメントのみ。

## 7. `title: ''` の列見出しが `key` にフォールバックする挙動

**背景**: ボタン専用列(ss2602 の `__detail` 列 = 右端固定の「品目マスタ」ボタン)は見出しを空にしたいのに、`title: ''` にすると見出しに `__detail` が表示されます(comparison-grid デモでは `title: 'マスタ'` に変えて回避)。

**現状**: ヘッダー描画が `column.title || column.key` 相当のフォールバックをしていると推測されます(`title?: string` は任意なので、未指定時のフォールバック自体は妥当)。

**提案**(いずれか):
- (a) `title === ''` は「見出しなし」として空文字を描画する(`title ?? key` に変更)。**挙動変更**なので要判断ですが、`''` を明示する利用者は空を意図しているはず。
- (b) 現状維持のうえ API_REFERENCE の `title` 行に「未指定 / 空文字は `key` を表示」と明記する。

列メニュー / フィルター管理パネル / CSV ヘッダーなど、列名を表示する箇所の一貫性も合わせて確認が必要です。

**影響範囲 / 互換**: (a) は空文字を渡していた利用側で見出しが消える(意図どおりのはず)。(b) は影響なし。

## 8. スクロール位置の取得 / 設定 / 通知 API

**背景**: comparison-grid の Phase 2 候補「左右整列モード」(突き合わせ順に並べ、欠損側にプレースホルダ行を入れて左右の行位置を揃える)では、2 つのグリッドの縦スクロールを同期する必要があります。

**現状**: 命令的ハンドルは `scrollToRow` / `scrollToCell` / `scrollToTop` / `scrollToBottom` / `getVisibleRowRange()`(API_REFERENCE「スクロール」節)。ピクセル単位の位置取得 / 設定と、スクロール発生の通知がありません。`scrollToRow` の往復で同期すると、行高が違う / auto-height のときにズレ、また双方向同期でループしやすい。

**提案**:

```ts
// SpreadsheetGridHandle<T>
getScrollPosition(): { top: number; left: number };
setScrollPosition(position: { top?: number; left?: number }, options?: { behavior?: 'auto' | 'smooth' }): void;

// SpreadsheetGridProps<T>
/** スクロールコンテナの scroll イベント(passive)。rAF で間引いて通知する。 */
onScroll?: (position: { top: number; left: number; source: 'user' | 'api' }) => void;
```

`source: 'api'` は `setScrollPosition` / `scrollTo*` 由来の変化を示し、利用側が双方向同期のループを止めるのに使います。既存の scroll リスナー(`setScrollTop` の effect)に相乗りできるため、実装コストは小さいと見込みます。

**影響範囲 / 互換**: 追加のみ。

---

## 9. pointerdown 時の `focus()` に `preventScroll: true` を付ける(2026-08-30 追記・v0.29.0 で確認)

**背景**: comparison-grid のデモ(`maxHeight: 720` のグリッド 2 面 + 上部ツールバー)で、セルを **1 回クリックしただけ**で下方向に数行ぶん範囲選択される現象を確認しました(Playwright + Chrome で再現。viewport 900px でグリッド root の下端が 934px にある状態でクリックすると、ページが 33px スクロールし選択が 2 行に伸びる。ツールバーが高い実画面では 8〜9 行)。spreadsheet-grid 単体のデモではグリッドが viewport に収まるため表面化しません。

**現状 / 原因**: `useGridPointerInteractions.ts` の `handleCellPointerDown`(約 505 行)/ `handleRowHeaderPointerDown`(約 672 行)/ 列ヘッダー pointerdown(約 750 行)が `gridRootRef.current?.focus()` を **`preventScroll` なし**で呼んでいます。グリッド root(`.ssg-shell`, `tabIndex=0`)が viewport に収まりきっていないと、`focus()` の既定動作でページ(祖先スクロールコンテナ)が root を見える位置までスクロールします。その結果、ポインタは動いていないのに**グリッドがポインタの下を流れ**、Chrome が新しくポインタ直下に来たセルへ boundary イベント(`pointerenter`)を発火 → `dragState` が `selection` のままなので `handleCellPointerEnter` が `updateSelection` を dispatch → `pointerup` までに選択が伸びる、という連鎖です。

**検証**: document の capture 段階の `pointerdown` で `.ssg-shell` を `focus({ preventScroll: true })` しておく(グリッド側の `focus()` は既に activeElement なので no-op になる)と、同条件で **スクロール 0 / 選択 1 行** になりました。

**提案**: pointerdown 系 3 箇所を `gridRootRef.current?.focus({ preventScroll: true })` にする。キーボード操作や `scrollToCell` 由来のフォーカスは対象外(スクロールしてよい)。`preventScroll` は全モダンブラウザ対応(jsdom も引数を無視するだけ)。

**影響範囲 / 互換**: クリックでページがスクロールしなくなる以外の挙動変更なし。セル自体をビューポート内に持ってくる必要がある場合は既存の `scrollToCell` で明示的に行う想定。

**採用時の comparison-grid 側の対応**: なし(peer 下限を修正版へ上げるのみ)。未採用の間の回避策として、`ComparisonPane` の `onPointerDownCapture` で同じ先行フォーカスを入れることができます(上記検証と同じ手法。内部クラス `.ssg-shell` に依存するため、採用後に外す前提)。

---

## 10. 行ホバーの controlled 化(`hoveredRowIndex` / `onHoveredRowChange`)(2026-09-11 追記・v0.32.0 で確認)

**背景**: comparison-grid の左右整列モード(`alignRows`。プレースホルダ行を挿入して「左右の同じ行位置 = 同じ突き合わせ相手」にする)で、**片側の行をホバーしたとき、もう片側の同じ行位置も同時にハイライトしたい**(2 ペイン / N 構成ペインとも)。行数が多いと視線が左右で迷うため、ホバー同期があると対応行の照合が楽になる。comparison-grid ではオプション(既定 OFF)として提供する予定。

**現状**: 行ホバーは `SpreadsheetGrid.tsx` 内部の `useState`(`hoveredRowIndex` / `setHoveredRowIndex`、約 626 行)で、`useGridPointerInteractions.ts` がセル `pointerenter`(約 663 行)/ 行ヘッダー `pointerenter`(約 851 行)で設定し、列ヘッダー `pointerenter`(約 944 行)/ 行ヘッダー `pointerleave`(`SpreadsheetGrid.tsx` 約 3196 行)/ grid 本体 `onPointerLeave`(約 6238 行)でクリアする。値は `GridBodyLayer` へ `hoveredRowIndex` として渡り、各行で `isRowHovered = hoveredRowIndex === rowIndex` を評価して `.ssg-body-cell--row-hovered` / `.ssg-header-cell--hovered` を付ける。**外部からホバー行を読む手段(イベント)も、書く手段(controlled prop)も無い**。`enableRowHover` は ON / OFF のみ。

**利用側だけで実現する場合の回り道**(採用されない場合の comparison-grid 側の代替案): ペインのラッパー DOM で `pointermove` を拾い、`closest('[data-row-index]')` からビュー行 index を得て相手ペインへ伝え、相手ペインは `getRowClassName` で独自クラス(`cmpg-row-hover-synced`)を付ける。動作はするが、(a) 内部 DOM 属性 `data-row-index` への依存、(b) 相手ペインの `getRowClassName` の同一性がホバーのたびに変わり、行 memo が全行分破れて再レンダーが増える、(c) 本体ホバー(`.ssg-body-cell--row-hovered`)と同期ホバーで CSS を二重に持つ、という難点がある。

**提案**: 行ホバーを「controlled にもできる」prop 対にする(既存の `activeCell` 等と同じ流儀の *optionally controlled*)。

```ts
// SpreadsheetGridProps<T> への追加(すべて任意)
/** 行ホバーの controlled 値(ビュー行 index / null = ホバーなし)。
 *  指定時は内部 state を使わず、この値でハイライトする(pointer 由来の変化は onHoveredRowChange で通知のみ)。 */
hoveredRowIndex?: number | null;
/** 行ホバーが変わったときの通知(uncontrolled でも呼ばれる)。
 *  viewRowIndex はフィルター / ソート適用後のビュー行 index。source は将来の拡張用(現状 'pointer' のみ)。 */
onHoveredRowChange?: (viewRowIndex: number | null, ctx: { source: 'pointer' }) => void;
```

- 内部実装は `useState` を「`hoveredRowIndex` prop があればそれ、無ければ内部 state」に置き換えるだけ(`setHoveredRowIndex` の各呼び出し箇所で `onHoveredRowChange` も呼ぶ)。`GridBodyLayer` 以降は無変更。
- 通知は同値なら発火しない(pointerenter は 1 行内でセルを跨ぐたびに来るため、`current === next` は抑止する)。既存の `setHoveredRowIndex((current) => (current === rowIndex ? null : current))`(行ヘッダー leave)も同じ規則で通知する。
- `enableRowHover: false` のときは controlled 値も無視(ハイライトしない / 通知しない)。「通知だけ欲しい」ケースは想定しないため単純な方が良い。
- ハンドル(`SpreadsheetGridHandle`)には載せない(state を prop で表現できるため。「prop で表現できない一発操作だけを載せる」方針に従う)。

**影響範囲 / 後方互換**: 追加のみ。prop 未指定時は現状と完全同一。`GridState`(getState / applyState)には含めない(一時的な UI 状態のため)。

**採用時の comparison-grid 側の対応**: `useComparisonScrollSyncGroup` と同じ registry 方式で `useComparisonHoverSync`(2-way)/ N 構成版を追加し、各ペインの `gridProps` に `hoveredRowIndex`(グループの共有 state)と `onHoveredRowChange`(broadcast)を流す。`ComparisonView` / `ComparisonLayout.Root` には `enableHoverSync?: boolean`(既定 false・整列モードでのみ意味がある)を追加。CSS は本体の `.ssg-body-cell--row-hovered` がそのまま付くため、既存の `--cmpg-*-row-hover-bg` トークンが相手ペインでも効く(追加 CSS 不要)。

---

## 11. コピー / エクスポートの行フィルタ(`isRowExportable`)(2026-09-11 追記・v0.32.0 で確認)

**背景**: comparison-grid の左右整列モードでは、欠損側に**プレースホルダ行**(既定 `{}`、`.cmpg-row-placeholder` でグレー表示)を挿入して行位置を揃えている。この行は表示上の詰め物だが、グリッドから見ると通常の行なので、**左上コーナーの全選択 → Ctrl+C**、**列ヘッダー選択 → Ctrl+C**、**行ヘッダー範囲選択 → Ctrl+C** のいずれでも**空行として TSV に混じる**。片側だけを Excel に貼る用途では空行が混じって行数がずれるため、「プレースホルダ行を除いてコピーする」オプション(既定 OFF。左右を横に並べて貼る用途では空行がある方が対応関係が保たれるため)を comparison-grid で提供したい。

**現状**: コピー経路は `useGridKeyboardInteractions.ts`(約 126 行)の Ctrl/⌘+C → `useGridClipboardController.ts` の `handleCopy`(約 107 行)の 1 本で、`isWholeGridSelected`(全セル範囲の `cell` 選択として表現)なら `serializeWholeGridToTsv`(約 80 行)、それ以外は `utils/clipboard.ts` の `serializeSelectionToTsv`(`cell` / `row` / `col` の 3 分岐)。いずれも `getRow(viewIndex)` で行を引き、`getCellValue` → `formatClipboardValue ?? String(value ?? '')` で整形して `'\t'` / `'\n'` 結合する。行を除外するフックは無く、あるのは**列単位**の `formatClipboardValue` のみ。CSV(`buildCsv` → `serializeRowsToCsv`)と `getExportData`(`buildGridExportData`)も `resolveExportScope` で行レンジ `[startRow, endRow)` を解決して同じ整形規則で書き出すため、同様に除外できない。コンテキストメニューの既定項目にコピーは無い(Ctrl+C のみ)。

**利用側だけで実現する場合の回り道**(採用されない場合の comparison-grid 側の代替案): ラッパー DOM の capture 段階 `keydown` で Ctrl/⌘+C を横取りして `stopPropagation` し、`handle.getSelection()` の範囲から `rows[viewIndex]` を引いて除外し、自前で TSV を組み立てて `navigator.clipboard` へ書く。難点は、(a) `getCellValue` / `formatClipboardValue` / `'\t'` 結合 / `writeTextToClipboard` の二段フォールバックといった**コピー整形の二重実装**(本体の規則変更に追随が必要)、(b) `getSelection()` はビュー index だが、行オブジェクトを引く公開 API が無いためソート / フィルター有効時に `rows[viewIndex]` が別の行を指す(整列モードではどちらも無効が前提なので実用上は動くが、契約としては脆い)、(c) CSV / `getExportData` は別途対応が要る。

**提案**: 「行をコピー / エクスポート対象にするか」を返す述語 prop を 1 つ追加し、**コピー(TSV)/ CSV / getExportData の 3 経路で共通に**適用する。

```ts
// SpreadsheetGridProps<T> への追加(任意)
/** コピー(Ctrl+C の TSV)/ exportCsv / getExportData の対象行フィルタ。false を返した行は出力から除く。
 *  ctx.viewRowIndex はフィルター / ソート適用後のビュー行 index。既定は全行 true。 */
isRowExportable?: (row: T, ctx: { viewRowIndex: number; rowKey: GridRowKey }) => boolean;
```

- 名前は `isRowExportable`(コピーも「クリップボードへのエクスポート」と見なす)。`isRowCopyable` + `isRowExportable` の 2 つに分ける案もあるが、comparison-grid の用途では常に同じ述語を渡すため 1 つで足りる(必要になれば `CsvExportOptions` / `GridExportOptions` 側に上書きを足せる)。
- 適用箇所は `serializeWholeGridToTsv` / `serializeSelectionToTsv`(3 分岐)/ `serializeRowsToCsv` / `buildGridExportData` の各行ループ。既に `if (!row) continue;`(SSRM 未ロード行の skip)があるので、その直後に `if (isRowExportable && !isRowExportable(row, ctx)) continue;` を足す形。
- 除外は**行単位のみ**(セル範囲選択で範囲内にプレースホルダ行があれば、その行を丸ごと落とす。列は触らない)。貼り付け(`handlePaste`)は対象外。
- 代替案: 行述語ではなく `transformCopyMatrix?: (matrix: string[][], ctx) => string[][]` のような後処理フックにすると汎用性は上がるが、CSV / getExportData(セルは `{ value, text }`)と型が揃わず、利用側が「どの行がプレースホルダか」を matrix から判別できない(空行 = プレースホルダとは限らない)ため、行述語の方を推す。

**影響範囲 / 後方互換**: 追加のみ。prop 未指定時は現状と完全同一。`isWholeGridSelected` の判定(選択範囲が全域か)には影響しない(除外は出力時のみ)。

**採用時の comparison-grid 側の対応**: `useComparisonPane` の `gridProps` 合成で `isRowExportable: (row) => !placeholderRows.has(row)` を(利用側の `isRowExportable` があれば AND で)流す。オプションは `excludePlaceholderRowsOnCopy?: boolean`(既定 false)を `useComparisonPane` / `ComparisonView` / `ComparisonLayout.Root` に追加。comparison-grid 自身の `getExportData` 相当(`logic/exportData.ts`)も同じオプションでプレースホルダ行を除外して整合させる。

---

## 付記: 今回の開発で確認できた「そのまま使えた」点

提案ではありませんが、設計判断の裏付けとして共有します。

- `getRowClassName` の返り値が行コンテナ + 各データセルの両方に付く仕様(gridTypes.ts 約 1570 行)のおかげで、`.ssg-body-cell.cmpg-row-diff` の連結セレクタだけで行ハイライトが成立しました。
- `:where(.ssg-root)` の特異度 0 トークンと未レイヤー CSS の方針を comparison-grid でもそのまま踏襲でき、`.ssg-theme-dark` 配下で `--cmpg-*` を差し替えるだけでダークテーマに追従できました。
- `style.layer.css` の二本立て(1 行の `@import ... layer()`)は `scripts/emit-layer-css.mjs` をそのまま流用できました。
- `SpreadsheetGridProps<T>` から `rows` / `columns` / `dataSource` を `Omit` した型を「透過 props」として公開でき、ソート / フィルター / テーマ / `ref` などグリッドの全機能を利用側が有効化できることをデモで確認しました。
