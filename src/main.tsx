import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSentry } from './lib/sentry'
import { initWebVitals } from './lib/webVitals'
import { offlineDatabase } from './lib/offlineDatabase'
import { offlineSync } from './lib/offlineSync'

// Initialize Sentry before rendering
initSentry();

// Initialize Web Vitals monitoring
initWebVitals();

// Initialize offline database and initial sync
offlineDatabase.init().then(() => {
  offlineSync.syncDataFromServer().catch(err => {
    console.warn('Initial sync failed, will retry when online:', err);
  });
});

createRoot(document.getElementById("root")!).render(<App />);
