// comparison-grid の公開型です。公開する型は API_REFERENCE.md と対応します。
//   設計方針(サイドカー方式): 利用側の行 T には一切書き込まず、差分情報は行オブジェクトを
//   キーにした Map(ComparisonDiffMap)で横持ちします。グリッドへは T[] をそのまま渡すため、
//   利用側は GridColumn<T> / SpreadsheetGridProps<T> を「T の型のまま」書けます。
import type { CSSProperties, ReactNode } from 'react';
import type {
  CellStyleContext,
  GridColumn,
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
};

export type UseComparisonResult<T> = ComparisonResult<T> & {
  /** 参照安定化済みの compareFields(ペインのセル強調に使用)。 */
  compareFields: readonly CompareField<T>[];
  /** effectiveShowDiffOnly 適用後の表示行。フィルタ無しのときは入力配列と同一参照。 */
  visibleLeft: readonly T[];
  visibleRight: readonly T[];
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
    header?: ReactNode;
    /** ヘッダースロットの描画。既定は header !== undefined。 */
    showHeader?: boolean;
    gridProps?: ComparisonGridProps<T>;
    className?: string;
    style?: CSSProperties;
  };

/** ComparisonView が useComparison の結果から使う部分。 */
export type ComparisonViewModel<T> = Pick<
  UseComparisonResult<T>,
  'visibleLeft' | 'visibleRight' | 'leftDiffs' | 'rightDiffs' | 'compareFields'
>;

export type ComparisonViewProps<T extends object> = ComparisonHighlightOptions &
  ComparisonDiffLabelColumnProps<T> & {
    comparison: ComparisonViewModel<T>;
    columns: readonly GridColumn<T>[];
    keyColumnKeys?: readonly string[];
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
