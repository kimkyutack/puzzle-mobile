import config from '../../../../config/official-site.json';
import legal from '../../../../config/legal.json';

export const locales=['ko','en','ja'] as const;
export type SiteLocale=typeof locales[number];
export const policyPaths=['/privacy','/terms','/account-deletion'] as const;
export type PolicyPath=typeof policyPaths[number];
export type SitePath='/'|PolicyPath;
export type Section={id:string;title:string;body:string};
export type PolicyPage={title:string;summary:string;sections:Section[]};
export type Policies=Record<PolicyPath,PolicyPage>;
export const site=config;
export const business=legal;
export const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export const mail=(subject:string,body='')=>`mailto:${business.contactEmail}?${new URLSearchParams({subject,...(body?{body:body.replace(/\r?\n/g,'\r\n')}:{})}).toString().replace(/\+/g,'%20')}`;
export const emailLink=(subject:string)=>`<a href="${escape(mail(subject))}">${escape(business.contactEmail)}</a>`;
export const table=(headings:string[],rows:string[][])=>`<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(headings.join(' · '))}"><table><thead><tr>${headings.map(text=>`<th scope="col">${escape(text)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(text=>`<td>${text}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const media=(filename:string)=>`${site.basePath}/media/${filename}`;
export const sitePath=(locale:SiteLocale,path:SitePath='/')=>`${site.basePath}${locale==='ko'?'':'/'+locale}${path}`;
export const isLocale=(value:string|null):value is SiteLocale=>locales.some(locale=>locale===value);
export const isPolicyPath=(value:string):value is PolicyPath=>policyPaths.some(path=>path===value);
export const languageNames:Record<SiteLocale,string>={ko:'한국어',en:'English',ja:'日本語'};

const companies:Record<SiteLocale,{name:string;representative:string;address:string;labels:[string,string,string,string,string]}>={
 ko:{name:business.businessName,representative:business.representative,address:business.address,labels:['사업자','대표자 · 개인정보 보호책임자','사업자등록번호','사업장 주소','문의 · 권리 행사']},
 en:{name:'Hidden Stage (히든스테이지)',representative:'Kim Gyu-taek (김규택)',address:'Suite 110, 1F, 17 Galmaesunhwan-ro, Guri-si, Gyeonggi-do, Republic of Korea',labels:['Operator','Representative · privacy contact','Business registration number','Business address','Contact and privacy requests']},
 ja:{name:'Hidden Stage（ヒドゥンステージ）',representative:'キム・ギュテク（김규택）',address:'大韓民国 京畿道 九里市 葛梅循環路17、1階110号',labels:['運営事業者','代表者・個人情報保護責任者','事業者登録番号','事業所所在地','お問い合わせ・権利行使']}
};
export function businessDetails(locale:SiteLocale,subject:string){
 const info=companies[locale];
 const values=[escape(info.name),escape(info.representative),escape(business.businessRegistrationNumber),escape(info.address),emailLink(subject)];
 return `<dl class="business">${info.labels.map((label,i)=>`<div><dt>${escape(label)}</dt><dd>${values[i]}</dd></div>`).join('')}</dl>`;
}
export const paragraphs=(...values:string[])=>values.map(value=>`<p>${value}</p>`).join('');
export const list=(values:string[],ordered=false)=>`<${ordered?'ol':'ul'}${ordered?' class="steps"':''}>${values.map(value=>`<li>${value}</li>`).join('')}</${ordered?'ol':'ul'}>`;
