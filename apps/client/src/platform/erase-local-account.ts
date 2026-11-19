import { Preferences } from '@capacitor/preferences';
import { INPUT_HISTORY_KEY } from '../input-diagnostics';
import { readLanguagePreference, saveLanguagePreference } from '../locale-preference';
import { clearAppleChallenge } from './auth';
import { ageAdmissionStorage } from './storage';

export async function eraseLocalAccountData(userId:string) {
  const accountKeys=[
    `cloud-garden-run-${userId}`,`cloud-garden-run-${userId}-conflict`,`cloud-garden-preferences-${userId}`,
    `garden-seen-help-${userId}`,`garden-pending-help-${userId}`,`garden-story-pending-${userId}`,
    `garden-pending-mutations-${userId}`,`cloud-garden-event-discovery-v1:${encodeURIComponent(userId)}`,INPUT_HISTORY_KEY
  ];
  for(const key of Object.keys(localStorage)){
    if(accountKeys.includes(key)||key.startsWith(`animal-expedition-v1:${userId}:`)
       ||key.startsWith(`garden-rescue-daily-v1-${userId}-`)||key.startsWith('cloud-garden-treasure-'))localStorage.removeItem(key);
  }
  const language=readLanguagePreference();
  if(language?.userId===userId)saveLanguagePreference(language.language,false);
  await Promise.all([ageAdmissionStorage.clear(),clearAppleChallenge(),(async()=>{
    const {keys}=await Preferences.keys();
    await Promise.all(keys.filter(key=>key.startsWith(`garden.purchase-intent.${userId}.`)).map(key=>Preferences.remove({key})));
  })()]);
}
