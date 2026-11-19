import type {AgeBand} from '../../../../packages/contracts/src/age-access';

let band:AgeBand|null=null;
export const getAccountAge=()=>band;
export const setAccountAge=(value:AgeBand|null)=>{band=value;};
export const clearAccountAge=()=>setAccountAge(null);
export const childAccount=()=>band==='child';
export const accountAllowsAds=()=>band==='adult';
