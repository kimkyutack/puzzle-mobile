import type {CSSProperties,SyntheticEvent} from 'react';
import attendancePreview from '../../../packages/assets/event-header-v112/runtime/attendance-preview.webp?inline';
import attendance from '../../../packages/assets/event-design-v62/event-header-attendance-v73.webp';
import flowerlight from '../../../packages/assets/event-design-v62/event-header-flowerlight-v73.webp';
import treasure from '../../../packages/assets/event-design-v62/event-header-treasure-v73.webp';
import tools from '../../../packages/assets/event-design-v62/event-header-tools-v73.webp';
import season from '../../../packages/assets/event-design-v62/event-header-season-v73.webp';
import rewards from '../../../packages/assets/event-design-v62/event-header-rewards-v73.webp';
import './event-headers-v73.css';

const headers={attendance,flowerlight,treasure,'power-festival':tools,season,'live-events':rewards};

function revealHeader({currentTarget:image}:SyntheticEvent<HTMLImageElement>){
 // Keep the bundled garden preview visible until the full bitmap can be painted.
 void image.decode().then(()=>{if(image.isConnected)image.dataset.ready='true';},()=>{});
}
/** An in-bundle garden preview paints before external artwork is fetched. The
 * selected full-resolution header replaces it after decoding, including on tab changes. */
export default function EventHeaderBackdrop(){
 return <div className="events-page-backdrop events-header-backdrop" aria-hidden="true" style={{'--events-header-preview':`url("${attendancePreview}")`} as CSSProperties}>
  {Object.entries(headers).map(([id,src])=><img key={id} className="events-header-image" data-event-header={id} src={src} loading="eager" fetchPriority={id==='attendance'?'high':'low'} decoding="async" onLoad={revealHeader} onError={event=>{delete event.currentTarget.dataset.ready;}} alt="" draggable={false}/>)}
 </div>;
}
