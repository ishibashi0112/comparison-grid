// デモ用の BOM(部品構成)モックデータです。ss2602 の API(GetComponentsInfo)の代役として、
//   品番ごとの展開結果を返します。ライブラリはこの型を知りません(利用側の T)。
export type BomRow = {
  rootItemCode: string;
  rootItemName: string;
  rootItemSpec: string;
  /** 階層(1 始まり)。展開結果は深さ優先順で並ぶ(buildComparisonTree の getLevel に渡す)。 */
  levelNo: number;
  itemCode: string;
  /** 代表品番(無ければ '')。「代表品番比較」ON のとき自品番の代わりにキーのセグメントになる(子孫へ伝播)。 */
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

const buildRows = (root: RootItemInfo, seeds: readonly Seed[]): BomRow[] =>
  seeds.map((seed) => {
    return {
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
//   モーターASSY は ASSY ごと後継品番(子は同じ)にしてあり、通常比較ではサブツリー丸ごと左のみ + 右のみ、
//   代表品番比較 ON では親の置き換えが子へ伝播して子同士が突き合う(数量 / 支給区分違いになる)。
const A1000_R2 = buildRows(
  { code: 'A1000-R2', name: '制御ユニット (Rev.2)', spec: '100V/200V 仕様' },
  [
    s(1, 'B2001', 'ブラケット', 'SUS304 t2.0', '無', '2'),
    s(1, 'B2002A', 'モーターASSY改', '-', '無', '1', 'B2002'),
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

// 別案(Rev.3)。N 構成比較(現行 A1000 を基準に Rev.2 / Rev.3 を並べる)用。Rev.2 とは別の箇所を変えてある:
//   ブラケットの数量 / ハーネスの長さは同じで支給区分だけ / 基板 ASSY のコネクタ数 / ゴム足を廃止 / ヒートシンク追加。
const A1000_R3 = buildRows(
  { code: 'A1000-R3', name: '制御ユニット (Rev.3)', spec: '200V 仕様' },
  [
    s(1, 'B2001', 'ブラケット', 'SUS304 t2.0', '無', '3'),
    s(1, 'B2002', 'モーターASSY', '-', '無', '1'),
    s(2, 'C3001', 'DCモーター', '24V 20W', '無', '1'),
    s(2, 'C3002', 'ハーネス', '300mm', '有', '1'),
    s(2, 'C3003', '六角穴付ボルト', 'M4x10', '無', '4'),
    s(3, 'D4001', '平座金', 'M4', '無', '4'),
    s(1, 'B2003', 'カバー', 'ABS 黒', '無', '1'),
    s(1, 'B2005', 'ラベル', 'PET', '無', '1'),
    s(1, 'B2006', '基板ASSY', '-', '有', '1'),
    s(2, 'C3010', '制御基板', 'REV.A', '無', '1'),
    s(2, 'C3011', 'コネクタ', '10P', '無', '3'),
    s(1, 'B2007', '電源ケーブル', '2m', '有', '1'),
    s(1, 'B2009', 'ネジセット', '-', '無', '1'),
    s(1, 'B2013', 'ヒートシンク', 'A6063', '無', '1'),
  ],
);

// 無関係な構成(ほぼ全件が片側のみになるケース)。
const X9000 = buildRows({ code: 'X9000', name: '試験治具', spec: '-' }, [
  s(1, 'B2001', 'ブラケット', 'SUS304 t2.0', '無', '1'),
  s(1, 'Y1001', 'ベースプレート', 'A5052 t5.0', '無', '1'),
  s(1, 'Y1002', 'クランプ', '-', '有', '2'),
]);

// ---------------------------------------------------------------------------------------------
// 大量データ(スクロール同期 / 差分ジャンプ / 差分のみフィルタの動作確認用)。
//   シード固定の疑似乱数(mulberry32)で旧構成を生成し、新構成は旧構成から**行位置の規則**で
//   派生させます(乱数は使わない)。したがって毎回同じ内容・同じ差分位置になります。
// ---------------------------------------------------------------------------------------------

/** mulberry32。Math.random と違い、シードが同じなら同じ列を返す。 */
const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const ASSEMBLY_NAMES = [
  'フレームASSY',
  '駆動ASSY',
  '基板ASSY',
  '配線ASSY',
  'カバーASSY',
  'センサASSY',
  '冷却ASSY',
  '操作パネルASSY',
] as const;

/** 部品名と仕様の候補。level 2 / 3 の行はここから選ぶ。 */
const PART_CATALOG: readonly (readonly [name: string, specs: readonly string[]])[] = [
  ['ブラケット', ['SUS304 t1.5', 'SUS304 t2.0', 'SPCC t1.6']],
  ['六角穴付ボルト', ['M3x8', 'M4x10', 'M5x12', 'M6x15']],
  ['ナット', ['M3', 'M4', 'M5']],
  ['平座金', ['M3', 'M4', 'M5']],
  ['ハーネス', ['150mm', '300mm', '500mm']],
  ['コネクタ', ['4P', '6P', '10P']],
  ['制御基板', ['REV.A', 'REV.B']],
  ['ケーブル', ['1m', '2m', '3m']],
  ['カバー', ['ABS 黒', 'ABS 白', 'PC 透明']],
  ['ラベル', ['PET', '紙']],
  ['ゴム足', ['φ8', 'φ10']],
  ['ファン', ['40mm', '60mm']],
  ['センサ', ['光電', '近接']],
  ['スペーサー', ['5mm', '10mm']],
];

const pick = <V,>(rng: () => number, candidates: readonly V[]): V =>
  candidates[Math.floor(rng() * candidates.length)];

/** 旧構成の seed 列を生成する。level 1 の ASSY × assemblyCount、各 ASSY に level 2 を 2〜6 個、
 *  level 2 の約 3 割に level 3 を 1〜3 個ぶら下げる(1 ASSY あたり平均 7 行強)。 */
const generateBaseSeeds = (assemblyCount: number, seed: number): Seed[] => {
  const rng = createRng(seed);
  const seeds: Seed[] = [];
  let partNo = 2000;
  let subPartNo = 3000;
  const pushPart = (level: number, code: string) => {
    const [name, specs] = pick(rng, PART_CATALOG);
    seeds.push(
      s(level, code, name, pick(rng, specs), rng() < 0.15 ? '有' : '無', String(1 + Math.floor(rng() * 6))),
    );
  };
  for (let a = 0; a < assemblyCount; a++) {
    const assemblyName = `${ASSEMBLY_NAMES[a % ASSEMBLY_NAMES.length]} ${String(a + 1).padStart(3, '0')}`;
    seeds.push(s(1, `P${1000 + a}`, assemblyName, '-', rng() < 0.1 ? '有' : '無', '1'));
    const partCount = 2 + Math.floor(rng() * 5);
    for (let p = 0; p < partCount; p++) {
      pushPart(2, `Q${partNo++}`);
      if (rng() < 0.3) {
        const subCount = 1 + Math.floor(rng() * 3);
        for (let c = 0; c < subCount; c++) pushPart(3, `R${subPartNo++}`);
      }
    }
  }
  return seeds;
};

/** 「変更なしゾーン」: 行番号 100〜199、400〜499、700〜799 … は一切変更しない。
 *  差分ジャンプで大きく飛ぶ区間と、同一行が続く中でのスクロール同期を目視しやすくするため。 */
const isQuietZone = (rowIndex: number) => Math.floor(rowIndex / 100) % 3 === 1;

/** 旧構成から新構成(Rev.2)を派生させる。行位置ベースの規則で以下を散らす:
 *   - 数量変更(19 行に 1 回)/ 支給区分変更(41 行に 1 回) → 項目違い
 *   - level 2 以下のサブツリー削除(71 行に 1 回)                → 左のみ
 *   - ASSY 8 個に 1 個、末尾へ新規部品を追加                     → 右のみ
 *   - 子を持たない level 2 部品 29 個に 1 個を後継品番へ置換     → 通常は左のみ + 右のみ、
 *     代表品番比較 ON では同一(または項目違い)として突き合う
 *     (葉に限定しているのはデータの安定のため。親の置換も子へ伝播するので制約ではない) */
const deriveRevisionSeeds = (base: readonly Seed[]): Seed[] => {
  const out: Seed[] = [];
  let assemblyIndex = -1;
  let leafPartIndex = -1;
  for (let i = 0; i < base.length; i++) {
    const seed = base[i];
    const hasChildren = base[i + 1] !== undefined && base[i + 1].level > seed.level;
    if (seed.level === 1) assemblyIndex++;
    if (seed.level === 2 && !hasChildren) leafPartIndex++;

    if (isQuietZone(i)) {
      out.push(seed);
      continue;
    }

    // サブツリー削除(左のみ)。子行も一緒に落とし、走査位置をサブツリーの末尾へ進める。
    if (seed.level >= 2 && i % 71 === 17) {
      let end = i + 1;
      while (end < base.length && base[end].level > seed.level) end++;
      i = end - 1;
      continue;
    }

    let next = seed;
    if (i % 19 === 4) next = { ...next, qty: String(Number(next.qty) + 1) };
    if (i % 41 === 9) next = { ...next, shikiyuKbn: next.shikiyuKbn === '有' ? '無' : '有' };
    if (seed.level === 2 && !hasChildren && leafPartIndex % 29 === 7) {
      next = {
        ...next,
        itemCode: `${seed.itemCode}A`,
        itemName: `${seed.itemName}改`,
        reprItemCode: seed.itemCode,
      };
    }
    out.push(next);

    // 新規部品の追加(右のみ)。ASSY 直下(level 2)の先頭に挿入する。
    if (seed.level === 1 && assemblyIndex % 8 === 3) {
      out.push(s(2, `N${4000 + assemblyIndex}`, '追加部品', '新規', '無', '1'));
    }
  }
  return out;
};

/** 大量データの旧 / 新構成の対を生成する(内容はシードと assemblyCount だけで決まる)。 */
export const generateLargeBomPair = (options: {
  code: string;
  name: string;
  assemblyCount: number;
  seed?: number;
}): { base: BomRow[]; revision: BomRow[] } => {
  const { code, name, assemblyCount, seed = 20260830 } = options;
  const baseSeeds = generateBaseSeeds(assemblyCount, seed);
  return {
    base: buildRows({ code, name, spec: '100V 仕様' }, baseSeeds),
    revision: buildRows(
      { code: `${code}-R2`, name: `${name} (Rev.2)`, spec: '100V/200V 仕様' },
      deriveRevisionSeeds(baseSeeds),
    ),
  };
};

// 約 500 行(70 ASSY)。差分ジャンプ / スクロール同期の確認用。
const L5000 = generateLargeBomPair({ code: 'L5000', name: '大型制御盤', assemblyCount: 70 });
// 約 3,000 行(400 ASSY)。仮想スクロール下での性能確認用。
const L9000 = generateLargeBomPair({ code: 'L9000', name: '生産ライン', assemblyCount: 400 });

export const BOM_DATASETS: Record<string, BomRow[]> = {
  A1000,
  'A1000-R2': A1000_R2,
  'A1000-R3': A1000_R3,
  X9000,
  L5000: L5000.base,
  'L5000-R2': L5000.revision,
  L9000: L9000.base,
  'L9000-R2': L9000.revision,
};

export const BOM_ITEM_CODES = Object.keys(BOM_DATASETS);

/** 左右をワンクリックで切り替えるプリセット(デモのツールバー用)。 */
export const BOM_PRESETS: readonly { label: string; left: string; right: string }[] = [
  { label: '標準', left: 'A1000', right: 'A1000-R2' },
  { label: '大量', left: 'L5000', right: 'L5000-R2' },
  { label: '超大量', left: 'L9000', right: 'L9000-R2' },
];

/** N 構成比較(基準 + 案)のプリセット(デモのツールバー用)。先頭が基準。 */
export const BOM_MULTI_PRESETS: readonly { label: string; codes: readonly string[] }[] = [
  { label: '3 構成', codes: ['A1000', 'A1000-R2', 'A1000-R3'] },
  { label: '4 構成', codes: ['A1000', 'A1000-R2', 'A1000-R3', 'X9000'] },
  { label: '大量 3 構成', codes: ['L5000', 'L5000-R2', 'L5000'] },
];

/** 品番の展開結果を非同期で返します(未登録の品番は空配列 = 片側のみの比較を再現)。 */
export const fetchBom = (itemCode: string): Promise<BomRow[]> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(BOM_DATASETS[itemCode.trim().toUpperCase()] ?? []), 250);
  });
