// 2 ペイン + ペインごとのヘッダースロットを並べる薄いレイアウトです(CSS Grid)。
//   layout='horizontal'(既定)は左右 2 カラム、'vertical' は上下 2 行(left が上)。
//   ヘッダースロットは片側だけ指定されても両ペインに描画し、上端を揃えます。
//   enableScrollSync の実体は useComparisonScrollSync(ヘッドレス)で、同期軸は layout に依り、
//   横並びは top のみ、縦並びは top / left 両方(列が上下に揃うため横も合わせる)。
import { useMemo } from 'react';
import type { ComparisonGridProps, ComparisonViewProps } from '../model/types';
import { ComparisonPane } from './ComparisonPane';
import { useComparisonScrollSync } from '../hooks/useComparisonScrollSync';
import { cx } from '../logic/cx';

const mergeGridProps = <T,>(
  base: ComparisonGridProps<T> | undefined,
  override: ComparisonGridProps<T> | undefined,
): ComparisonGridProps<T> | undefined => {
  if (!override) return base;
  if (!base) return override;
  return { ...base, ...override };
};

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
    showDiffLabelColumn,
    diffLabelColumn,
  } = props;
  const showHeader = leftHeader !== undefined || rightHeader !== undefined;
  const mergedLeft = useMemo(
    () => mergeGridProps(gridProps, leftGridProps),
    [gridProps, leftGridProps],
  );
  const mergedRight = useMemo(
    () => mergeGridProps(gridProps, rightGridProps),
    [gridProps, rightGridProps],
  );
  const { leftGridProps: leftProps, rightGridProps: rightProps } = useComparisonScrollSync<T>({
    enabled: enableScrollSync,
    syncHorizontal: layout === 'vertical',
    leftGridProps: mergedLeft,
    rightGridProps: mergedRight,
  });
  const highlight = {
    enableRowHighlight,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    showDiffLabelColumn,
    diffLabelColumn,
  };

  return (
    <div
      className={cx('cmpg-view', `cmpg-view--${layout}`, className)}
      style={style}
      data-cmpg-layout={layout}
    >
      <ComparisonPane<T>
        side="left"
        rows={comparison.visibleLeft}
        diffs={comparison.leftDiffs}
        columns={columns}
        compareFields={comparison.compareFields}
        keyColumnKeys={keyColumnKeys}
        placeholderRows={comparison.placeholders?.left}
        contextRows={comparison.contextRows?.left}
        descendantDiffCounts={comparison.descendantDiffCounts?.left}
        header={leftHeader}
        showHeader={showHeader}
        gridProps={leftProps}
        {...highlight}
      />
      <ComparisonPane<T>
        side="right"
        rows={comparison.visibleRight}
        diffs={comparison.rightDiffs}
        columns={columns}
        compareFields={comparison.compareFields}
        keyColumnKeys={keyColumnKeys}
        placeholderRows={comparison.placeholders?.right}
        contextRows={comparison.contextRows?.right}
        descendantDiffCounts={comparison.descendantDiffCounts?.right}
        header={rightHeader}
        showHeader={showHeader}
        gridProps={rightProps}
        {...highlight}
      />
    </div>
  );
}
