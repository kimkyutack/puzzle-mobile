import {OperationsProvider} from './OperationsUI';
// TEMP-FREEZE-PROBE: shows runtime errors on screen while diagnosing the rocket freeze. Remove after.
{const report=(text:string)=>{try{let box=document.getElementById('freeze-probe');if(!box){box=document.createElement('pre');box.id='freeze-probe';box.style.cssText='position:fixed;left:0;right:0;bottom:0;max-height:50vh;overflow:auto;margin:0;padding:8px;background:#5a0000ee;color:#fff;font:10px/1.3 monospace;white-space:pre-wrap;z-index:2147483647;pointer-events:auto';document.body.appendChild(box);}box.textContent=(box.textContent??'')+new Date().toISOString().slice(11,19)+' '+text+'\n---\n';}catch{}};
 window.addEventListener('error',e=>report('ERROR '+(e.error?.stack||e.message)+' @'+e.filename?.split('/').pop()+':'+e.lineno+':'+e.colno));
 window.addEventListener('unhandledrejection',e=>report('REJECT '+((e.reason as Error)?.stack||String(e.reason))));
 document.addEventListener('webglcontextlost',()=>report('WEBGL CONTEXT LOST'),true);
 document.addEventListener('webglcontextrestored',()=>report('WEBGL CONTEXT RESTORED'),true);}
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
