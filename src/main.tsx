import { initSentry } from './lib/sentry';
import { initMixpanel } from './lib/mixpanel';
initSentry();
initMixpanel();

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
