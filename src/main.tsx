// Global safety guard to permanently prevent "Converting circular structure to JSON" errors
const nativeJSONStringify = JSON.stringify;
JSON.stringify = function (value: any, replacer?: any, space?: any): string {
  try {
    return nativeJSONStringify(value, replacer, space);
  } catch (err: any) {
    if (err instanceof TypeError && String(err?.message || '').toLowerCase().includes('circular')) {
      const seen = new WeakSet();
      return nativeJSONStringify(
        value,
        (key, val) => {
          if (typeof val === 'object' && val !== null) {
            if (typeof (val as any).nodeType === 'number' || (val as any).$$typeof || seen.has(val)) {
              return undefined;
            }
            seen.add(val);
          }
          if (typeof replacer === 'function') {
            return replacer(key, val);
          }
          return val;
        },
        space
      );
    }
    throw err;
  }
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SpeedInsights } from "@vercel/speed-insights/react"
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <SpeedInsights />
  </StrictMode>,
);
