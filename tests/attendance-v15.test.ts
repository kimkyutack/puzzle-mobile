import {describe,it,expect} from 'vitest';
import {attendanceProgress} from '../apps/api/src/attendance';
describe('seven-day attendance',()=>{
 it('keeps missing days, ignores duplicate day keys, and marks today only once',()=>{expect(attendanceProgress(['10','12','12','14'],14)).toMatchObject({total:3,claimedDays:3,cycleDay:3});expect(attendanceProgress(['10','12','14'],16)).toMatchObject({total:3,claimedDays:3,cycleDay:4});});
 it('shows a completed seventh visit today and opens the next cycle tomorrow',()=>{const days=['1','2','3','4','5','6','7'];expect(attendanceProgress(days,7)).toMatchObject({total:7,claimedDays:7,cycleDay:7});expect(attendanceProgress(days,8)).toMatchObject({total:7,claimedDays:0,cycleDay:1});});
 it('does not count future or malformed claim keys',()=>{expect(attendanceProgress(['1','2','99','NaN',''],3)).toMatchObject({total:2,claimedDays:2,cycleDay:3});});
});
