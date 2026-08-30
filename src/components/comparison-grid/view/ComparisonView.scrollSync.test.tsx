// enableScrollSync(左右ペインの縦スクロール同期)の結合テストです。
//   jsdom は実レイアウト / 実スクロールを持たないため、spreadsheet-grid の scrollApi テストと
//   同じ手法を使います:
//   - installJsdomLayoutStubs() で行・列を描画させる
//   - scrollHeight / scrollWidth を大きな固定値の getter にしてスクロール可能量を与える
//     (0 のままだと setScrollPosition がすべて 0 へクランプされる)
//   - scrollTo を「scrollTop / scrollLeft を即時反映して scroll イベントを発火する」スタブに差し替える
//   - onScroll 通知は rAF で間引かれるため、フレームを流してから検証する
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { createRef } from 'react';
import type { GridColumn } from '@ishibashi0112/spreadsheet-grid';
import type {
  GridScrollEventParams,
  SpreadsheetGridHandle,
} from '@ishibashi0112/spreadsheet-grid';
import { installJsdomLayoutStubs } from '@ishibashi0112/spreadsheet-grid/testing';
import { ComparisonView } from './ComparisonView';
import { useComparison } from '../hooks/useComparison';
import type { ComparisonViewProps, UseComparisonOptions } from '../model/types';

let uninstallLayoutStubs: (() => void) | undefined;
beforeAll(() => {
  uninstallLayoutStubs = installJsdomLayoutStubs();
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => 10000,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => 5000,
  });
  Element.prototype.scrollTo = function scrollToStub(
    optionsOrX?: ScrollToOptions | number,
    y?: number,
  ) {
    const options: ScrollToOptions =
      typeof optionsOrX === 'number' ? { left: optionsOrX, top: y } : (optionsOrX ?? {});
    const before = { top: this.scrollTop, left: this.scrollLeft };
    if (options.top !== undefined) this.scrollTop = options.top;
    if (options.left !== undefined) this.scrollLeft = options.left;
    if (before.top !== this.scrollTop || before.left !== this.scrollLeft) {
      this.dispatchEvent(new Event('scroll'));
    }
  };
});

afterAll(() => {
  delete (HTMLElement.prototype as { scrollHeight?: unknown }).scrollHeight;
  delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth;
  uninstallLayoutStubs?.();
});

afterEach(() => {
  cleanup();
});

// rAF 通知(間引き)を 1 フレームぶん流します。
const flushAnimationFrame = async () => {
  await act(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
};

type Row = { id: string; qty: number };
const rows: Row[] = Array.from({ length: 100 }, (_, i) => ({ id: `R${i}`, qty: i }));
const columns: GridColumn<Row>[] = [
  { key: 'id', title: 'ID', width: 120 },
  { key: 'qty', title: '数量', width: 120 },
];
const getMatchKey = (r: Row) => r.id;

type HarnessProps = Partial<UseComparisonOptions<Row>> &
  Omit<ComparisonViewProps<Row>, 'comparison' | 'columns'>;

function Harness({ alignRows, ...viewProps }: HarnessProps) {
  const comparison = useComparison<Row>({
    left: rows,
    right: rows.map((r) => ({ ...r })),
    getMatchKey,
    compareFields: [{ key: 'qty', label: '数量' }],
    alignRows,
  });
  return <ComparisonView<Row> comparison={comparison} columns={columns} {...viewProps} />;
}

const scrollElOf = (container: HTMLElement, side: 'left' | 'right'): HTMLElement => {
  const el = container.querySelector(`.cmpg-pane--${side} .ssg-scroll-container`);
  if (!(el instanceof HTMLElement)) throw new Error(`${side} のスクロールコンテナが見つかりません`);
  return el;
};

const userScroll = async (el: HTMLElement, position: { top?: number; left?: number }) => {
  await act(async () => {
    if (position.top !== undefined) el.scrollTop = position.top;
    if (position.left !== undefined) el.scrollLeft = position.left;
    el.dispatchEvent(new Event('scroll'));
  });
  await flushAnimationFrame();
};

describe('ComparisonView enableScrollSync', () => {
  it('左のユーザースクロールが右へ伝わり、縦のみ同期される(横は伝えない)', async () => {
    const { container } = render(<Harness alignRows enableScrollSync />);
    const leftEl = scrollElOf(container, 'left');
    const rightEl = scrollElOf(container, 'right');

    await userScroll(leftEl, { top: 240 });
    expect(rightEl.scrollTop).toBe(240);
    expect(leftEl.scrollTop).toBe(240);

    await userScroll(leftEl, { left: 120 });
    expect(rightEl.scrollLeft).toBe(0);
    expect(rightEl.scrollTop).toBe(240);
  });

  it('右のユーザースクロールも左へ伝わる(双方向)', async () => {
    const { container } = render(<Harness alignRows enableScrollSync />);
    const leftEl = scrollElOf(container, 'left');
    const rightEl = scrollElOf(container, 'right');

    await userScroll(rightEl, { top: 480 });
    expect(leftEl.scrollTop).toBe(480);
  });

  it("layout='vertical'(縦並び)では縦横とも同期される", async () => {
    const { container } = render(<Harness alignRows enableScrollSync layout="vertical" />);
    const leftEl = scrollElOf(container, 'left');
    const rightEl = scrollElOf(container, 'right');

    await userScroll(leftEl, { top: 240, left: 120 });
    expect(rightEl.scrollTop).toBe(240);
    expect(rightEl.scrollLeft).toBe(120);

    // 双方向: 下(right)の横スクロールも上(left)へ伝わる。
    await userScroll(rightEl, { left: 300 });
    expect(leftEl.scrollLeft).toBe(300);
  });

  it("同期由来(source 'api')のスクロールは相手へ戻さず、利用側 onScroll へは透過する", async () => {
    const events: { side: string; params: GridScrollEventParams }[] = [];
    const { container } = render(
      <Harness
        alignRows
        enableScrollSync
        leftGridProps={{ onScroll: (params) => events.push({ side: 'left', params }) }}
        rightGridProps={{ onScroll: (params) => events.push({ side: 'right', params }) }}
      />,
    );
    const leftEl = scrollElOf(container, 'left');
    const rightEl = scrollElOf(container, 'right');

    await userScroll(leftEl, { top: 100 });
    // 右の 'api' 通知(次フレーム)まで流してもループしない。
    await flushAnimationFrame();
    await flushAnimationFrame();

    expect(leftEl.scrollTop).toBe(100);
    expect(rightEl.scrollTop).toBe(100);
    expect(events).toEqual([
      { side: 'left', params: { top: 100, left: 0, source: 'user' } },
      { side: 'right', params: { top: 100, left: 0, source: 'api' } },
    ]);
  });

  it('enableScrollSync を指定しなければ同期しない', async () => {
    const { container } = render(<Harness alignRows />);
    const leftEl = scrollElOf(container, 'left');
    const rightEl = scrollElOf(container, 'right');

    await userScroll(leftEl, { top: 240 });
    expect(rightEl.scrollTop).toBe(0);
  });

  it('利用側の ref(leftGridProps={{ ref }})と共存する', async () => {
    const ref = createRef<SpreadsheetGridHandle<Row>>();
    const { container } = render(<Harness alignRows enableScrollSync leftGridProps={{ ref }} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.getScrollPosition()).toEqual({ top: 0, left: 0 });

    // 内部ハンドルも生きている(同期が機能する)。
    await userScroll(scrollElOf(container, 'left'), { top: 60 });
    expect(scrollElOf(container, 'right').scrollTop).toBe(60);
  });
});
