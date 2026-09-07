// 合成コンポーネント(ComparisonLayout)の Context とフック、モデルの正規化です。
//   コンポーネント本体(ComparisonLayout.tsx)から分離しているのは、コンポーネントだけを export するファイルに
//   保つため(react-refresh の制約)。
import { createContext, useContext } from 'react';
import type {
  ComparisonGridProps,
  ComparisonLayoutContextValue,
  ComparisonLayoutModel,
  ComparisonLayoutSide,
  ComparisonMultiViewModel,
  ComparisonSideId,
} from '../model/types';

// Context は非ジェネリックに保持し、取り出すフックで T を付け直す(React の createContext は型引数を
//   コンポーネントごとに変えられないため)。
export const LayoutContext = createContext<ComparisonLayoutContextValue<never> | null>(null);
export const PaneContext = createContext<ComparisonSideId | undefined>(undefined);

/** Root が配る値を取り出します(自作のツールバー / 集計表示など)。Root 外では例外。 */
export function useComparisonLayout<T>(): ComparisonLayoutContextValue<T> {
  const value = useContext(LayoutContext);
  if (!value) {
    throw new Error('ComparisonLayout: Root(ComparisonLayoutRoot)の配下で使ってください。');
  }
  return value as unknown as ComparisonLayoutContextValue<T>;
}

/** 現在の Pane の構成 ID(Pane 外では undefined)。 */
export function useComparisonLayoutSide(): ComparisonSideId | undefined {
  return useContext(PaneContext);
}

export const isMultiModel = <T,>(
  model: ComparisonLayoutModel<T>,
): model is ComparisonMultiViewModel<T> => 'sides' in model;

export const mergeGridProps = <T,>(
  base: ComparisonGridProps<T> | undefined,
  override: ComparisonGridProps<T> | undefined,
): ComparisonGridProps<T> | undefined => {
  if (!override) return base;
  if (!base) return override;
  return { ...base, ...override };
};

/** 2-way / N 構成のモデルを構成の配列に正規化します(純関数)。2-way は id が 'left' / 'right'。 */
export const normalizeLayoutSides = <T,>(
  model: ComparisonLayoutModel<T>,
): ComparisonLayoutSide<T>[] => {
  if (isMultiModel(model)) {
    return model.sides.map((side) => ({
      id: side.id,
      rows: side.visibleRows,
      diffs: side.diffs,
      placeholderRows: side.placeholderRows,
    }));
  }
  return [
    {
      id: 'left',
      rows: model.visibleLeft,
      diffs: model.leftDiffs,
      placeholderRows: model.placeholders?.left,
      contextRows: model.contextRows?.left,
      descendantDiffCounts: model.descendantDiffCounts?.left,
    },
    {
      id: 'right',
      rows: model.visibleRight,
      diffs: model.rightDiffs,
      placeholderRows: model.placeholders?.right,
      contextRows: model.contextRows?.right,
      descendantDiffCounts: model.descendantDiffCounts?.right,
    },
  ];
};
