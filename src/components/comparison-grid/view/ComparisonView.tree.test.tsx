// ComparisonView + useTreeComparison の結合テストです(jsdom + 実グリッド描画)。
//   木モードの「差分のみ」で残る文脈行に .cmpg-row-context が付き、差分行には付かないことを DOM で検証します。
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { installJsdomLayoutStubs } from '@ishibashi0112/spreadsheet-grid/testing';
import { ComparisonView } from './ComparisonView';
import { useTreeComparison } from '../hooks/useTreeComparison';
import { buildComparisonTree } from '../logic/tree';
import type { CompareField } from '../model/types';

let uninstallLayoutStubs: (() => void) | undefined;
beforeAll(() => {
  uninstallLayoutStubs = installJsdomLayoutStubs();
});

afterAll(() => {
  uninstallLayoutStubs?.();
});

afterEach(() => {
  cleanup();
});

type Row = { code: string; level: number; qty: number };
const row = (code: string, level: number, qty = 1): Row => ({ code, level, qty });
const getLevel = (r: Row) => r.level;
const getCode = (r: Row) => r.code;
const compareFields: CompareField<Row>[] = [{ key: 'qty', label: '数量' }];
const columns: GridColumn<Row>[] = [
  { key: 'code', title: 'コード', width: 100 },
  { key: 'qty', title: '数量', width: 80 },
];

// 左: A(B(C)) / E。右: A(B(C 数量 2)) / E → C が差分、A / B は文脈行、E は落ちる。
const leftTree = buildComparisonTree([row('A', 1), row('B', 2), row('C', 3), row('E', 1)], { getLevel }).roots;
const rightTree = buildComparisonTree([row('A', 1), row('B', 2), row('C', 3, 2), row('E', 1)], { getLevel }).roots;

function Harness({ showDiffOnly, showDiffLabelColumn }: { showDiffOnly: boolean; showDiffLabelColumn?: boolean }) {
  const comparison = useTreeComparison<Row>({
    left: leftTree,
    right: rightTree,
    getCode,
    compareFields,
    showDiffOnly,
  });
  return (
    <ComparisonView<Row>
      comparison={comparison}
      columns={columns}
      showDiffLabelColumn={showDiffLabelColumn}
    />
  );
}

const textsOf = (elements: NodeListOf<Element>) =>
  new Set(Array.from(elements).map((el) => el.textContent?.trim()));

describe('ComparisonView(木モード)', () => {
  it('「差分のみ」で残った文脈行に .cmpg-row-context が付き、差分行には付かない', () => {
    const { container } = render(<Harness showDiffOnly />);
    const contextCells = container.querySelectorAll('.cmpg-pane--left .ssg-body-cell.cmpg-row-context');
    expect(contextCells.length).toBeGreaterThan(0);
    const contextTexts = textsOf(contextCells);
    expect(contextTexts.has('A')).toBe(true);
    expect(contextTexts.has('B')).toBe(true);
    expect(contextTexts.has('C')).toBe(false);
    // 差分行は差分クラスのみ。
    const diffCells = container.querySelectorAll('.cmpg-pane--left .ssg-body-cell.cmpg-row-diff');
    expect(textsOf(diffCells).has('C')).toBe(true);
    Array.from(diffCells).forEach((cell) => expect(cell.classList.contains('cmpg-row-context')).toBe(false));
    // E は表示されない。
    const allTexts = textsOf(container.querySelectorAll('.cmpg-pane--left .ssg-body-cell'));
    expect(allTexts.has('E')).toBe(false);
  });

  it('自身は same で配下に差分がある行に .cmpg-row-rollup が付き、差分ラベル列に配下差分ラベルが出る', () => {
    const { container } = render(<Harness showDiffOnly={false} showDiffLabelColumn />);
    const rollupCells = container.querySelectorAll('.cmpg-pane--left .ssg-body-cell.cmpg-row-rollup');
    const rollupTexts = textsOf(rollupCells);
    expect(rollupTexts.has('A')).toBe(true);
    expect(rollupTexts.has('B')).toBe(true);
    expect(rollupTexts.has('C')).toBe(false);
    expect(rollupTexts.has('E')).toBe(false);
    expect(rollupTexts.has('配下に差分 1 件')).toBe(true);
    // 差分行には rollup が付かず、差分ラベルは自身のもの。
    const diffCells = container.querySelectorAll('.cmpg-pane--left .ssg-body-cell.cmpg-row-diff');
    expect(textsOf(diffCells).has('数量違い')).toBe(true);
    Array.from(diffCells).forEach((cell) => expect(cell.classList.contains('cmpg-row-rollup')).toBe(false));
  });

  it('フィルタ無しでは文脈行クラスは付かない', () => {
    const { container } = render(<Harness showDiffOnly={false} />);
    expect(container.querySelectorAll('.ssg-body-cell.cmpg-row-context')).toHaveLength(0);
    expect(textsOf(container.querySelectorAll('.cmpg-pane--left .ssg-body-cell')).has('E')).toBe(true);
  });
});
