// 例 02: 階層比較(部品表の木)。平坦な展開結果 → buildComparisonTree で木 → useTreeComparison。
//   - 突き合わせキーはライブラリがパス(B2002/C3001)として導出するので、別の親の下の同じ品番は突き合わない。
//   - 折りたたみは collapsedKeys(パスキーの Set)を利用側 state で持つ。1 つのキーで両ペインの対が畳まれる。
//   - 「差分のみ」では差分行の祖先が文脈行(.cmpg-row-context)として残り、配下に差分がある親は
//     .cmpg-row-rollup + 差分ラベル列の「配下に差分 n 件」になる。
import { useCallback, useMemo, useState } from 'react';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { ComparisonView, buildComparisonTree, useTreeComparison } from '@ishibashi0112/comparison-grid';
import '@ishibashi0112/comparison-grid/style.css';
import { COLUMNS, COMPARE_FIELDS, CURRENT, PLAN_A, type Part } from './data';

const getLevel = (row: Part) => row.level;
const getCode = (row: Part) => row.itemCode;

export function TreeComparisonExample() {
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const toggleCollapsed = useCallback((key: string) => {
    setCollapsedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 木は useMemo で組む(buildComparisonTree は毎回新しい木を返す)。破綻は issues に報告される(修復はしない)。
  const leftTree = useMemo(() => buildComparisonTree(CURRENT, { getLevel }), []);
  const rightTree = useMemo(() => buildComparisonTree(PLAN_A, { getLevel }), []);

  const comparison = useTreeComparison<Part>({
    left: leftTree.roots,
    right: rightTree.roots,
    getCode,
    compareFields: COMPARE_FIELDS,
    showDiffOnly,
    alignRows: true,
    collapsedKeys,
  });

  // Level 列: 深さでインデントし、子を持つ行に展開ボタンを出す(getTreeInfo / isCollapsed は比較結果のアクセサ)。
  const { getTreeInfo, isCollapsed } = comparison;
  const columns = useMemo<GridColumn<Part>[]>(
    () => [
      {
        key: 'level',
        title: 'Level',
        width: 80,
        renderCell: ({ row }) => {
          const info = getTreeInfo(row);
          if (!info) return null; // 整列のプレースホルダ行は階層情報を持たない
          return (
            <span style={{ paddingLeft: info.depth * 12 }}>
              {info.hasChildren ? (
                <button type="button" onClick={() => toggleCollapsed(info.matchKey)}>
                  {isCollapsed(row) ? '▸' : '▾'}
                </button>
              ) : null}
              {row.level}
            </span>
          );
        },
      },
      ...COLUMNS,
    ],
    [getTreeInfo, isCollapsed, toggleCollapsed],
  );

  return (
    <section>
      <label>
        <input
          type="checkbox"
          checked={comparison.effectiveShowDiffOnly}
          disabled={!comparison.canShowDiffOnly}
          onChange={(event) => setShowDiffOnly(event.target.checked)}
        />
        差分のみ(祖先は文脈行として残る)
      </label>
      {leftTree.issues.length + rightTree.issues.length > 0 ? (
        <p>{`階層の問題 ${leftTree.issues.length + rightTree.issues.length} 件`}</p>
      ) : null}
      <ComparisonView<Part>
        comparison={comparison}
        columns={columns}
        keyColumnKeys={['itemCode']}
        showDiffLabelColumn
        enableScrollSync
        gridProps={{ height: 320 }}
      />
    </section>
  );
}
