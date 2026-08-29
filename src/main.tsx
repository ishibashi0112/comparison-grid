import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// グリッド本体の CSS(peer)とデモの CSS。ライブラリ自身の CSS はコンポーネントが import します。
import '@ishibashi0112/spreadsheet-grid/style.css';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
