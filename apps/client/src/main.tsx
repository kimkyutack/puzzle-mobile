import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import LanguageGate from './LanguageGate';
import {getLocale,setLocale} from './i18n';
import {needsRasterCompatibility} from './RasterSurface';
import './style.css';
import './fonts.css';
import './ui-v3.css';
import './ui-v4.css';
import './ui-v5.css';
import './ui-v6.css';
import './ui-v7.css';
import './ui-v8.css';
import './ui-v9.css';
import './context-v9.css';
// Older Android WebViews report paint-order support while still stroking over
// HTML glyph fills. Use an outside shadow outline on the same compatibility path.
document.documentElement.classList.toggle('legacy-text',needsRasterCompatibility());
setLocale(getLocale());
createRoot(document.getElementById('root')!).render(<LanguageGate><App/></LanguageGate>);
