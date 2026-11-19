import {OperationsProvider} from './OperationsUI';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {configureViewport} from './platform/viewport';
import App from './App';
import LanguageGate from './LanguageGate';
import AgeAccessGate from './AgeAccessGate';
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
configureViewport(Capacitor.getPlatform(),document.querySelector<HTMLMetaElement>('meta[name="viewport"]'));
document.addEventListener('contextmenu',event=>{
  const target=event.target;
  if(target instanceof Element&&target.closest('input,textarea,select,[contenteditable="true"]'))return;
  event.preventDefault();
});
document.addEventListener('selectstart',event=>{
  const target=event.target;
  if(target instanceof Element&&target.closest('input,textarea,select,[contenteditable="true"]'))return;
  event.preventDefault();
});
document.documentElement.classList.toggle('legacy-text',needsRasterCompatibility());
setLocale(getLocale());
createRoot(document.getElementById('root')!).render(<LanguageGate><AgeAccessGate><OperationsProvider><App/></OperationsProvider></AgeAccessGate></LanguageGate>);
