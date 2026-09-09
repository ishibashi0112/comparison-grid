// 例 05: 4 構成を 2×2 に並べ、スクロール同期グループを差分ジャンプと共有する。
//   - 配置は Root の style(または .cmpg-view の CSS 上書き)で決める。ライブラリは配置を固定しない。
//   - useComparisonScrollSyncGroup で作ったグループを Root に注入すると、各 Grid がハンドルを登録する。
//     useMultiComparisonNavigation({ getHandle: group.getHandle }) でそのハンドルを使ってスクロールできる。
import {
  ComparisonLayout,
  useComparisonScrollSyncGroup,
  useMultiComparison,
  useMultiComparisonNavigation,
} from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css';
import { COLUMNS, COMPARE_FIELDS, CURRENT, PLAN_A, PLAN_B, getMatchKey, type Part } from './data';

const SIDES = [
  { id: 'current', rows: CURRENT, label: '現行' },
  { id: 'planA', rows: PLAN_A, label: '案1' },
  { id: 'planB', rows: PLAN_B, label: '案2' },
  { id: 'planC', rows: PLAN_A.slice(0, 3), label: '案3' },
];

export function Grid2x2NavigationExample() {
  const comparison = useMultiComparison<Part>({
    sides: SIDES,
    getMatchKey,
    compareFields: COMPARE_FIELDS,
    alignRows: true,
  });
  const group = useComparisonScrollSyncGroup<Part>({ enabled: true });
  const navigation = useMultiComparisonNavigation<Part>({
    comparison,
    alignRows: true,
    getHandle: group.getHandle,
  });

  return (
    <section>
      <button type="button" onClick={navigation.goToPreviousDiff} disabled={!navigation.canNavigate}>
        ◀ 前の差分
      </button>
      <button type="button" onClick={navigation.goToNextDiff} disabled={!navigation.canNavigate}>
        次の差分 ▶
      </button>
      <span>
        {navigation.activeDiffIndex >= 0
          ? `${navigation.activeDiffIndex + 1} / ${navigation.diffCount}`
          : `差分 ${navigation.diffCount} 件`}
      </span>
      <ComparisonLayout.Root<Part>
        comparison={comparison}
        columns={COLUMNS}
        keyColumnKeys={['itemCode']}
        scrollSyncGroup={group}
        gridProps={{ height: 240 }}
        // 2×2: 既定の「子の数だけ横並び」を、2 カラム × 行方向へ流す指定で上書きする。
        style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoFlow: 'row' }}
      >
        {comparison.sides.map((side) => (
          <ComparisonLayout.Pane key={side.id} side={side.id}>
            <ComparisonLayout.Header>{side.label}</ComparisonLayout.Header>
            <ComparisonLayout.Grid<Part> />
          </ComparisonLayout.Pane>
        ))}
      </ComparisonLayout.Root>
    </section>
  );
}
