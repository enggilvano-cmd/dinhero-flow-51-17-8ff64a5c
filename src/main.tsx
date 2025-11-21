import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'
import { initSentry } from './lib/sentry'
import { initWebVitals } from './lib/webVitals'

// Initialize Sentry before rendering
initSentry();

// Initialize Web Vitals monitoring
initWebVitals();

createRoot(document.getElementById("root")!).render(<App />);
