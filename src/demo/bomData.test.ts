// デモ用の大量 BOM 生成器のテストです。決定性(毎回同じ内容)と、スクロール同期 / 差分ジャンプの
//   確認に必要な性質(十分な行数・全種類の差分・キー重複なし)を固定します。
import { describe, expect, it } from 'vitest';
import { BOM_DATASETS, BOM_PRESETS, generateLargeBomPair, type BomRow } from './bomData';

type DiffSummary = { same: number; fieldDiff: number; leftOnly: number; rightOnly: number };

const summarize = (left: readonly BomRow[], right: readonly BomRow[]): DiffSummary => {
  const rightByPath = new Map(right.map((row) => [row.itemPath, row]));
  const leftByPath = new Map(left.map((row) => [row.itemPath, row]));
  const summary: DiffSummary = { same: 0, fieldDiff: 0, leftOnly: 0, rightOnly: 0 };
  for (const row of left) {
    const other = rightByPath.get(row.itemPath);
    if (!other) summary.leftOnly++;
    else if (other.qty !== row.qty || other.shikiyuKbn !== row.shikiyuKbn) summary.fieldDiff++;
    else summary.same++;
  }
  for (const row of right) if (!leftByPath.has(row.itemPath)) summary.rightOnly++;
  return summary;
};

const uniquePaths = (rows: readonly BomRow[]) => new Set(rows.map((row) => row.itemPath)).size;

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

  it('itemPath(突き合わせキー)は左右とも重複しない', () => {
    const { base, revision } = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 70 });
    expect(uniquePaths(base)).toBe(base.length);
    expect(uniquePaths(revision)).toBe(revision.length);
  });

  it('階層パスは親子関係と整合する(level n の行のパスは n 要素)', () => {
    const { base, revision } = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 30 });
    for (const row of [...base, ...revision]) {
      expect(row.itemPath.split('/')).toHaveLength(row.levelNo);
      expect(row.itemPath.endsWith(row.itemCode)).toBe(true);
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
    // 後継品番: 代表品番で旧品番を指し、置換前のパスに代表品番を当てると左と突き合う。
    const successors = revision.filter((row) => row.reprItemCode !== '');
    expect(successors.length).toBeGreaterThan(0);
    const basePaths = new Set(base.map((row) => row.itemPath));
    for (const row of successors) {
      expect(row.itemCode).toBe(`${row.reprItemCode}A`);
      expect(basePaths.has(row.itemPath.replace(row.itemCode, row.reprItemCode))).toBe(true);
    }
  });

  it('変更なしゾーン(行 100〜199)は旧構成と同じ行が並ぶ', () => {
    const { base, revision } = generateLargeBomPair({ code: 'T', name: 'テスト', assemblyCount: 70 });
    const revisionByPath = new Map(revision.map((row) => [row.itemPath, row]));
    for (let i = 100; i < 200; i++) {
      const row = base[i];
      const other = revisionByPath.get(row.itemPath);
      expect(other, `row ${i} (${row.itemPath}) は新構成にも存在する`).toBeDefined();
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
