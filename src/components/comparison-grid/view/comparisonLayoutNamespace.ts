// 名前空間版(`<ComparisonLayout.Root>` / `.Pane` / `.Header` / `.Grid`)。名前付き export と同じ実体で、
//   tree-shaking のため主は名前付き export。JSX での型引数は `<ComparisonLayout.Root<Row> …>` と書ける。
import {
  ComparisonLayoutGrid,
  ComparisonLayoutHeader,
  ComparisonLayoutPane,
  ComparisonLayoutRoot,
} from './ComparisonLayout';

export const ComparisonLayout = {
  Root: ComparisonLayoutRoot,
  Pane: ComparisonLayoutPane,
  Header: ComparisonLayoutHeader,
  Grid: ComparisonLayoutGrid,
} as const;
