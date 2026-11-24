import gardenPass from '../../../packages/assets/weekly-events/garden-pass.webp';
import unlimitedTools from '../../../packages/assets/weekly-events/unlimited-tools.webp';
export function EventIcon({kind,size=54}:{kind:'pass'|'unlimited';size?:number}){
 return <img className="icon event-feature-icon" src={kind==='pass'?gardenPass:unlimitedTools} width={size} height={size} alt="" draggable={false}/>;
}
