// 列定義 / 行クラスの合成ロジックの単体テストです(node 環境)。
import { describe, it, expect } from 'vitest';
import type { GridColumn, RowStyleContext } from '@ishibashi0112/spreadsheet-grid';
import { compare } from './compare';
import { compareMany } from './compareMany';
import {
  CMPG_CLASS_NAMES,
  DEFAULT_DIFF_LABEL_COLUMN_KEY,
  composeColumns,
  composeRowClassName,
  getDiffCellClassName,
  getDiffRowClassName,
  hasMissingCounterpart,
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

const rowCtxOf = (r: Row, rowIndex: number): RowStyleContext<Row> => ({
  row: r,
  rowIndex,
  sourceRowIndex: rowIndex,
  rowKey: rowIndex,
  isSelected: false,
});

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
    expect(fn?.(left[0], 0, rowCtxOf(left[0], 0))).toBeUndefined();
    expect(fn?.(left[1], 1, rowCtxOf(left[1], 1))).toBe('cmpg-row-diff cmpg-row-diff--field user-b');
    expect(fn?.(left[2], 2, rowCtxOf(left[2], 2))).toBe('cmpg-row-diff cmpg-row-diff--left-only');
  });

  it('enableRowHighlight=false は利用側の関数をそのまま返す', () => {
    const user = () => 'x';
    expect(composeRowClassName(result.leftDiffs, user, false)).toBe(user);
    expect(composeRowClassName(result.leftDiffs, undefined, false)).toBeUndefined();
  });

  it('placeholderRows の行には .cmpg-row-placeholder が付き、差分クラスは付かない', () => {
    const placeholder = row('__ph', 0);
    const placeholders: ReadonlySet<Row> = new Set([placeholder]);
    const fn = composeRowClassName(result.leftDiffs, undefined, true, placeholders);
    expect(fn?.(placeholder, 3, rowCtxOf(placeholder, 3))).toBe(CMPG_CLASS_NAMES.rowPlaceholder);
    // 差分行はこれまでどおり。
    expect(fn?.(left[1], 1, rowCtxOf(left[1], 1))).toBe('cmpg-row-diff cmpg-row-diff--field');
  });

  it('enableRowHighlight=false でもプレースホルダ行クラスは付与され、利用側と合成される', () => {
    const placeholder = row('__ph', 0);
    const placeholders: ReadonlySet<Row> = new Set([placeholder]);
    const user = () => 'user-class';
    const fn = composeRowClassName(result.leftDiffs, user, false, placeholders);
    expect(fn).not.toBe(user);
    expect(fn?.(placeholder, 0, rowCtxOf(placeholder, 0))).toBe(
      `${CMPG_CLASS_NAMES.rowPlaceholder} user-class`,
    );
    // 差分行には差分クラスが付かない(ハイライト無効)。
    expect(fn?.(left[1], 1, rowCtxOf(left[1], 1))).toBe('user-class');
    // 空 Set なら従来どおり利用側の関数をそのまま返す。
    expect(composeRowClassName(result.leftDiffs, user, false, new Set<Row>())).toBe(user);
  });
});

describe('composeRowClassName: ロールアップ', () => {
  // A(same)の配下に差分 2 件、B(field-diff)の配下にも 1 件ある想定。
  const counts: ReadonlyMap<Row, number> = new Map([
    [left[0], 2],
    [left[1], 1],
  ]);

  it('自身が same で配下に差分がある行にだけ .cmpg-row-rollup が付く(差分行には付かない)', () => {
    const fn = composeRowClassName(result.leftDiffs, undefined, true, undefined, undefined, counts);
    expect(fn?.(left[0], 0, rowCtxOf(left[0], 0))).toBe(CMPG_CLASS_NAMES.rowRollup);
    expect(fn?.(left[1], 1, rowCtxOf(left[1], 1))).toBe('cmpg-row-diff cmpg-row-diff--field');
    expect(fn?.(left[2], 2, rowCtxOf(left[2], 2))).toBe('cmpg-row-diff cmpg-row-diff--left-only');
  });

  it('enableRowHighlight=false ならロールアップも付かない', () => {
    expect(composeRowClassName(result.leftDiffs, undefined, false, undefined, undefined, counts)).toBeUndefined();
  });

  it('利用側のクラスと合成される', () => {
    const user = () => 'user-class';
    const fn = composeRowClassName(result.leftDiffs, user, true, undefined, undefined, counts);
    expect(fn?.(left[0], 0, rowCtxOf(left[0], 0))).toBe(`${CMPG_CLASS_NAMES.rowRollup} user-class`);
  });
});

describe('insertDiffLabelColumn: 配下差分ラベル', () => {
  const counts: ReadonlyMap<Row, number> = new Map([
    [left[0], 2],
    [left[1], 1],
  ]);

  it('自身のラベルが空で配下に差分がある行に既定ラベルを出す(差分行は自身のラベル)', () => {
    const composed = insertDiffLabelColumn(columns, result.leftDiffs, undefined, counts);
    const labelColumn = composed[composed.length - 1];
    expect(labelColumn.getValue?.(left[0])).toBe('配下に差分 2 件');
    expect(labelColumn.getValue?.(left[1])).toBe('数量違い');
    expect(labelColumn.getValue?.(left[2])).toBe('左のみ');
  });

  it('descendantDiffLabel で文言を差し替えられ、列オブジェクトには漏れない', () => {
    const composed = insertDiffLabelColumn(
      columns,
      result.leftDiffs,
      { descendantDiffLabel: (count) => `${count} changed below` },
      counts,
    );
    const labelColumn = composed[composed.length - 1];
    expect(labelColumn.getValue?.(left[0])).toBe('2 changed below');
    expect('descendantDiffLabel' in labelColumn).toBe(false);
  });

  it('counts が無ければ従来どおり空', () => {
    const composed = insertDiffLabelColumn(columns, result.leftDiffs, undefined);
    expect(composed[composed.length - 1].getValue?.(left[0])).toBe('');
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

// ---------------------------------------------------------------------------------------------
// N 構成(compareMany)の差分でも同じ合成が効く。
// ---------------------------------------------------------------------------------------------
describe('N 構成の差分(ComparisonMultiRowDiff)', () => {
  // base: A(same) / B(qty 違い) / C(partial: a に無い) / D(only)。a: A / B / E(only)。b: A / B / C。
  const mBase = [row('A', 1), row('B', 1), row('C', 1), row('D', 1)];
  const mA = [row('A', 1), row('B', 2), row('E', 1)];
  const mB = [row('A', 1), row('B', 1), row('C', 1)];
  const multi = compareMany(
    [
      { id: 'base', rows: mBase },
      { id: 'a', rows: mA },
      { id: 'b', rows: mB },
    ],
    { getMatchKey: (r) => r.id, compareFields },
  );
  const baseDiffs = multi.sidesById.get('base')!.diffs;
  const aDiffs = multi.sidesById.get('a')!.diffs;

  it('行クラスは kind ごとの修飾子(--field / --partial / --only)が付く', () => {
    expect(getDiffRowClassName(baseDiffs.get(mBase[0]))).toBeUndefined();
    expect(getDiffRowClassName(baseDiffs.get(mBase[1]))).toBe('cmpg-row-diff cmpg-row-diff--field');
    expect(getDiffRowClassName(baseDiffs.get(mBase[2]))).toBe('cmpg-row-diff cmpg-row-diff--partial');
    expect(getDiffRowClassName(baseDiffs.get(mBase[3]))).toBe('cmpg-row-diff cmpg-row-diff--only');
    expect(getDiffRowClassName(aDiffs.get(mA[2]))).toBe('cmpg-row-diff cmpg-row-diff--only');
    expect(CMPG_CLASS_NAMES.rowOnly).toBe('cmpg-row-diff--only');
    expect(CMPG_CLASS_NAMES.rowPartial).toBe('cmpg-row-diff--partial');
  });

  it('キー列は相手の無い行(only / partial / missingIn 付き field-diff)で強調される', () => {
    const composed = composeColumns(columns, baseDiffs, { compareFields, keyColumnKeys: ['id'] });
    const idCol = composed[0];
    expect(cellClass(idCol, mBase[0])).toBeUndefined();
    expect(cellClass(idCol, mBase[1])).toBeUndefined();
    expect(cellClass(idCol, mBase[2])).toBe('cmpg-cell-diff cmpg-cell-diff--key');
    expect(cellClass(idCol, mBase[3])).toBe('cmpg-cell-diff cmpg-cell-diff--key');
    expect(hasMissingCounterpart(baseDiffs.get(mBase[2])!)).toBe(true);
    expect(hasMissingCounterpart(baseDiffs.get(mBase[1])!)).toBe(false);

    // 一部に無く残りと違う行(field-diff + missingIn)はキー列と差分フィールド列の両方が強調される。
    const mixed = compareMany(
      [
        { id: 'base', rows: [row('A', 1)] },
        { id: 'a', rows: [] },
        { id: 'b', rows: [row('A', 2)] },
      ],
      { getMatchKey: (r) => r.id, compareFields },
    );
    const mixedRow = mixed.sidesById.get('base')!.rows[0];
    const mixedCols = composeColumns(columns, mixed.sidesById.get('base')!.diffs, {
      compareFields,
      keyColumnKeys: ['id'],
    });
    expect(cellClass(mixedCols[0], mixedRow)).toBe('cmpg-cell-diff cmpg-cell-diff--key');
    expect(cellClass(mixedCols[1], mixedRow)).toBe('cmpg-cell-diff cmpg-cell-diff--field');
  });

  it('フィールド列は fieldDiffs(和集合)に含まれる列だけ強調される', () => {
    const composed = composeColumns(columns, baseDiffs, { compareFields, keyColumnKeys: ['id'] });
    expect(cellClass(composed[1], mBase[1])).toBe('cmpg-cell-diff cmpg-cell-diff--field');
    expect(cellClass(composed[2], mBase[1])).toBeUndefined();
    expect(cellClass(composed[1], mBase[2])).toBeUndefined();
  });

  it('差分ラベル列は N 構成のラベルを出す', () => {
    const withLabel = insertDiffLabelColumn(columns, baseDiffs, undefined);
    const labelCol = withLabel[withLabel.length - 1];
    expect(labelCol.key).toBe(DEFAULT_DIFF_LABEL_COLUMN_KEY);
    expect(labelCol.getValue?.(mBase[1])).toBe('a: 数量違い');
    expect(labelCol.getValue?.(mBase[2])).toBe('a: 無し');
    expect(labelCol.getValue?.(mBase[3])).toBe('基準のみ');
  });
});
