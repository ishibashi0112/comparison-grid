// ComparisonView を実際に描画し、SpreadsheetGrid へのハイライト配線を検証する結合テストです。
//   - 2 ペイン + ヘッダースロット
//   - 差分行クラス(.cmpg-row-diff)/ キー列セル / 差分フィールドセル / 差分ラベル列
//   - enable* の無効化と利用側 getRowClassName / cellClassName との共存
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import { ComparisonView } from './ComparisonView';
import { useComparison } from '../hooks/useComparison';
import type { CompareField, ComparisonViewProps, UseComparisonOptions } from '../model/types';

// jsdom には ResizeObserver / Element.scrollTo が無い(SpreadsheetGrid がマウント時に使う)ため最小スタブ。
//   また jsdom はレイアウトを持たず clientHeight / clientWidth / getBoundingClientRect が 0 のため、
//   仮想化された本体行が 1 行も描画されません。ビューポート寸法を固定値で返すスタブを入れて
//   実グリッドに行 / セルを描画させ、ハイライトの配線を DOM で検証します。
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 600,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 1200,
  });
  Element.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 600,
      right: 1200,
      width: 1200,
      height: 600,
      toJSON: () => ({}),
    }) as DOMRect;
  // 列仮想化(@tanstack/react-virtual)はスクロール要素の矩形を ResizeObserver の通知から得るため、
  //   observe 時に固定寸法で即時コールバックするスタブを入れます(no-op だと列が 1 本も描画されません)。
  type ResizeObserverCallbackLike = (entries: unknown[], observer: unknown) => void;
  class ResizeObserverStub {
    private readonly callback: ResizeObserverCallbackLike;
    constructor(callback: ResizeObserverCallbackLike) {
      this.callback = callback;
    }
    observe(target: Element): void {
      const size = { inlineSize: 1200, blockSize: 600 };
      this.callback(
        [
          {
            target,
            contentRect: { width: 1200, height: 600, top: 0, left: 0 },
            borderBoxSize: [size],
            contentBoxSize: [size],
          },
        ],
        this,
      );
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
});

afterEach(() => {
  cleanup();
});

type Row = { id: string; qty: number; kbn: string };
const row = (id: string, qty: number, kbn = '無'): Row => ({ id, qty, kbn });

const compareFields: CompareField<Row>[] = [
  { key: 'qty', label: '数量' },
  { key: 'kbn', label: '支給区分' },
];
const columns: GridColumn<Row>[] = [
  { key: 'id', title: 'ID', width: 80 },
  { key: 'qty', title: '数量', width: 80 },
  { key: 'kbn', title: '支給', width: 80 },
];

// left: A(same) / B(qty 差分) / C(left-only)。right: A / B / D(right-only)。
const left = [row('A', 1), row('B', 1), row('C', 1)];
const right = [row('A', 1), row('B', 2), row('D', 1)];

type HarnessProps = Partial<UseComparisonOptions<Row>> &
  Omit<ComparisonViewProps<Row>, 'comparison' | 'columns'>;

function Harness({ showDiffOnly, ...viewProps }: HarnessProps) {
  const comparison = useComparison<Row>({
    left,
    right,
    getMatchKey: (r) => r.id,
    compareFields,
    showDiffOnly,
  });
  return <ComparisonView<Row> comparison={comparison} columns={columns} {...viewProps} />;
}

const cellsIn = (root: HTMLElement, side: 'left' | 'right', selector: string) =>
  Array.from(root.querySelectorAll(`.cmpg-pane--${side} ${selector}`));

const cellTexts = (elements: Element[]) => elements.map((el) => el.textContent?.trim());

describe('ComparisonView', () => {
  it('2 ペインとヘッダースロットを描画し、片側だけのヘッダーでも両ペインにスロットが出る', () => {
    const { container } = render(<Harness leftHeader={<span>LEFT HEAD</span>} />);
    expect(container.querySelectorAll('.cmpg-view .cmpg-pane')).toHaveLength(2);
    const headers = container.querySelectorAll('.cmpg-pane-header');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toBe('LEFT HEAD');
    expect(headers[1].textContent).toBe('');
    expect(container.querySelectorAll('.cmpg-grid.ssg-root')).toHaveLength(2);
  });

  it('ヘッダー未指定ならスロットを描画しない', () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll('.cmpg-pane-header')).toHaveLength(0);
  });

  it('差分行 / キー列セル / 差分フィールドセルに既定クラスが付き、差分ラベル列が出る', () => {
    const { container } = render(
      <Harness keyColumnKeys={['id']} showDiffLabelColumn diffLabelColumn={{ title: '変更箇所' }} />,
    );
    // 左: B(field-diff)と C(left-only)の行セルだけ .cmpg-row-diff。
    const leftDiffRows = cellsIn(container, 'left', '.ssg-body-cell.cmpg-row-diff');
    expect(leftDiffRows.length).toBeGreaterThan(0);
    expect(
      cellsIn(container, 'left', '.ssg-body-cell.cmpg-row-diff--left-only').length,
    ).toBeGreaterThan(0);
    expect(cellsIn(container, 'left', '.ssg-body-cell.cmpg-row-diff--right-only')).toHaveLength(0);
    // キー列: 左は C、右は D のセルだけ。
    expect(cellTexts(cellsIn(container, 'left', '.ssg-body-cell.cmpg-cell-diff--key'))).toEqual(['C']);
    expect(cellTexts(cellsIn(container, 'right', '.ssg-body-cell.cmpg-cell-diff--key'))).toEqual(['D']);
    // 差分フィールド: 数量列の B 行だけ(支給区分は同じ)。
    expect(cellTexts(cellsIn(container, 'left', '.ssg-body-cell.cmpg-cell-diff--field'))).toEqual(['1']);
    expect(cellTexts(cellsIn(container, 'right', '.ssg-body-cell.cmpg-cell-diff--field'))).toEqual(['2']);
    // 差分ラベル列。
    expect(container.textContent).toContain('変更箇所');
    expect(container.textContent).toContain('数量違い');
    expect(container.textContent).toContain('左のみ');
    expect(container.textContent).toContain('右のみ');
  });

  it('showDiffOnly で same 行が両ペインから消える', () => {
    const { container } = render(<Harness showDiffOnly keyColumnKeys={['id']} />);
    const leftIds = cellTexts(cellsIn(container, 'left', '.ssg-body-cell')).filter((t) =>
      ['A', 'B', 'C', 'D'].includes(t ?? ''),
    );
    expect(leftIds).toEqual(['B', 'C']);
    const rightIds = cellTexts(cellsIn(container, 'right', '.ssg-body-cell')).filter((t) =>
      ['A', 'B', 'C', 'D'].includes(t ?? ''),
    );
    expect(rightIds).toEqual(['B', 'D']);
  });

  it('enable* を false にするとライブラリのクラスが付かない', () => {
    const { container } = render(
      <Harness
        keyColumnKeys={['id']}
        enableRowHighlight={false}
        enableKeyCellHighlight={false}
        enableFieldCellHighlight={false}
      />,
    );
    expect(container.querySelectorAll('.cmpg-row-diff')).toHaveLength(0);
    expect(container.querySelectorAll('.cmpg-cell-diff')).toHaveLength(0);
  });

  it('利用側の getRowClassName / className と共存する', () => {
    const { container } = render(
      <Harness
        gridProps={{
          className: 'my-grid',
          getRowClassName: (r) => (r.id === 'B' ? 'user-row-b' : undefined),
        }}
        rightGridProps={{ className: 'my-right-grid' }}
      />,
    );
    const userCells = Array.from(container.querySelectorAll('.cmpg-pane--left .ssg-body-cell.user-row-b'));
    expect(userCells.length).toBeGreaterThan(0);
    expect(userCells.every((el) => el.classList.contains('cmpg-row-diff'))).toBe(true);
    expect(container.querySelector('.cmpg-pane--left .ssg-root')?.classList.contains('my-grid')).toBe(true);
    expect(container.querySelector('.cmpg-pane--right .ssg-root')?.classList.contains('my-right-grid')).toBe(true);
    expect(container.querySelector('.cmpg-pane--right .ssg-root')?.classList.contains('cmpg-grid')).toBe(true);
  });
});
