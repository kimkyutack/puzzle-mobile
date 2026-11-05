import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createGardenWorld,applyTrustedDecorationGrant,applyGardenCommand} from '../../packages/garden-world/src';
import {WorldMap} from '../../apps/client/src/garden-world/WorldMap';
import {loadWorldArt,type LoadedArt} from '../../apps/client/src/garden-world/assets';
import {residentDirectionArt} from '../../apps/client/src/garden-world/resident-art';
import {residentHeading,residentWalkFrame} from '../../apps/client/src/garden-world/residents';

let world=createGardenWorld('walk-v26-fixture');
for(const [i,id]of ['rabbit','cat','dog'].entries()){
 world=applyTrustedDecorationGrant(world,{ownerId:world.ownerId,grantId:'grant-'+id,itemId:'animal-'+id,instanceIds:[id],variant:'classic',source:'shop'});
 world=applyGardenCommand(world,{type:'place',instanceId:id,x:14+i*2,y:16,rotation:0,operationId:'place-'+id,expectedRevision:world.revision},world.ownerId);
}
const actors=['visitor_a','visitor_b','animal-rabbit','animal-cat','animal-dog'];
const headings=[{dx:-1,dy:0,label:'왼쪽 위 ↖'},{dx:0,dy:-1,label:'오른쪽 위 ↗'},{dx:0,dy:1,label:'왼쪽 아래 ↙'},{dx:1,dy:0,label:'오른쪽 아래 ↘'}];
function Fixture(){
 const [art,setArt]=useState<Record<string,LoadedArt>|null>(null),[distance,setDistance]=useState(0),[paused,setPaused]=useState(false);
 useEffect(()=>{void loadWorldArt().then(setArt)},[]);
 useEffect(()=>{if(paused)return;let frame=0,last=performance.now();const tick=(now:number)=>{setDistance(d=>d+Math.max(0,Math.min(.1,(now-last)/1000))*.36);last=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[paused]);
 return <><header><h1>사람·동물 네 방향 보행</h1><p>실제 정원과 같은 원화 선택 · 이동 거리로 다리 교대</p><button onClick={()=>setPaused(value=>!value)}>{paused?'재생':'정지'}</button></header><table><thead><tr>{headings.map(h=><th key={h.label}>{h.label}</th>)}</tr></thead><tbody>{art&&actors.map(id=><tr key={id}>{headings.map(h=>{const frame=residentWalkFrame(distance,id.startsWith('animal')),view=residentDirectionArt(art,{art:id,pose:'walk',frame,...residentHeading(h.dx,h.dy)});return <td key={h.label} data-actor={id} data-direction={view.direction} data-frame={frame} data-asset={view.assetId}><img src={view.art.image.src} style={{transform:view.flipped?'scaleX(-1)':undefined}}/><small>{view.direction} · {frame+1}/4</small></td>})}</tr>)}</tbody></table><header><h1>실제 정원 렌더러</h1><p>동물 배치·산책·하품·수면 유지 · API 없는 격리 데이터</p></header><section>{art&&<WorldMap world={world} images={art} editable={false} reducedMotion={false} preview={null} previewValid onSelect={()=>{}} onPreview={()=>{}}/>}</section></>;
}
const mount=document.getElementById('root')! as HTMLElement&{walkV26Root?:ReturnType<typeof createRoot>};
mount.walkV26Root??=createRoot(mount);mount.walkV26Root.render(<Fixture/>);
