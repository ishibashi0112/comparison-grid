// N 構成比較(基準 + 案 1・案 2…)のデモです。平坦な行を品目コードで突き合わせ、合成コンポーネント
//   (ComparisonLayout.Root / .Pane / .Header / .Grid)でペインを構成の数だけ並べます。
//   利用側が書くのは「構成の配列 / 列定義 / 比較設定」と JSX の配置だけで、差分計算・ラベル・ハイライト・
//   スクロール同期・差分ジャンプはライブラリ側が担います。階層(木)の N 構成対応は今後の予定のため、
//   ここでは平坦比較(キー = 品目コード)にしています。
import { useMemo, useState, type FormEvent } from 'react';
import type { GridColumn, GridTheme } from '@ishibashi0112/spreadsheet-grid';
import {
  ComparisonLayout,
  useComparisonScrollSyncGroup,
  useMultiComparison,
  useMultiComparisonNavigation,
  type CompareField,
  type ComparisonGridProps,
  type ComparisonMultiMode,
  type ComparisonMultiVisibleSide,
  type ComparisonSideInput,
} from '../components/comparison-grid';
import { BOM_ITEM_CODES, BOM_MULTI_PRESETS, fetchBom, type BomRow } from './bomData';

const COMPARE_FIELDS: CompareField<BomRow>[] = [
  { key: 'qty', label: '数量' },
  { key: 'shikiyuKbn', label: '支給区分' },
];

const getMatchKey = (row: BomRow) => row.itemCode;

const COLUMNS: GridColumn<BomRow>[] = [
  { key: 'levelNo', title: 'Level', width: 60, align: 'right' },
  { key: 'itemCode', title: '品目コード', width: 110 },
  { key: 'itemName', title: '品目名', width: 150 },
  { key: 'spec', title: '仕様', width: 120 },
  { key: 'shikiyuKbn', title: '支給', width: 60 },
  { key: 'qty', title: '数量', width: 60, align: 'right' },
];

const EMPTY_ROWS: readonly BomRow[] = [];
const MAX_SIDES = 5;

const sideIdOf = (index: number) => `side-${index}`;

function SideHeader({
  side,
  rows,
  mode,
}: {
  side: ComparisonMultiVisibleSide<BomRow>;
  rows: readonly BomRow[];
  mode: ComparisonMultiMode;
}) {
  const root = rows[0];
  const { summary } = side;
  // 「一部無し」(partial)は基準ペインと mode 'all' の各ペインでだけ起こる。
  const showPartial = side.isBase || mode === 'all';
  return (
    <>
      <h3 className="demo-pane-title">
        {side.isBase ? <span className="demo-badge">基準</span> : null}
        {root ? `${root.rootItemCode} ${root.rootItemName}` : side.label}
      </h3>
      <p className="demo-pane-spec">
        {root ? `仕様: ${root.rootItemSpec} ・ ` : ''}
        {`${summary.total} 件(同一 ${summary.same} / 無し ${summary.only}${
          showPartial ? ` / 一部無し ${summary.partial}` : ''
        } / 項目違い ${summary.fieldDiff})`}
      </p>
    </>
  );
}

export function MultiComparisonDemo({ theme, cvdColors }: { theme: GridTheme; cvdColors: boolean }) {
  const [codes, setCodes] = useState<string[]>([...BOM_MULTI_PRESETS[0].codes]);
  const [rowsBySide, setRowsBySide] = useState<readonly BomRow[][]>([]);
  const [baseIndex, setBaseIndex] = useState(0);
  const [mode, setMode] = useState<ComparisonMultiMode>('base');
  const [isLoading, setIsLoading] = useState(false);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [alignRows, setAlignRows] = useState(false);
  const [syncScroll, setSyncScroll] = useState(true);
  const [syncHorizontalScroll, setSyncHorizontalScroll] = useState(false);
  const [syncHover, setSyncHover] = useState(false);
  const [verticalLayout, setVerticalLayout] = useState(false);
  const [excludePlaceholderCopy, setExcludePlaceholderCopy] = useState(false);

  // 1. 構成の配列: { id, rows, label }。id は位置で固定し(同じ品番を 2 回並べても衝突しない)、label に品番を出す。
  const sides = useMemo<ComparisonSideInput<BomRow>[]>(
    () =>
      codes.map((code, index) => ({
        id: sideIdOf(index),
        rows: rowsBySide[index] ?? EMPTY_ROWS,
        label: code.trim() === '' ? `構成 ${index + 1}` : code.trim().toUpperCase(),
      })),
    [codes, rowsBySide],
  );

  // 2. 比較: mode 'base' = 基準対各構成 / 'all' = 全構成一致判定。差分のみ / 整列はフックが導出する。
  const comparison = useMultiComparison<BomRow>({
    sides,
    mode,
    baseId: sideIdOf(Math.min(baseIndex, codes.length - 1)),
    getMatchKey,
    compareFields: COMPARE_FIELDS,
    showDiffOnly,
    alignRows,
  });

  // 3. スクロール同期グループは外で作り、Root と差分ジャンプで共有する(Grid がハンドルを登録してくれる)。
  const group = useComparisonScrollSyncGroup<BomRow>({
    enabled: syncScroll,
    syncHorizontal: verticalLayout || syncHorizontalScroll,
  });
  const navigation = useMultiComparisonNavigation<BomRow>({
    comparison,
    alignRows,
    getHandle: group.getHandle,
  });

  const gridProps = useMemo<ComparisonGridProps<BomRow>>(
    () => ({
      rowHeight: 25,
      headerHeight: 25,
      maxHeight: 640,
      theme,
      showTopBar: false,
      showBottomBar: false,
      enableUndoRedo: false,
    }),
    [theme],
  );

  const load = async (nextCodes: readonly string[]) => {
    setIsLoading(true);
    try {
      const loaded = await Promise.all(nextCodes.map((code) => fetchBom(code)));
      setRowsBySide(loaded);
    } finally {
      setIsLoading(false);
    }
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(codes);
  };
  const applyPreset = (presetCodes: readonly string[]) => {
    setCodes([...presetCodes]);
    setBaseIndex(0);
    void load(presetCodes);
  };
  const updateCode = (index: number, value: string) =>
    setCodes((previous) => previous.map((code, i) => (i === index ? value : code)));
  const addSide = () => setCodes((previous) => [...previous, '']);
  const removeSide = (index: number) => {
    setCodes((previous) => previous.filter((_code, i) => i !== index));
    setRowsBySide((previous) => previous.filter((_rows, i) => i !== index));
    setBaseIndex((previous) => (previous > index ? previous - 1 : Math.min(previous, codes.length - 2)));
  };

  const hasData = rowsBySide.some((rows) => rows.length > 0);
  const duplicateCount = comparison.sides.reduce((sum, side) => sum + side.duplicateKeys.length, 0);

  return (
    <>
      <header className="demo-header">
        <h1 className="demo-title">部品構成比較(N 構成)</h1>
        <form className="demo-form" onSubmit={handleSubmit}>
          {codes.map((code, index) => (
            <span key={sideIdOf(index)} className="demo-side-input">
              <label className="demo-toggle" title={mode === 'all' ? '全構成一致では基準を選びません' : '基準にする'}>
                <input
                  type="radio"
                  name="demo-base"
                  checked={mode === 'base' && index === baseIndex}
                  disabled={mode === 'all'}
                  onChange={() => setBaseIndex(index)}
                />
                {mode === 'all' ? '構成' : index === baseIndex ? '基準' : '案'}
              </label>
              <input
                className="demo-input"
                list="demo-multi-item-codes"
                value={code}
                onChange={(event) => updateCode(index, event.target.value)}
                placeholder={`構成 ${index + 1}`}
                aria-label={`構成 ${index + 1} の品番`}
              />
              <button
                type="button"
                className="demo-button demo-button--small"
                onClick={() => removeSide(index)}
                disabled={codes.length <= 2 || isLoading}
                aria-label={`構成 ${index + 1} を削除`}
              >
                ×
              </button>
            </span>
          ))}
          <datalist id="demo-multi-item-codes">
            {BOM_ITEM_CODES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
          <button
            type="button"
            className="demo-button demo-button--small"
            onClick={addSide}
            disabled={codes.length >= MAX_SIDES || isLoading}
          >
            ＋ 構成を追加
          </button>
          <button type="submit" className="demo-button demo-button--primary" disabled={isLoading}>
            {isLoading ? '展開中…' : '展開'}
          </button>
          <span className="demo-toggle demo-presets">
            プリセット
            {BOM_MULTI_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="demo-button demo-button--small"
                onClick={() => applyPreset(preset.codes)}
                disabled={isLoading}
                title={preset.codes.join(' / ')}
              >
                {preset.label}
              </button>
            ))}
          </span>
          <label className="demo-toggle" title="全構成に存在し、全構成で一致する行だけを同一とみなす(基準なし)">
            <input
              type="checkbox"
              checked={mode === 'all'}
              onChange={(event) => setMode(event.target.checked ? 'all' : 'base')}
            />
            全構成一致判定
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
            整列
          </label>
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(event) => setSyncScroll(event.target.checked)}
            />
            スクロール同期
          </label>
          <label className="demo-toggle" title="横並びでも横スクロールを同期する(縦並びでは常に同期)">
            <input
              type="checkbox"
              checked={verticalLayout || syncHorizontalScroll}
              disabled={!syncScroll || verticalLayout}
              onChange={(event) => setSyncHorizontalScroll(event.target.checked)}
            />
            横も同期
          </label>
          <label className="demo-toggle" title="ある構成の行ホバーを他の構成の同じ行位置にも表示(整列時)">
            <input
              type="checkbox"
              checked={syncHover}
              disabled={!alignRows}
              onChange={(event) => setSyncHover(event.target.checked)}
            />
            ホバー同期
          </label>
          <label className="demo-toggle">
            <input
              type="checkbox"
              checked={verticalLayout}
              onChange={(event) => setVerticalLayout(event.target.checked)}
            />
            縦並び
          </label>
          <label
            className="demo-toggle"
            title="整列のプレースホルダ行(グレーの空行)を Ctrl+C / CSV の出力から除く"
          >
            <input
              type="checkbox"
              checked={excludePlaceholderCopy}
              disabled={!alignRows}
              onChange={(event) => setExcludePlaceholderCopy(event.target.checked)}
            />
            空行を除いてコピー
          </label>
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
        <p className="demo-summary">
          {hasData
            ? `平坦比較(キー = 品目コード)。${
                comparison.mode === 'all'
                  ? '全構成一致判定: 全構成に存在し全構成で一致する行だけが同一で、どのペインでも揺れのある行は差分になります。'
                  : `基準「${comparison.getSide(comparison.baseId ?? comparison.axisId)?.label ?? ''}」に対して他の各構成を比較しています。`
              }` +
              (!comparison.hasAllSides ? '(空の構成があるため「差分のみ」は無効)' : '') +
              (duplicateCount > 0 ? ' ※ キー重複あり(同じ品目コードが複数行)' : '')
            : `品番を入力して「展開」を押すか、プリセットを選んでください(登録済み: ${BOM_ITEM_CODES.join(' / ')})。`}
        </p>
      </header>
      <main className="demo-main">
        {/* 4. 表示: 合成コンポーネント。ペインは構成の数だけ JSX で並べる。 */}
        <ComparisonLayout.Root<BomRow>
          comparison={comparison}
          columns={COLUMNS}
          keyColumnKeys={['itemCode']}
          showDiffLabelColumn
          diffLabelColumn={{ title: '変更箇所', width: 170 }}
          layout={verticalLayout ? 'vertical' : 'horizontal'}
          scrollSyncGroup={group}
          enableHoverSync={alignRows && syncHover}
          excludePlaceholderRowsOnCopy={excludePlaceholderCopy}
          gridProps={gridProps}
          className={cvdColors ? 'cmpg-colors-cvd' : undefined}
        >
          {comparison.sides.map((side) => (
            <ComparisonLayout.Pane key={side.id} side={side.id}>
              <ComparisonLayout.Header>
                <SideHeader side={side} rows={side.rows} mode={comparison.mode} />
              </ComparisonLayout.Header>
              <ComparisonLayout.Grid<BomRow> />
            </ComparisonLayout.Pane>
          ))}
        </ComparisonLayout.Root>
      </main>
    </>
  );
}
