import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// comparison-grid のライブラリビルド設定です(npm 配布物 dist を生成)。
//   - デモ app 用の vite.config.ts とは分離します。
//   - entry は公開バレル index.ts。react / react-dom / @ishibashi0112/spreadsheet-grid は
//     バンドルせず外部化し、利用側(peer)が解決します。サブパス import も正規表現で除外します。
//   - styles.css は JS から分離して単一の dist/style.css へ抽出します(自動注入はしません)。
//     利用側は `import '<pkg>/style.css'` で読み込みます。@layer cmpg-base 版の style.layer.css は
//     build:lib 最終ステップの scripts/emit-layer-css.mjs が生成します。
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/components/comparison-grid/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: (id) =>
        /^react($|\/)/.test(id) ||
        /^react-dom($|\/)/.test(id) ||
        /^@ishibashi0112\/spreadsheet-grid($|\/)/.test(id),
      output: {
        exports: 'named',
        assetFileNames: (assetInfo) => {
          const names = assetInfo.names ?? (assetInfo.name ? [assetInfo.name] : [])
          if (names.some((n) => n.endsWith('.css'))) return 'style.css'
          return 'assets/[name][extname]'
        },
      },
    },
    target: 'es2023',
    sourcemap: false,
    cssCodeSplit: false,
    emptyOutDir: true,
  },
})
