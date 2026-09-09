import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// テスト設定です。既定 environment は node(純ロジックのテスト)。
//   React を描画するテスト(.test.tsx)は先頭 docblock `// @vitest-environment jsdom` で個別に
//   jsdom へ振り分けます(spreadsheet-grid と同じ運用)。
//   使用例(examples/)のテストも対象。例は利用側と同じ `@ishibashi0112/comparison-grid` で import するため、
//   エイリアスでソースへ解決します(vite.config.ts / tsconfig.app.json の paths と対応)。
export default defineConfig({
  resolve: {
    alias: {
      '@ishibashi0112/comparison-grid/style.css': resolve(
        import.meta.dirname,
        'src/components/comparison-grid/styles.css',
      ),
      '@ishibashi0112/comparison-grid': resolve(
        import.meta.dirname,
        'src/components/comparison-grid/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'examples/**/*.test.{ts,tsx}'],
  },
});
