// compareMany()(N 構成比較の純ロジック)の単体テストです(node 環境)。
import { describe, it, expect } from 'vitest';
import { compareMany, formatDefaultMultiDiffLabel, DEFAULT_COMPARISON_MULTI_LABELS } from './compareMany';
import type { CompareField, CompareManyOptions, MultiDiffLabelContext } from '../model/types';

type Row = { id: string; qty: number; kbn: string };
const row = (id: string, qty: number, kbn = '無'): Row => ({ id, qty, kbn });

const fields: CompareField<Row>[] = [
  { key: 'qty', label: '数量' },
  { key: 'kbn', label: '支給区分' },
];
const options: CompareManyOptions<Row> = { getMatchKey: (r) => r.id, compareFields: fields };

// base: A / B / C / D。planA: A(same) / B(qty 違い) / D。planB: A / B(kbn 違い) / C / E。
//   → A: same、B: field-diff(和集合 qty・kbn)、C: partial(planA に無い)、D: partial(planB に無い)、
//     E: planB のみ。
const base = [row('A', 1), row('B', 1), row('C', 1), row('D', 1)];
const planA = [row('A', 1), row('B', 2), row('D', 1)];
const planB = [row('A', 1), row('B', 1, '有'), row('C', 1), row('E', 1)];
const sides = [
  { id: 'base', rows: base, label: '現行' },
  { id: 'a', rows: planA, label: '案1' },
  { id: 'b', rows: planB, label: '案2' },
];

describe('compareMany: 基準ペインの集約', () => {
  const result = compareMany(sides, options);
  const baseSide = result.sidesById.get('base')!;
  const diffOf = (r: Row) => baseSide.diffs.get(r)!;

  it('基準は sides[0] で、構成別結果は入力順・isBase / label を持つ', () => {
    expect(result.baseId).toBe('base');
    expect(result.sides.map((s) => [s.id, s.label, s.isBase])).toEqual([
      ['base', '現行', true],
      ['a', '案1', false],
      ['b', '案2', false],
    ]);
    expect(baseSide.rows).toBe(base);
    expect([...result.pairs.keys()]).toEqual(['a', 'b']);
  });

  it('全構成と一致する行は same(ラベル空)で、counterparts に各構成の行を持つ', () => {
    const d = diffOf(base[0]);
    expect(d).toMatchObject({ sideId: 'base', isBase: true, kind: 'same', label: '', matchKey: 'A' });
    expect(d.counterparts.get('a')).toBe(planA[0]);
    expect(d.counterparts.get('b')).toBe(planB[0]);
    expect(d.missingIn.size).toBe(0);
    expect(d.bySide.get('a')?.kind).toBe('same');
  });

  it('フィールド差分は和集合になり、ラベルは構成ごとの内訳を入力順に連結する', () => {
    const d = diffOf(base[1]);
    expect(d.kind).toBe('field-diff');
    expect([...d.fieldDiffs]).toEqual(['qty', 'kbn']);
    expect(d.label).toBe('案1: 数量違い / 案2: 支給区分違い');
    expect(d.bySide.get('a')?.fieldDiffs.has('qty')).toBe(true);
    expect(d.bySide.get('b')?.fieldDiffs.has('kbn')).toBe(true);
  });

  it('一部の構成に無い行は partial で、missingIn にその構成 ID が入り内訳は「無し」', () => {
    const c = diffOf(base[2]);
    expect(c.kind).toBe('partial');
    expect([...c.missingIn]).toEqual(['a']);
    expect(c.counterparts.get('b')).toBe(planB[2]);
    expect(c.label).toBe('案1: 無し');
    expect(c.bySide.get('a')?.kind).toBe('left-only');

    const d = diffOf(base[3]);
    expect(d.kind).toBe('partial');
    expect([...d.missingIn]).toEqual(['b']);
    expect(d.label).toBe('案2: 無し');
  });

  it('どの構成にも無い行は only(基準のみ)', () => {
    const r = compareMany(
      [
        { id: 'base', rows: [row('Z', 1)] },
        { id: 'a', rows: [] },
        { id: 'b', rows: [] },
      ],
      options,
    );
    const d = r.sidesById.get('base')!.diffs.get(r.sidesById.get('base')!.rows[0])!;
    expect(d.kind).toBe('only');
    expect(d.label).toBe('基準のみ');
    expect([...d.missingIn]).toEqual(['a', 'b']);
    expect(r.hasAnyDiff).toBe(true);
  });

  it('一部に無く残りと違う行は field-diff で、missingIn と fieldDiffs の両方を持つ', () => {
    const r = compareMany(
      [
        { id: 'base', rows: [row('A', 1)], label: '現行' },
        { id: 'a', rows: [], label: '案1' },
        { id: 'b', rows: [row('A', 2)], label: '案2' },
      ],
      options,
    );
    const d = r.sidesById.get('base')!.diffs.get(r.sidesById.get('base')!.rows[0])!;
    expect(d.kind).toBe('field-diff');
    expect([...d.missingIn]).toEqual(['a']);
    expect([...d.fieldDiffs]).toEqual(['qty']);
    expect(d.label).toBe('案1: 無し / 案2: 数量違い');
  });

  it('summary は kind ごとの件数、hasAnyDiff はいずれかの構成に same 以外があるか', () => {
    expect(baseSide.summary).toEqual({ total: 4, same: 1, only: 0, partial: 2, fieldDiff: 1 });
    expect(result.hasAnyDiff).toBe(true);
    const allSame = compareMany(
      [
        { id: 'x', rows: [row('A', 1)] },
        { id: 'y', rows: [row('A', 1)] },
      ],
      options,
    );
    expect(allSame.hasAnyDiff).toBe(false);
  });
});

describe('compareMany: 基準以外のペイン', () => {
  const result = compareMany(sides, options);
  const a = result.sidesById.get('a')!;
  const b = result.sidesById.get('b')!;

  it('基準との 2-way 結果を写す(same / field-diff / only)。counterparts は基準のみ', () => {
    expect(a.diffs.get(planA[0])).toMatchObject({ sideId: 'a', isBase: false, kind: 'same', label: '' });
    expect(a.diffs.get(planA[0])!.counterparts.get('base')).toBe(base[0]);
    expect(a.diffs.get(planA[1])).toMatchObject({ kind: 'field-diff', label: '数量違い' });
    expect([...a.diffs.get(planA[1])!.fieldDiffs]).toEqual(['qty']);
    expect(b.diffs.get(planB[3])).toMatchObject({ kind: 'only', label: 'この構成のみ' });
    expect(b.diffs.get(planB[3])!.counterparts.size).toBe(0);
    expect(b.diffs.get(planB[3])!.missingIn.size).toBe(0);
  });

  it('bySide は baseId をキーに 2-way の自側注釈を 1 件持つ', () => {
    const d = b.diffs.get(planB[3])!;
    expect([...d.bySide.keys()]).toEqual(['base']);
    expect(d.bySide.get('base')?.kind).toBe('right-only');
    expect(d.bySide.get('base')?.side).toBe('right');
  });

  it('summary は構成ごと(partial は常に 0)', () => {
    expect(a.summary).toEqual({ total: 3, same: 2, only: 0, partial: 0, fieldDiff: 1 });
    expect(b.summary).toEqual({ total: 4, same: 2, only: 1, partial: 0, fieldDiff: 1 });
  });
});

describe('compareMany: 2 構成のときは 2-way と同じ見た目になる', () => {
  it('基準ペインの内訳ラベルに構成名の接頭辞が付かない', () => {
    const r = compareMany(
      [
        { id: 'base', rows: [row('A', 1), row('B', 1)], label: '現行' },
        { id: 'a', rows: [row('A', 2)], label: '案1' },
      ],
      options,
    );
    const bs = r.sidesById.get('base')!;
    expect(bs.diffs.get(bs.rows[0])!.label).toBe('数量違い');
    expect(bs.diffs.get(bs.rows[1])!.kind).toBe('only');
    expect(bs.diffs.get(bs.rows[1])!.label).toBe('基準のみ');
  });
});

describe('compareMany: baseId / 重複キー / 入力検証', () => {
  it('baseId で基準を選べる(入力順は保たれる)', () => {
    const r = compareMany(sides, { ...options, baseId: 'b' });
    expect(r.baseId).toBe('b');
    expect(r.sides.map((s) => s.isBase)).toEqual([false, false, true]);
    expect([...r.pairs.keys()]).toEqual(['base', 'a']);
    // planB の E は基準になったので、他の 2 構成に無い → only。
    const e = r.sidesById.get('b')!.diffs.get(planB[3])!;
    expect(e.kind).toBe('only');
  });

  it('重複キーは構成ごとに報告され、既定 last(後勝ち)で相手を選ぶ', () => {
    const dupBase = [row('A', 1), row('A', 2)];
    const r = compareMany(
      [
        { id: 'base', rows: dupBase },
        { id: 'a', rows: [row('A', 2)] },
      ],
      options,
    );
    expect(r.sidesById.get('base')!.duplicateKeys).toEqual(['A']);
    expect(r.sidesById.get('a')!.duplicateKeys).toEqual([]);
    // 構成 a の A は基準の後勝ち(qty 2)と対 → same。
    expect(r.sidesById.get('a')!.diffs.get(r.sidesById.get('a')!.rows[0])!.kind).toBe('same');
    const first = compareMany(
      [
        { id: 'base', rows: dupBase },
        { id: 'a', rows: [row('A', 2)] },
      ],
      { ...options, duplicateKeyPolicy: 'first' },
    );
    expect(first.sidesById.get('a')!.diffs.get(first.sidesById.get('a')!.rows[0])!.kind).toBe('field-diff');
  });

  it('基準だけ(他構成なし)は全行 same で hasAnyDiff は false', () => {
    const r = compareMany([{ id: 'base', rows: [row('A', 1)] }], options);
    expect(r.sides[0].diffs.get(r.sides[0].rows[0])!.kind).toBe('same');
    expect(r.sidesById.get('base')!.duplicateKeys).toEqual([]);
    expect(r.hasAnyDiff).toBe(false);
  });

  it('空の sides / 重複 ID / 存在しない baseId は例外', () => {
    expect(() => compareMany([], options)).toThrow(/sides が空/);
    expect(() =>
      compareMany(
        [
          { id: 'x', rows: [] },
          { id: 'x', rows: [] },
        ],
        options,
      ),
    ).toThrow(/重複/);
    expect(() => compareMany([{ id: 'x', rows: [] }], { ...options, baseId: 'nope' })).toThrow(/baseId/);
  });
});

describe('compareMany: ラベルのカスタマイズ', () => {
  it('labels の部分上書きが基準 / 他ペインの両方に効く', () => {
    const r = compareMany(sides, {
      ...options,
      labels: { missingInSide: '欠', sideSeparator: '、', sideLabelSeparator: '=', sideOnly: '追加' },
    });
    expect(r.sidesById.get('base')!.diffs.get(base[1])!.label).toBe('案1=数量違い、案2=支給区分違い');
    expect(r.sidesById.get('base')!.diffs.get(base[2])!.label).toBe('案1=欠');
    expect(r.sidesById.get('b')!.diffs.get(planB[3])!.label).toBe('追加');
  });

  it('formatDiffLabel で完全に差し替えられ、ctx に sides / bySide / diffFields が渡る', () => {
    const seen: MultiDiffLabelContext<Row>[] = [];
    const r = compareMany(sides, {
      ...options,
      formatDiffLabel: (ctx) => {
        seen.push(ctx);
        return `${ctx.sideId}:${ctx.kind}:${ctx.diffFields.map((f) => f.key).join('+')}`;
      },
    });
    expect(r.sidesById.get('base')!.diffs.get(base[1])!.label).toBe('base:field-diff:qty+kbn');
    expect(r.sidesById.get('a')!.diffs.get(planA[1])!.label).toBe('a:field-diff:qty');
    const ctx = seen.find((c) => c.row === base[1])!;
    expect(ctx.sides.map((s) => s.id)).toEqual(['base', 'a', 'b']);
    expect(ctx.bySide.size).toBe(2);
    expect(ctx.labels).toEqual(DEFAULT_COMPARISON_MULTI_LABELS);
  });

  it('formatDefaultMultiDiffLabel は単体でも呼べる', () => {
    const ctx: MultiDiffLabelContext<Row> = {
      sideId: 'a',
      isBase: false,
      kind: 'only',
      row: row('A', 1),
      fieldDiffs: new Set(),
      diffFields: [],
      missingIn: new Set(),
      bySide: new Map(),
      sides: [],
      labels: DEFAULT_COMPARISON_MULTI_LABELS,
    };
    expect(formatDefaultMultiDiffLabel(ctx)).toBe('この構成のみ');
  });
});
