import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// デモ app(playground)用の vite 設定です。ライブラリ配布物は vite.lib.config.ts で生成します。
//   エイリアス: 使用例(examples/)は利用側と同じ `@ishibashi0112/comparison-grid` で import するため、
//   ソースへ解決します(tsconfig.app.json の paths / vitest.config.ts と対応)。
export default defineConfig({
  plugins: [react()],
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
})
