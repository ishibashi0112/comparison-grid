// llms.txt / llms-full.txt を生成します(build:lib の最終ステップ。npm 配布物に同梱)。
//   - llms.txt: 目次(タイトル / 要約 / 一次情報へのリンク)。https://llmstxt.org/ の形式。
//   - llms-full.txt: README + API_REFERENCE + examples/README + SKILL.md の全文結合。AI が 1 ファイルで全体を読めるように。
//   手で編集しないこと(ドキュメントを直したら pnpm run docs:llms で再生成)。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));

const index = `# ${pkg.name}

> ${pkg.description}

React 19 + @ishibashi0112/spreadsheet-grid 製の構成比較ライブラリ。判定は純ロジック(React 非依存)、表示はヘッドレスなフック → 合成コンポーネント → プリセットの 3 層。行には書き込まず、差分は行オブジェクトをキーにした Map で横持ちする(サイドカー方式)。

## 一次情報

- [README](README.md): 導入 / クイックスタート / スタイル / レシピ(英日併記)
- [API リファレンス](src/components/comparison-grid/API_REFERENCE.md): 先頭の「用途 → API」表から入る。全公開 API・型・クラス・トークン
- [使用例](examples/README.md): 01〜08。利用側と同じ import で書かれ、型検査・描画テスト済み(そのままコピーできる)
- [AI 向けスキル](skills/comparison-grid/SKILL.md): Claude Code などに読ませる手引き(用途 → API、最小コード、落とし穴)
- [設計ノート](docs/DESIGN_NOTES.md): 設計判断の経緯と実装記録

## 全文

- [llms-full.txt](llms-full.txt): 上記のうち README / API リファレンス / 使用例索引 / スキルを 1 ファイルに結合したもの
`;

const section = (title, path) => `\n\n---\n\n<!-- ${path} -->\n\n# ${title}\n\n${read(path)}`;
const full =
  `# ${pkg.name} — 全文(llms-full.txt。scripts/emit-llms.mjs が生成)\n\n> ${pkg.description}\n\nバージョン: ${pkg.version}` +
  section('README', 'README.md') +
  section('API リファレンス', 'src/components/comparison-grid/API_REFERENCE.md') +
  section('使用例の索引', 'examples/README.md') +
  section('AI 向けスキル', 'skills/comparison-grid/SKILL.md');

writeFileSync(resolve(root, 'llms.txt'), index);
writeFileSync(resolve(root, 'llms-full.txt'), full);
console.log(`emit-llms: llms.txt / llms-full.txt を生成しました(${full.length.toLocaleString()} 文字)`);
