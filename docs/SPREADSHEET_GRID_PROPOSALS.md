# spreadsheet-grid への提案書(comparison-grid 開発からのフィードバック)

- 提出元: `@ishibashi0112/comparison-grid`(リポジトリ `ishibashi0112/comparison-grid`)の初版開発(2026-08-29)
- 対象: `@ishibashi0112/spreadsheet-grid` **v0.28.1**(リポジトリ `ishibashi0112/datasheet-grid`)
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

## 採否結果(2026-08-29・spreadsheet-grid 側で実装)

spreadsheet-grid リポジトリのブランチ `claude/spreadsheet-grid-proposals-7g56pd`(v0.28.1 ベース)で対応。

| # | 採否 | 内容 |
| --- | --- | --- |
| 1 | ✅ 採用 | `CellStyleContext` をバレルから公開(batch 1)。 |
| 2 | ✅ 採用 | `rows` / `columns` / `filterOptions` を readonly 化(batch 2)。型の緩和のみで実行時挙動は不変。 |
| 3 | ✅ 採用(案 a + b) | `@ishibashi0112/spreadsheet-grid/testing` サブパスで `installJsdomLayoutStubs({ width?, height? })` を公開(restore 関数を返す)+ ドキュメント化(batch 5)。 |
| 4 | ➖ 既存機能で充足 | 提案の `getRowKey` 相当は **`rowKeyGetter` prop として実装済みだった**(`(row, index) => GridRowKey`。clientSide / serverSide 両対応、選択・`ctx.rowKey`・React key に配線済み)。comparison-grid 側はこれを利用すればよい。 |
| 5 | ✅ 採用 | `getRowClassName` に第 3 引数 `ctx: RowStyleContext<T>`(`row / rowIndex / sourceRowIndex / rowKey / isSelected`)を追加(batch 3)。完全後方互換。`isGroupRow` はグループ行が `getRowClassName` の対象外(専用描画)のため持たない。 |
| 6 | ✅ 採用 | 状態クラス一覧を API_REFERENCE / website に「公開契約」(変更時 breaking 扱い)として明記(batch 4)。 |
| 7 | ✅ 案 (b) を採用 / 案 (a) は見送り確定 | 現状維持のうえ「未指定 / 空文字は `key` を表示」を明記。案 (a) の挙動変更は **2026-08-29 に見送りで確定**(comparison-grid 側に実害なし。見出しを空にしたい列は `title: ' '` で回避可)。必要が生じたら「ヘッダー表示のみ空文字を尊重・列メニュー等の識別 UI は key 維持」の案で 0.30.0 として実装する。 |
| 8 | ✅ 採用 | `handle.getScrollPosition()` / `handle.setScrollPosition()` / `props.onScroll`(`source: 'user' \| 'api'`・rAF 間引き)を追加(batch 6)。 |

採用分が npm へ publish されたら、comparison-grid 側の対応(`GridCellStyleContext` の再エクスポート化・`rows as T[]` キャスト削除・自前スタブの `installJsdomLayoutStubs()` 置き換え・peer 下限の引き上げ)を行う。

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

## 付記: 今回の開発で確認できた「そのまま使えた」点

提案ではありませんが、設計判断の裏付けとして共有します。

- `getRowClassName` の返り値が行コンテナ + 各データセルの両方に付く仕様(gridTypes.ts 約 1570 行)のおかげで、`.ssg-body-cell.cmpg-row-diff` の連結セレクタだけで行ハイライトが成立しました。
- `:where(.ssg-root)` の特異度 0 トークンと未レイヤー CSS の方針を comparison-grid でもそのまま踏襲でき、`.ssg-theme-dark` 配下で `--cmpg-*` を差し替えるだけでダークテーマに追従できました。
- `style.layer.css` の二本立て(1 行の `@import ... layer()`)は `scripts/emit-layer-css.mjs` をそのまま流用できました。
- `SpreadsheetGridProps<T>` から `rows` / `columns` / `dataSource` を `Omit` した型を「透過 props」として公開でき、ソート / フィルター / テーマ / `ref` などグリッドの全機能を利用側が有効化できることをデモで確認しました。
