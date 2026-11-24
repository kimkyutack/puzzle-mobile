import {useRef,useState} from 'react';
import {profileImage} from './profile-image';
import {DEFAULT_PROFILE_APPEARANCE,PROFILE_AVATARS,PROFILE_BACKDROPS,PROFILE_FRAMES,type ProfileAppearance} from '@garden/contracts';
import greenhouse from '../../admin/public/_studio/media/gallery/cloud-garden/lumi-cloud-greenhouse-thumb.webp';
import flowerlight from '../../admin/public/_studio/media/gallery/cloud-garden/flowerlight-plaza-thumb.webp';
import terrace from '../../admin/public/_studio/media/gallery/cloud-garden/season-garden-thumb.webp';
import fountain from '../../../packages/assets/flowerlight-v42/flowerlight-fountain.png';
import rabbit from '../../../packages/garden-world/art/runtime/rabbit.png';
import {tr} from './i18n';
import {Button,Icon} from './ui';
import './gardener-profile.css';

const backdrops={greenhouse,flowerlight,terrace};
const avatarNames={lumi:'루미',tori:'토리',rabbit:'토끼'};
const backdropNames={greenhouse:'구름 온실',flowerlight:'꽃빛 광장',terrace:'계절 정원'};
const frameNames={gold:'햇살 금빛',leaf:'새잎 초록',violet:'별빛 보라'};
const tabs={avatar:'캐릭터',frame:'테두리',backdrop:'배경'} as const;

function GardenerBackdrop({backdrop}:{backdrop:ProfileAppearance['backdrop']}){
 return <div className="gardener-cover" data-backdrop={backdrop}>
  <img className="gardener-landscape" src={backdrops[backdrop]} alt="" draggable={false}/>
  {backdrop==='flowerlight'&&<img className="gardener-fountain" src={fountain} alt="" draggable={false}/>}
 </div>;
}

export function GardenerAvatar({avatar='lumi',customImage,size}:{avatar?:ProfileAppearance['avatar'];customImage?:string;size:number}){
 if(customImage)return <img className="icon custom-profile-image" src={customImage} width={size} height={size} alt="" draggable={false}/>;
 return avatar==='rabbit'
  ? <img className="icon" src={rabbit} width={size} height={size} alt="" draggable={false}/>
  : <Icon id={avatar==='tori'?'tori_v8':'lumi_happy'} size={size}/>;
}

/** A player's chosen character inside their chosen frame, for lists (ranking, friends, guild). */
export function ProfilePortrait({appearance=DEFAULT_PROFILE_APPEARANCE,size}:{appearance?:ProfileAppearance;size:number}){
 return <span className="profile-portrait" data-profile-frame={appearance.frame} style={{width:size,height:size}}><GardenerAvatar avatar={appearance.avatar} customImage={appearance.customImage} size={Math.round(size*.78)}/></span>;
}

interface CardProps {
 nickname:string;
 level:number;
 highestClear:number;
 appearance?:ProfileAppearance;
 guild?:string|null;
 restoration?:string;
 badge?:{name:string;asset:string};
}

export function GardenerCard({nickname,level,highestClear,appearance=DEFAULT_PROFILE_APPEARANCE,guild,restoration,badge}:CardProps){
 return <section className="gardener-card" aria-label={tr('정원사 프로필')}>
  <GardenerBackdrop backdrop={appearance.backdrop}/>
  <div className="gardener-identity">
   <div className="gardener-portrait" data-profile-frame={appearance.frame}><GardenerAvatar avatar={appearance.avatar} customImage={appearance.customImage} size={78}/></div>
   <div className="gardener-name">
    <span className="gardener-level">{tr('레벨')} {level}</span>
    <h3>{nickname}</h3>
    {guild&&<span className="gardener-guild"><Icon id="guild" size={19}/>{guild}</span>}
    {badge&&<span className="gardener-guild"><Icon id={badge.asset} size={19}/>{tr(badge.name)}</span>}
   </div>
  </div>
  <div className="gardener-records">
   <div><Icon id="level_completed_v61" size={31}/><span>{tr('최고 클리어 레벨')}<strong>{highestClear}</strong></span></div>
   {restoration&&<div><Icon id="home" size={31}/><span>{tr('정원 복원')}<strong>{restoration}</strong></span></div>}
  </div>
 </section>;
}

export function GardenerAppearanceEditor({card,working,onCancel,onSave}:{card:CardProps;working:boolean;onCancel:()=>void;onSave:(value:ProfileAppearance)=>void}){
 const [draft,setDraft]=useState<ProfileAppearance>(()=>({...DEFAULT_PROFILE_APPEARANCE,...card.appearance}));
 const [tab,setTab]=useState<keyof typeof tabs>('avatar');
 const [imageBusy,setImageBusy]=useState(false),[imageError,setImageError]=useState('');
 const upload=useRef<HTMLInputElement>(null),revision=useRef(0);
 async function selectImage(file:File|undefined){
  if(!file)return;
  const current=++revision.current;setImageBusy(true);setImageError('');
  try{const image=await profileImage(file);if(current===revision.current)setDraft(previous=>({...previous,customImage:image}));}
  catch(error){if(current===revision.current)setImageError(tr(error instanceof Error?error.message:'사진을 처리하지 못했어요.'));}
  finally{if(current===revision.current)setImageBusy(false);}
 }
 const saved=card.appearance??DEFAULT_PROFILE_APPEARANCE;
 function choose<K extends keyof ProfileAppearance>(kind:K,value:ProfileAppearance[K]){
  setDraft(previous=>({...previous,[kind]:value}));
 }
 return <div className="gardener-editor">
  <GardenerCard {...card} appearance={draft}/>
  <div className="gardener-editor-tabs" aria-label={tr('프로필 꾸미기')}>
   {(['avatar','frame','backdrop'] as const).map(id=><button key={id} aria-pressed={tab===id} disabled={working} onClick={()=>setTab(id)}>{tr(tabs[id])}</button>)}
  </div>
  <div className="gardener-choices" aria-label={tr(tabs[tab])}>
   {tab==='avatar'&&<><button className="profile-photo-choice" aria-pressed={!!draft.customImage} disabled={working||imageBusy} onClick={()=>upload.current?.click()}><span>{draft.customImage?<GardenerAvatar customImage={draft.customImage} size={47}/>:<b aria-hidden="true">+</b>}</span>{tr(imageBusy?'사진 처리 중…':'내 사진')}</button>{PROFILE_AVATARS.map(id=><button key={id} aria-pressed={!draft.customImage&&draft.avatar===id} disabled={working||imageBusy} onClick={()=>{revision.current++;setDraft(previous=>({...previous,avatar:id,customImage:undefined}));}}><span><GardenerAvatar avatar={id} size={47}/></span>{tr(avatarNames[id])}</button>)}</>}
   {tab==='frame'&&PROFILE_FRAMES.map(id=><button key={id} aria-pressed={draft.frame===id} disabled={working} onClick={()=>choose('frame',id)}><span className="gardener-frame-option" data-profile-frame={id}/>{tr(frameNames[id])}</button>)}
   {tab==='backdrop'&&PROFILE_BACKDROPS.map(id=><button key={id} aria-pressed={draft.backdrop===id} disabled={working} onClick={()=>choose('backdrop',id)}><GardenerBackdrop backdrop={id}/>{tr(backdropNames[id])}</button>)}
  </div>
  <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={event=>{void selectImage(event.currentTarget.files?.[0]);event.currentTarget.value='';}}/>
  {imageError&&<p role="alert" className="profile-image-error">{imageError}</p>}
  <div className="gardener-editor-actions">
   <Button secondary disabled={working} onClick={onCancel}>{tr('취소')}</Button>
   <Button tone="green" disabled={working||imageBusy||(['avatar','frame','backdrop','customImage'] as const).every(id=>draft[id]===saved[id])} onClick={()=>onSave(draft)}>{tr('꾸미기 저장')}</Button>
  </div>
 </div>;
}
