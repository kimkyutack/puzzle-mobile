import {tr} from "./i18n";
import BrandLogo from './BrandLogo';
interface Props {progress:number;error:string;recovering:boolean;busy:boolean;onRecover:()=>void;onRetry:()=>void}
export default function LoadingScreen({progress,error,recovering,busy,onRecover,onRetry}:Props){
 return <main className="story-loading" aria-busy={!error}>
  <img className="story-loading-art" src="/assets/loading-story.png" alt={tr("루미가 구름정원에 도착한 초대장을 발견했어요")}/>
  <h1 className="brand-heading"><BrandLogo/></h1>
  <div className="story-loading-bottom">
   <p role={error?'alert':'status'}>{tr(error)||tr("다음 편지를 만나러 가요")}</p>
   <div className="loading-progress" aria-hidden="true"><img src="/assets/loading-track.png" alt=""/><span style={{width:Math.round(progress*100)+'%'}}><img src="/assets/loading-fill.png" alt=""/></span></div>
   <progress className="sr-only" max={1} value={progress} aria-label={tr("리소스 준비")}/>
   {error?<button className="loading-retry" disabled={busy} onClick={recovering?onRecover:onRetry}>{recovering?tr("계정 다시 연결"):tr("다시 연결")}</button>:<small>{Math.round(progress*100)}%</small>}
  </div>
 </main>;
}
