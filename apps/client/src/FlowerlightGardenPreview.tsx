import {useEffect,useRef,useState} from 'react';
import type {GardenWorldState} from '../../../packages/garden-world/src';
import {WorldMap,type MapHandle} from './garden-world/WorldMap';
import {loadWorldArt,type LoadedArt} from './garden-world/assets';
import {Button} from './ui';
import {tr} from './i18n';

/** This is the player's saved garden, not a separate event diorama. */
export default function FlowerlightGardenPreview({world,error,onVisit,reduced}:{world:GardenWorldState|null;error:string;onVisit:()=>void;reduced:boolean}){
 const [images,setImages]=useState<Record<string,LoadedArt>|null>(null),[artError,setArtError]=useState(''),map=useRef<MapHandle>(null);
 useEffect(()=>{let live=true;void loadWorldArt().then(images=>{if(live)setImages(images)},()=>{if(live)setArtError(tr('정원을 불러오지 못했어요.'))});return()=>{live=false}},[]);
 useEffect(()=>{if(world&&images)map.current?.overview()},[world?.revision,!!images]);
 return <section className="festival-real-garden" aria-label={tr('나의 축제 정원')}>
  {world&&images?<WorldMap ref={map} world={world} images={images} editable={false} reducedMotion={reduced} overviewInsets={{top:45,bottom:45,left:16,right:16}} preview={null} previewValid onPreview={()=>{}} onSelect={()=>{}}/>:<p role="status">{error||artError||tr('나의 정원을 펼치는 중…')}</p>}
  <strong className="festival-real-garden-label">{tr('나의 축제 정원')}</strong><Button secondary className="festival-visit-garden" onClick={onVisit}>{tr('내 정원으로')}</Button>
 </section>;
}
