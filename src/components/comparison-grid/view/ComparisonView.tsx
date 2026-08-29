// 左右 2 ペイン + ペインごとのヘッダースロットを並べる薄いレイアウトです(CSS Grid 2 カラム)。
//   ヘッダースロットは片側だけ指定されても両ペインに描画し、上端を揃えます。
import { useMemo } from 'react';
import type { ComparisonGridProps, ComparisonViewProps } from '../model/types';
import { ComparisonPane } from './ComparisonPane';
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
    enableRowHighlight,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    showDiffLabelColumn,
    diffLabelColumn,
  } = props;
  const showHeader = leftHeader !== undefined || rightHeader !== undefined;
  const leftProps = useMemo(
    () => mergeGridProps(gridProps, leftGridProps),
    [gridProps, leftGridProps],
  );
  const rightProps = useMemo(
    () => mergeGridProps(gridProps, rightGridProps),
    [gridProps, rightGridProps],
  );
  const highlight = {
    enableRowHighlight,
    enableKeyCellHighlight,
    enableFieldCellHighlight,
    showDiffLabelColumn,
    diffLabelColumn,
  };

  return (
    <div className={cx('cmpg-view', className)} style={style}>
      <ComparisonPane<T>
        side="left"
        rows={comparison.visibleLeft}
        diffs={comparison.leftDiffs}
        columns={columns}
        compareFields={comparison.compareFields}
        keyColumnKeys={keyColumnKeys}
        placeholderRows={comparison.placeholders?.left}
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
        header={rightHeader}
        showHeader={showHeader}
        gridProps={rightProps}
        {...highlight}
      />
    </div>
  );
}
