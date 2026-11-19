import {Capacitor} from '@capacitor/core';
import {Browser} from '@capacitor/browser';
import type {MouseEvent} from 'react';
import deployment from '../../../config/deployment.json';
import officialSite from '../../../config/official-site.json';
import {translateText,type Locale} from './i18n';
import {Card} from './ui';
import './legal-links.css';

const origin=new URL(officialSite.origin??deployment.apiUrl).origin;
const links=[['/privacy','개인정보처리방침'],['/terms','이용약관'],['/account-deletion','계정 삭제 안내']] as const;
export default function LegalLinks({locale,onError,compact=false}:{locale:Locale;onError:(message:string)=>void;compact?:boolean}){
 const base=origin+officialSite.basePath+(locale==='ko'?'':'/'+locale);
 const label=(text:string)=>translateText(text,locale);
 async function open(event:MouseEvent<HTMLAnchorElement>,url:string){
  if(!Capacitor.isNativePlatform())return;
  event.preventDefault();
  try{await Browser.open({url});}
  catch{onError(label('안내 페이지를 열지 못했어요. 잠시 후 다시 시도해 주세요.'));}
 }
 const navigation=<nav className="settings-legal-links" aria-label={label('약관 및 개인정보')}>{links.map(([path,title])=><a key={path} href={base+path} target="_blank" rel="noopener noreferrer" onClick={event=>void open(event,base+path)}>{label(title)}<span aria-hidden="true">↗</span></a>)}</nav>;
 return compact?navigation:<Card title={label('약관 및 개인정보')} tone="blue">{navigation}</Card>;
}
