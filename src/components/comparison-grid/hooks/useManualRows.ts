// マニュアル入力ペイン用の行 state ヘルパーです(ss2602 の手入力構成の学び)。
//   - 末尾空行の維持: 編集のたびに「末尾の空行がちょうど trailingEmptyRows 行」になるよう整える。
//     既存の空行オブジェクトは再利用して参照を保つ(グリッドの編集状態 / undo に優しい)。
//   - 正規化フック: onRowsChange 時に normalizeRow を各行へ適用(変更不要なら同じ参照を返す契約)。
//   - 送信時検証: validateRow の結果を errors / isValid として導出(空行は評価しない)。
//   - dataRows(空行除外)を useComparison の入力に渡し、rows(空行込み)をグリッドに渡す。
import { useCallback, useMemo, useState } from 'react';
import type {
  ManualRowError,
  UseManualRowsOptions,
  UseManualRowsResult,
} from '../model/types';

/**
 * マニュアル入力ペインの行 state(末尾空行の維持 / 正規化 / 送信時検証)。空行を除いた `dataRows` を
 * `useComparison` の片側に渡し、`gridProps` を編集側のペインにスプレッドします。
 *
 * @example
 * ```tsx
 * const manual = useManualRows<Row>({ createRow, isEmptyRow, normalizeRow, validateRow });
 * const comparison = useComparison<Row>({ left: master, right: manual.dataRows, getMatchKey, compareFields });
 * <ComparisonView<Row> comparison={comparison} columns={editableColumns}
 *   gridProps={{ readOnly: true }} rightGridProps={{ ...manual.gridProps, readOnly: false }} />;
 * ```
 */
export function useManualRows<T>(options: UseManualRowsOptions<T>): UseManualRowsResult<T> {
  const { createRow, isEmptyRow, normalizeRow, validateRow, trailingEmptyRows = 1 } = options;

  const withTrailingEmpty = useCallback(
    (source: readonly T[]): T[] => {
      let end = source.length;
      while (end > 0 && isEmptyRow(source[end - 1])) end -= 1;
      const next = source.slice(0, end);
      // 既存の末尾空行を先頭から再利用し、足りないぶんだけ生成する。
      for (let i = end; i < source.length && next.length < end + trailingEmptyRows; i += 1) {
        next.push(source[i]);
      }
      while (next.length < end + trailingEmptyRows) {
        next.push(createRow());
      }
      return next;
    },
    [isEmptyRow, createRow, trailingEmptyRows],
  );

  const [rows, setRowsState] = useState<readonly T[]>(() =>
    withTrailingEmpty(options.initialRows ?? []),
  );

  const onRowsChange = useCallback(
    (nextRows: T[]) => {
      const normalized = normalizeRow ? nextRows.map((row) => normalizeRow(row)) : nextRows;
      setRowsState(withTrailingEmpty(normalized));
    },
    [normalizeRow, withTrailingEmpty],
  );
  const setRows = useCallback(
    (nextRows: readonly T[]) => {
      setRowsState(withTrailingEmpty(nextRows));
    },
    [withTrailingEmpty],
  );
  const clear = useCallback(() => {
    setRowsState(withTrailingEmpty([]));
  }, [withTrailingEmpty]);

  const dataRows = useMemo(() => rows.filter((row) => !isEmptyRow(row)), [rows, isEmptyRow]);

  const errors = useMemo<readonly ManualRowError<T>[]>(() => {
    if (!validateRow) return [];
    const found: ManualRowError<T>[] = [];
    rows.forEach((row, rowIndex) => {
      if (isEmptyRow(row)) return;
      const message = validateRow(row, rowIndex);
      if (message) found.push({ row, rowIndex, message });
    });
    return found;
  }, [rows, validateRow, isEmptyRow]);

  const gridProps = useMemo(
    () => ({ onRowsChange, createRow }),
    [onRowsChange, createRow],
  );

  return useMemo(
    () => ({
      rows,
      dataRows,
      onRowsChange,
      setRows,
      clear,
      errors,
      isValid: errors.length === 0,
      gridProps,
    }),
    [rows, dataRows, onRowsChange, setRows, clear, errors, gridProps],
  );
}
