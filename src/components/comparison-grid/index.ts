// comparison-grid の公開エントリ(バレル)です。公開する型は API_REFERENCE.md と対応します。

// 純ロジック(React 非依存)。
export {
  compare,
  formatDefaultDiffLabel,
  DEFAULT_COMPARISON_LABELS,
} from './logic/compare';
export { alignComparisonRows } from './logic/alignRows';
// N 構成比較(基準対各構成)。2-way の上に載る別レイヤー。
export {
  compareMany,
  formatDefaultMultiDiffLabel,
  DEFAULT_COMPARISON_MULTI_LABELS,
} from './logic/compareMany';
export { alignComparisonRowsMany } from './logic/alignRowsMany';
export { getComparisonExportData } from './logic/exportData';
// 階層比較(木): 平坦な行 → 木 / 木 → キー付き平坦化 / 構造マージ整列。
export {
  buildComparisonTree,
  flattenComparisonTree,
  collectCollapsedDescendants,
  DEFAULT_TREE_KEY_SEPARATOR,
  TREE_KEY_OCCURRENCE_SEPARATOR,
} from './logic/tree';
export { alignComparisonTree } from './logic/alignTree';
export { countDescendantDiffs } from './logic/rollup';
// ライブラリが付与するクラス名と差分ラベル列の既定キー(利用側 CSS / テスト向け)。
export {
  CMPG_CLASS_NAMES,
  DEFAULT_DIFF_LABEL_COLUMN_KEY,
  formatDefaultDescendantDiffLabel,
} from './logic/paneColumns';
// React 層。
export { useComparison } from './hooks/useComparison';
export { useTreeComparison } from './hooks/useTreeComparison';
export { useMultiComparison } from './hooks/useMultiComparison';
export { useComparisonNavigation } from './hooks/useComparisonNavigation';
export { useMultiComparisonNavigation, collectMultiDiffStops } from './hooks/useMultiComparisonNavigation';
export { useManualRows } from './hooks/useManualRows';
// ヘッドレス層: ComparisonPane / ComparisonView の本体。自前の SpreadsheetGrid に差分合成 / スクロール同期を配線する。
export { useComparisonPane } from './hooks/useComparisonPane';
export {
  useComparisonScrollSync,
  useComparisonScrollSyncGroup,
  useComparisonScrollSyncMany,
  useSyncedGridProps,
  composeSyncedGridProps,
} from './hooks/useComparisonScrollSync';
export { ComparisonPane } from './view/ComparisonPane';
export { ComparisonView } from './view/ComparisonView';
// 合成コンポーネント: Root が Context で配り、Pane / Header / Grid は役割だけ。ペイン数は JSX の子の数。
export {
  ComparisonLayoutRoot,
  ComparisonLayoutPane,
  ComparisonLayoutHeader,
  ComparisonLayoutGrid,
} from './view/ComparisonLayout';
export { ComparisonLayout } from './view/comparisonLayoutNamespace';
export {
  useComparisonLayout,
  useComparisonLayoutSide,
  normalizeLayoutSides,
} from './view/comparisonLayoutContext';

export type {
  ComparisonSide,
  ComparisonDiffKind,
  ComparisonRowDiff,
  ComparisonRow,
  CompareField,
  ComparisonLabels,
  DiffLabelContext,
  DuplicateKeyPolicy,
  CompareOptions,
  ComparisonSideSummary,
  ComparisonSummary,
  ComparisonDuplicateKeys,
  ComparisonDiffMap,
  ComparisonResult,
  ComparisonAlignedPair,
  ComparisonPlaceholders,
  AlignComparisonRowsOptions,
  AlignComparisonRowsResult,
  ComparisonSideId,
  ComparisonSideInput,
  ComparisonSideInfo,
  ComparisonMultiDiffKind,
  ComparisonMultiRowDiff,
  ComparisonMultiRow,
  ComparisonMultiDiffMap,
  ComparisonMultiLabels,
  MultiDiffLabelContext,
  CompareManyOptions,
  ComparisonMultiSideSummary,
  ComparisonMultiSideResult,
  ComparisonMultiResult,
  AlignComparisonRowsManyOptions,
  AlignComparisonRowsManyResult,
  UseMultiComparisonOptions,
  ComparisonMultiVisibleSide,
  UseMultiComparisonResult,
  ComparisonScrollSyncGroup,
  UseComparisonScrollSyncGroupOptions,
  UseComparisonScrollSyncManyOptions,
  UseComparisonScrollSyncManyResult,
  ComparisonMultiDiffStop,
  UseMultiComparisonNavigationOptions,
  UseMultiComparisonNavigationResult,
  ComparisonAnyRowDiff,
  ComparisonAnyDiffMap,
  ComparisonExportOptions,
  ComparisonTreeNode,
  BuildComparisonTreeByLevelOptions,
  BuildComparisonTreeByParentOptions,
  BuildComparisonTreeOptions,
  ComparisonTreeIssueKind,
  ComparisonTreeIssue,
  BuildComparisonTreeResult,
  ComparisonTreeKeyOptions,
  ComparisonTreeInfo,
  FlattenComparisonTreeResult,
  ComparisonContextRows,
  ComparisonDescendantDiffCounts,
  UseTreeComparisonOptions,
  UseTreeComparisonResult,
  UseComparisonOptions,
  UseComparisonResult,
  ComparisonDiffStop,
  UseComparisonNavigationOptions,
  UseComparisonNavigationResult,
  ManualRowError,
  UseManualRowsOptions,
  UseManualRowsResult,
  GridCellStyleContext,
  ComparisonGridProps,
  ComparisonHighlightOptions,
  DiffLabelColumnOptions,
  ComparisonDiffLabelColumnProps,
  UseComparisonPaneOptions,
  ComparisonPaneGridProps,
  UseComparisonPaneResult,
  ComparisonPaneProps,
  UseComparisonScrollSyncOptions,
  UseComparisonScrollSyncResult,
  ComparisonViewModel,
  ComparisonViewLayout,
  ComparisonViewProps,
  ComparisonMultiViewModel,
  ComparisonLayoutModel,
  ComparisonLayoutSide,
  ComparisonLayoutRootProps,
  ComparisonLayoutPaneProps,
  ComparisonLayoutHeaderProps,
  ComparisonLayoutGridProps,
  ComparisonLayoutContextValue,
} from './model/types';
