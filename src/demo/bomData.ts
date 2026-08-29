// デモ用の BOM(部品構成)モックデータです。ss2602 の API(GetComponentsInfo)の代役として、
//   品番ごとの展開結果を返します。ライブラリはこの型を知りません(利用側の T)。
export type BomRow = {
  /** 階層パス(ルートを除く品目コードを '/' で連結)。突き合わせキーに使う。 */
  itemPath: string;
  rootItemCode: string;
  rootItemName: string;
  rootItemSpec: string;
  levelNo: number;
  itemCode: string;
  /** 代表品番(無ければ '')。「代表品番比較」ON のとき突き合わせキーに使う。 */
  reprItemCode: string;
  itemName: string;
  spec: string;
  /** 支給区分('有' / '無')。 */
  shikiyuKbn: string;
  /** 数量(API は文字列で返す想定)。 */
  qty: string;
};

export type RootItemInfo = { code: string; name: string; spec: string };

type Seed = {
  level: number;
  itemCode: string;
  itemName: string;
  spec: string;
  shikiyuKbn: string;
  qty: string;
  reprItemCode?: string;
};

const s = (
  level: number,
  itemCode: string,
  itemName: string,
  spec: string,
  shikiyuKbn: string,
  qty: string,
  reprItemCode?: string,
): Seed => ({ level, itemCode, itemName, spec, shikiyuKbn, qty, reprItemCode });

const buildRows = (root: RootItemInfo, seeds: Seed[]): BomRow[] => {
  const stack: string[] = [];
  return seeds.map((seed) => {
    stack.length = Math.max(0, seed.level - 1);
    stack.push(seed.itemCode);
    return {
      itemPath: stack.join('/'),
      rootItemCode: root.code,
      rootItemName: root.name,
      rootItemSpec: root.spec,
      levelNo: seed.level,
      itemCode: seed.itemCode,
      reprItemCode: seed.reprItemCode ?? '',
      itemName: seed.itemName,
      spec: seed.spec,
      shikiyuKbn: seed.shikiyuKbn,
      qty: seed.qty,
    };
  });
};

// 旧構成。
const A1000 = buildRows({ code: 'A1000', name: '制御ユニット', spec: '100V 仕様' }, [
  s(1, 'B2001', 'ブラケット', 'SUS304 t2.0', '無', '2'),
  s(1, 'B2002', 'モーターASSY', '-', '無', '1'),
  s(2, 'C3001', 'DCモーター', '24V 20W', '無', '1'),
  s(2, 'C3002', 'ハーネス', '300mm', '無', '1'),
  s(2, 'C3003', '六角穴付ボルト', 'M4x10', '無', '4'),
  s(3, 'D4001', '平座金', 'M4', '無', '4'),
  s(1, 'B2003', 'カバー', 'ABS 黒', '無', '1'),
  s(1, 'B2005', 'ラベル', 'PET', '無', '1'),
  s(1, 'B2006', '基板ASSY', '-', '有', '1'),
  s(2, 'C3010', '制御基板', 'REV.A', '無', '1'),
  s(2, 'C3011', 'コネクタ', '10P', '無', '2'),
  s(1, 'B2007', '電源ケーブル', '2m', '有', '1'),
  s(1, 'B2008', 'ゴム足', 'φ10', '無', '4'),
  s(1, 'B2009', 'ネジセット', '-', '無', '1'),
]);

// 新構成(Rev.2)。カバー / 電源ケーブルは後継品番(代表品番で旧品番を指す)へ置き換え。
const A1000_R2 = buildRows(
  { code: 'A1000-R2', name: '制御ユニット (Rev.2)', spec: '100V/200V 仕様' },
  [
    s(1, 'B2001', 'ブラケット', 'SUS304 t2.0', '無', '2'),
    s(1, 'B2002', 'モーターASSY', '-', '無', '1'),
    s(2, 'C3001', 'DCモーター', '24V 20W', '無', '2'),
    s(2, 'C3002', 'ハーネス', '300mm', '有', '1'),
    s(2, 'C3003', '六角穴付ボルト', 'M4x10', '有', '6'),
    s(3, 'D4001', '平座金', 'M4', '無', '4'),
    s(1, 'B2004', 'カバー改', 'ABS 黒', '無', '1', 'B2003'),
    s(1, 'B2005', 'ラベル', 'PET', '無', '1'),
    s(1, 'B2006', '基板ASSY', '-', '有', '1'),
    s(2, 'C3010', '制御基板', 'REV.B', '無', '1'),
    s(2, 'C3011', 'コネクタ', '10P', '無', '2'),
    s(1, 'B2010', '電源ケーブル改', '3m', '有', '1', 'B2007'),
    s(1, 'B2008', 'ゴム足', 'φ10', '無', '4'),
    s(1, 'B2011', 'ファン', '40mm', '無', '2'),
    s(1, 'B2012', 'フィルター', '-', '無', '1'),
  ],
);

// 無関係な構成(ほぼ全件が片側のみになるケース)。
const X9000 = buildRows({ code: 'X9000', name: '試験治具', spec: '-' }, [
  s(1, 'B2001', 'ブラケット', 'SUS304 t2.0', '無', '1'),
  s(1, 'Y1001', 'ベースプレート', 'A5052 t5.0', '無', '1'),
  s(1, 'Y1002', 'クランプ', '-', '有', '2'),
]);

export const BOM_DATASETS: Record<string, BomRow[]> = {
  A1000,
  'A1000-R2': A1000_R2,
  X9000,
};

export const BOM_ITEM_CODES = Object.keys(BOM_DATASETS);

/** 品番の展開結果を非同期で返します(未登録の品番は空配列 = 片側のみの比較を再現)。 */
export const fetchBom = (itemCode: string): Promise<BomRow[]> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(BOM_DATASETS[itemCode.trim().toUpperCase()] ?? []), 250);
  });
