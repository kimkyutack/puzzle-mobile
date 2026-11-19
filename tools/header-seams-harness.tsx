import React,{useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createGame} from '@garden/core';
import {getLevel} from '@garden/content';
import {ENGINE_VERSION,type Goal} from '@garden/contracts';
import '../apps/client/src/style.css';
import '../apps/client/src/fonts.css';
import '../apps/client/src/ui-v3.css';
import '../apps/client/src/ui-v4.css';
import '../apps/client/src/ui-v5.css';
import '../apps/client/src/ui-v6.css';
import '../apps/client/src/ui-v7.css';
import '../apps/client/src/ui-v8.css';
import '../apps/client/src/ui-v9.css';
import PlayHud from '../apps/client/src/PlayHud';
import {prepareAssets} from '../apps/client/src/assets';
import {setLocale} from '../apps/client/src/i18n';
import {mountRasterSurface} from '../apps/client/src/RasterSurface';
import {mountRasterSurface as mountLegacy} from './raster-layout-before';

// Same actual HUD and assets, same 83% preview scale. Only the paint method differs.
await Promise.all([prepareAssets(()=>{}),document.fonts.load('18px Jua'),document.fonts.load('18px "Lilita One"')]);setLocale('ko');
const state=createGame(getLevel(31,ENGINE_VERSION));
const goals:Array<[Goal['kind'],number]>=[['drop',28],['sprout',24],['crate',3],['berry',16],['frost',5],['vine',4]];
state.goals=goals.map(([kind,count])=>({kind,count,remaining:count}));state.moves=21;
function Sample({legacy}:{legacy:boolean}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>host.current?(legacy?mountLegacy:mountRasterSurface)(host.current):undefined,[legacy]);
 return <article className="seam-case"><p>{legacy?'수정 전 · CSS 분할 이미지':'수정 후 · 합친 프레임 이미지'}</p><main className="game-shell playing" data-art-root style={{width:390,height:'auto',transform:'scale(.83)',transformOrigin:'top left'}}><div className="art-surface" ref={host}/><PlayHud state={state} tool={null} locked={false} onCancelTool={()=>{}}/></main></article>;
}
createRoot(document.getElementById('root')!).render(<><Sample legacy/><Sample legacy={false}/></>);
