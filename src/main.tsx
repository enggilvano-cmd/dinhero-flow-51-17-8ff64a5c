import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSentry } from './lib/sentry'
import { initWebVitals } from './lib/webVitals'

// Initialize Sentry before rendering
initSentry();

// Initialize Web Vitals monitoring
initWebVitals();

createRoot(document.getElementById("root")!).render(<App />);
