import { defineConfig } from 'vitest/config';

// テスト設定です。既定 environment は node(純ロジックのテスト)。
//   React を描画するテスト(.test.tsx)は先頭 docblock `// @vitest-environment jsdom` で個別に
//   jsdom へ振り分けます(spreadsheet-grid と同じ運用)。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
