// 使用例で共有する行の型・データ・列定義・比較設定です。ライブラリはこの型を知りません(利用側の T)。
//   使用例は利用側と同じ import パス(`@ishibashi0112/comparison-grid`)で書いてあるので、そのままコピーして使えます。
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import type { CompareField } from '@ishibashi0112/comparison-grid';

/** 部品構成の 1 行。level は階層比較の例(02)だけが使う(展開結果は深さ優先順 + level で並ぶ)。 */
export type Part = {
  itemCode: string;
  itemName: string;
  qty: number;
  shikiyuKbn: '有' | '無';
  level: number;
};

const p = (level: number, itemCode: string, itemName: string, qty: number, shikiyuKbn: '有' | '無' = '無'): Part => ({
  level,
  itemCode,
  itemName,
  qty,
  shikiyuKbn,
});

/** 現行(基準)。 */
export const CURRENT: Part[] = [
  p(1, 'B2001', 'ブラケット', 2),
  p(1, 'B2002', 'モーターASSY', 1),
  p(2, 'C3001', 'DCモーター', 1),
  p(2, 'C3002', 'ハーネス', 1),
  p(1, 'B2003', 'カバー', 1),
  p(1, 'B2007', '電源ケーブル', 1, '有'),
];

/** 案 1: 数量変更 + ハーネス支給 + カバー廃止 + ファン追加。 */
export const PLAN_A: Part[] = [
  p(1, 'B2001', 'ブラケット', 2),
  p(1, 'B2002', 'モーターASSY', 1),
  p(2, 'C3001', 'DCモーター', 2),
  p(2, 'C3002', 'ハーネス', 1, '有'),
  p(1, 'B2007', '電源ケーブル', 1, '有'),
  p(1, 'B2011', 'ファン', 2),
];

/** 案 2: ブラケット数量変更 + 電源ケーブル廃止。 */
export const PLAN_B: Part[] = [
  p(1, 'B2001', 'ブラケット', 3),
  p(1, 'B2002', 'モーターASSY', 1),
  p(2, 'C3001', 'DCモーター', 1),
  p(2, 'C3002', 'ハーネス', 1),
  p(1, 'B2003', 'カバー', 1),
];

/** 突き合わせキー。平坦比較では品目コード(階層比較ではライブラリがパスを導出する)。 */
export const getMatchKey = (row: Part) => row.itemCode;

/** 「差分を見る」フィールド。label は差分ラベル(`数量・支給区分違い`)に使われる。 */
export const COMPARE_FIELDS: CompareField<Part>[] = [
  { key: 'qty', label: '数量' },
  { key: 'shikiyuKbn', label: '支給区分' },
];

/** 列定義は spreadsheet-grid の GridColumn<T> をそのまま書く(ライブラリが差分クラスを合成する)。 */
export const COLUMNS: GridColumn<Part>[] = [
  { key: 'itemCode', title: '品目コード', width: 110 },
  { key: 'itemName', title: '品目名', width: 150 },
  { key: 'shikiyuKbn', title: '支給', width: 60 },
  { key: 'qty', title: '数量', width: 60, align: 'right' },
];
