import titleKo from '../../../packages/assets/branding/title-ko.webp';
import titleEn from '../../../packages/assets/branding/title-en.webp';
import {useI18n} from './i18n';
import './brand.css';

/** Bundled bootstrap art: available before the full game manifest has loaded. */
export default function BrandLogo(){
 const {locale,t}=useI18n();
 return <img className="brand-logo" src={locale==='en'?titleEn:titleKo} alt={t('brand.title')} width={1200} height={locale==='en'?499:500} fetchPriority="high" decoding="async"/>;
}
