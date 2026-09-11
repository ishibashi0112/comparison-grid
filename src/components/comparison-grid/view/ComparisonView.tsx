// 2 ペイン + ペインごとのヘッダースロットを並べる薄いレイアウトです。合成コンポーネント
//   (ComparisonLayout.Root / .Pane / .Header / .Grid)で組んだプリセットで、props / DOM は従来どおり:
//   - layout='horizontal'(既定)は左右 2 カラム、'vertical' は上下 2 行(left が上)。
//   - ヘッダースロットは片側だけ指定されても両ペインに描画し、上端を揃えます。
//   - enableScrollSync の実体は Root の同期グループ(useComparisonScrollSyncGroup)で、同期軸は layout に依り、
//     横並びは top のみ、縦並びは top / left 両方(列が上下に揃うため横も合わせる)。
import type { ComparisonViewProps } from '../model/types';
import {
  ComparisonLayoutGrid,
  ComparisonLayoutHeader,
  ComparisonLayoutPane,
  ComparisonLayoutRoot,
} from './ComparisonLayout';

/**
 * 2 ペインのプリセット(`ComparisonLayout` で組んだもの)。`useComparison` / `useTreeComparison` の戻り値と
 * 列定義を渡すだけで、差分ハイライト / 差分ラベル列 / スクロール同期 / ホバー同期つきの左右比較になります。
 *
 * @example
 * ```tsx
 * <ComparisonView<Row>
 *   comparison={comparison}
 *   columns={columns}
 *   keyColumnKeys={['id']}
 *   showDiffLabelColumn
 *   enableScrollSync
 *   leftHeader={<strong>現行</strong>}
 *   rightHeader={<strong>案1</strong>}
 *   gridProps={{ height: 480 }}
 * />
 * ```
 */
export function ComparisonView<T extends object>(props: ComparisonViewProps<T>) {
  const {
    comparison,
    columns,
    keyColumnKeys,
    leftHeader,
    rightHeader,
    gridProps,
    leftGridProps,
    rightGridProps,
    className,
    style,
    layout = 'horizontal',
    enableRowHighlight,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    enableScrollSync = false,
    enableHoverSync = false,
    showDiffLabelColumn,
    diffLabelColumn,
    excludePlaceholderRowsOnCopy,
  } = props;
  const showHeader = leftHeader !== undefined || rightHeader !== undefined;

  return (
    <ComparisonLayoutRoot<T>
      comparison={comparison}
      columns={columns}
      keyColumnKeys={keyColumnKeys}
      layout={layout}
      enableScrollSync={enableScrollSync}
      enableHoverSync={enableHoverSync}
      gridProps={gridProps}
      className={className}
      style={style}
      enableRowHighlight={enableRowHighlight}
      enableKeyCellHighlight={enableKeyCellHighlight}
      enableFieldCellHighlight={enableFieldCellHighlight}
      showDiffLabelColumn={showDiffLabelColumn}
      diffLabelColumn={diffLabelColumn}
      excludePlaceholderRowsOnCopy={excludePlaceholderRowsOnCopy}
    >
      <ComparisonLayoutPane side="left">
        {showHeader ? <ComparisonLayoutHeader>{leftHeader}</ComparisonLayoutHeader> : null}
        <ComparisonLayoutGrid<T> gridProps={leftGridProps} />
      </ComparisonLayoutPane>
      <ComparisonLayoutPane side="right">
        {showHeader ? <ComparisonLayoutHeader>{rightHeader}</ComparisonLayoutHeader> : null}
        <ComparisonLayoutGrid<T> gridProps={rightGridProps} />
      </ComparisonLayoutPane>
    </ComparisonLayoutRoot>
  );
}
