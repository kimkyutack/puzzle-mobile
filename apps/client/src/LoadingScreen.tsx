import {tr} from "./i18n";
import BrandLogo from './BrandLogo';
import StartupPoster from './StartupPoster';
interface Props {progress:number;error:string;recovering:boolean;busy:boolean;onRecover:()=>void;onRetry:()=>void}
export default function LoadingScreen({progress,error,recovering,busy,onRecover,onRetry}:Props){
 return <main className="story-loading" aria-busy={!error}>
  <StartupPoster className="story-loading-art" alt={tr('동물 친구들과 푸른 정원에 정자를 짓는 루미')}/>
  <h1 className="brand-heading"><BrandLogo/></h1>
  <div className="story-loading-bottom">
   <p role={error?'alert':'status'}>{tr(error)||tr('함께 정원을 만드는 중이에요')}</p>
   <div className="loading-progress" aria-hidden="true"><img src="/assets/loading-track.png" alt=""/><span style={{width:Math.round(progress*100)+'%'}}><img src="/assets/loading-fill.png" alt=""/></span></div>
   <progress className="sr-only" max={1} value={progress} aria-label={tr("리소스 준비")}/>
   {error?<button className="loading-retry" disabled={busy} onClick={recovering?onRecover:onRetry}>{recovering?tr("계정 다시 연결"):tr("다시 연결")}</button>:<small>{Math.round(progress*100)}%</small>}
  </div>
 </main>;
}
