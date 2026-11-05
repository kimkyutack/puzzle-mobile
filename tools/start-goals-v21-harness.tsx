// The actual start modal with approved content. No account, inventory or API mutation.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {newPlayer} from '../apps/api/src/db';
import StartLevelModal from '../apps/client/src/StartLevelModal';
import ArtSurface from '../apps/client/src/ArtSurface';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import type {PreBooster} from '@garden/contracts';
import '../apps/client/src/style.css';
import '../apps/client/src/fonts.css';
import '../apps/client/src/ui-v3.css';
import '../apps/client/src/ui-v4.css';
import '../apps/client/src/ui-v5.css';
import '../apps/client/src/ui-v6.css';
import '../apps/client/src/ui-v7.css';
import '../apps/client/src/ui-v8.css';
import '../apps/client/src/ui-v9.css';
import '../apps/client/src/context-v9.css';

const query=new URLSearchParams(location.search),player=newPlayer('start-goals-ui-only',Date.now());player.level=Number(query.get('level')??17);
document.documentElement.style.setProperty('--safe-top','48px');document.documentElement.style.setProperty('--safe-bottom','22px');
document.documentElement.classList.toggle('legacy-text',query.get('legacy')==='1');
setLocale(query.get('lang')==='en'?'en':'ko');configureSound(false,false,false);
function Fixture(){const [selected,setSelected]=useState<PreBooster[]>([]),[open,setOpen]=useState(true);return <main className="game-shell" data-art-root><ArtSurface scene="home"/>{open&&<StartLevelModal player={player} selected={selected} busy={false} unlimited={false} onToggle={item=>setSelected(values=>values.includes(item)?values.filter(value=>value!==item):[...values,item])} onPlay={()=>{}} onClose={()=>setOpen(false)}/>}</main>;}
await prepareAssets(()=>{});await document.fonts.load('16px Jua');await document.fonts.load('18px "Lilita One"');
const root=import.meta.hot?.data.root??createRoot(document.getElementById('root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<Fixture/>);
