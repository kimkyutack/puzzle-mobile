import type {Player} from '@garden/contracts';

export type HeartCloseAction='dismiss'|'wait'|'resume'|'home';

/** Remembers only a start rejected for lack of hearts, not ordinary heart visits. */
export class HeartStartFlow {
 private pendingStart=false;
 private working=false;
 private closeRequested=false;

 waitForHearts(){this.pendingStart=true;this.closeRequested=false;}
 cancel(){const pending=this.pendingStart;this.pendingStart=false;this.closeRequested=false;return pending;}
 setWorking(value:boolean){this.working=value;return !value&&this.closeRequested;}

 close(player:Pick<Player,'hearts'|'unlimitedUntil'>,now:number):HeartCloseAction{
  if(!this.pendingStart)return 'dismiss';
  if(this.working){this.closeRequested=true;return 'wait';}
  this.cancel();
  return player.hearts>0||player.unlimitedUntil>now?'resume':'home';
 }
}
