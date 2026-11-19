import type {GardenStageDefinition} from '@garden/contracts';
import {t,tr} from './i18n';
import rabbit from '../../../packages/garden-world/art/runtime/residents-v22/rabbit-0.png';
import {art} from './assets';
import './garden-stages.css';
export default function GardenStageIntro({stage}:{stage:GardenStageDefinition}){
 const water=stage.kind==='water';
 return <section className="garden-stage-intro" aria-label={tr(water?'물길 정원':'동물 길 안내')}>
  <div className="garden-stage-scene" aria-hidden="true"><img className="stage-intro-floor" src={art(water?'stage_water_straight_v33':'stage_dry_straight_v33')} alt=""/><img className="stage-intro-source" src={water?art('stage_spring_v33'):rabbit} alt=""/><img className="stage-intro-goal" src={art(water?'stage_flower_bloom_v33':'stage_rabbit_home_v33')} alt=""/></div>
  <p>{water?tr('흙마개 위의 타일을 맞춰 꽃까지 물을 보내세요.'):t('start.animalGuide')}</p>
 </section>;
}
