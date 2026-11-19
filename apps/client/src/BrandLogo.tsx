import titleKo from '../../../packages/assets/branding/title-ko.webp';
import titleEn from '../../../packages/assets/branding/title-en.webp';
import titleJa from '../../../packages/assets/branding/title-ja.webp';
import {useI18n} from './i18n';
import './brand.css';

const logos={ko:{src:titleKo,height:500},en:{src:titleEn,height:499},ja:{src:titleJa,height:499}};

/** Bundled bootstrap art: available before the full game manifest has loaded. */
export default function BrandLogo(){
 const {locale,t}=useI18n();
 const {src,height}=logos[locale];
 return <img className="brand-logo" src={src} alt={t('brand.title')} width={1200} height={height} fetchPriority="high" decoding="async"/>;
}
