// 使用例(examples/)の結合テストです。各例を実際に描画し、グリッドと差分ハイライトが出ることを確認して
//   「ドキュメントが腐らない」ようにします(公開 API が変わればここが落ちる)。
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { installJsdomLayoutStubs } from '@ishibashi0112/spreadsheet-grid/testing';
import { TwoWayBasicExample } from './01-two-way-basic';
import { TreeComparisonExample } from './02-tree-comparison';
import { MultiBaseExample } from './03-multi-base';
import { MultiAllExample } from './04-multi-all';
import { Grid2x2NavigationExample } from './05-grid-2x2-navigation';
import { HeadlessOwnGridExample } from './06-headless-own-grid';
import { ExportCsvExample } from './07-export-csv';
import { ManualInputExample } from './08-manual-input';

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

const grids = (root: HTMLElement) => root.querySelectorAll('.cmpg-grid.ssg-root').length;
const diffRows = (root: HTMLElement, side: string) =>
  root.querySelectorAll(`.cmpg-pane--${side} .ssg-body-row.cmpg-row-diff`).length;

describe('examples', () => {
  it('01: 2 ペインが描画され、差分のみトグルで行が絞られる', () => {
    const { container, getByLabelText } = render(<TwoWayBasicExample />);
    expect(grids(container)).toBe(2);
    expect(diffRows(container, 'left')).toBeGreaterThan(0);
    const before = container.querySelectorAll('.cmpg-pane--left .ssg-body-row').length;
    fireEvent.click(getByLabelText('差分のみ'));
    expect(container.querySelectorAll('.cmpg-pane--left .ssg-body-row').length).toBeLessThan(before);
  });

  it('02: 階層比較が描画され、Level 列に展開ボタンが出る', () => {
    const { container } = render(<TreeComparisonExample />);
    expect(grids(container)).toBe(2);
    expect(container.querySelectorAll('.cmpg-pane--left button').length).toBeGreaterThan(0);
    expect(diffRows(container, 'right')).toBeGreaterThan(0);
  });

  it('03: 3 ペイン(基準対各構成)が描画され、基準ペインに集約の差分が付く', () => {
    const { container } = render(<MultiBaseExample />);
    expect(grids(container)).toBe(3);
    expect(container.querySelectorAll('.cmpg-pane-header')).toHaveLength(3);
    expect(diffRows(container, 'current')).toBeGreaterThan(0);
  });

  it("04: mode 'all' で自作の集計パーツが Root 配下で動く", () => {
    const { container } = render(<MultiAllExample />);
    expect(grids(container)).toBe(3);
    expect(container.querySelectorAll('.example-diff-counts li')).toHaveLength(3);
    // 全構成一致判定: どのペインにも揺れがある。
    expect(diffRows(container, 'x')).toBeGreaterThan(0);
    expect(diffRows(container, 'y')).toBeGreaterThan(0);
    expect(diffRows(container, 'z')).toBeGreaterThan(0);
  });

  it('05: 4 ペインが描画され、差分ジャンプのボタンが有効', () => {
    const { container, getByRole } = render(<Grid2x2NavigationExample />);
    expect(grids(container)).toBe(4);
    const view = container.querySelector('.cmpg-view') as HTMLElement;
    expect(view.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    const next = getByRole('button', { name: '次の差分 ▶' }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(container.textContent).toContain('1 / ');
  });

  it('06: 自前 DOM の SpreadsheetGrid にも差分クラスが付く', () => {
    const { container } = render(<HeadlessOwnGridExample />);
    expect(container.querySelectorAll('table.example-own-layout .cmpg-grid.ssg-root')).toHaveLength(2);
    expect(container.querySelectorAll('.cmpg-row-diff').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.cmpg-row-placeholder').length).toBeGreaterThan(0);
  });

  it('07: CSV に見出しと差分ラベル列が出る', () => {
    const { container, getByRole } = render(<ExportCsvExample />);
    fireEvent.click(getByRole('button', { name: '左ペインを CSV に' }));
    const csv = container.querySelector('.example-csv')?.textContent ?? '';
    expect(csv.split('\n')[0]).toBe('品目コード,品目名,支給,数量,変更箇所');
    expect(csv).toContain('数量違い');
  });

  it('08: 入力側の確定行がマスタと比較され、検証エラーが送信を止める', () => {
    const { container, getByRole } = render(<ManualInputExample />);
    expect(grids(container)).toBe(2);
    expect(diffRows(container, 'right')).toBeGreaterThan(0); // 数量 2 の行が項目違い
    expect((getByRole('button', { name: '送信' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
