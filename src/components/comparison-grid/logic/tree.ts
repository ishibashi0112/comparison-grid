// 階層比較(木)の純ロジックです(React / グリッド非依存)。
//   - buildComparisonTree: 平坦な行(深さ優先順 + level / 隣接リスト)から ComparisonTreeNode<T>[] を組み立てます。
//     破綻(level の飛び / ID 重複 / 親未解決 / 循環)は修復せず、ベストエフォートで木を作って issues に報告します。
//   - flattenComparisonTree: 木を深さ優先順に平坦化し、行ごとの突き合わせキー(パス)と階層情報をサイドカー
//     (Map<行, ComparisonTreeInfo>)で返します。キーは「親のキー + 区切り + 自セグメント」で、セグメントは
//     代表コード(あれば)で置き換えるため、親の置き換えが子孫のキーへ自動で伝播します。
//     同じ親の下でセグメントが重複したときは出現順の '#n' を付けて区別し、compare() に重複キーを渡しません。
//   - collectCollapsedDescendants: 折りたたまれた行(matchKey が collapsedKeys に含まれる行)の子孫を集めます。
//   - 行 T には書き込みません。木のノードは T を包むだけで、T に children を要求しません。
import type {
  BuildComparisonTreeByLevelOptions,
  BuildComparisonTreeByParentOptions,
  BuildComparisonTreeOptions,
  BuildComparisonTreeResult,
  ComparisonTreeInfo,
  ComparisonTreeIssue,
  ComparisonTreeKeyOptions,
  ComparisonTreeNode,
  FlattenComparisonTreeResult,
} from '../model/types';

/** 突き合わせキー(パス)の既定の区切り。 */
export const DEFAULT_TREE_KEY_SEPARATOR = '/';
/** 同じ親の下でセグメントが重複したときに付ける出現番号の区切り(`B2002/C3003#1`)。 */
export const TREE_KEY_OCCURRENCE_SEPARATOR = '#';

type MutableNode<T> = {
  row: T;
  children: MutableNode<T>[];
  /** 入力上の行位置(issues の rowIndex 用)。 */
  index: number;
};

const toNode = <T>(row: T, index: number): MutableNode<T> => ({ row, children: [], index });

/** 内部ノードから index を落として公開型へ(children は共有)。 */
const toPublic = <T>(node: MutableNode<T>): ComparisonTreeNode<T> => ({
  row: node.row,
  children: node.children.map(toPublic),
});

const buildByLevel = <T>(
  rows: readonly T[],
  options: BuildComparisonTreeByLevelOptions<T>,
): BuildComparisonTreeResult<T> => {
  const { getLevel } = options;
  const roots: MutableNode<T>[] = [];
  const issues: ComparisonTreeIssue<T>[] = [];
  // stack[d] = 直近に現れた深さ d のノード。深さは先頭行の level を 0 とした相対値。
  const stack: MutableNode<T>[] = [];
  let rootLevel: number | undefined;

  rows.forEach((row, rowIndex) => {
    const level = getLevel(row);
    if (rootLevel === undefined) rootLevel = level;
    let depth = Math.trunc(level - rootLevel);
    if (!Number.isFinite(depth) || depth < 0) depth = 0;
    if (depth > stack.length) {
      issues.push({
        kind: 'level-jump',
        row,
        rowIndex,
        message: `level が直前の行より 2 段以上深い(level ${level})。直前の行の子として扱います。`,
      });
      depth = stack.length;
    }
    const node = toNode(row, rowIndex);
    if (depth === 0) roots.push(node);
    else stack[depth - 1].children.push(node);
    stack.length = depth;
    stack.push(node);
  });

  return { roots: roots.map(toPublic), issues };
};

const isRootParentId = (parentId: string | null | undefined): parentId is null | undefined | '' =>
  parentId === null || parentId === undefined || parentId === '';

const buildByParent = <T>(
  rows: readonly T[],
  options: BuildComparisonTreeByParentOptions<T>,
): BuildComparisonTreeResult<T> => {
  const { getId, getParentId } = options;
  const issues: ComparisonTreeIssue<T>[] = [];
  const nodes = rows.map(toNode);

  // ID → ノード。重複 ID は最初の行に解決し、以降の行を報告する(品番を ID に渡した典型的な破綻)。
  const nodeById = new Map<string, MutableNode<T>>();
  nodes.forEach((node) => {
    const id = getId(node.row);
    if (nodeById.has(id)) {
      issues.push({
        kind: 'duplicate-id',
        row: node.row,
        rowIndex: node.index,
        message: `ID "${id}" が重複しています(getId に品番を渡していませんか)。親の参照は最初の行へ解決されます。`,
      });
      return;
    }
    nodeById.set(id, node);
  });

  // 親リンクの解決。親が見つからない行はルート扱い。
  const parentOf = new Map<MutableNode<T>, MutableNode<T>>();
  nodes.forEach((node) => {
    const parentId = getParentId(node.row);
    if (isRootParentId(parentId)) return;
    const parent = nodeById.get(parentId);
    if (!parent) {
      issues.push({
        kind: 'missing-parent',
        row: node.row,
        rowIndex: node.index,
        message: `親 ID "${parentId}" の行が見つかりません。ルート行として扱います。`,
      });
      return;
    }
    parentOf.set(node, parent);
  });

  // 循環の検出。親を辿って訪問中のノードへ戻ったらそこでリンクを切り、ルート扱いにする。
  const state = new Map<MutableNode<T>, 'visiting' | 'done'>();
  for (const start of nodes) {
    const path: MutableNode<T>[] = [];
    let current: MutableNode<T> | undefined = start;
    while (current !== undefined && state.get(current) !== 'done') {
      if (state.get(current) === 'visiting') {
        parentOf.delete(current);
        issues.push({
          kind: 'cycle',
          row: current.row,
          rowIndex: current.index,
          message: `親の参照が循環しています(ID "${getId(current.row)}")。この行をルート行として扱います。`,
        });
        break;
      }
      state.set(current, 'visiting');
      path.push(current);
      current = parentOf.get(current);
    }
    for (const visited of path) state.set(visited, 'done');
  }

  // 組み立て。兄弟順・ルート順は入力順。
  const roots: MutableNode<T>[] = [];
  for (const node of nodes) {
    const parent = parentOf.get(node);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return { roots: roots.map(toPublic), issues };
};

/** 平坦な行から木を組み立てます(純関数)。
 *  - `{ getLevel }`: 深さ優先順 + level(BOM 展開 API の典型)。ID は不要。
 *  - `{ getId, getParentId }`: 隣接リスト。ID は**出現ごとに一意な行 ID**を渡すこと(品番は不可)。
 *  破綻は修復せず、ベストエフォートの木と issues を返します(投げません)。 */
export function buildComparisonTree<T>(
  rows: readonly T[],
  options: BuildComparisonTreeOptions<T>,
): BuildComparisonTreeResult<T> {
  return 'getLevel' in options ? buildByLevel(rows, options) : buildByParent(rows, options);
}

/** 木を深さ優先順に平坦化し、行ごとの突き合わせキーと階層情報をサイドカーで返します(純関数)。 */
export function flattenComparisonTree<T>(
  roots: readonly ComparisonTreeNode<T>[],
  options: ComparisonTreeKeyOptions<T>,
): FlattenComparisonTreeResult<T> {
  const { getCode, getRepresentativeCode, separator = DEFAULT_TREE_KEY_SEPARATOR } = options;
  const rows: T[] = [];
  const infos = new Map<T, ComparisonTreeInfo<T>>();

  const visit = (
    nodes: readonly ComparisonTreeNode<T>[],
    parent: T | undefined,
    parentKey: string | undefined,
    depth: number,
  ) => {
    // 同じ親の下でのセグメントの出現回数(重複の区別用)。
    const seen = new Map<string, number>();
    for (const node of nodes) {
      const representative = getRepresentativeCode?.(node.row);
      const segment = representative ? representative : getCode(node.row);
      const occurrence = seen.get(segment) ?? 0;
      seen.set(segment, occurrence + 1);
      const keySegment =
        occurrence > 0 ? `${segment}${TREE_KEY_OCCURRENCE_SEPARATOR}${occurrence}` : segment;
      const matchKey = parentKey === undefined ? keySegment : `${parentKey}${separator}${keySegment}`;
      const children = node.children ?? [];
      rows.push(node.row);
      infos.set(node.row, {
        depth,
        parent,
        hasChildren: children.length > 0,
        occurrence,
        matchKey,
      });
      visit(children, node.row, matchKey, depth + 1);
    }
  };
  visit(roots, undefined, undefined, 0);

  return { rows, infos };
}

/** 折りたたまれた行(matchKey が collapsedKeys に含まれる行)の子孫を集めます(純関数)。
 *  rows が深さ優先順(親が子より先)であることを利用して 1 パスで判定します。折りたたんだ行自身は含めません。 */
export function collectCollapsedDescendants<T>(
  flattened: FlattenComparisonTreeResult<T>,
  collapsedKeys: ReadonlySet<string>,
): Set<T> {
  const hidden = new Set<T>();
  if (collapsedKeys.size === 0) return hidden;
  const { rows, infos } = flattened;
  for (const row of rows) {
    const parent = infos.get(row)?.parent;
    if (parent === undefined) continue;
    const parentKey = infos.get(parent)?.matchKey;
    if (hidden.has(parent) || (parentKey !== undefined && collapsedKeys.has(parentKey))) {
      hidden.add(row);
    }
  }
  return hidden;
}
