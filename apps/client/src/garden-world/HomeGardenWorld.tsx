import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {Player,GardenStyle,StoryState} from '@garden/contracts';
import {AREAS,RESTORATIONS} from '@garden/content';
import {DECORATIONS,GARDEN_WORLD,gardenLandCells,gardenExpansionOptions,nextGardenRotation,storedDecorations,validateGardenPlacement,type GardenExpansionPlot,type GardenWorldState,type GardenPlacement,type GardenRotation} from '../../../../packages/garden-world/src';
import {GARDEN_SHOP_PRICES,liveShopItems} from '../../../../packages/garden-world/src/live';
import {request,key} from '../api';
import {tr} from '../i18n';
import {Amount,Button,Icon} from '../ui';
import {WorldMap,type MapHandle} from './WorldMap';
import {WORLD_ART,UI_ART,loadWorldArt,type LoadedArt} from './assets';
import {findPreviewPlacement} from './placement-preview';
import {extendGardenPaint} from './paint';
import {gardenDirectionArt} from './direction-art';
import {restorationSite} from '../../../../packages/garden-world/src/restoration-sites';
import type {GardenTask,RestorationVisual} from '../GardenScene';
import './live-world.css';

interface Props {styles?:StoryState['styles'];onStyle:(taskId:string,style:GardenStyle)=>void;styleBusy:boolean;styleReady:boolean;player:Player;editing:boolean;area:number;onArea:(area:number)=>void;onClose:()=>void;onEdit:()=>void;onPlayer:(player:Player)=>void;onRestore:(task:GardenTask)=>void;restoreBusy:boolean;restoring:boolean;visual?:RestorationVisual|null;confirmedWorld?:GardenWorldState|null}
export default function HomeGardenWorld(p:Props){
 const [world,setWorld]=useState<GardenWorldState|null>(null),[images,setImages]=useState<Record<string,LoadedArt>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState<'restore'|'bag'|'shop'|'expand'>('restore'),[category,setCategory]=useState('all'),[selected,setSelected]=useState<string|null>(null),[preview,setPreview]=useState<GardenPlacement|null>(null),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0);
 const [quantities,setQuantities]=useState<Record<string,number>>({}),[purchase,setPurchase]=useState<{itemId:string;quantity:number}|null>(null),[paintItem,setPaintItem]=useState<string|null>(null),[staged,setStaged]=useState<GardenPlacement[]>([]),[paintPan,setPaintPan]=useState(false);
 const [landConfig,setLandConfig]=useState<{cost:number;tiles:number}|null>(null),[landSelection,setLandSelection]=useState<string|null>(null),[landConfirm,setLandConfirm]=useState(false),[expandedLand,setExpandedLand]=useState<GardenExpansionPlot|null>(null);
 const preferredPlacement=useRef<{x:number;y:number}|null>(null);
 const [paintRotation,setPaintRotation]=useState<GardenRotation>(0);
 const stagedRef=useRef(staged);stagedRef.current=staged;
 const map=useRef<MapHandle>(null),pending=useRef<{signature:string;key:string}|null>(null),guard=useRef(false),alive=useRef(true),worldRef=useRef(world);worldRef.current=world;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const restored=p.player.restored.join('|');
 const owner=useRef(p.player.id);owner.current=p.player.id;
 const acceptWorld=(value:GardenWorldState)=>{if(value.ownerId!==owner.current)return null;const previous=worldRef.current,next=previous?.ownerId===value.ownerId&&previous.revision>value.revision?previous:value;worldRef.current=next;setWorld(next);return next;};
 useEffect(()=>{let live=true;setError('');void Promise.all([request<{world:GardenWorldState;land?:{cost:number;tiles:number}}>('/garden/world'),loadWorldArt()]).then(([result,art])=>{if(live){acceptWorld(result.world);setLandConfig(result.land??null);setImages(art)}},e=>{if(live)setError(e instanceof Error?e.message:tr('정원을 불러오지 못했어요.'))});return()=>{live=false}},[p.player.id,retry]);
 useEffect(()=>{if(p.confirmedWorld)acceptWorld(p.confirmedWorld);},[p.confirmedWorld]);
 // Updated servers include the saved world with a restoration. Older cached receipts still need one refresh.
 useEffect(()=>{if(!world||world.ownerId!==p.player.id||!p.player.restored.some(id=>!world.owned['restored-'+id])||p.confirmedWorld?.ownerId===p.player.id&&p.player.restored.every(id=>p.confirmedWorld!.owned['restored-'+id]))return;let live=true;void request<{world:GardenWorldState}>('/garden/world').then(result=>{if(live)acceptWorld(result.world);},()=>{});return()=>{live=false};},[p.player.id,restored,p.confirmedWorld,!!world]);
 useEffect(()=>{if(!p.editing){setSelected(null);setPreview(null);setPaintItem(null);setStaged([]);setPurchase(null);setLandConfirm(false);setExpandedLand(null)}},[p.editing]);
 useEffect(()=>{const task=p.visual?RESTORATIONS.find(t=>t.id===p.visual!.taskId):p.editing?RESTORATIONS.find(t=>!p.player.restored.includes(t.id)):undefined;
  if(task){const site=restorationSite(task,RESTORATIONS.indexOf(task)),item=DECORATIONS.find(d=>d.id===(task.itemId??(task.asset==='door'?(task.area==='workshop'?'garden-greenhouse':'garden-gate'):'garden-'+task.asset)));map.current?.focus({x:site.x+(item?.width??1)/2,y:site.y+(item?.height??1)/2});return;}
  const region=GARDEN_WORLD.regions.find(r=>r.id===AREAS[p.area]?.id);if(region)map.current?.focus({x:region.x+region.width/2,y:region.y+region.height/2});
 },[p.area,p.editing,p.visual?.taskId,!!images]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3000);return()=>clearTimeout(timer)},[notice]);
 const landOptions=useMemo(()=>world?gardenExpansionOptions(world):[],[world]);
 const landPlot=expandedLand??landOptions.find(plot=>plot.id===landSelection)??landOptions[0]??null;
 const landArea=useMemo(()=>world?gardenLandCells(world).size:0,[world]);
 useEffect(()=>{if(p.editing&&tab==='expand'&&landPlot)map.current?.framePlot(landPlot)},[p.editing,tab,landPlot?.id,!!images]);
 const select=useCallback((id:string)=>{setSelected(id);setPreview(null);setPaintItem(null);setStaged([]);p.onEdit()},[p.onEdit]);
 const movePreview=useCallback((point:{x:number;y:number})=>setPreview(old=>old?{...old,...point}:old),[]);
 const item=world&&selected?world.owned[selected]:null,definition=item?DECORATIONS.find(d=>d.id===item.itemId):null;
 const styleTask=selected?.startsWith('restored-')?RESTORATIONS.find(t=>t.id===selected.slice(9)&&['bench','planter','lamp'].includes(t.asset)):null;
 const painted=world?{...world,placements:{...world.placements,...Object.fromEntries(staged.map(placement=>[placement.instanceId,placement]))},owned:Object.fromEntries(Object.entries(world.owned).map(([id,item])=>[id,id.startsWith('restored-')?{...item,variant:p.styles?.[id.slice(9)]||item.variant}:item]))}:null;
 let invalid=false;if(world&&preview)try{validateGardenPlacement(world,preview)}catch{invalid=true}
 function begin(instanceId:string,current=worldRef.current){
  if(!current)return;const owned=current.owned[instanceId],definition=DECORATIONS.find(d=>d.id===owned?.itemId);
  if(definition&&(definition.layer==='ground'||(definition.category!=='animal'&&storedDecorations(current).filter(i=>i.itemId===definition.id).length>1))){setPaintItem(definition.id);setStaged([]);stagedRef.current=[];setPaintPan(false);setPaintRotation(0);setSelected(null);setPreview(null);const at=findPreviewPlacement(current,instanceId,preferredPlacement.current??{x:16,y:18});if(at)map.current?.focus({x:at.x+.5,y:at.y+.5});return;}
  const candidate=findPreviewPlacement(current,instanceId,preferredPlacement.current??{x:16,y:18});
  if(!candidate){setNotice(tr('놓을 공간이 부족해요. 다른 물건을 옮겨 주세요.'));return}
  setSelected(instanceId);setPreview(candidate);map.current?.focus({x:candidate.x+.5,y:candidate.y+.5});
 }
 async function perform(path:string,body:Record<string,unknown>,after?:(r:{world:GardenWorldState;instanceId?:string;instanceIds?:string[]})=>void){
  if(guard.current)return;guard.current=true;setBusy(true);setNotice('');
  const requestOwner=p.player.id,signature=JSON.stringify([path,body]);if(pending.current?.signature!==signature)pending.current={signature,key:key()};
  try{const result=await request<{world:GardenWorldState;player?:Player;instanceId?:string;instanceIds?:string[]}>(path,{...body,key:pending.current.key});pending.current=null;if(owner.current!==requestOwner)return;if(result.player)p.onPlayer(result.player);if(alive.current){const accepted=acceptWorld(result.world);if(accepted)after?.({...result,world:accepted});}}
  catch(e){if((e as {code?:string}).code&&!['NETWORK','INTERNAL_ERROR'].includes((e as {code?:string}).code!))pending.current=null;if(alive.current){setNotice(e instanceof Error?e.message:tr('정원을 저장하지 못했어요.'));if((e as {code?:string}).code==='STALE_REVISION'){clearPaint();setPreview(null);setSelected(null);setLandConfirm(false);setRetry(n=>n+1)}}}
  finally{guard.current=false;if(alive.current)setBusy(false)}
 }
 function save(){if(!world||!preview||invalid)return;void perform('/garden/world/commands',{...preview,type:world.placements[preview.instanceId]?'move':'place',expectedRevision:world.revision},()=>{setPreview(null);setSelected(null);setNotice(tr('정원에 놓았어요!'))})}
 function paint(cells:Array<{x:number;y:number}>){if(!worldRef.current||!paintItem||busy)return;const next=extendGardenPaint(worldRef.current,paintItem,stagedRef.current,cells,paintRotation);stagedRef.current=next;setStaged(next);}
 function clearPaint(){setStaged([]);stagedRef.current=[];setPaintItem(null);setPaintPan(false);setPaintRotation(0);}
 function savePaint(){if(!world||!staged.length)return;const count=staged.length;void perform('/garden/world/commands',{type:'paint',placements:staged,expectedRevision:world.revision},()=>{clearPaint();setTab('bag');setNotice(tr('정원에 놓았어요!')+' '+count+tr('개'))})}
 function switchTab(next:'restore'|'bag'|'shop'|'expand'){if(busy)return;setSelected(null);setPreview(null);clearPaint();setPurchase(null);setLandConfirm(false);setExpandedLand(null);setTab(next);}
 const paintStock=world&&paintItem?storedDecorations(world).filter(i=>i.itemId===paintItem).length:0;
 const paintingGround=DECORATIONS.find(d=>d.id===paintItem)?.layer==='ground';
 const paintArt=paintItem?(paintingGround?{art:WORLD_ART[paintItem]!,flipped:false}:gardenDirectionArt(WORLD_ART,paintItem,'classic',paintRotation)):null;
 const purchaseDefinition=purchase?DECORATIONS.find(d=>d.id===purchase.itemId):null;
 const selectedArt=definition&&painted&&selected?(definition.layer==='ground'?{art:WORLD_ART[definition.id]!,flipped:false}:gardenDirectionArt(WORLD_ART,definition.id,painted.owned[selected]!.variant,preview?.rotation??world!.placements[selected]?.rotation??0)):null;
 const next=RESTORATIONS.find(t=>!p.player.restored.includes(t.id));
 const catalog=(tab==='shop'?liveShopItems():DECORATIONS.filter(d=>world&&storedDecorations(world).some(i=>i.itemId===d.id))).filter(d=>category==='all'||d.category===category);
 const style={'--live-plate':`url(${UI_ART.plate})`,'--live-dock':`url(${UI_ART.dock})`,'--live-card':`url(${UI_ART.ice})`,'--live-green':`url(${UI_ART.play})`,'--live-blue':`url(${UI_ART.secondary})`,'--live-amber':`url(${UI_ART.amber})`} as CSSProperties;
 return <div className={'live-garden'+(p.editing?' is-editing':'')} style={style} data-live-garden="true">
  {world&&world.ownerId===p.player.id&&images?<WorldMap ref={map} world={painted!} images={images} restoration={p.visual} preview={preview} previewValid={!invalid} editable={p.editing} expansionPreview={p.editing&&tab==='expand'?landPlot:null} paint={!!paintItem&&!paintPan&&!busy} onPaint={paint} onSelect={id=>{if(!busy&&!p.restoring&&!paintItem&&tab!=='expand')select(id)}} onPreview={point=>{if(!busy)movePreview(point)}}/>:<div className="live-load" role="status"><img src={UI_ART.lumi} alt=""/><p>{error||tr('나의 정원을 펼치는 중…')}</p>{error&&<Button onClick={()=>setRetry(n=>n+1)}>{tr('다시 불러오기')}</Button>}</div>}
  {!p.editing&&world&&<p className="live-map-hint">{tr('끌어서 둘러보기 · 두 손가락으로 확대')}</p>}
  {p.editing&&<>
   <div className="live-edit-tabs has-expansion" data-art-root><Button secondary icon="hammer" disabled={busy} onClick={()=>switchTab('restore')}>{tr('복원')}</Button><Button secondary icon="chest" disabled={busy} onClick={()=>switchTab('bag')}>{tr('보관함')}</Button><Button tone="gold" icon="shop" disabled={busy} onClick={()=>switchTab('shop')}>{tr('상점')}</Button><Button tone="gold" icon="home" disabled={busy||!landConfig} onClick={()=>switchTab('expand')}>{tr('확장')}</Button><button className="live-close" aria-label={tr('정원 꾸미기 닫기')} disabled={busy} onClick={p.onClose}><img src={UI_ART.close} alt=""/></button></div>
   <section className="live-sheet" data-art-root aria-label={tr(paintItem?(paintingGround?'산책로 이어 깔기':'장식 연속 배치'):tab==='expand'?'정원 확장':purchase?'구매 확인':definition?'선택한 정원 물건':tab==='shop'?'정원 상점':tab==='bag'?'정원 보관함':'정원 복원')}>
    {tab==='expand'?<div className="live-land-tools" data-land-plot={landPlot?.id} data-land-owned={!!expandedLand}>
     <div className="live-sheet-heading"><h2>{tr(expandedLand?'20칸을 확장했어요!':landConfirm?'확장 구매 확인':'정원 확장')}</h2><Amount kind="coin" value={p.player.coins+p.player.boundCoins}/></div>
     <div className="live-land-summary"><Icon id="home" size={48}/><div><strong>{landArea.toLocaleString()}{tr('칸')}{!expandedLand&&landPlot&&' → '+(landArea+20).toLocaleString()+tr('칸')}</strong><p>{tr(expandedLand?'새 땅에 장식을 놓아 보세요.':'선택한 땅 5 × 4 · 총 20칸')}</p></div></div>
     {expandedLand?<><div className="live-actions"><Button secondary onClick={()=>{setExpandedLand(null);setLandSelection(null);setLandConfirm(false)}}>{tr('계속 확장')}</Button><Button tone="gold" icon="chest" onClick={()=>switchTab('bag')}>{tr('장식 놓기')}</Button></div></>:landPlot&&landConfig?<>
      {!landConfirm&&<div className="live-land-picker"><Button secondary disabled={busy||landOptions.length<2} onClick={()=>{const index=Math.max(0,landOptions.findIndex(plot=>plot.id===landPlot.id));setLandSelection(landOptions[(index-1+landOptions.length)%landOptions.length]!.id)}}>{tr('이전 위치')}</Button><span>{Math.max(0,landOptions.findIndex(plot=>plot.id===landPlot.id))+1} / {landOptions.length}</span><Button secondary disabled={busy||landOptions.length<2} onClick={()=>{const index=Math.max(0,landOptions.findIndex(plot=>plot.id===landPlot.id));setLandSelection(landOptions[(index+1)%landOptions.length]!.id)}}>{tr('다음 위치')}</Button></div>}
      <p className="live-land-explain">{tr(landConfirm?'골드를 사용해 선택한 땅을 확장할까요?':'노란색으로 표시된 땅을 확장해요.')}</p>
      <div className="live-actions">{landConfirm&&<Button secondary disabled={busy} onClick={()=>setLandConfirm(false)}>{tr('취소')}</Button>}<Button tone="gold" disabled={busy||p.player.coins+p.player.boundCoins<landConfig.cost} onClick={()=>{if(!landConfirm){setLandConfirm(true);return;}const bought=landPlot;void perform('/garden/world/expand',{plotId:bought.id,expectedRevision:world!.revision},()=>{setLandConfirm(false);setExpandedLand(bought);preferredPlacement.current={x:bought.x+2,y:bought.y+2};setNotice(tr('20칸을 확장했어요!'));})}}>{busy?tr('확장 중…'):<><span>{tr(landConfirm?'구매 확인':'20칸 확장')}</span><Amount kind="coin" value={landConfig.cost}/></>}</Button></div>
      {p.player.coins+p.player.boundCoins<landConfig.cost&&<p className="live-land-explain">{tr('코인이 부족해요.')}</p>}
     </>:<p>{tr('더 확장할 수 있는 땅이 없어요.')}</p>}
    </div>:paintItem?<div className="live-paint-tools">
     <div className="live-selection"><img src={paintArt!.art} style={{transform:paintArt?.flipped?'scaleX(-1)':undefined}} alt=""/><div><h2>{tr(paintingGround?'산책로 이어 깔기':'장식 연속 배치')}</h2><p>{tr('손가락으로 쭉 그려 주세요.')} {tr('남은 수량')} {paintStock-staged.length}</p><p role="status">{tr('미리 배치')} {staged.length} / 100</p></div></div>
     <div className="live-actions"><Button secondary disabled={busy} onClick={clearPaint}>{tr('취소')}</Button><Button secondary className="live-turn" disabled={busy} onClick={()=>setPaintRotation(nextGardenRotation)}>{tr('방향')} {paintRotation}°</Button><Button secondary disabled={busy||!staged.length} onClick={()=>{const next=staged.slice(0,-1);stagedRef.current=next;setStaged(next)}}>{tr('한 칸 취소')}</Button></div>
     <div className="live-actions"><Button secondary disabled={busy} onClick={()=>setPaintPan(value=>!value)}>{tr(paintPan?'이어 깔기':'지도 이동')}</Button><Button disabled={busy||!staged.length} onClick={savePaint}>{busy?tr('저장 중…'):tr('설치')+' '+staged.length+tr('개')}</Button></div>
    </div>:purchase&&purchaseDefinition?<div className="live-purchase-confirm" role="group" aria-label={tr('구매 확인')}>
     <div className="live-selection"><img src={WORLD_ART[purchase.itemId]} alt=""/><div><h2>{tr(purchaseDefinition.name)}</h2><p>{purchase.quantity}{tr('개를 구매할까요?')}</p><Amount kind="coin" value={GARDEN_SHOP_PRICES[purchase.itemId]!*purchase.quantity}/></div></div>
     <p>{tr('구매한 물건은 보관함에 보관돼요.')}</p><div className="live-actions"><Button secondary disabled={busy} onClick={()=>setPurchase(null)}>{tr('취소')}</Button><Button tone="gold" disabled={busy} onClick={()=>void perform('/garden/shop/buy',{itemId:purchase.itemId,quantity:purchase.quantity},result=>{setPurchase(null);if(result.instanceId)begin(result.instanceId,result.world)})}>{busy?tr('구매 중…'):tr('구매 확인')}</Button></div>
    </div>:definition&&world&&selected?<><div className="live-selection"><img src={selectedArt!.art} style={{transform:selectedArt?.flipped?'scaleX(-1)':undefined}} alt=""/><div><h2>{tr(definition.name)}</h2><p>{busy?tr('정원에 저장하는 중…'):preview?(invalid?tr('다른 칸에 놓아 주세요.'):tr('끌어서 위치를 정한 뒤 놓아 주세요.')):tr('이동하거나 보관할 수 있어요.')}</p></div></div><div className="live-actions"><Button secondary disabled={busy} onClick={()=>{setSelected(null);setPreview(null)}}>{tr('취소')}</Button>{preview?<>{definition.rotations.length>1&&<Button secondary className="live-turn" disabled={busy} onClick={()=>setPreview(old=>old?{...old,rotation:nextGardenRotation(old.rotation)}:null)}>{tr('방향')} {preview.rotation}°</Button>}<Button disabled={invalid||busy} onClick={save}>{tr('놓기')}</Button></>:<><Button disabled={busy} onClick={()=>setPreview({...world.placements[selected]!})}>{tr('이동')}</Button><Button tone="gold" disabled={busy} onClick={()=>void perform('/garden/world/commands',{type:'store',instanceId:selected,expectedRevision:world.revision},()=>{setSelected(null);setNotice(tr('보관함에 넣었어요.'))})}>{tr('보관')}</Button></>}</div>{styleTask&&!preview&&<div className="live-actions">{(['classic','festival'] as const).map(style=><Button key={style} secondary={style==='classic'} disabled={p.styleBusy||!p.styleReady} onClick={()=>p.onStyle(styleTask.id,style)}>{tr(style==='classic'?'자연':'축제')}</Button>)}</div>}</>:tab==='restore'?<>
     <h2>{tr(p.restoring?'가꾸는 중…':next?next.name:'모든 복원을 마쳤어요!')}</h2><p>{tr(p.restoring?'정원을 가꾸면서 저장하고 있어요.':next?'복원하면 다음 이야기가 이어져요.':'완성한 시설을 옮기거나 상점에서 장식을 더해 보세요.')}</p>
     {next?<Button icon="hammer" disabled={p.restoreBusy||p.restoring||p.player.stars<next.cost} onClick={()=>p.onRestore(next)}>{p.restoreBusy||p.restoring?tr('가꾸는 중…'):<><span>{tr('복원하기')}</span><Amount kind="star" value={next.cost}/></>}</Button>:<Button tone="gold" icon="shop" onClick={()=>setTab('shop')}>{tr('장식과 동물 구경하기')}</Button>}

    </>:<>
     <div className="live-sheet-heading"><h2>{tr(tab==='shop'?'정원 상점':'정원 보관함')}</h2>{tab==='shop'&&<Amount kind="coin" value={p.player.coins+p.player.boundCoins}/>}</div>
     <div className="live-categories">{[['all','전체'],['decoration','장식'],['building','시설'],['animal','동물']].map(([id,label])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id!)}>{tr(label!)}</button>)}</div>
     <div key={tab+category} className="live-products">{catalog.map(d=>{const stock=world?storedDecorations(world).filter(i=>i.itemId===d.id):[],price=GARDEN_SHOP_PRICES[d.id]!,quantity=quantities[d.id]??1;return <article key={d.id} className={'live-product '+d.category} style={{'--live-card':`url(${d.category==='animal'?UI_ART.peach:d.category==='building'?UI_ART.lavender:UI_ART.ice})`} as CSSProperties}><img src={WORLD_ART[d.id]} alt={tr(d.name)}/><h3>{tr(d.name)}</h3><p>{tab==='bag'?tr('보유 ')+stock.length:d.width+'×'+d.height+' '+tr('칸')}</p>{tab==='shop'?<><div className="live-quantity" role="group" aria-label={tr(d.name)+' '+tr('구매 수량')}><button aria-label={tr('수량 줄이기')} disabled={busy||quantity<=1} onClick={()=>setQuantities(old=>({...old,[d.id]:Math.max(1,quantity-1)}))}>−</button><input type="number" inputMode="numeric" aria-label={tr(d.name)+' '+tr('수량')} min="1" max="100" disabled={busy} value={quantity} onChange={e=>setQuantities(old=>({...old,[d.id]:Math.max(1,Math.min(100,Math.trunc(Number(e.target.value)||1)))}))}/><button aria-label={tr('수량 늘리기')} disabled={busy||quantity>=100} onClick={()=>setQuantities(old=>({...old,[d.id]:Math.min(100,quantity+1)}))}>+</button></div><Button tone="gold" disabled={busy||!world||p.player.level<5||p.player.coins+p.player.boundCoins<price*quantity} onClick={()=>setPurchase({itemId:d.id,quantity})}><Amount kind="coin" value={price*quantity}/></Button></>:<Button disabled={busy||!stock.length} onClick={()=>begin(stock[0]!.id)}>{tr(d.layer==='ground'?'이어 깔기':stock.length>1&&d.category!=='animal'?'연속 놓기':'놓기')}</Button>}</article>})}{!catalog.length&&<p className="live-empty">{tr('보관한 물건이 없어요. 지도에서 보관하거나 상점에서 구입해 보세요.')}</p>}</div>
    </>}
   </section>
  </>}
  {notice&&<p className="live-notice" role="status">{notice}</p>}
 </div>;
}
