import {deviceCopy} from '../../../packages/content/src/long-campaign-boards';
import type {GameState} from '@garden/contracts';
import {tr} from './i18n';
import {Icon} from './ui';
import './campaign-devices.css';

export default function CampaignDeviceHint({state}:{state:GameState}){
 const devices=state.devices,step=devices?.steps[devices.index];
 if(!devices||!step)return null;
 const [name,hint]=deviceCopy[step.kind];
 return <div className="campaign-device-hint" aria-live="polite">
  <Icon id={devices.color?`tile_${devices.color}`:'stage_mud_gate_v33'} size={24}/>
  <div><strong>{tr(name)}</strong><span>{tr(hint)}</span></div>
  {step.kind==='scale'
   ?<div className="campaign-scale-pans">
    <b>{devices.pans?.[0]??0}/{step.target}</b>
    <b>{devices.pans?.[1]??0}/{step.target}</b>
   </div>
   :<b aria-label={`${devices.progress} / ${step.target}`}>{devices.progress}/{step.target}</b>}
 </div>;
}
