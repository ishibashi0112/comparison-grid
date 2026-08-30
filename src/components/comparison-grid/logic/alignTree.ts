// 木モードの左右整列(構造マージ)の純ロジックです(React / グリッド非依存)。
//   平坦な alignComparisonRows は「左の行順 → 右のみは末尾」ですが、木では兄弟リスト単位で対を作り、
//   右にしか無いサブツリーを**直前に対になった兄弟の直後**へ挿入します(先行する対が無い右のみは
//   最初の対の直前、対が 1 つも無ければ末尾 = 平坦な alignComparisonRows と同じ)。
//   ASSY の中に追加された部品がその ASSY の直下に並び、左右の親子関係が崩れません。
//   - 対の判定は compare() の counterpart(leftDiffs)を使い、同じ兄弟リストに居る相手だけを対にします
//     (キーがパスなら相手は必ず同じ兄弟リストに居る。別の場所に居る相手は片側のみとして扱う)。
//   - 片側のみのサブツリーは丸ごと相手側プレースホルダと組みます。
//   - プレースホルダの扱いは alignComparisonRows と同じ(行ごとに新しいオブジェクト・同一性で判定)。
import type {
  AlignComparisonRowsOptions,
  AlignComparisonRowsResult,
  ComparisonAlignedPair,
  ComparisonDiffMap,
  ComparisonSide,
  ComparisonTreeNode,
} from '../model/types';

const defaultCreatePlaceholderRow = <T>(): T => ({}) as T;
const EMPTY_NODES: readonly never[] = [];

/** 左右の木を構造マージで整列し、欠損側へプレースホルダ行を挿入します(純関数)。 */
export function alignComparisonTree<T>(
  left: readonly ComparisonTreeNode<T>[],
  right: readonly ComparisonTreeNode<T>[],
  leftDiffs: ComparisonDiffMap<T>,
  options?: AlignComparisonRowsOptions<T>,
): AlignComparisonRowsResult<T> {
  const createPlaceholderRow = options?.createPlaceholderRow ?? defaultCreatePlaceholderRow;
  const pairs: ComparisonAlignedPair<T>[] = [];
  const leftPlaceholders = new Set<T>();
  const rightPlaceholders = new Set<T>();

  const placeholder = (side: ComparisonSide): T => {
    const row = createPlaceholderRow(side);
    (side === 'left' ? leftPlaceholders : rightPlaceholders).add(row);
    return row;
  };

  const pushLeftOnly = (node: ComparisonTreeNode<T>) => {
    pairs.push({ left: node.row, right: placeholder('right') });
    for (const child of node.children ?? EMPTY_NODES) pushLeftOnly(child);
  };
  const pushRightOnly = (node: ComparisonTreeNode<T>) => {
    pairs.push({ left: placeholder('left'), right: node.row });
    for (const child of node.children ?? EMPTY_NODES) pushRightOnly(child);
  };

  const merge = (
    leftNodes: readonly ComparisonTreeNode<T>[],
    rightNodes: readonly ComparisonTreeNode<T>[],
  ) => {
    const rightNodeByRow = new Map<T, ComparisonTreeNode<T>>();
    for (const node of rightNodes) rightNodeByRow.set(node.row, node);
    const consumed = new Set<ComparisonTreeNode<T>>();

    // 1. 左の兄弟順に相手を確定する(同じ兄弟リストに居る未消費の counterpart だけ)。
    const matched = leftNodes.map((leftNode) => {
      const counterpart = leftDiffs.get(leftNode.row)?.counterpart;
      const rightNode = counterpart !== undefined ? rightNodeByRow.get(counterpart) : undefined;
      if (!rightNode || consumed.has(rightNode)) return undefined;
      consumed.add(rightNode);
      return rightNode;
    });

    // 2. 対にならなかった右の兄弟を「右の順で直前に対になった兄弟」に紐づける(無ければ先頭)。
    const trailing = new Map<ComparisonTreeNode<T> | null, ComparisonTreeNode<T>[]>();
    let anchor: ComparisonTreeNode<T> | null = null;
    for (const rightNode of rightNodes) {
      if (consumed.has(rightNode)) {
        anchor = rightNode;
        continue;
      }
      const bucket = trailing.get(anchor);
      if (bucket) bucket.push(rightNode);
      else trailing.set(anchor, [rightNode]);
    }

    // 3. 出力: 左順に(対 + その子のマージ + 対の直後に来る右のみ)/ 左のみサブツリー。
    //    先行する対が無い右のみは最初の対の直前(対が無ければ末尾)に置く。
    let leadingEmitted = false;
    const emitLeading = () => {
      if (leadingEmitted) return;
      leadingEmitted = true;
      for (const rightNode of trailing.get(null) ?? EMPTY_NODES) pushRightOnly(rightNode);
    };
    leftNodes.forEach((leftNode, index) => {
      const rightNode = matched[index];
      if (!rightNode) {
        pushLeftOnly(leftNode);
        return;
      }
      emitLeading();
      pairs.push({ left: leftNode.row, right: rightNode.row });
      merge(leftNode.children ?? EMPTY_NODES, rightNode.children ?? EMPTY_NODES);
      for (const only of trailing.get(rightNode) ?? EMPTY_NODES) pushRightOnly(only);
    });
    emitLeading();
  };
  merge(left, right);

  return {
    pairs,
    placeholders: { left: leftPlaceholders, right: rightPlaceholders },
  };
}
