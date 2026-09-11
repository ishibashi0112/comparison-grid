// getComparisonExportData の単体テストです(node 環境)。
import { describe, it, expect } from 'vitest';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { compare } from './compare';
import { alignComparisonRows } from './alignRows';
import { getComparisonExportData } from './exportData';
import type { CompareField } from '../model/types';

type Row = { id: string; qty: number; note?: string };
const row = (id: string, qty: number): Row => ({ id, qty });
const getMatchKey = (r: Row) => r.id;
const compareFields: CompareField<Row>[] = [{ key: 'qty', label: '数量' }];

// left: A(same) / B(qty 差分) / C(left-only)。right: A / B / D(right-only)。
const left = [row('A', 1), row('B', 1), row('C', 1)];
const right = [row('A', 1), row('B', 2), row('D', 1)];
const result = compare(left, right, { getMatchKey, compareFields });

const columns: GridColumn<Row>[] = [
  { key: 'id', title: 'ID', width: 80 },
  { key: 'qty', width: 80, valueFormatter: ({ value }) => `${String(value)} 個` },
  { key: 'double', title: '2 倍', width: 80, getValue: (r) => r.qty * 2 },
  { key: 'hidden', title: '非表示', width: 80, visible: false },
];

describe('getComparisonExportData', () => {
  it('value は getValue ?? row[key]、text は valueFormatter ?? String(value ?? "")、見出しは title ?? key', () => {
    const data = getComparisonExportData<Row>({
      rows: left,
      diffs: result.leftDiffs,
      columns,
      showDiffLabelColumn: false,
    });
    expect(data.columns).toEqual([
      { key: 'id', title: 'ID' },
      { key: 'qty', title: 'qty' },
      { key: 'double', title: '2 倍' },
    ]);
    expect(data.rows[1]).toEqual([
      { value: 'B', text: 'B' },
      { value: 1, text: '1 個' },
      { value: 2, text: '2' },
    ]);
    // note は列に無い / hidden は visible: false で除外される。
    expect(data.rows[0]).toHaveLength(3);
  });

  it('差分ラベル列は既定で末尾に含まれ、ラベルが text になる', () => {
    const data = getComparisonExportData<Row>({
      rows: left,
      diffs: result.leftDiffs,
      columns: columns.slice(0, 1),
    });
    expect(data.columns).toEqual([
      { key: 'id', title: 'ID' },
      { key: 'cmpgDiffLabel', title: '差分' },
    ]);
    expect(data.rows.map((cells) => cells[1].text)).toEqual(['', '数量違い', '左のみ']);
  });

  it('diffLabelColumn で見出し / 位置を調整できる', () => {
    const data = getComparisonExportData<Row>({
      rows: right,
      diffs: result.rightDiffs,
      columns: columns.slice(0, 1),
      diffLabelColumn: { title: '変更箇所', position: 'start' },
    });
    expect(data.columns[0]).toEqual({ key: 'cmpgDiffLabel', title: '変更箇所' });
    expect(data.rows.map((cells) => cells[0].text)).toEqual(['', '数量違い', '右のみ']);
  });

  it('整列済み配列を渡すと対順になり、プレースホルダ行は全セル空になる', () => {
    const aligned = alignComparisonRows(result.annotatedLeft, result.annotatedRight);
    const rightRows = aligned.pairs.map((pair) => pair.right);
    const data = getComparisonExportData<Row>({
      rows: rightRows,
      diffs: result.rightDiffs,
      columns: columns.slice(0, 2),
    });
    // 右側の対順: A / B / プレースホルダ(C の相手)/ D。
    expect(data.rows.map((cells) => cells[0].text)).toEqual(['A', 'B', '', 'D']);
    expect(data.rows[2].every((cell) => cell.text === '')).toBe(true);
    expect(data.rows[2].every((cell) => cell.value === undefined || cell.value === '')).toBe(true);
  });

  it('excludeRows にプレースホルダの Set を渡すと、その行が出力から行ごと除かれる', () => {
    const aligned = alignComparisonRows(result.annotatedLeft, result.annotatedRight);
    const rightRows = aligned.pairs.map((pair) => pair.right);
    const data = getComparisonExportData<Row>({
      rows: rightRows,
      diffs: result.rightDiffs,
      columns: columns.slice(0, 2),
      excludeRows: aligned.placeholders.right,
    });
    expect(data.rows.map((cells) => cells[0].text)).toEqual(['A', 'B', 'D']);
    // 空の Set なら従来どおり。
    const unchanged = getComparisonExportData<Row>({
      rows: rightRows,
      diffs: result.rightDiffs,
      columns: columns.slice(0, 2),
      excludeRows: new Set(),
    });
    expect(unchanged.rows).toHaveLength(4);
  });
});

describe('getComparisonExportData: 木モードのロールアップ', () => {
  it('descendantDiffCounts を渡すと、ラベルが空で配下に差分がある行に配下差分ラベルが入る', () => {
    const counts: ReadonlyMap<Row, number> = new Map([[left[0], 3]]);
    const data = getComparisonExportData<Row>({
      rows: left,
      diffs: result.leftDiffs,
      columns: [{ key: 'id', title: 'ID', width: 80 }],
      descendantDiffCounts: counts,
    });
    expect(data.rows.map((cells) => cells[1].text)).toEqual(['配下に差分 3 件', '数量違い', '左のみ']);
  });
});
