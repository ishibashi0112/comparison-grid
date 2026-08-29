// 列定義 / 行クラスの合成ロジックの単体テストです(node 環境)。
import { describe, it, expect } from 'vitest';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { compare } from './compare';
import {
  CMPG_CLASS_NAMES,
  DEFAULT_DIFF_LABEL_COLUMN_KEY,
  composeColumns,
  composeRowClassName,
  getDiffCellClassName,
  getDiffRowClassName,
  insertDiffLabelColumn,
} from './paneColumns';
import type { CompareField, GridCellStyleContext } from '../model/types';

type Row = { id: string; qty: number; kbn: string };
const row = (id: string, qty: number, kbn = '無'): Row => ({ id, qty, kbn });

const compareFields: CompareField<Row>[] = [
  { key: 'qty', label: '数量' },
  { key: 'kbn', label: '支給区分' },
];

// left: A(same) / B(qty 差分) / C(left-only)。right: A / B / D(right-only)。
const left = [row('A', 1), row('B', 1), row('C', 1)];
const right = [row('A', 1), row('B', 2), row('D', 1)];
const result = compare(left, right, { getMatchKey: (r) => r.id, compareFields });

const columns: GridColumn<Row>[] = [
  { key: 'id', title: 'ID', width: 80 },
  { key: 'qty', title: '数量', width: 80 },
  { key: 'kbn', title: '支給', width: 80 },
  { key: 'note', title: '備考', width: 80 },
];

const ctxOf = (r: Row, column: GridColumn<Row>): GridCellStyleContext<Row> => ({
  row: r,
  rowIndex: 0,
  sourceRowIndex: 0,
  rowKey: 0,
  colIndex: 0,
  value: undefined,
  column,
  isActive: false,
  isSelected: false,
  isEditing: false,
  readOnly: false,
});

const cellClass = (col: GridColumn<Row>, r: Row): string | undefined => {
  const fn = col.cellClassName;
  return typeof fn === 'function' ? fn(ctxOf(r, col)) : fn;
};

describe('getDiffRowClassName / getDiffCellClassName', () => {
  it('行クラスは same / 未知の行では undefined、それ以外は種別修飾子つき', () => {
    expect(getDiffRowClassName(undefined)).toBeUndefined();
    expect(getDiffRowClassName(result.leftDiffs.get(left[0]))).toBeUndefined();
    expect(getDiffRowClassName(result.leftDiffs.get(left[1]))).toBe(
      `${CMPG_CLASS_NAMES.rowDiff} ${CMPG_CLASS_NAMES.rowFieldDiff}`,
    );
    expect(getDiffRowClassName(result.leftDiffs.get(left[2]))).toBe(
      `${CMPG_CLASS_NAMES.rowDiff} ${CMPG_CLASS_NAMES.rowLeftOnly}`,
    );
    expect(getDiffRowClassName(result.rightDiffs.get(right[2]))).toBe(
      `${CMPG_CLASS_NAMES.rowDiff} ${CMPG_CLASS_NAMES.rowRightOnly}`,
    );
  });

  it('セルクラスはキー列 × only 行、フィールド列 × 該当差分でだけ付く', () => {
    const onlyDiff = result.leftDiffs.get(left[2]);
    const fieldDiff = result.leftDiffs.get(left[1]);
    expect(getDiffCellClassName(onlyDiff, { isKeyColumn: true })).toBe(
      `${CMPG_CLASS_NAMES.cellDiff} ${CMPG_CLASS_NAMES.cellKeyDiff}`,
    );
    expect(getDiffCellClassName(fieldDiff, { isKeyColumn: true })).toBeUndefined();
    expect(getDiffCellClassName(fieldDiff, { isKeyColumn: false, fieldKeys: ['qty'] })).toBe(
      `${CMPG_CLASS_NAMES.cellDiff} ${CMPG_CLASS_NAMES.cellFieldDiff}`,
    );
    expect(getDiffCellClassName(fieldDiff, { isKeyColumn: false, fieldKeys: ['kbn'] })).toBeUndefined();
    expect(getDiffCellClassName(undefined, { isKeyColumn: true, fieldKeys: ['qty'] })).toBeUndefined();
  });
});

describe('composeColumns', () => {
  it('強調対象外の列は同一参照のまま、対象列だけ新しいオブジェクトになる', () => {
    const composed = composeColumns(columns, result.leftDiffs, {
      compareFields,
      keyColumnKeys: ['id'],
    });
    expect(composed[0]).not.toBe(columns[0]); // id: キー列
    expect(composed[1]).not.toBe(columns[1]); // qty: フィールド列
    expect(composed[2]).not.toBe(columns[2]); // kbn: フィールド列
    expect(composed[3]).toBe(columns[3]); // note: 対象外
    expect(composed.map((c) => c.key)).toEqual(['id', 'qty', 'kbn', 'note']);
  });

  it('キー列は left-only 行だけ、フィールド列は該当差分の行だけクラスが付く', () => {
    const composed = composeColumns(columns, result.leftDiffs, {
      compareFields,
      keyColumnKeys: ['id'],
    });
    expect(cellClass(composed[0], left[0])).toBeUndefined();
    expect(cellClass(composed[0], left[1])).toBeUndefined();
    expect(cellClass(composed[0], left[2])).toBe('cmpg-cell-diff cmpg-cell-diff--key');
    expect(cellClass(composed[1], left[1])).toBe('cmpg-cell-diff cmpg-cell-diff--field');
    expect(cellClass(composed[2], left[1])).toBeUndefined();
  });

  it('columnKey で比較キーと異なる列を強調対象にできる', () => {
    const fields: CompareField<Row>[] = [{ key: 'double', label: '倍量', getValue: (r) => r.qty * 2, columnKey: 'qty' }];
    const res = compare(left, right, { getMatchKey: (r) => r.id, compareFields: fields });
    const composed = composeColumns(columns, res.leftDiffs, { compareFields: fields });
    expect(cellClass(composed[1], left[1])).toBe('cmpg-cell-diff cmpg-cell-diff--field');
  });

  it('利用側の cellClassName(文字列 / 関数)と合成される', () => {
    const custom: GridColumn<Row>[] = [
      { key: 'id', title: 'ID', width: 80, cellClassName: 'mono' },
      { key: 'qty', title: '数量', width: 80, cellClassName: (ctx) => (ctx.row.qty > 0 ? 'positive' : undefined) },
    ];
    const composed = composeColumns(custom, result.leftDiffs, { compareFields, keyColumnKeys: ['id'] });
    expect(cellClass(composed[0], left[2])).toBe('cmpg-cell-diff cmpg-cell-diff--key mono');
    expect(cellClass(composed[0], left[0])).toBe('mono');
    expect(cellClass(composed[1], left[1])).toBe('cmpg-cell-diff cmpg-cell-diff--field positive');
    expect(cellClass(composed[1], left[0])).toBe('positive');
  });

  it('enable* を false にすると対象列も同一参照で通過する', () => {
    const composed = composeColumns(columns, result.leftDiffs, {
      compareFields,
      keyColumnKeys: ['id'],
      enableKeyCellHighlight: false,
      enableFieldCellHighlight: false,
    });
    composed.forEach((c, i) => expect(c).toBe(columns[i]));
  });
});

describe('composeRowClassName', () => {
  it('ライブラリの行クラスと利用側 getRowClassName を合成する', () => {
    const user = (r: Row) => (r.id === 'B' ? 'user-b' : undefined);
    const fn = composeRowClassName(result.leftDiffs, user, true);
    expect(fn?.(left[0], 0)).toBeUndefined();
    expect(fn?.(left[1], 1)).toBe('cmpg-row-diff cmpg-row-diff--field user-b');
    expect(fn?.(left[2], 2)).toBe('cmpg-row-diff cmpg-row-diff--left-only');
  });

  it('enableRowHighlight=false は利用側の関数をそのまま返す', () => {
    const user = () => 'x';
    expect(composeRowClassName(result.leftDiffs, user, false)).toBe(user);
    expect(composeRowClassName(result.leftDiffs, undefined, false)).toBeUndefined();
  });
});

describe('insertDiffLabelColumn', () => {
  it('既定は末尾に追加され、getValue が差分ラベルを返す', () => {
    const composed = insertDiffLabelColumn(columns, result.leftDiffs, undefined);
    const labelColumn = composed[composed.length - 1];
    expect(labelColumn.key).toBe(DEFAULT_DIFF_LABEL_COLUMN_KEY);
    expect(labelColumn.title).toBe('差分');
    expect(labelColumn.getValue?.(left[0])).toBe('');
    expect(labelColumn.getValue?.(left[1])).toBe('数量違い');
    expect(labelColumn.getValue?.(left[2])).toBe('左のみ');
    expect(labelColumn.getValue?.(row('Z', 0))).toBe('');
  });

  it('position とタイトル等を上書きできる', () => {
    expect(insertDiffLabelColumn(columns, result.leftDiffs, { position: 'start' })[0].key).toBe(
      DEFAULT_DIFF_LABEL_COLUMN_KEY,
    );
    expect(insertDiffLabelColumn(columns, result.leftDiffs, { position: 2 })[2].key).toBe(
      DEFAULT_DIFF_LABEL_COLUMN_KEY,
    );
    expect(insertDiffLabelColumn(columns, result.leftDiffs, { position: 99 })[4].key).toBe(
      DEFAULT_DIFF_LABEL_COLUMN_KEY,
    );
    const custom = insertDiffLabelColumn(columns, result.leftDiffs, {
      key: 'diffLabel',
      title: '変更箇所',
      width: 200,
      pinned: 'right',
    });
    expect(custom[4]).toMatchObject({ key: 'diffLabel', title: '変更箇所', width: 200, pinned: 'right' });
  });
});
