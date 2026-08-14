import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import OverlayApp from './OverlayApp';
import { isOverlayWindow } from './lib/overlay';
import './styles.css';

const container = document.getElementById('root');
if (container) {
  const isOverlay = isOverlayWindow(window.location.search);
  createRoot(container).render(
    <React.StrictMode>{isOverlay ? <OverlayApp /> : <App />}</React.StrictMode>,
  );
}
