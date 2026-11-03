import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './ui/App';

interface HotData {
  save?: string;
}
interface Hot {
  ready?: (start: (data: HotData) => void) => void;
  data?: HotData;
}
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;

function start(data: HotData = {}) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App initialSave={data?.save} />
    </StrictMode>,
  );
}

// Embedded viewers can hand back a snapshot of the running game after an update.
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
