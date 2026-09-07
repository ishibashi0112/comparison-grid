// ss2602(部品構成比較アプリ)の比較画面を comparison-grid で再現するデモです。
//   利用側が書くのは「行の型 / データ / 列定義 / 比較設定」だけで、差分計算・ラベル生成・
//   行 / セルのハイライト・差分のみフィルタはライブラリ側が担います(引き継ぎ書のゴール像)。
//   モード切替: 「2 構成(階層)」= 従来の木モード(ComparisonView)/ 「N 構成(平坦)」= 基準 + 案 1・案 2…
//   を合成コンポーネントで並べる(demo/MultiComparisonDemo.tsx)。
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { GridColumn, GridTheme } from '@ishibashi0112/spreadsheet-grid';
import {
  ComparisonView,
  buildComparisonTree,
  useComparisonNavigation,
  useTreeComparison,
  type CompareField,
  type ComparisonGridProps,
  type ComparisonTreeInfo,
} from './components/comparison-grid';
import {
  BOM_DATASETS,
  BOM_ITEM_CODES,
  BOM_PRESETS,
  fetchBom,
  type BomRow,
  type RootItemInfo,
} from './demo/bomData';
import { MultiComparisonDemo } from './demo/MultiComparisonDemo';
import './App.css';

type DemoMode = 'tree' | 'multi';

// 1. 比較設定: 「差分を見る」フィールドを宣言するだけ。
const COMPARE_FIELDS: CompareField<BomRow>[] = [
  { key: 'qty', label: '数量' },
  { key: 'shikiyuKbn', label: '支給区分' },
];

// 階層比較のアクセサ。展開結果は深さ優先順 + level で来るので、木の構築は getLevel だけでよい(行 ID 不要)。
//   突き合わせキー(パス)はライブラリが木から導出する。代表品番比較 ON のときは getRepresentativeCode を
//   渡し、自品番の代わりに代表品番をセグメントにする(親の置き換えは子孫へ伝播する)。
const getLevel = (row: BomRow) => row.levelNo;
const getItemCode = (row: BomRow) => row.itemCode;
const getRepresentativeCode = (row: BomRow) => row.reprItemCode;

// Level 列: 階層の深さ(getTreeInfo の depth)に応じて左インデントを付け、子を持つ行には折りたたみの
//   展開ボタンを出す。ボタンは行の matchKey(左右共通)でトグルするため、片側を畳めば相手側の対も畳まれる。
//   当たり判定: ボタン(20px 角)に加え、子を持つ行ではセル全体のクリックでもトグルする(ボタンは
//   キーボード操作用に残し、クリックの二重発火は stopPropagation で防ぐ)。
//   左右整列(alignRows)のプレースホルダ行は階層情報を持たない(getTreeInfo が undefined)ので空表示に落とす。
type TreeAccessors = {
  getTreeInfo: (row: BomRow) => ComparisonTreeInfo<BomRow> | undefined;
  isCollapsed: (row: BomRow) => boolean;
  toggleCollapsed: (key: string) => void;
};

const createLevelColumn = ({
  getTreeInfo,
  isCollapsed,
  toggleCollapsed,
}: TreeAccessors): GridColumn<BomRow> => ({
  key: 'levelNo',
  title: 'Level',
  width: 76,
  renderCell: ({ row }) => {
    const info = getTreeInfo(row);
    if (!info) return null;
    const collapsed = isCollapsed(row);
    const toggle = info.hasChildren ? () => toggleCollapsed(info.matchKey) : undefined;
    return (
      <div
        className={toggle ? 'demo-level-cell demo-level-cell--toggle' : 'demo-level-cell'}
        style={{ paddingLeft: `${info.depth * 12}px` }}
        onClick={toggle}
      >
        {toggle ? (
          <button
            type="button"
            className="demo-expander"
            aria-label={collapsed ? '展開' : '折りたたむ'}
            aria-expanded={!collapsed}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="demo-expander demo-expander--leaf" />
        )}
        {row.levelNo}
      </div>
    );
  },
});

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

// 2. 列定義: 利用側の型 T に対する GridColumn をそのまま書く。Level 列だけは比較結果のアクセサを
//    受け取るため、コンポーネント内で createLevelColumn を先頭に足して組み立てる。
const STATIC_COLUMNS: GridColumn<BomRow>[] = [
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
  const [mode, setMode] = useState<DemoMode>('tree');
  const [theme, setTheme] = useState<GridTheme>('light');
  const [cvdColors, setCvdColors] = useState(false);

  // モード切替とテーマ / 配色は両モード共通のバーに置く。
  const modeBar = (
    <nav className="demo-mode-bar" aria-label="デモのモード">
      <button
        type="button"
        className={mode === 'tree' ? 'demo-button demo-button--primary' : 'demo-button'}
        onClick={() => setMode('tree')}
      >
        2 構成(階層)
      </button>
      <button
        type="button"
        className={mode === 'multi' ? 'demo-button demo-button--primary' : 'demo-button'}
        onClick={() => setMode('multi')}
      >
        N 構成(平坦・合成コンポーネント)
      </button>
      <label className="demo-toggle">
        テーマ
        <select value={theme} onChange={(event) => setTheme(event.target.value as GridTheme)}>
          <option value="light">light</option>
          <option value="dark">dark</option>
          <option value="auto">auto</option>
        </select>
      </label>
      <label className="demo-toggle">
        <input
          type="checkbox"
          checked={cvdColors}
          onChange={(event) => setCvdColors(event.target.checked)}
        />
        色覚多様性配色
      </label>
    </nav>
  );

  return (
    <div className={theme === 'dark' ? 'demo-app demo-app--dark' : 'demo-app'}>
      {modeBar}
      {mode === 'tree' ? (
        <TreeComparisonDemo theme={theme} cvdColors={cvdColors} />
      ) : (
        <MultiComparisonDemo theme={theme} cvdColors={cvdColors} />
      )}
    </div>
  );
}

function TreeComparisonDemo({ theme, cvdColors }: { theme: GridTheme; cvdColors: boolean }) {
  const [leftCode, setLeftCode] = useState('A1000');
  const [rightCode, setRightCode] = useState('A1000-R2');
  const [leftRows, setLeftRows] = useState<BomRow[]>([]);
  const [rightRows, setRightRows] = useState<BomRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [isReprItemMode, setIsReprItemMode] = useState(false);
  const [alignRows, setAlignRows] = useState(false);
  const [syncScroll, setSyncScroll] = useState(false);
  const [verticalLayout, setVerticalLayout] = useState(false);
  // 折りたたみ: 突き合わせキー(matchKey)の集合を利用側の state で持つ。
  const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const toggleCollapsed = useCallback((key: string) => {
    setCollapsedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const [enableGridFeatures, setEnableGridFeatures] = useState(false);

  // 3. 木の構築: 平坦な展開結果 → 木。破綻(level の飛び等)は修復されず issues に報告される。
  const leftTree = useMemo(() => buildComparisonTree(leftRows, { getLevel }), [leftRows]);
  const rightTree = useMemo(() => buildComparisonTree(rightRows, { getLevel }), [rightRows]);
  const treeIssueCount = leftTree.issues.length + rightTree.issues.length;

  // 4. 比較: コードの取り方と差分フィールドを渡すだけ。キーは木から導出され、実効的な「差分のみ」は
  //    フック側で導出される(差分行の祖先は文脈行として残る)。alignRows は構造マージで左右を揃える。
  const comparison = useTreeComparison<BomRow>({
    left: leftTree.roots,
    right: rightTree.roots,
    getCode: getItemCode,
    getRepresentativeCode: isReprItemMode ? getRepresentativeCode : undefined,
    compareFields: COMPARE_FIELDS,
    showDiffOnly,
    alignRows,
    collapsedKeys,
  });

  // Level 列は比較結果のアクセサ(getTreeInfo / isCollapsed)を閉じ込めるため、ここで組み立てる。
  const columns = useMemo<GridColumn<BomRow>[]>(
    () => [
      createLevelColumn({
        getTreeInfo: comparison.getTreeInfo,
        isCollapsed: comparison.isCollapsed,
        toggleCollapsed,
      }),
      ...STATIC_COLUMNS,
    ],
    [comparison.getTreeInfo, comparison.isCollapsed, toggleCollapsed],
  );

  // 差分ジャンプ: グリッドのハンドル ref はフックが生成し、leftGridProps / rightGridProps で配線する。
  const navigation = useComparisonNavigation<BomRow>({ comparison, alignRows });

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

  // 差分ジャンプ用のハンドル ref を片側ずつ渡す(enableScrollSync の内部 ref とは合成される)。
  const leftGridProps = useMemo<ComparisonGridProps<BomRow>>(
    () => ({ ref: navigation.leftRef }),
    [navigation.leftRef],
  );
  const rightGridProps = useMemo<ComparisonGridProps<BomRow>>(
    () => ({ ref: navigation.rightRef }),
    [navigation.rightRef],
  );

  const loadBoms = async (left: string, right: string) => {
    setIsLoading(true);
    try {
      const [nextLeft, nextRight] = await Promise.all([fetchBom(left), fetchBom(right)]);
      setLeftRows(nextLeft);
      setRightRows(nextRight);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadBoms(leftCode, rightCode);
  };

  // プリセット: 左右の品番を入れ替えてそのまま展開する(大量データでスクロール同期 / 差分ジャンプを確認)。
  const applyPreset = (left: string, right: string) => {
    setLeftCode(left);
    setRightCode(right);
    void loadBoms(left, right);
  };

  const handleReset = () => {
    setLeftRows([]);
    setRightRows([]);
    setShowDiffOnly(false);
    setCollapsedKeys(new Set());
  };

  const { summary } = comparison;
  const hasData = leftRows.length > 0 || rightRows.length > 0;

  return (
    <>
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
          <span className="demo-toggle demo-presets">
            プリセット
            {BOM_PRESETS.map((preset) => (
              <button
                key={preset.left}
                type="button"
                className="demo-button demo-button--small"
                onClick={() => applyPreset(preset.left, preset.right)}
                disabled={isLoading}
                title={`${preset.left} / ${preset.right}`}
              >
                {`${preset.label}(${BOM_DATASETS[preset.left].length.toLocaleString()} 行)`}
              </button>
            ))}
          </span>
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
              checked={verticalLayout}
              onChange={(event) => setVerticalLayout(event.target.checked)}
            />
            縦並び
          </label>
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={enableGridFeatures}
              onChange={(event) => setEnableGridFeatures(event.target.checked)}
            />
            ソート / フィルター
          </label>
          <button
            type="button"
            className="demo-button"
            onClick={() => setCollapsedKeys(new Set())}
            disabled={collapsedKeys.size === 0}
          >
            すべて展開
          </button>
          <button
            type="button"
            className="demo-button"
            onClick={navigation.goToPreviousDiff}
            disabled={!navigation.canNavigate}
          >
            ◀ 前の差分
          </button>
          <button
            type="button"
            className="demo-button"
            onClick={navigation.goToNextDiff}
            disabled={!navigation.canNavigate}
          >
            次の差分 ▶
          </button>
          <span className="demo-toggle">
            {navigation.activeDiffIndex >= 0
              ? `${navigation.activeDiffIndex + 1} / ${navigation.diffCount}`
              : `差分 ${navigation.diffCount} 件`}
          </span>
        </form>
        {hasData ? (
          <p className="demo-summary">
            {`左 ${summary.left.total} 件(同一 ${summary.left.same} / 左のみ ${summary.left.only} / 項目違い ${summary.left.fieldDiff})・右 ${summary.right.total} 件(右のみ ${summary.right.only})`}
            {!comparison.hasBothSides ? '(片側のみのため「差分のみ」は無効)' : ''}
            {comparison.duplicateKeys.left.length > 0 || comparison.duplicateKeys.right.length > 0
              ? ' ※ キー重複あり'
              : ''}
            {treeIssueCount > 0 ? ` ※ 階層の問題 ${treeIssueCount} 件(issues)` : ''}
          </p>
        ) : (
          <p className="demo-summary">
            {`品番を入力して「展開」を押すか、プリセットを選んでください(登録済み: ${BOM_ITEM_CODES.join(' / ')}。未登録の品番は空になります)。`}
          </p>
        )}
      </header>
      <main className="demo-main">
        {/* 5. 表示: 2 ペイン + 差分ハイライト + 差分ラベル列。列定義 T のまま渡せる。 */}
        <ComparisonView<BomRow>
          comparison={comparison}
          columns={columns}
          className={cvdColors ? 'cmpg-colors-cvd' : undefined}
          keyColumnKeys={['itemCode']}
          showDiffLabelColumn
          diffLabelColumn={{ title: '変更箇所', width: 130 }}
          layout={verticalLayout ? 'vertical' : 'horizontal'}
          enableScrollSync={syncScroll}
          leftHeader={<PaneHeader info={toRootItemInfo(leftRows)} />}
          rightHeader={<PaneHeader info={toRootItemInfo(rightRows)} />}
          gridProps={gridProps}
          leftGridProps={leftGridProps}
          rightGridProps={rightGridProps}
        />
      </main>
    </>
  );
}
