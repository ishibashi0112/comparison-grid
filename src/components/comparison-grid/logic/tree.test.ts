// 階層比較の純ロジック(buildComparisonTree / flattenComparisonTree)の単体テストです(node 環境)。
//   - 平坦な行(level 順 / 隣接リスト)からの木の組み立てと、破綻の検出(修復せず報告)
//   - 木からのキー導出: パス / 代表コードの子孫への伝播 / 兄弟重複の '#n'
//   - 「同じサブ ASSY が 2 箇所で使われる」構成でも親違いの子が突き合わないこと(compare() との結合)
import { describe, it, expect } from 'vitest';
import { buildComparisonTree, flattenComparisonTree } from './tree';
import { compare } from './compare';
import type { ComparisonTreeNode } from '../model/types';

type Row = { id: string; code: string; level: number; parentId?: string | null; repr?: string; qty?: number };
const row = (code: string, level: number, extra: Partial<Row> = {}): Row => ({
  id: extra.id ?? code,
  code,
  level,
  ...extra,
});
const getLevel = (r: Row) => r.level;
const getCode = (r: Row) => r.code;
const getId = (r: Row) => r.id;
const getParentId = (r: Row) => r.parentId;

/** 木を「コード(子...)」の文字列に落として構造を比較しやすくする。 */
const shape = (nodes: readonly ComparisonTreeNode<Row>[]): string =>
  nodes
    .map((node) => {
      const children = node.children ?? [];
      return children.length > 0 ? `${node.row.code}(${shape(children)})` : node.row.code;
    })
    .join(',');

describe('buildComparisonTree: level 順(展開結果)', () => {
  it('深さ優先順 + level から親子を復元する(1 始まりの level)', () => {
    const rows = [row('A', 1), row('B', 2), row('C', 3), row('D', 2), row('E', 1)];
    const { roots, issues } = buildComparisonTree(rows, { getLevel });
    expect(shape(roots)).toBe('A(B(C),D),E');
    expect(issues).toEqual([]);
  });

  it('level は先頭行を基準の相対値で扱う(0 始まりでも同じ木になる)', () => {
    const rows = [row('A', 0), row('B', 1), row('C', 2), row('D', 1)];
    expect(shape(buildComparisonTree(rows, { getLevel }).roots)).toBe('A(B(C),D)');
    const from5 = [row('A', 5), row('B', 6), row('C', 7), row('D', 6)];
    expect(shape(buildComparisonTree(from5, { getLevel }).roots)).toBe('A(B(C),D)');
  });

  it('level が 2 段以上飛んだ行は直前の行の子として扱い、level-jump を報告する', () => {
    const rows = [row('A', 1), row('B', 3), row('C', 2)];
    const { roots, issues } = buildComparisonTree(rows, { getLevel });
    expect(shape(roots)).toBe('A(B,C)');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'level-jump', row: rows[1], rowIndex: 1 });
    expect(issues[0].message).toContain('level 3');
  });

  it('先頭行より浅い行はルート扱い(報告しない)', () => {
    const rows = [row('A', 2), row('B', 3), row('C', 1)];
    const { roots, issues } = buildComparisonTree(rows, { getLevel });
    expect(shape(roots)).toBe('A(B),C');
    expect(issues).toEqual([]);
  });

  it('空配列は空の木', () => {
    expect(buildComparisonTree([], { getLevel })).toEqual({ roots: [], issues: [] });
  });
});

describe('buildComparisonTree: 隣接リスト(行 ID + 親 ID)', () => {
  it('親 ID から親子を復元し、兄弟順は入力順になる', () => {
    const rows = [
      row('A', 1, { id: '1', parentId: null }),
      row('D', 2, { id: '4', parentId: '1' }),
      row('B', 2, { id: '2', parentId: '1' }),
      row('C', 3, { id: '3', parentId: '2' }),
      row('E', 1, { id: '5', parentId: '' }),
    ];
    const { roots, issues } = buildComparisonTree(rows, { getId, getParentId });
    expect(shape(roots)).toBe('A(D,B(C)),E');
    expect(issues).toEqual([]);
  });

  it('親 ID が見つからない行はルート扱いで missing-parent を報告する', () => {
    const rows = [row('A', 1, { id: '1' }), row('B', 2, { id: '2', parentId: '99' })];
    const { roots, issues } = buildComparisonTree(rows, { getId, getParentId });
    expect(shape(roots)).toBe('A,B');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-parent', row: rows[1], rowIndex: 1 });
  });

  it('ID が重複した場合(品番を ID に渡した典型)は最初の行へ解決し、duplicate-id を報告する', () => {
    // 同じサブ ASSY B2002 が 2 箇所に出現し、子が親を「品番」で指している。
    const rows = [
      row('B2100', 1, { id: 'B2100' }),
      row('B2002', 2, { id: 'B2002', parentId: 'B2100' }),
      row('C3001', 3, { id: 'C3001', parentId: 'B2002' }),
      row('B2200', 1, { id: 'B2200' }),
      row('B2002', 2, { id: 'B2002', parentId: 'B2200' }),
      row('C3001', 3, { id: 'C3001', parentId: 'B2002' }),
    ];
    const { roots, issues } = buildComparisonTree(rows, { getId, getParentId });
    // 子 C3001 は両方とも「最初の B2002」へ寄るため木は歪む(2 つ目の B2002 は親 B2200 の下に残る)。
    //   issues で必ず分かる。
    expect(shape(roots)).toBe('B2100(B2002(C3001,C3001)),B2200(B2002)');
    expect(issues.map((issue) => issue.kind)).toEqual(['duplicate-id', 'duplicate-id']);
    expect(issues[0]).toMatchObject({ row: rows[4], rowIndex: 4 });
    expect(issues[0].message).toContain('B2002');
  });

  it('親の参照が循環している場合はリンクを切ってルート扱いにし、cycle を報告する', () => {
    const rows = [
      row('A', 1, { id: '1', parentId: '3' }),
      row('B', 2, { id: '2', parentId: '1' }),
      row('C', 3, { id: '3', parentId: '2' }),
      row('D', 1, { id: '4', parentId: '1' }),
    ];
    const { roots, issues } = buildComparisonTree(rows, { getId, getParentId });
    expect(shape(roots)).toBe('A(B(C),D)');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'cycle', row: rows[0], rowIndex: 0 });
  });

  it('自分自身を親に指す行もルート扱い(cycle)', () => {
    const rows = [row('A', 1, { id: '1', parentId: '1' })];
    const { roots, issues } = buildComparisonTree(rows, { getId, getParentId });
    expect(shape(roots)).toBe('A');
    expect(issues[0]?.kind).toBe('cycle');
  });
});

describe('flattenComparisonTree: キー導出と階層情報', () => {
  const build = (rows: Row[]) => buildComparisonTree(rows, { getLevel }).roots;

  it('深さ優先順に平坦化し、キーは親のキー + 区切り + 自コードになる', () => {
    const rows = [row('A', 1), row('B', 2), row('C', 3), row('D', 2)];
    const { rows: flat, infos } = flattenComparisonTree(build(rows), { getCode });
    expect(flat).toEqual(rows);
    expect(flat.map((r) => infos.get(r)?.matchKey)).toEqual(['A', 'A/B', 'A/B/C', 'A/D']);
    expect(infos.get(rows[0])).toMatchObject({ depth: 0, parent: undefined, hasChildren: true, occurrence: 0 });
    expect(infos.get(rows[2])).toMatchObject({ depth: 2, parent: rows[1], hasChildren: false });
  });

  it('区切りを変えられる', () => {
    const rows = [row('A', 1), row('B', 2)];
    const { infos } = flattenComparisonTree(build(rows), { getCode, separator: ' > ' });
    expect(infos.get(rows[1])?.matchKey).toBe('A > B');
  });

  it('代表コードは自セグメントを置き換え、子孫のキーへ伝播する', () => {
    // 親 B2004(代表 B2003)の子 X: 代表コードモードでは B2003/X になる。
    const rows = [row('B2004', 1, { repr: 'B2003' }), row('X', 2), row('Y', 3)];
    const { infos } = flattenComparisonTree(build(rows), {
      getCode,
      getRepresentativeCode: (r) => r.repr,
    });
    expect(rows.map((r) => infos.get(r)?.matchKey)).toEqual(['B2003', 'B2003/X', 'B2003/X/Y']);
  });

  it('代表コードが空 / null / undefined なら自コードを使う', () => {
    const rows = [row('A', 1, { repr: '' }), row('B', 2, { repr: undefined })];
    const { infos } = flattenComparisonTree(build(rows), {
      getCode,
      getRepresentativeCode: (r) => (r.code === 'B' ? null : r.repr),
    });
    expect(rows.map((r) => infos.get(r)?.matchKey)).toEqual(['A', 'A/B']);
  });

  it('同じ親の下の同じセグメントは出現順の #n で区別する(別の親の下なら付かない)', () => {
    const rows = [row('A', 1), row('N', 2), row('N', 2), row('N', 2), row('B', 1), row('N', 2)];
    const { infos } = flattenComparisonTree(build(rows), { getCode });
    expect(rows.map((r) => infos.get(r)?.matchKey)).toEqual(['A', 'A/N', 'A/N#1', 'A/N#2', 'B', 'B/N']);
    expect(rows.map((r) => infos.get(r)?.occurrence)).toEqual([0, 0, 1, 2, 0, 0]);
  });

  it('children が無いノードも受け付ける(手書きの木)', () => {
    const a = row('A', 1);
    const b = row('B', 2);
    const tree: ComparisonTreeNode<Row>[] = [{ row: a, children: [{ row: b }] }];
    const { rows: flat, infos } = flattenComparisonTree(tree, { getCode });
    expect(flat).toEqual([a, b]);
    expect(infos.get(b)?.matchKey).toBe('A/B');
  });
});

describe('木のキー + compare(): 親違いの同品番は突き合わない', () => {
  const keyed = (rows: Row[], repr = false) =>
    flattenComparisonTree(buildComparisonTree(rows, { getLevel }).roots, {
      getCode,
      getRepresentativeCode: repr ? (r) => r.repr : undefined,
    });
  const compareTrees = (left: Row[], right: Row[], repr = false) => {
    const flatLeft = keyed(left, repr);
    const flatRight = keyed(right, repr);
    const getMatchKey = (r: Row) =>
      flatLeft.infos.get(r)?.matchKey ?? flatRight.infos.get(r)?.matchKey ?? r.code;
    return compare(flatLeft.rows, flatRight.rows, {
      getMatchKey,
      compareFields: [{ key: 'qty', label: '数量' }],
    });
  };

  it('同じサブ ASSY が 2 箇所で使われていても、各出現は自分の親の下の相手とだけ突き合う', () => {
    const left = [
      row('B2100', 1), row('B2002', 2), row('C3001', 3, { qty: 1 }),
      row('B2200', 1), row('B2002', 2), row('C3001', 3, { qty: 1 }),
    ];
    const right = [
      row('B2100', 1), row('B2002', 2), row('C3001', 3, { qty: 1 }),
      row('B2200', 1), row('B2002', 2), row('C3001', 3, { qty: 5 }),
    ];
    const result = compare_(left, right);
    expect(result.annotatedLeft.map((e) => e.diff.kind)).toEqual([
      'same', 'same', 'same', 'same', 'same', 'field-diff',
    ]);
    expect(result.annotatedLeft[5].diff.counterpart).toBe(right[5]);
    expect(result.duplicateKeys).toEqual({ left: [], right: [] });

    function compare_(l: Row[], r: Row[]) {
      return compareTrees(l, r);
    }
  });

  it('親が違えば同じ品番の子でも別キー(左のみ + 右のみ)になる', () => {
    const left = [row('B2002', 1), row('C3001', 2)];
    const right = [row('B2004', 1), row('C3001', 2)];
    const result = compareTrees(left, right);
    expect(result.annotatedLeft.map((e) => e.diff.kind)).toEqual(['left-only', 'left-only']);
    expect(result.annotatedRight.map((e) => e.diff.kind)).toEqual(['right-only', 'right-only']);
  });

  it('代表コードで親が突き合えば、子も伝播したキーで突き合う', () => {
    const left = [row('B2003', 1), row('X', 2, { qty: 1 })];
    const right = [row('B2004', 1, { repr: 'B2003' }), row('X', 2, { qty: 2 })];
    expect(compareTrees(left, right).annotatedLeft.map((e) => e.diff.kind)).toEqual([
      'left-only',
      'left-only',
    ]);
    const result = compareTrees(left, right, true);
    expect(result.annotatedLeft.map((e) => e.diff.kind)).toEqual(['same', 'field-diff']);
    expect(result.annotatedLeft[1].diff.counterpart).toBe(right[1]);
  });
});
