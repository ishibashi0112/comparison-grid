// 合成コンポーネント(Compound Components)です。HeroUI の Dropdown.Trigger / .Popover のように、
//   Root が Context で状態(比較結果 / 列 / ハイライト設定 / スクロール同期グループ)を配り、
//   Pane / Header / Grid は「役割」を名乗るだけで、配置・階層・追加要素は利用側の JSX が決めます。
//   - ペインの数は JSX の子の数。2-way(useComparison)でも N 構成(useMultiComparison)でも同じ書き方。
//   - Grid の本体はヘッドレス層(useComparisonPane + useSyncedGridProps)。DOM は .cmpg-pane-body だけ。
//   - ComparisonView はこれらで組んだプリセット(props / DOM は従来どおり)。
//   - Root 外で Pane / Grid を使うと例外(日本語メッセージ)。明示的に props を渡すヘッドレス経路は残る。
import { useMemo } from 'react';
import { SpreadsheetGrid } from '@ishibashi0112/spreadsheet-grid';
import type {
  ComparisonLayoutContextValue,
  ComparisonLayoutGridProps,
  ComparisonLayoutHeaderProps,
  ComparisonLayoutPaneProps,
  ComparisonLayoutRootProps,
  ComparisonLayoutSide,
  ComparisonSideId,
  ComparisonViewModel,
} from '../model/types';
import {
  LayoutContext,
  PaneContext,
  isMultiModel,
  mergeGridProps,
  normalizeLayoutSides,
  useComparisonLayout,
  useComparisonLayoutSide,
} from './comparisonLayoutContext';
import { useComparisonPane } from '../hooks/useComparisonPane';
import {
  useComparisonScrollSyncGroup,
  useSyncedGridProps,
} from '../hooks/useComparisonScrollSync';
import { cx } from '../logic/cx';
import '../styles.css';

const CLASS_SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function ComparisonLayoutRoot<T extends object>(props: ComparisonLayoutRootProps<T>) {
  const {
    comparison,
    columns,
    keyColumnKeys,
    layout = 'horizontal',
    enableScrollSync = false,
    scrollSyncGroup,
    gridProps,
    className,
    style,
    children,
    enableRowHighlight,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    showDiffLabelColumn,
    diffLabelColumn,
  } = props;

  // 正規化の依存は「モデルの中身」にする(利用側が comparison をインラインで組んでも再正規化しない)。
  const multi = isMultiModel(comparison) ? comparison : undefined;
  const twoWay = isMultiModel(comparison) ? undefined : (comparison as ComparisonViewModel<T>);
  const sides = useMemo(
    () => normalizeLayoutSides<T>(comparison),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- comparison の中身(下記)で判定する
    [
      multi?.sides,
      twoWay?.visibleLeft,
      twoWay?.visibleRight,
      twoWay?.leftDiffs,
      twoWay?.rightDiffs,
      twoWay?.placeholders,
      twoWay?.contextRows,
      twoWay?.descendantDiffCounts,
    ],
  );
  const sidesById = useMemo(
    () => new Map<ComparisonSideId, ComparisonLayoutSide<T>>(sides.map((side) => [side.id, side])),
    [sides],
  );
  const compareFields = comparison.compareFields;

  const ownGroup = useComparisonScrollSyncGroup<T>({
    enabled: enableScrollSync,
    syncHorizontal: layout === 'vertical',
  });
  const group = scrollSyncGroup ?? ownGroup;

  const highlight = useMemo(
    () => ({
      enableRowHighlight,
      enableKeyCellHighlight,
      enableFieldCellHighlight,
      showDiffLabelColumn,
      diffLabelColumn,
    }),
    [
      enableRowHighlight,
      enableKeyCellHighlight,
      enableFieldCellHighlight,
      showDiffLabelColumn,
      diffLabelColumn,
    ],
  );

  const value = useMemo<ComparisonLayoutContextValue<T>>(
    () => ({
      sides,
      getSide: (id) => sidesById.get(id),
      columns,
      keyColumnKeys,
      compareFields,
      highlight,
      gridProps,
      layout,
      scrollSyncGroup: group,
    }),
    [sides, sidesById, columns, keyColumnKeys, compareFields, highlight, gridProps, layout, group],
  );

  return (
    <LayoutContext.Provider value={value as unknown as ComparisonLayoutContextValue<never>}>
      <div
        className={cx('cmpg-view', `cmpg-view--${layout}`, className)}
        style={style}
        data-cmpg-layout={layout}
      >
        {children}
      </div>
    </LayoutContext.Provider>
  );
}

export function ComparisonLayoutPane(props: ComparisonLayoutPaneProps) {
  const { side, className, style, children } = props;
  useComparisonLayout();
  return (
    <PaneContext.Provider value={side}>
      <div
        className={cx(
          'cmpg-pane',
          CLASS_SAFE_ID.test(side) ? `cmpg-pane--${side}` : undefined,
          className,
        )}
        style={style}
        data-cmpg-side={side}
      >
        {children}
      </div>
    </PaneContext.Provider>
  );
}

export function ComparisonLayoutHeader(props: ComparisonLayoutHeaderProps) {
  const { className, style, children } = props;
  return (
    <div className={cx('cmpg-pane-header', className)} style={style}>
      {children}
    </div>
  );
}

export function ComparisonLayoutGrid<T extends object>(props: ComparisonLayoutGridProps<T>) {
  const { side: sideProp, gridProps, className, style } = props;
  const layout = useComparisonLayout<T>();
  const paneSide = useComparisonLayoutSide();
  const sideId = sideProp ?? paneSide;
  const side = sideId !== undefined ? layout.getSide(sideId) : undefined;

  const merged = useMemo(
    () => mergeGridProps(layout.gridProps, gridProps),
    [layout.gridProps, gridProps],
  );
  // フックの呼び出し順を保つため、side が無い場合も合成は行い、描画の直前で例外にする。
  const synced = useSyncedGridProps(layout.scrollSyncGroup, sideId ?? '', merged);
  const pane = useComparisonPane<T>({
    rows: side?.rows ?? EMPTY_ROWS,
    diffs: side?.diffs ?? EMPTY_DIFFS,
    columns: layout.columns,
    compareFields: layout.compareFields,
    keyColumnKeys: layout.keyColumnKeys,
    placeholderRows: side?.placeholderRows,
    contextRows: side?.contextRows,
    descendantDiffCounts: side?.descendantDiffCounts,
    gridProps: synced,
    ...layout.highlight,
  });

  if (sideId === undefined) {
    throw new Error(
      'ComparisonLayout.Grid: Pane の配下に置くか、side prop で構成 ID を指定してください。',
    );
  }
  if (!side) {
    throw new Error(`ComparisonLayout.Grid: 構成 "${sideId}" が comparison にありません。`);
  }

  return (
    <div className={cx('cmpg-pane-body', className)} style={style}>
      <SpreadsheetGrid<T> {...pane.gridProps} />
    </div>
  );
}

const EMPTY_ROWS: readonly never[] = [];
const EMPTY_DIFFS: ReadonlyMap<never, never> = new Map<never, never>();
