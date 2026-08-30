// デモ用の大量 BOM 生成器のテストです。決定性(毎回同じ内容)と、スクロール同期 / 差分ジャンプの
//   確認に必要な性質(十分な行数・全種類の差分・キー重複なし)を固定します。
import { describe, expect, it } from 'vitest';
import { buildComparisonTree, flattenComparisonTree } from '../components/comparison-grid';
import { BOM_DATASETS, BOM_PRESETS, generateLargeBomPair, type BomRow } from './bomData';

type DiffSummary = { same: number; fieldDiff: number; leftOnly: number; rightOnly: number };

/** ライブラリと同じ規則でパスキーを導出する(level 順 → 木 → 平坦化)。 */
const keyed = (rows: readonly BomRow[], useRepr = false) => {
  const { roots, issues } = buildComparisonTree(rows, { getLevel: (row) => row.levelNo });
  const { infos } = flattenComparisonTree(roots, {
    getCode: (row) => row.itemCode,
    getRepresentativeCode: useRepr ? (row) => row.reprItemCode : undefined,
  });
  const keyOf = (row: BomRow) => infos.get(row)?.matchKey ?? '';
  return { infos, issues, keyOf, byKey: new Map(rows.map((row) => [keyOf(row), row])) };
};

const summarize = (left: readonly BomRow[], right: readonly BomRow[]): DiffSummary => {
  const l = keyed(left);
  const r = keyed(right);
  const summary: DiffSummary = { same: 0, fieldDiff: 0, leftOnly: 0, rightOnly: 0 };
  for (const row of left) {
    const other = r.byKey.get(l.keyOf(row));
    if (!other) summary.leftOnly++;
    else if (other.qty !== row.qty || other.shikiyuKbn !== row.shikiyuKbn) summary.fieldDiff++;
    else summary.same++;
  }
  for (const row of right) if (!l.byKey.has(r.keyOf(row))) summary.rightOnly++;
  return summary;
};

describe('generateLargeBomPair', () => {
  it('同じ引数なら毎回同じ内容を返す(決定的)', () => {
    const a = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 20 });
    const b = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 20 });
    expect(a).toEqual(b);
  });

  it('シードが違えば内容も変わる', () => {
    const a = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 20, seed: 1 });
    const b = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 20, seed: 2 });
    expect(a.base).not.toEqual(b.base);
  });

  it('パスキーは左右とも重複しない(兄弟重複の出現番号 #n が付かない)', () => {
    const { base, revision } = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 70 });
    for (const rows of [base, revision]) {
      const { byKey, keyOf } = keyed(rows);
      expect(byKey.size).toBe(rows.length);
      for (const row of rows) expect(keyOf(row)).not.toContain('#');
    }
  });

  it('階層は level と整合し、木の構築で問題が報告されない', () => {
    const { base, revision } = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 30 });
    for (const rows of [base, revision]) {
      const { infos, issues, keyOf } = keyed(rows);
      expect(issues).toEqual([]);
      for (const row of rows) {
        expect(infos.get(row)?.depth).toBe(row.levelNo - 1);
        expect(keyOf(row).split('/')).toHaveLength(row.levelNo);
        expect(keyOf(row).endsWith(row.itemCode)).toBe(true);
      }
    }
  });

  it('新構成には全種類の差分(項目違い / 左のみ / 右のみ / 後継品番)が含まれる', () => {
    const { base, revision } = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 70 });
    const summary = summarize(base, revision);
    expect(summary.fieldDiff).toBeGreaterThan(0);
    expect(summary.leftOnly).toBeGreaterThan(0);
    expect(summary.rightOnly).toBeGreaterThan(0);
    // 多数派は同一行(差分ジャンプで飛ぶ余地がある)。
    expect(summary.same).toBeGreaterThan(summary.fieldDiff + summary.leftOnly + summary.rightOnly);
    // 後継品番: 代表品番で旧品番を指し、代表品番比較のキーなら左と突き合う。
    const successors = revision.filter((row) => row.reprItemCode !== '');
    expect(successors.length).toBeGreaterThan(0);
    const baseKeys = keyed(base);
    const revisionReprKeys = keyed(revision, true);
    for (const row of successors) {
      expect(row.itemCode).toBe(`${row.reprItemCode}A`);
      expect(baseKeys.byKey.has(revisionReprKeys.keyOf(row))).toBe(true);
    }
  });

  it('変更なしゾーン(行 100〜199)は旧構成と同じ行が並ぶ', () => {
    const { base, revision } = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 70 });
    const baseKeys = keyed(base);
    const revisionKeys = keyed(revision);
    for (let i = 100; i < 200; i++) {
      const row = base[i];
      const other = revisionKeys.byKey.get(baseKeys.keyOf(row));
      expect(other, `row ${i} (${baseKeys.keyOf(row)}) は新構成にも存在する`).toBeDefined();
      expect(other?.qty).toBe(row.qty);
      expect(other?.shikiyuKbn).toBe(row.shikiyuKbn);
    }
  });
});

describe('BOM_DATASETS(登録済みデータ)', () => {
  it('大量 / 超大量プリセットは 1 画面(約 28 行)を大きく超える行数を持つ', () => {
    expect(BOM_DATASETS.L5000.length).toBeGreaterThanOrEqual(400);
    expect(BOM_DATASETS['L5000-R2'].length).toBeGreaterThanOrEqual(400);
    expect(BOM_DATASETS.L9000.length).toBeGreaterThanOrEqual(2500);
    expect(BOM_DATASETS['L9000-R2'].length).toBeGreaterThanOrEqual(2500);
  });

  it('プリセットの品番はすべて登録済み', () => {
    for (const preset of BOM_PRESETS) {
      expect(BOM_DATASETS[preset.left], preset.left).toBeDefined();
      expect(BOM_DATASETS[preset.right], preset.right).toBeDefined();
    }
  });

  it('ルート情報は品番ごとに揃っている', () => {
    for (const [code, rows] of Object.entries(BOM_DATASETS)) {
      for (const row of rows) expect(row.rootItemCode).toBe(code);
    }
  });
});
