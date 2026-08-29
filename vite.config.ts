import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// デモ app(playground)用の vite 設定です。ライブラリ配布物は vite.lib.config.ts で生成します。
export default defineConfig({
  plugins: [react()],
})
