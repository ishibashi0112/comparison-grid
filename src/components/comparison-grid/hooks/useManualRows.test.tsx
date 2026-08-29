// useManualRows(マニュアル入力ペインの行 state ヘルパー)のテストです(renderHook のため jsdom)。
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useManualRows } from './useManualRows';
import type { UseManualRowsOptions } from '../model/types';

afterEach(() => {
  cleanup();
});

type Row = { name: string; qty: string };
const row = (name: string, qty = '1'): Row => ({ name, qty });
const createRow = (): Row => ({ name: '', qty: '' });
const isEmptyRow = (r: Row) => r.name === '' && r.qty === '';
// 変更不要なら同じ参照を返す契約。
const normalizeRow = (r: Row): Row => {
  const name = r.name.trim();
  return name === r.name ? r : { ...r, name };
};

const renderManual = (overrides?: Partial<UseManualRowsOptions<Row>>) =>
  renderHook(() =>
    useManualRows<Row>({ createRow, isEmptyRow, ...overrides }),
  );

describe('useManualRows', () => {
  it('初期状態は initialRows + 末尾空行 1 行で、dataRows は空行を含まない', () => {
    const initial = [row('A'), row('B')];
    const { result } = renderManual({ initialRows: initial });
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.rows.slice(0, 2)).toEqual(initial);
    expect(isEmptyRow(result.current.rows[2])).toBe(true);
    expect(result.current.dataRows).toEqual(initial);
    expect(result.current.isValid).toBe(true);
  });

  it('末尾行への入力で空行が追加され、余分な末尾空行は 1 行に整えられる', () => {
    const { result } = renderManual();
    const empty = result.current.rows[0];
    act(() => result.current.onRowsChange([{ ...empty, name: 'A' }]));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.rows[0].name).toBe('A');
    expect(isEmptyRow(result.current.rows[1])).toBe(true);

    // 空行を 3 行に増やしても 1 行へ。既存の空行オブジェクトは先頭から再利用される。
    const keepEmpty = createRow();
    act(() =>
      result.current.onRowsChange([row('A'), keepEmpty, createRow(), createRow()]),
    );
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.rows[1]).toBe(keepEmpty);
  });

  it('normalizeRow が適用され、変更の無い行は参照が保たれる', () => {
    const { result } = renderManual({ normalizeRow });
    const untouched = row('A');
    act(() => result.current.onRowsChange([untouched, row('  B  ')]));
    expect(result.current.rows[0]).toBe(untouched);
    expect(result.current.rows[1].name).toBe('B');
  });

  it('途中の空行は表示上は残り、dataRows からは除外される', () => {
    const { result } = renderManual();
    act(() => result.current.onRowsChange([row('A'), createRow(), row('C')]));
    expect(result.current.rows).toHaveLength(4);
    expect(result.current.dataRows.map((r) => r.name)).toEqual(['A', 'C']);
  });

  it('validateRow のエラーが errors / isValid に反映される(空行は評価しない)', () => {
    const { result } = renderManual({
      validateRow: (r, rowIndex) => (r.qty === '' ? `行 ${rowIndex + 1}: 数量が未入力` : null),
    });
    act(() => result.current.onRowsChange([row('A'), { name: 'B', qty: '' }]));
    expect(result.current.isValid).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]).toMatchObject({ rowIndex: 1, message: '行 2: 数量が未入力' });

    act(() => result.current.onRowsChange([row('A'), row('B')]));
    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toHaveLength(0);
  });

  it('setRows は末尾空行を維持して差し替え、clear で空行だけに戻る', () => {
    const { result } = renderManual();
    act(() => result.current.setRows([row('A'), row('B')]));
    expect(result.current.dataRows).toHaveLength(2);
    expect(result.current.rows).toHaveLength(3);

    act(() => result.current.clear());
    expect(result.current.rows).toHaveLength(1);
    expect(isEmptyRow(result.current.rows[0])).toBe(true);
    expect(result.current.dataRows).toHaveLength(0);
  });

  it('trailingEmptyRows で維持する空行数を変えられる(0 は維持しない)', () => {
    const two = renderManual({ trailingEmptyRows: 2 });
    expect(two.result.current.rows).toHaveLength(2);

    const zero = renderManual({ trailingEmptyRows: 0, initialRows: [row('A')] });
    expect(zero.result.current.rows).toHaveLength(1);
    act(() => zero.result.current.onRowsChange([row('A'), createRow()]));
    expect(zero.result.current.rows).toHaveLength(1);
  });

  it('gridProps は onRowsChange / createRow を持ち、参照が安定している', () => {
    const { result, rerender } = renderManual();
    const first = result.current.gridProps;
    expect(typeof first.onRowsChange).toBe('function');
    expect(first.createRow).toBe(createRow);
    rerender();
    expect(result.current.gridProps).toBe(first);
  });
});
