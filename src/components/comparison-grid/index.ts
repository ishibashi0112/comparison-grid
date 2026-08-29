// comparison-grid の公開エントリ(バレル)です。公開する型は API_REFERENCE.md と対応します。

// 純ロジック(React 非依存)。
export {
  compare,
  formatDefaultDiffLabel,
  DEFAULT_COMPARISON_LABELS,
} from './logic/compare';
export { alignComparisonRows } from './logic/alignRows';
export { getComparisonExportData } from './logic/exportData';
// ライブラリが付与するクラス名と差分ラベル列の既定キー(利用側 CSS / テスト向け)。
export { CMPG_CLASS_NAMES, DEFAULT_DIFF_LABEL_COLUMN_KEY } from './logic/paneColumns';
// React 層。
export { useComparison } from './hooks/useComparison';
export { useComparisonNavigation } from './hooks/useComparisonNavigation';
export { ComparisonPane } from './view/ComparisonPane';
export { ComparisonView } from './view/ComparisonView';

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
  ComparisonExportOptions,
  UseComparisonOptions,
  UseComparisonResult,
  ComparisonDiffStop,
  UseComparisonNavigationOptions,
  UseComparisonNavigationResult,
  GridCellStyleContext,
  ComparisonGridProps,
  ComparisonHighlightOptions,
  DiffLabelColumnOptions,
  ComparisonDiffLabelColumnProps,
  ComparisonPaneProps,
  ComparisonViewModel,
  ComparisonViewProps,
} from './model/types';
