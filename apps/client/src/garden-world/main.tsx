import {StrictMode,useCallback,useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {DECORATIONS,GARDEN_WORLD,nextGardenRotation,GardenWorldError,applyGardenCommand,storedDecorations,validateGardenPlacement,type DecorationDefinition,type GardenPlacement,type GardenWorldState} from '../../../../packages/garden-world/src';
import {PREVIEW_KEY,PREVIEW_OWNER,readPreviewGarden} from './preview-state';
import {UI_ART,WORLD_ART,loadWorldArt,type LoadedArt} from './assets';
import {WorldMap,type MapHandle} from './WorldMap';
import {findPreviewPlacement} from './placement-preview';
import {purchasePreviewItem} from './preview-shop';
import {gardenDirectionArt} from './direction-art';
import './fonts.css';
import './world.css';
function Button({children,onClick,tone='blue',disabled=false,label}:{children:ReactNode;onClick:()=>void;tone?:'blue'|'lime'|'amber';disabled?:boolean;label?:string}){
 return <button className="gw-button" disabled={disabled} aria-label={label} style={{borderImageSource:`url(${tone==='lime'?UI_ART.play:tone==='amber'?UI_ART.amber:UI_ART.secondary})`}} onClick={onClick}>{children}</button>;
}
const errorText:Record<string,string>={OCCUPIED:'다른 물건과 겹쳐요.',REGION_LOCKED:'아직 열리지 않은 땅이에요.',OUT_OF_BOUNDS:'정원 안에 놓아주세요.',WRONG_REGION:'이 건물은 온실 구역에 놓아주세요.',UNSUPPORTED_ROTATION:'이 물건은 방향을 바꿀 수 없어요.'};
type Category='all'|DecorationDefinition['category'];
const categories:readonly [Category,string][]=[['all','전체'],['decoration','장식'],['building','시설'],['animal','동물']];
const featured=['animal-rabbit','animal-cat','animal-dog','garden-rose-arch','garden-gazebo','garden-pond','garden-picnic','garden-hedge','garden-mushroom'];
function App(){
 const [initial]=useState(()=>{let raw=null;try{raw=localStorage.getItem(PREVIEW_KEY);}catch{}return readPreviewGarden(raw);});
 const [world,setWorld]=useState(initial.world),[images,setImages]=useState<Record<string,LoadedArt>|null>(null),[loadError,setLoadError]=useState(''),[drawer,setDrawer]=useState<'inventory'|'regions'|'shop'|null>(null),[category,setCategory]=useState<Category>('all'),[selected,setSelected]=useState<string|null>(null),[preview,setPreview]=useState<GardenPlacement|null>(null),[visitor,setVisitor]=useState(false),[zoom,setZoom]=useState(.68),[notice,setNotice]=useState(initial.status==='invalid'?'저장된 체험 정원을 읽지 못해 기본 모습을 열었어요.':'');
 const map=useRef<MapHandle>(null),worldRef=useRef(world);worldRef.current=world;
 useEffect(()=>{let cancelled=false;void Promise.all([loadWorldArt(),document.fonts.load('16px Jua')]).then(([art])=>{if(!cancelled)setImages(art);},()=>{if(!cancelled)setLoadError('정원 그림을 불러오지 못했어요. 새로고침해 주세요.');});return()=>{cancelled=true;};},[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);},[notice]);
 const commit=(next:GardenWorldState)=>{worldRef.current=next;setWorld(next);try{localStorage.setItem(PREVIEW_KEY,JSON.stringify(next));}catch{setNotice('이 기기에 저장하지 못했어요. 현재 화면에서는 계속 꾸밀 수 있어요.');}};
 const owned=storedDecorations(world),selectedItem=selected?world.owned[selected]:undefined,definition=selectedItem?DECORATIONS.find(item=>item.id===selectedItem.itemId):undefined;
 const selectedArt=definition&&selected?(definition.layer==='ground'?{art:WORLD_ART[definition.id]!,flipped:false}:gardenDirectionArt(WORLD_ART,definition.id,world.owned[selected]!.variant,preview?.rotation??world.placements[selected]?.rotation??0)):null;
 const filtered=DECORATIONS.filter(item=>category==='all'||item.category===category),inventoryCatalog=filtered.filter(item=>Object.values(world.owned).some(owned=>owned.itemId===item.id));
 const shopCatalog=filtered.filter(item=>item.futureShop).sort((a,b)=>(featured.includes(a.id)?featured.indexOf(a.id):100)-(featured.includes(b.id)?featured.indexOf(b.id):100));
 let invalid='';if(preview)try{validateGardenPlacement(world,preview);}catch(error){invalid=error instanceof GardenWorldError?errorText[error.code]||'이곳에는 놓을 수 없어요.':'이곳에는 놓을 수 없어요.';}
 const select=useCallback((id:string)=>{setSelected(id);setDrawer(null);},[]);
 const movePreview=useCallback((point:{x:number;y:number})=>setPreview(old=>old?{...old,...point}:old),[]);
 const beginPlacement=(instanceId:string,current=worldRef.current)=>{
  if(visitor)return;const item=current.owned[instanceId];if(!item)return;
  setDrawer(null);const definition=DECORATIONS.find(def=>def.id===item.itemId)!,region=definition.regions?.includes('workshop')?'workshop':'sky';
  const at=region==='workshop'?{x:4,y:18}:{x:18,y:19},candidate=findPreviewPlacement(current,item.id,at);
  if(!candidate){setSelected(null);setNotice('놓을 공간이 부족해요. 다른 물건을 옮기거나 보관해 주세요.');return;}
  setSelected(item.id);setPreview(candidate);map.current?.focus({x:candidate.x+.5,y:candidate.y+.5});
 };
 const chooseStored=(itemId:string)=>{const item=storedDecorations(worldRef.current).find(owned=>owned.itemId===itemId);if(item)beginPlacement(item.id);};
 const purchase=(itemId:string)=>{
  if(visitor)return;
  try{const result=purchasePreviewItem(worldRef.current,itemId,crypto.randomUUID());commit(result.world);beginPlacement(result.instanceId,result.world);}
  catch(error){setNotice(error instanceof Error?error.message:'체험 아이템을 받지 못했어요.');}
 };
 const place=()=>{
  if(!preview||invalid||visitor)return;const current=worldRef.current;try{
   const next=applyGardenCommand(current,{...preview,type:current.placements[preview.instanceId]?'move':'place',expectedRevision:current.revision,operationId:crypto.randomUUID()},PREVIEW_OWNER);commit(next);setPreview(null);setSelected(null);setNotice('정원에 놓았어요!');
  }catch(error){setNotice(error instanceof GardenWorldError?errorText[error.code]||'배치를 저장하지 못했어요.':'배치를 저장하지 못했어요.');}
 };
 const store=()=>{
  if(!selected||visitor)return;const current=worldRef.current;try{commit(applyGardenCommand(current,{type:'store',operationId:crypto.randomUUID(),expectedRevision:current.revision,instanceId:selected},PREVIEW_OWNER));setSelected(null);setPreview(null);setNotice('보관함에 넣었어요. 언제든 다시 놓을 수 있어요.');}catch{setNotice('물건을 보관하지 못했어요.');}
 };
 const style={'--gw-plate':`url(${UI_ART.plate})`,'--gw-dock':`url(${UI_ART.dock})`} as CSSProperties;
 return <main className={'gw-shell'+(visitor?' is-visitor':'')} style={style}>
  {images?<WorldMap ref={map} world={world} images={images} preview={preview} previewValid={!invalid} editable={!visitor&&!!selected} onSelect={select} onPreview={movePreview} onZoom={setZoom}/>:<div className="gw-loading" role="status"><img src={UI_ART.lumi} alt=""/><p>{loadError||'나의 정원을 펼치는 중…'}</p></div>}
  <header className="gw-header gw-plate"><img className="gw-avatar" src={UI_ART.lumi} alt="루미"/><div><h1>{visitor?'정원 구경':'나의 정원'}</h1><p>체험 정원 · 이 기기에 저장</p></div><button className="gw-home" aria-label="분수 광장으로 이동" onClick={()=>map.current?.focus({x:16.5,y:16.5})}><img src={UI_ART.home} alt=""/></button></header>
  <div className="gw-zoom gw-plate" aria-label="지도 확대와 축소"><button aria-label="지도 확대" onClick={()=>map.current?.zoom(1.2)}>+</button><span>{Math.round(zoom*100)}%</span><button aria-label="지도 축소" onClick={()=>map.current?.zoom(1/1.2)}>−</button></div>
  {visitor&&<div className="gw-visit-note gw-plate">방문 화면 체험 · 자유롭게 둘러보세요</div>}
  {!drawer&&!selected&&!visitor&&<p className="gw-hint">땅을 끌어 이동하고, 건물을 눌러 꾸며보세요</p>}
  <nav className="gw-footer" aria-label="정원 메뉴">
   <button disabled={visitor} aria-expanded={drawer==='shop'} onClick={()=>{setPreview(null);setSelected(null);setDrawer(drawer==='shop'?null:'shop');}}><img src={UI_ART.shop} alt=""/><span>상점</span></button>
   <button disabled={visitor} aria-expanded={drawer==='inventory'} onClick={()=>{setPreview(null);setSelected(null);setDrawer(drawer==='inventory'?null:'inventory');}}><img src={UI_ART.inventory} alt=""/><span>보관함</span></button>
   <button aria-expanded={drawer==='regions'} onClick={()=>{setPreview(null);setSelected(null);setDrawer(drawer==='regions'?null:'regions');}}><img src={UI_ART.home} alt=""/><span>구역</span></button>
   <button onClick={()=>{setPreview(null);setSelected(null);setDrawer(null);setVisitor(!visitor);}}><img src={visitor?UI_ART.hammer:UI_ART.lumi} alt=""/><span>{visitor?'내 정원으로':'방문 화면'}</span></button>
  </nav>
  {drawer&&<section className={'gw-drawer'+(drawer==='shop'?' gw-shop-drawer':'')} aria-label={drawer==='inventory'?'꾸미기 보관함':drawer==='shop'?'꾸미기 체험 상점':'정원 구역'}><div className="gw-sheet-heading"><h2>{drawer==='inventory'?'꾸미기 보관함':drawer==='shop'?'꾸미기 체험 상점':'정원 둘러보기'}</h2><button aria-label="패널 닫기" onClick={()=>setDrawer(null)}><img src={UI_ART.close} alt=""/></button></div>
   {drawer!=='regions'&&<div className="gw-categories" role="group" aria-label="꾸미기 종류">{categories.map(([value,label])=><button key={value} aria-pressed={category===value} style={{borderImageSource:`url(${category===value?UI_ART.play:UI_ART.secondary})`}} onClick={()=>setCategory(value)}>{label}</button>)}</div>}
   {drawer==='inventory'?<><p className="gw-sheet-note">보유한 장식과 동물 친구를 골라 놓아보세요</p>{inventoryCatalog.length?<div key={category} className="gw-inventory">{inventoryCatalog.map(item=>{const count=owned.filter(owned=>owned.itemId===item.id).length;return <button key={item.id} className="gw-product gw-plate" aria-label={`${item.name} · 보관 ${count}개`} disabled={!count} onClick={()=>chooseStored(item.id)}><img src={WORLD_ART[item.id]} alt=""/><strong>{item.name}</strong><span>{count?`${count}개 보관`:'모두 배치했어요'}</span></button>;})}</div>:<div className="gw-empty"><img src={WORLD_ART[category==='animal'?'animal-rabbit':'garden-rose-arch']} alt=""/><p>{category==='animal'?'정원에 함께할 동물 친구를 만나보세요.':'상점에서 새로운 꾸미기를 만나보세요.'}</p><Button tone="amber" onClick={()=>setDrawer('shop')}>체험 상점으로</Button></div>}</>:drawer==='shop'?<><p className="gw-sheet-note">무료 체험 구매 · 실제 코인이나 결제를 사용하지 않아요</p><div key={category} className="gw-shop-grid">{shopCatalog.map(item=>{const count=Object.values(world.owned).filter(owned=>owned.itemId===item.id).length;return <article key={item.id} className={'gw-shop-item is-'+item.category} style={{borderImageSource:`url(${item.category==='animal'?UI_ART.peach:item.category==='building'?UI_ART.lavender:UI_ART.ice})`}}><img src={WORLD_ART[item.id]} alt={item.name}/><h3>{item.name}</h3><p>{item.width}×{item.height}칸 · {count}개 보유</p><Button label={`${item.name} 체험 구매`} tone="amber" onClick={()=>purchase(item.id)}>체험 구매</Button></article>;})}</div></>:<div className="gw-regions">{GARDEN_WORLD.regions.map(region=>{const unlocked=world.unlockedRegions.includes(region.id);return <button key={region.id} className="gw-region gw-plate" onClick={()=>{map.current?.focus({x:region.x+region.width/2,y:region.y+region.height/2});setDrawer(null);}}><img src={WORLD_ART[region.id==='workshop'?'garden-greenhouse':region.id==='terrace'?'garden-fountain':region.id==='forest'?'garden-tree':'garden-planter']} alt=""/><span>{region.name}<small>{unlocked?'둘러보기':'이야기로 열리는 구역'}</small></span></button>;})}</div>}
  </section>}
  {selected&&definition&&<section className="gw-selection" aria-label="선택한 정원 물건"><div className="gw-selection-head"><img src={selectedArt!.art} style={{transform:selectedArt?.flipped?'scaleX(-1)':undefined}} alt=""/><div><h2>{definition.name}</h2><p>{preview?invalid||'여기에 놓을 수 있어요.':`${definition.width}×${definition.height}칸 · ${visitor?'정원을 구경하는 중':'이동하거나 보관할 수 있어요'}`}</p></div><button aria-label="선택 닫기" onClick={()=>{setPreview(null);setSelected(null);}}><img src={UI_ART.close} alt=""/></button></div>
   {!visitor&&<div className="gw-actions">{preview?<><Button label="배치 취소" onClick={()=>{setPreview(null);setSelected(null);}}>취소</Button>{definition.rotations.length>1&&<Button label="건물 방향 바꾸기" onClick={()=>setPreview(old=>old?{...old,rotation:nextGardenRotation(old.rotation)}:null)}>방향 {preview.rotation}°</Button>}<Button tone="lime" disabled={!!invalid} onClick={place}>{definition.category==='animal'?'친구 놓기':'배치'}</Button></>:<><Button tone="amber" onClick={()=>{const placed=world.placements[selected];if(placed)setPreview({...placed});}}>이동</Button><Button onClick={store}>보관</Button></>}</div>}
  </section>}
  {notice&&<div className="gw-toast gw-plate" role="status">{notice}</div>}
  <div className="gw-accessible">{Object.values(world.placements).filter(p=>world.owned[p.instanceId]!.itemId!=='garden-path-stone').map(p=><button key={p.instanceId} onClick={()=>{select(p.instanceId);map.current?.focus({x:p.x+1,y:p.y+1});}}>{DECORATIONS.find(item=>item.id===world.owned[p.instanceId]!.itemId)!.name} 선택 · {p.x},{p.y}</button>)}</div>
 </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
