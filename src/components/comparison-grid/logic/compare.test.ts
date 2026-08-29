// compare()(純ロジック)の単体テストです。React / グリッド非依存で node 環境で回します。
import { describe, it, expect } from 'vitest';
import { compare, formatDefaultDiffLabel, DEFAULT_COMPARISON_LABELS } from './compare';
import type { CompareField, CompareOptions, DiffLabelContext } from '../model/types';

type Row = { id: string; qty: number; kbn: string };

const row = (id: string, qty: number, kbn = '無'): Row => ({ id, qty, kbn });

const fields: CompareField<Row>[] = [
  { key: 'qty', label: '数量' },
  { key: 'kbn', label: '支給区分' },
];

const options: CompareOptions<Row> = {
  getMatchKey: (r) => r.id,
  compareFields: fields,
};

describe('compare: 基本判定', () => {
  it('同一キー・同一値は same(ラベル空)で、相手行を counterpart に持つ', () => {
    const left = [row('A', 1)];
    const right = [row('A', 1)];
    const result = compare(left, right, options);
    expect(result.annotatedLeft[0].diff).toMatchObject({
      side: 'left',
      kind: 'same',
      label: '',
      matchKey: 'A',
    });
    expect(result.annotatedLeft[0].diff.counterpart).toBe(right[0]);
    expect(result.annotatedRight[0].diff.counterpart).toBe(left[0]);
    expect(result.annotatedLeft[0].diff.fieldDiffs.size).toBe(0);
    expect(result.hasAnyDiff).toBe(false);
    expect(result.summary).toEqual({
      left: { total: 1, same: 1, only: 0, fieldDiff: 0 },
      right: { total: 1, same: 1, only: 0, fieldDiff: 0 },
    });
  });

  it('相手に無いキーは left-only / right-only になり既定ラベルが付く', () => {
    const left = [row('A', 1), row('B', 1)];
    const right = [row('A', 1), row('C', 1)];
    const result = compare(left, right, options);
    expect(result.annotatedLeft[1].diff).toMatchObject({ kind: 'left-only', label: '左のみ' });
    expect(result.annotatedLeft[1].diff.counterpart).toBeUndefined();
    expect(result.annotatedRight[1].diff).toMatchObject({ kind: 'right-only', label: '右のみ' });
    expect(result.summary.left).toEqual({ total: 2, same: 1, only: 1, fieldDiff: 0 });
    expect(result.summary.right).toEqual({ total: 2, same: 1, only: 1, fieldDiff: 0 });
    expect(result.hasAnyDiff).toBe(true);
  });

  it('単一フィールド差分は field-diff、fieldDiffs にそのキーだけ入り、両側同じラベル', () => {
    const left = [row('A', 1)];
    const right = [row('A', 2)];
    const result = compare(left, right, options);
    const l = result.annotatedLeft[0].diff;
    const r = result.annotatedRight[0].diff;
    expect(l.kind).toBe('field-diff');
    expect(l.label).toBe('数量違い');
    expect([...l.fieldDiffs]).toEqual(['qty']);
    expect(r.kind).toBe('field-diff');
    expect(r.label).toBe('数量違い');
    expect([...r.fieldDiffs]).toEqual(['qty']);
    expect(result.summary.left.fieldDiff).toBe(1);
    expect(result.summary.right.fieldDiff).toBe(1);
  });

  it('複数フィールド差分のラベルは compareFields の宣言順で連結する', () => {
    const left = [row('A', 1, '無')];
    const right = [row('A', 2, '有')];
    const result = compare(left, right, options);
    expect(result.annotatedLeft[0].diff.label).toBe('数量・支給区分違い');
    expect([...result.annotatedLeft[0].diff.fieldDiffs]).toEqual(['qty', 'kbn']);

    const reversed = compare(left, right, {
      ...options,
      compareFields: [fields[1], fields[0]],
    });
    expect(reversed.annotatedLeft[0].diff.label).toBe('支給区分・数量違い');
  });

  it('両方空なら空の結果', () => {
    const result = compare<Row>([], [], options);
    expect(result.annotatedLeft).toEqual([]);
    expect(result.annotatedRight).toEqual([]);
    expect(result.leftDiffs.size).toBe(0);
    expect(result.hasAnyDiff).toBe(false);
    expect(result.summary.left.total).toBe(0);
  });

  it('片側空なら全件が left-only(hasAnyDiff は true)', () => {
    const left = [row('A', 1), row('B', 2)];
    const result = compare<Row>(left, [], options);
    expect(result.annotatedLeft.map((e) => e.diff.kind)).toEqual(['left-only', 'left-only']);
    expect(result.summary.left.only).toBe(2);
    expect(result.summary.right.total).toBe(0);
    expect(result.hasAnyDiff).toBe(true);
  });

  it('入力順を保ち、diffs Map は行オブジェクトの同一性で引ける', () => {
    const left = [row('B', 1), row('A', 1), row('C', 1)];
    const right = [row('A', 1)];
    const result = compare(left, right, options);
    expect(result.annotatedLeft.map((e) => e.row)).toEqual(left);
    expect(result.leftDiffs.get(left[0])?.kind).toBe('left-only');
    expect(result.leftDiffs.get(left[1])?.kind).toBe('same');
    expect(result.leftDiffs.get({ ...left[1] })).toBeUndefined();
  });

  it('compareFields が空なら same / left-only / right-only だけになる', () => {
    const result = compare([row('A', 1)], [row('A', 99)], { ...options, compareFields: [] });
    expect(result.annotatedLeft[0].diff.kind).toBe('same');
  });
});

describe('compare: キー重複', () => {
  it('既定(last)は同一側の後の行が相手になり、duplicateKeys に報告される', () => {
    const left = [row('A', 1)];
    const right = [row('A', 1), row('A', 2)];
    const result = compare(left, right, options);
    expect(result.annotatedLeft[0].diff.counterpart).toBe(right[1]);
    expect(result.annotatedLeft[0].diff.kind).toBe('field-diff');
    // 右側の各行はそれぞれ左の行と比較される(同一キーの行は両方とも注釈される)。
    expect(result.annotatedRight.map((e) => e.diff.kind)).toEqual(['same', 'field-diff']);
    expect(result.duplicateKeys).toEqual({ left: [], right: ['A'] });
  });

  it("duplicateKeyPolicy: 'first' は先の行が相手になる", () => {
    const left = [row('A', 1)];
    const right = [row('A', 1), row('A', 2)];
    const result = compare(left, right, { ...options, duplicateKeyPolicy: 'first' });
    expect(result.annotatedLeft[0].diff.counterpart).toBe(right[0]);
    expect(result.annotatedLeft[0].diff.kind).toBe('same');
  });

  it('片側だけに差分行が出る重複ケースでも hasAnyDiff は true', () => {
    // 右に同一キーが 2 行(2, 1)、左は 1 行(1)。左 → 相手は後勝ちで qty 1 → same。
    // 右の 1 行目(qty 2)は左と比較して field-diff。
    const left = [row('A', 1)];
    const right = [row('A', 2), row('A', 1)];
    const result = compare(left, right, options);
    expect(result.summary.left.fieldDiff).toBe(0);
    expect(result.summary.right.fieldDiff).toBe(1);
    expect(result.hasAnyDiff).toBe(true);
  });
});

describe('compare: カスタマイズ', () => {
  it('equals の引数順は (左の値, 右の値) で、右側の注釈でも入れ替わらない', () => {
    const calls: Array<[unknown, unknown]> = [];
    const asymmetric: CompareField<Row>[] = [
      {
        key: 'qty',
        label: '数量',
        equals: (l, r) => {
          calls.push([l, r]);
          return Number(l) >= Number(r);
        },
      },
    ];
    const left = [row('A', 2)];
    const right = [row('A', 1)];
    const result = compare(left, right, { ...options, compareFields: asymmetric });
    expect(result.annotatedLeft[0].diff.kind).toBe('same');
    expect(result.annotatedRight[0].diff.kind).toBe('same');
    expect(calls).toEqual([
      [2, 1],
      [2, 1],
    ]);
  });

  it('custom equals で数値 / 文字列の混在を同一視できる', () => {
    type Mixed = { id: string; qty: number | string };
    const numeric: CompareOptions<Mixed> = {
      getMatchKey: (r) => r.id,
      compareFields: [{ key: 'qty', label: '数量', equals: (a, b) => Number(a) === Number(b) }],
    };
    const strict = compare<Mixed>([{ id: 'A', qty: 5 }], [{ id: 'A', qty: '5' }], {
      ...numeric,
      compareFields: [{ key: 'qty', label: '数量' }],
    });
    expect(strict.annotatedLeft[0].diff.kind).toBe('field-diff');
    const loose = compare<Mixed>([{ id: 'A', qty: 5 }], [{ id: 'A', qty: '5' }], numeric);
    expect(loose.annotatedLeft[0].diff.kind).toBe('same');
  });

  it('custom getValue で計算値を比較できる(columnKey は判定に影響しない)', () => {
    const computed: CompareField<Row>[] = [
      { key: 'double', label: '倍量', getValue: (r) => r.qty * 2, columnKey: 'qty' },
    ];
    const result = compare([row('A', 1)], [row('A', 2)], { ...options, compareFields: computed });
    expect(result.annotatedLeft[0].diff.kind).toBe('field-diff');
    expect([...result.annotatedLeft[0].diff.fieldDiffs]).toEqual(['double']);
    expect(result.annotatedLeft[0].diff.label).toBe('倍量違い');
  });

  it('formatDiffLabel でラベルを差し替えられる(side / diffFields を受け取る)', () => {
    const seen: DiffLabelContext<Row>[] = [];
    const result = compare([row('A', 1), row('B', 1)], [row('A', 2)], {
      ...options,
      formatDiffLabel: (ctx) => {
        seen.push(ctx);
        if (ctx.kind === 'field-diff') return `${ctx.side}:${ctx.diffFields.map((f) => f.key).join('+')}`;
        return ctx.kind;
      },
    });
    expect(result.annotatedLeft.map((e) => e.diff.label)).toEqual(['left:qty', 'left-only']);
    expect(result.annotatedRight.map((e) => e.diff.label)).toEqual(['right:qty']);
    expect(seen[0].labels).toEqual(DEFAULT_COMPARISON_LABELS);
    expect(seen[0].counterpart).toBeDefined();
  });

  it('labels で既定文言を部分上書きできる', () => {
    const result = compare([row('A', 1, '無'), row('B', 1)], [row('A', 2, '有'), row('C', 1)], {
      ...options,
      labels: { leftOnly: 'L only', fieldDiffSeparator: ', ', fieldDiffSuffix: ' differ' },
    });
    expect(result.annotatedLeft[0].diff.label).toBe('数量, 支給区分 differ');
    expect(result.annotatedLeft[1].diff.label).toBe('L only');
    // 上書きしていない文言は既定のまま。
    expect(result.annotatedRight[1].diff.label).toBe('右のみ');
  });

  it('getMatchKey の差し替えで「代表品番比較」相当を表現できる', () => {
    type Bom = { itemPath: string; itemCode: string; reprItemCode: string; qty: number };
    const left: Bom[] = [{ itemPath: 'P1/B2003', itemCode: 'B2003', reprItemCode: '', qty: 1 }];
    const right: Bom[] = [{ itemPath: 'P1/B2004', itemCode: 'B2004', reprItemCode: 'B2003', qty: 1 }];
    const compareFields: CompareField<Bom>[] = [{ key: 'qty', label: '数量' }];
    const byPath = compare(left, right, { getMatchKey: (r) => r.itemPath, compareFields });
    expect(byPath.annotatedLeft[0].diff.kind).toBe('left-only');
    const byRepr = compare(left, right, {
      getMatchKey: (r) => r.itemPath.replace(r.itemCode, r.reprItemCode || r.itemCode),
      compareFields,
    });
    expect(byRepr.annotatedLeft[0].diff.kind).toBe('same');
    expect(byRepr.annotatedRight[0].diff.counterpart).toBe(left[0]);
  });
});

describe('formatDefaultDiffLabel', () => {
  const base: Omit<DiffLabelContext<Row>, 'kind' | 'diffFields'> = {
    side: 'left',
    row: row('A', 1),
    fieldDiffs: new Set(),
    labels: DEFAULT_COMPARISON_LABELS,
  };
  it('種別ごとの既定文言', () => {
    expect(formatDefaultDiffLabel({ ...base, kind: 'same', diffFields: [] })).toBe('');
    expect(formatDefaultDiffLabel({ ...base, kind: 'left-only', diffFields: [] })).toBe('左のみ');
    expect(formatDefaultDiffLabel({ ...base, kind: 'right-only', diffFields: [] })).toBe('右のみ');
    expect(formatDefaultDiffLabel({ ...base, kind: 'field-diff', diffFields: fields })).toBe(
      '数量・支給区分違い',
    );
  });
});
