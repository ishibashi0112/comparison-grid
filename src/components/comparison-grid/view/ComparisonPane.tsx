// 片側 1 ペインです。差分の合成は useComparisonPane(ヘッドレス)に任せ、ここではラッパー DOM
//   (.cmpg-pane / ヘッダースロット / .cmpg-pane-body)と SpreadsheetGrid の描画だけを担います。
//   gridProps は rows / columns 以外をそのまま透過します(getRowClassName / className は合成)。
import { SpreadsheetGrid } from '@ishibashi0112/spreadsheet-grid';
import type { ComparisonPaneProps } from '../model/types';
import { useComparisonPane } from '../hooks/useComparisonPane';
import { cx } from '../logic/cx';
import '../styles.css';

export function ComparisonPane<T extends object>(props: ComparisonPaneProps<T>) {
  const { side, header, showHeader = header !== undefined, className, style, ...paneOptions } =
    props;
  const pane = useComparisonPane<T>(paneOptions);

  return (
    <div
      className={cx('cmpg-pane', `cmpg-pane--${side}`, className)}
      style={style}
      data-cmpg-side={side}
    >
      {showHeader ? <div className="cmpg-pane-header">{header}</div> : null}
      <div className="cmpg-pane-body">
        <SpreadsheetGrid<T> {...pane.gridProps} />
      </div>
    </div>
  );
}
