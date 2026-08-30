// comparison-grid の公開型です。公開する型は API_REFERENCE.md と対応します。
//   設計方針(サイドカー方式): 利用側の行 T には一切書き込まず、差分情報は行オブジェクトを
//   キーにした Map(ComparisonDiffMap)で横持ちします。グリッドへは T[] をそのまま渡すため、
//   利用側は GridColumn<T> / SpreadsheetGridProps<T> を「T の型のまま」書けます。
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type {
  CellStyleContext,
  GridColumn,
  ScrollAlign,
  SpreadsheetGridHandle,
  SpreadsheetGridProps,
} from '@ishibashi0112/spreadsheet-grid';

/** 比較の左右。 */
export type ComparisonSide = 'left' | 'right';

/** 行の差分種別。 */
export type ComparisonDiffKind = 'same' | 'left-only' | 'right-only' | 'field-diff';

/** 1 行ぶんの差分情報。 */
export type ComparisonRowDiff<T> = {
  /** この差分が属する側。 */
  side: ComparisonSide;
  kind: ComparisonDiffKind;
  /** 表示用ラベル("左のみ" / "数量・支給区分違い" 等)。same は ''。 */
  label: string;
  /** getMatchKey が返した突き合わせキー。 */
  matchKey: string;
  /** 差分のあった CompareField.key の集合(field-diff 以外は空)。 */
  fieldDiffs: ReadonlySet<string>;
  /** 突き合わせ相手の行(left-only / right-only では undefined)。 */
  counterpart?: T;
};

/** 行と差分の組(反復・エクスポート用)。 */
export type ComparisonRow<T> = {
  row: T;
  diff: ComparisonRowDiff<T>;
};

/** 「差分を見る」フィールドの定義。 */
export type CompareField<T> = {
  /** fieldDiffs での識別子 兼 既定の getValue(row[key])/ 既定の強調対象列キー。 */
  key: string;
  /** ラベル生成に使う表示名。 */
  label: string;
  /** 値アクセサ。既定は row[key]。 */
  getValue?: (row: T) => unknown;
  /** 等価判定。既定は Object.is。引数順は常に (左の値, 右の値)。 */
  equals?: (leftValue: unknown, rightValue: unknown) => boolean;
  /** セル強調をかける列(GridColumn.key)。既定は key(列キーと比較キーが異なるときに指定)。 */
  columnKey?: string;
};

/** 既定ラベル生成の文言。 */
export type ComparisonLabels = {
  leftOnly: string;
  rightOnly: string;
  /** field-diff で複数フィールドの label を連結する区切り。 */
  fieldDiffSeparator: string;
  /** field-diff で連結後に付ける接尾辞。 */
  fieldDiffSuffix: string;
};

/** formatDiffLabel へ渡すコンテキスト。 */
export type DiffLabelContext<T> = {
  side: ComparisonSide;
  kind: ComparisonDiffKind;
  row: T;
  counterpart?: T;
  fieldDiffs: ReadonlySet<string>;
  /** 差分のあったフィールド(compareFields の順)。 */
  diffFields: readonly CompareField<T>[];
  /** 既定文言(labels オプション適用後)。 */
  labels: ComparisonLabels;
};

/** 同一側にキー重複があるときの突き合わせ相手の選び方。 */
export type DuplicateKeyPolicy = 'last' | 'first';

/** 比較設定(純ロジック compare() と useComparison() で共通)。 */
export type CompareOptions<T> = {
  /** 突き合わせキー(必須)。 */
  getMatchKey: (row: T) => string;
  /** 差分を見るフィールド。 */
  compareFields: readonly CompareField<T>[];
  /** ラベル生成の差し替え。未指定は既定実装(formatDefaultDiffLabel)。 */
  formatDiffLabel?: (ctx: DiffLabelContext<T>) => string;
  /** 既定文言の部分上書き。 */
  labels?: Partial<ComparisonLabels>;
  /** キー重複時の相手選択。既定 'last'(後勝ち)。 */
  duplicateKeyPolicy?: DuplicateKeyPolicy;
};

/** 片側の件数。 */
export type ComparisonSideSummary = {
  total: number;
  same: number;
  /** この側にしか無い行(left なら left-only、right なら right-only)。 */
  only: number;
  fieldDiff: number;
};

export type ComparisonSummary = {
  left: ComparisonSideSummary;
  right: ComparisonSideSummary;
};

export type ComparisonDuplicateKeys = {
  left: readonly string[];
  right: readonly string[];
};

/** 行オブジェクト → 差分 の参照表。 */
export type ComparisonDiffMap<T> = ReadonlyMap<T, ComparisonRowDiff<T>>;

/** compare() の戻り値。 */
export type ComparisonResult<T> = {
  annotatedLeft: ComparisonRow<T>[];
  annotatedRight: ComparisonRow<T>[];
  leftDiffs: ComparisonDiffMap<T>;
  rightDiffs: ComparisonDiffMap<T>;
  summary: ComparisonSummary;
  duplicateKeys: ComparisonDuplicateKeys;
  /** 左右いずれかに same 以外の行があるか。 */
  hasAnyDiff: boolean;
};

/** 左右整列モード(alignRows)で対になった 1 行。欠損側にはプレースホルダ行が入ります。 */
export type ComparisonAlignedPair<T> = {
  left: T;
  right: T;
};

/** 各側の表示配列に挿入されたプレースホルダ行の集合(行オブジェクトの同一性で判定)。 */
export type ComparisonPlaceholders<T> = {
  left: ReadonlySet<T>;
  right: ReadonlySet<T>;
};

export type AlignComparisonRowsOptions<T> = {
  /** プレースホルダ行の生成。**呼び出しごとに新しいオブジェクト**を返すこと(同一性で判定するため)。
   *  既定は空オブジェクト(`{} as T`。`row[key]` アクセスが undefined になり空セルとして描画される)。 */
  createPlaceholderRow?: (side: ComparisonSide) => T;
};

/** alignComparisonRows() の戻り値。 */
export type AlignComparisonRowsResult<T> = {
  /** 突き合わせ順の対。左の行順を基準に、左に無い右行は右の行順で末尾に並ぶ。 */
  pairs: ComparisonAlignedPair<T>[];
  placeholders: ComparisonPlaceholders<T>;
};

export type UseComparisonOptions<T> = CompareOptions<T> & {
  left: readonly T[];
  right: readonly T[];
  /** 「差分のみ表示」の意思(state)。実効値は effectiveShowDiffOnly として導出されます。 */
  showDiffOnly?: boolean;
  /** 左右整列モード(既定 false)。突き合わせ順に並べ、欠損側へプレースホルダ行を挿入して
   *  左右の同じ行位置を同じ突き合わせ相手にします。visibleLeft / visibleRight は常に同じ長さになります。 */
  alignRows?: boolean;
  /** alignRows 時のプレースホルダ行生成(AlignComparisonRowsOptions と同じ)。
   *  インライン関数は毎レンダー再整列になるため、コンポーネント外で定義してください。 */
  createPlaceholderRow?: (side: ComparisonSide) => T;
};

export type UseComparisonResult<T> = ComparisonResult<T> & {
  /** 参照安定化済みの compareFields(ペインのセル強調に使用)。 */
  compareFields: readonly CompareField<T>[];
  /** effectiveShowDiffOnly 適用後の表示行。フィルタ無し・alignRows OFF のときは入力配列と同一参照。
   *  alignRows ON では整列済み配列(プレースホルダ行を含む)。 */
  visibleLeft: readonly T[];
  visibleRight: readonly T[];
  /** alignRows で各側の表示配列に挿入されたプレースホルダ行(OFF のときは空 Set)。 */
  placeholders: ComparisonPlaceholders<T>;
  hasBothSides: boolean;
  /** hasBothSides && showDiffOnly。 */
  effectiveShowDiffOnly: boolean;
  /** 「差分のみ」トグルを有効にしてよいか(hasBothSides && hasAnyDiff)。 */
  canShowDiffOnly: boolean;
  /** 左右どちらの行でも差分を引ける参照関数。 */
  getDiff: (row: T) => ComparisonRowDiff<T> | undefined;
};

/** GridColumn.cellClassName(関数版)が受け取るコンテキストです。spreadsheet-grid v0.29.0 で
 *  公開された CellStyleContext の別名です(公開前は列型からの導出で代替していました)。 */
export type GridCellStyleContext<T> = CellStyleContext<T>;

/** ペインが SpreadsheetGrid へ透過する props。rows / columns / dataSource はライブラリが予約します。 */
export type ComparisonGridProps<T> = Omit<
  SpreadsheetGridProps<T>,
  'rows' | 'columns' | 'dataSource'
>;

export type ComparisonHighlightOptions = {
  /** same 以外の行へ .cmpg-row-diff を付与(既定 true)。 */
  enableRowHighlight?: boolean;
  /** keyColumnKeys の列で left-only / right-only 行のセルを強調(既定 true)。 */
  enableKeyCellHighlight?: boolean;
  /** compareFields に対応する列で差分セルを強調(既定 true)。 */
  enableFieldCellHighlight?: boolean;
};

/** 差分ラベル列(showDiffLabelColumn)の調整。getValue はライブラリが与えます。 */
export type DiffLabelColumnOptions<T> = Partial<
  Omit<GridColumn<T>, 'getValue' | 'setValue' | 'editable'>
> & {
  /** 挿入位置。既定 'end'。 */
  position?: 'start' | 'end' | number;
};

export type ComparisonDiffLabelColumnProps<T> = {
  /** 差分ラベル列を自動追加(既定 false)。 */
  showDiffLabelColumn?: boolean;
  diffLabelColumn?: DiffLabelColumnOptions<T>;
};

/** 差分ジャンプの 1 停止位置。index は visibleLeft / visibleRight 上の行位置。 */
export type ComparisonDiffStop<T> = {
  kind: Exclude<ComparisonDiffKind, 'same'>;
  /** visibleLeft 上の行 index(この側に行が無い停止では undefined)。 */
  leftIndex?: number;
  /** visibleRight 上の行 index(同上)。 */
  rightIndex?: number;
  leftRow?: T;
  rightRow?: T;
};

export type UseComparisonNavigationOptions<T> = {
  /** useComparison の戻り値(visibleLeft / visibleRight / leftDiffs / rightDiffs を使用)。 */
  comparison: Pick<
    UseComparisonResult<T>,
    'visibleLeft' | 'visibleRight' | 'leftDiffs' | 'rightDiffs'
  >;
  /** alignRows 利用時に true。片側のみの停止でも同じ行位置で両ペインをスクロールする。 */
  alignRows?: boolean;
  /** scrollToRow の align(既定 'center')。 */
  align?: ScrollAlign;
};

export type UseComparisonNavigationResult<T> = {
  /** 左ペインのグリッドへ `leftGridProps={{ ref: leftRef }}` で渡す。 */
  leftRef: RefObject<SpreadsheetGridHandle<T> | null>;
  /** 右ペインのグリッドへ `rightGridProps={{ ref: rightRef }}` で渡す。 */
  rightRef: RefObject<SpreadsheetGridHandle<T> | null>;
  /** 停止位置(visibleLeft の行順 → 左に無い右行は visibleRight の行順で末尾)。 */
  diffStops: readonly ComparisonDiffStop<T>[];
  diffCount: number;
  /** 現在の停止位置(未移動は -1)。visibleLeft / visibleRight が変わるとリセットされる。 */
  activeDiffIndex: number;
  /** diffCount > 0。ボタンの disabled に。 */
  canNavigate: boolean;
  /** 指定位置へ(範囲外はラップ)。 */
  goToDiff: (index: number) => void;
  /** 次の差分へ(末尾からは先頭へ)。 */
  goToNextDiff: () => void;
  /** 前の差分へ(先頭・未移動からは末尾へ)。 */
  goToPreviousDiff: () => void;
};

/** useManualRows の 1 エラー。rowIndex は rows(グリッド表示配列)上の位置。 */
export type ManualRowError<T> = {
  row: T;
  rowIndex: number;
  message: string;
};

export type UseManualRowsOptions<T> = {
  /** 初期行(既定 `[]`)。末尾空行はフックが維持するため含めなくてよい。 */
  initialRows?: readonly T[];
  /** 空行の生成(グリッドの createRow と同じ。**毎回新しいオブジェクト**を返すこと)。 */
  createRow: () => T;
  /** 「空行」の判定。末尾空行の維持と dataRows の除外に使う。 */
  isEmptyRow: (row: T) => boolean;
  /** 変更時の正規化(トリム等)。**変更が不要なら受け取った row をそのまま返す**こと
   *  (参照を保つとグリッドの編集状態 / undo と相性がよい)。 */
  normalizeRow?: (row: T) => T;
  /** 送信時検証。エラーメッセージを返す(空 / null / undefined で OK)。空行は評価しない。 */
  validateRow?: (row: T, rowIndex: number) => string | null | undefined;
  /** 維持する末尾空行数(既定 1)。0 で維持しない(末尾の空行は取り除かれる)。 */
  trailingEmptyRows?: number;
};

export type UseManualRowsResult<T> = {
  /** グリッドへ渡す行(末尾空行込み)。 */
  rows: readonly T[];
  /** 空行(途中の空行も含む)を除いた確定行。useComparison の left / right へ。 */
  dataRows: readonly T[];
  /** gridProps.onRowsChange へ(正規化 + 末尾空行の維持)。 */
  onRowsChange: (nextRows: T[]) => void;
  /** 行の外部差し替え(読み込み / リセット)。末尾空行の維持のみ行う(正規化はしない)。 */
  setRows: (rows: readonly T[]) => void;
  /** 全行クリア(空行だけの状態に戻す)。 */
  clear: () => void;
  /** validateRow の現在の結果。 */
  errors: readonly ManualRowError<T>[];
  /** errors.length === 0(送信可否に)。 */
  isValid: boolean;
  /** そのままスプレッドできる編集用 props(`gridProps={{ ...manual.gridProps, readOnly: false }}` 等)。 */
  gridProps: {
    onRowsChange: (nextRows: T[]) => void;
    createRow: () => T;
  };
};

/** getComparisonExportData() のオプション。 */
export type ComparisonExportOptions<T> = {
  /** エクスポートする行(`visibleLeft` / `annotatedLeft.map((e) => e.row)` / 整列済み配列など)。 */
  rows: readonly T[];
  /** この側の差分 Map(`leftDiffs` / `rightDiffs`)。 */
  diffs: ComparisonDiffMap<T>;
  /** 列定義。`visible: false` の列は除外される。 */
  columns: readonly GridColumn<T>[];
  /** 差分ラベル列を含める(既定 **true**。ペインの既定 false とは異なることに注意)。 */
  showDiffLabelColumn?: boolean;
  /** ラベル列の調整(`key` / `title` / `position` を使用)。 */
  diffLabelColumn?: DiffLabelColumnOptions<T>;
};

export type ComparisonPaneProps<T extends object> = ComparisonHighlightOptions &
  ComparisonDiffLabelColumnProps<T> & {
    side: ComparisonSide;
    rows: readonly T[];
    diffs: ComparisonDiffMap<T>;
    columns: readonly GridColumn<T>[];
    /** セル強調の対応付けに使用(useComparison の compareFields を渡す)。 */
    compareFields?: readonly CompareField<T>[];
    /** 突き合わせキー相当の列キー(left-only / right-only 行で強調)。 */
    keyColumnKeys?: readonly string[];
    /** この側の rows に含まれるプレースホルダ行(.cmpg-row-placeholder を付与)。 */
    placeholderRows?: ReadonlySet<T>;
    header?: ReactNode;
    /** ヘッダースロットの描画。既定は header !== undefined。 */
    showHeader?: boolean;
    gridProps?: ComparisonGridProps<T>;
    className?: string;
    style?: CSSProperties;
  };

/** ComparisonView が useComparison の結果から使う部分。placeholders は alignRows 利用時のみ必要。 */
export type ComparisonViewModel<T> = Pick<
  UseComparisonResult<T>,
  'visibleLeft' | 'visibleRight' | 'leftDiffs' | 'rightDiffs' | 'compareFields'
> &
  Partial<Pick<UseComparisonResult<T>, 'placeholders'>>;

export type ComparisonViewProps<T extends object> = ComparisonHighlightOptions &
  ComparisonDiffLabelColumnProps<T> & {
    comparison: ComparisonViewModel<T>;
    columns: readonly GridColumn<T>[];
    keyColumnKeys?: readonly string[];
    /** 左右ペインの縦スクロールを同期する(既定 false)。alignRows との併用を想定。
     *  source が 'user' のスクロールだけを相手ペインへ伝え、'api' 由来は無視してループを防ぎます。 */
    enableScrollSync?: boolean;
    leftHeader?: ReactNode;
    rightHeader?: ReactNode;
    /** 両ペイン共通の grid props。 */
    gridProps?: ComparisonGridProps<T>;
    /** 片側だけの上書き(gridProps の上にマージ)。 */
    leftGridProps?: ComparisonGridProps<T>;
    rightGridProps?: ComparisonGridProps<T>;
    className?: string;
    style?: CSSProperties;
  };

// ---------------------------------------------------------------------------------------------
// 階層比較(木)。平坦なコア(compare / alignComparisonRows)の上に載る入力層で、木から突き合わせキー
//   (パス)と階層情報をサイドカーで導出します。T に children を要求せず、ノードが T を包みます。
// ---------------------------------------------------------------------------------------------

/** 階層比較の入力ノード。`row` は利用側の行そのもの(書き込まない)。 */
export type ComparisonTreeNode<T> = {
  row: T;
  children?: readonly ComparisonTreeNode<T>[];
};

/** 展開結果(深さ優先順 + level)から木を組む。level は 0 始まりでも 1 始まりでもよい(先頭行を基準の相対値で扱う)。 */
export type BuildComparisonTreeByLevelOptions<T> = {
  getLevel: (row: T) => number;
};

/** 隣接リスト(各行が親を指す)から木を組む。`getId` は**出現ごとに一意な行 ID**(品番は不可)。 */
export type BuildComparisonTreeByParentOptions<T> = {
  getId: (row: T) => string;
  /** 親の行 ID。null / undefined / '' はルート行。 */
  getParentId: (row: T) => string | null | undefined;
};

export type BuildComparisonTreeOptions<T> =
  | BuildComparisonTreeByLevelOptions<T>
  | BuildComparisonTreeByParentOptions<T>;

/** buildComparisonTree が検出する破綻の種類(修復せず報告する)。 */
export type ComparisonTreeIssueKind =
  /** level が直前の行より 2 段以上深い(直前の行の子として扱う)。 */
  | 'level-jump'
  /** 同じ ID の行が複数ある(親の参照は最初の行へ解決)。品番を ID に渡した典型。 */
  | 'duplicate-id'
  /** 親 ID の行が見つからない(ルート行として扱う)。 */
  | 'missing-parent'
  /** 親の参照が循環している(その行をルート行として扱う)。 */
  | 'cycle';

export type ComparisonTreeIssue<T> = {
  kind: ComparisonTreeIssueKind;
  row: T;
  /** 入力配列上の行位置。 */
  rowIndex: number;
  /** 日本語のメッセージ(UI 表示 / ログ用)。 */
  message: string;
};

export type BuildComparisonTreeResult<T> = {
  roots: ComparisonTreeNode<T>[];
  issues: ComparisonTreeIssue<T>[];
};

/** 木から突き合わせキー(パス)を導出する設定。 */
export type ComparisonTreeKeyOptions<T> = {
  /** 自ノードのコード(パスの 1 セグメント)。木の中で何度現れてもよい。 */
  getCode: (row: T) => string;
  /** 代表コード。空でない値を返すと自セグメントを置き換え、子孫のキーにも伝播する。 */
  getRepresentativeCode?: (row: T) => string | null | undefined;
  /** セグメントの区切り(既定 '/')。 */
  separator?: string;
};

/** 行ごとの階層情報(flattenComparisonTree のサイドカー)。 */
export type ComparisonTreeInfo<T> = {
  /** 0 始まりの深さ。 */
  depth: number;
  /** 親の行(ルートは undefined)。 */
  parent?: T;
  hasChildren: boolean;
  /** 同じ親の下で同じセグメントを持つ行のうち何番目か(0 始まり)。1 以上ならキーに '#n' が付く。 */
  occurrence: number;
  /** 突き合わせキー(パス)。 */
  matchKey: string;
};

export type FlattenComparisonTreeResult<T> = {
  /** 深さ優先順の行。 */
  rows: T[];
  infos: ReadonlyMap<T, ComparisonTreeInfo<T>>;
};
