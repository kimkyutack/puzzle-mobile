/** Daily rewards have server-issued UTC day keys. Missing a day never resets
 * earned attendance, and one daily claim advances exactly once. */
export function attendanceProgress(sources:readonly string[],today:number){
 const days=new Set(sources.filter(value=>/^\d+$/.test(value)&&Number(value)<=today));
 const claimedToday=days.has(String(today)),total=days.size;
 const claimedDays=total%7||(claimedToday&&total>0?7:0);
 return {total,claimedDays,cycleDay:Math.min(7,claimedDays+(claimedToday?0:1)),bonusItem:'hammer' as const,bonusQuantity:1};
}
