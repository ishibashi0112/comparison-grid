// ss2602(部品構成比較アプリ)の比較画面を comparison-grid で再現するデモです。
//   利用側が書くのは「行の型 / データ / 列定義 / 比較設定」だけで、差分計算・ラベル生成・
//   行 / セルのハイライト・差分のみフィルタはライブラリ側が担います(引き継ぎ書のゴール像)。
import { useMemo, useState, type FormEvent } from 'react';
import type { GridColumn, GridTheme } from '@ishibashi0112/spreadsheet-grid';
import {
  ComparisonView,
  useComparison,
  type CompareField,
  type ComparisonGridProps,
} from './components/comparison-grid';
import { BOM_ITEM_CODES, fetchBom, type BomRow, type RootItemInfo } from './demo/bomData';
import './App.css';

// 1. 比較設定: 「差分を見る」フィールドを宣言するだけ。
const COMPARE_FIELDS: CompareField<BomRow>[] = [
  { key: 'qty', label: '数量' },
  { key: 'shikiyuKbn', label: '支給区分' },
];

// 突き合わせキー。代表品番比較 ON のときは階層パス中の自品番を代表品番へ置き換えたパスで比較する
//   (ss2602 の makeCompareKey 相当。ライブラリはこの規則を知らず、getMatchKey の差し替えで表現する)。
const getItemPathKey = (row: BomRow) => row.itemPath;
const getReprItemPathKey = (row: BomRow) =>
  row.itemPath.replace(row.itemCode, row.reprItemCode || row.itemCode);

// Level 列: 階層の深さに応じて左インデントを付けて表示する。
//   左右整列(alignRows)のプレースホルダ行は空オブジェクトで来るため、renderCell を持つ列は
//   ここで空表示に落とす(既定の getValue 列は undefined → 空セルになるので対応不要)。
const renderLevelCell = ({ row }: { row: BomRow }) => {
  if (!row.levelNo) return null;
  const level = Math.max(row.levelNo, 1);
  return (
    <div className="demo-level-cell" style={{ paddingLeft: `${(level - 1) * 12}px` }}>
      {level}
    </div>
  );
};

// 品目マスタを開くボタン列(右端固定)。
const detailColumn: GridColumn<BomRow> = {
  key: '__detail',
  title: 'マスタ',
  width: 64,
  pinned: 'right',
  suppressAutoSize: true,
  renderCell: ({ row }) =>
    row.itemCode ? (
      <button
        type="button"
        className="demo-detail-button"
        onClick={() => window.alert(`品目マスタを開く: ${row.itemCode}`)}
      >
        品目M
      </button>
    ) : null,
};

// 2. 列定義: 利用側の型 T に対する GridColumn をそのまま書く。
const columns: GridColumn<BomRow>[] = [
  { key: 'levelNo', title: 'Level', width: 60, renderCell: renderLevelCell },
  { key: 'itemCode', title: '品目コード', width: 110 },
  { key: 'reprItemCode', title: '代表品番', width: 100 },
  { key: 'itemName', title: '品目名', width: 160 },
  { key: 'spec', title: '仕様', width: 130 },
  { key: 'shikiyuKbn', title: '支給', width: 60 },
  { key: 'qty', title: '数量', width: 60, align: 'right' },
  detailColumn,
];

const toRootItemInfo = (rows: readonly BomRow[]): RootItemInfo => ({
  code: rows[0]?.rootItemCode ?? '',
  name: rows[0]?.rootItemName ?? '',
  spec: rows[0]?.rootItemSpec ?? '',
});

function PaneHeader({ info }: { info: RootItemInfo }) {
  if (!info.code) return null;
  return (
    <>
      <h3 className="demo-pane-title">{`${info.code} ${info.name}`}</h3>
      <p className="demo-pane-spec">{`仕様: ${info.spec}`}</p>
    </>
  );
}

export default function App() {
  const [leftCode, setLeftCode] = useState('A1000');
  const [rightCode, setRightCode] = useState('A1000-R2');
  const [leftRows, setLeftRows] = useState<BomRow[]>([]);
  const [rightRows, setRightRows] = useState<BomRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [isReprItemMode, setIsReprItemMode] = useState(false);
  const [alignRows, setAlignRows] = useState(false);
  const [syncScroll, setSyncScroll] = useState(false);
  const [theme, setTheme] = useState<GridTheme>('light');
  const [enableGridFeatures, setEnableGridFeatures] = useState(false);

  // 3. 比較: キーの取り方と差分フィールドを渡すだけ。実効的な「差分のみ」はフック側で導出される。
  //    alignRows は左右を突き合わせ順の同じ長さに揃える(欠損側はプレースホルダ行)。
  const comparison = useComparison<BomRow>({
    left: leftRows,
    right: rightRows,
    getMatchKey: isReprItemMode ? getReprItemPathKey : getItemPathKey,
    compareFields: COMPARE_FIELDS,
    showDiffOnly,
    alignRows,
  });

  // SpreadsheetGrid の props はそのまま透過できる(ソート / フィルター等の機能もここで有効化)。
  const gridProps = useMemo<ComparisonGridProps<BomRow>>(
    () => ({
      rowHeight: 25,
      headerHeight: 25,
      maxHeight: 720,
      theme,
      enableSorting: enableGridFeatures,
      enableColumnFilter: enableGridFeatures,
      enableGlobalFilter: enableGridFeatures,
      enableColumnMenu: enableGridFeatures,
      enableColumnResize: enableGridFeatures,
      showTopBar: enableGridFeatures,
      showBottomBar: enableGridFeatures,
      enableUndoRedo: false,
    }),
    [theme, enableGridFeatures],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const [nextLeft, nextRight] = await Promise.all([fetchBom(leftCode), fetchBom(rightCode)]);
      setLeftRows(nextLeft);
      setRightRows(nextRight);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setLeftRows([]);
    setRightRows([]);
    setShowDiffOnly(false);
  };

  const { summary } = comparison;
  const hasData = leftRows.length > 0 || rightRows.length > 0;

  return (
    <div className={theme === 'dark' ? 'demo-app demo-app--dark' : 'demo-app'}>
      <header className="demo-header">
        <h1 className="demo-title">部品構成比較</h1>
        <form className="demo-form" onSubmit={handleSubmit}>
          <input
            className="demo-input"
            list="demo-item-codes"
            value={leftCode}
            onChange={(event) => setLeftCode(event.target.value)}
            placeholder="左品番"
            aria-label="左品番"
          />
          <input
            className="demo-input"
            list="demo-item-codes"
            value={rightCode}
            onChange={(event) => setRightCode(event.target.value)}
            placeholder="右品番"
            aria-label="右品番"
          />
          <datalist id="demo-item-codes">
            {BOM_ITEM_CODES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
          <button type="submit" className="demo-button demo-button--primary" disabled={isLoading}>
            {isLoading ? '展開中…' : '展開'}
          </button>
          <button type="button" className="demo-button" onClick={handleReset} disabled={isLoading}>
            クリア
          </button>
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={isReprItemMode}
              onChange={(event) => setIsReprItemMode(event.target.checked)}
            />
            代表品番比較
          </label>
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={comparison.effectiveShowDiffOnly}
              disabled={!comparison.canShowDiffOnly}
              onChange={(event) => setShowDiffOnly(event.target.checked)}
            />
            差分のみ
          </label>
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={alignRows}
              onChange={(event) => setAlignRows(event.target.checked)}
            />
            左右整列
          </label>
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(event) => setSyncScroll(event.target.checked)}
            />
            スクロール同期
          </label>
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={enableGridFeatures}
              onChange={(event) => setEnableGridFeatures(event.target.checked)}
            />
            ソート / フィルター
          </label>
          <label className="demo-toggle">
            テーマ
            <select value={theme} onChange={(event) => setTheme(event.target.value as GridTheme)}>
              <option value="light">light</option>
              <option value="dark">dark</option>
              <option value="auto">auto</option>
            </select>
          </label>
        </form>
        {hasData ? (
          <p className="demo-summary">
            {`左 ${summary.left.total} 件(同一 ${summary.left.same} / 左のみ ${summary.left.only} / 項目違い ${summary.left.fieldDiff})・右 ${summary.right.total} 件(右のみ ${summary.right.only})`}
            {!comparison.hasBothSides ? '(片側のみのため「差分のみ」は無効)' : ''}
            {comparison.duplicateKeys.left.length > 0 || comparison.duplicateKeys.right.length > 0
              ? ' ※ キー重複あり'
              : ''}
          </p>
        ) : (
          <p className="demo-summary">
            品番を入力して「展開」を押してください(登録済み: A1000 / A1000-R2 / X9000。未登録の品番は空になります)。
          </p>
        )}
      </header>
      <main className="demo-main">
        {/* 4. 表示: 2 ペイン + 差分ハイライト + 差分ラベル列。列定義 T のまま渡せる。 */}
        <ComparisonView<BomRow>
          comparison={comparison}
          columns={columns}
          keyColumnKeys={['itemCode']}
          showDiffLabelColumn
          diffLabelColumn={{ title: '変更箇所', width: 130 }}
          enableScrollSync={syncScroll}
          leftHeader={<PaneHeader info={toRootItemInfo(leftRows)} />}
          rightHeader={<PaneHeader info={toRootItemInfo(rightRows)} />}
          gridProps={gridProps}
        />
      </main>
    </div>
  );
}
