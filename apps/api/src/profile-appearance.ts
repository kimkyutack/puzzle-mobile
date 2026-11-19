import {z} from 'zod';
import {PROFILE_AVATARS,PROFILE_FRAMES,PROFILE_BACKDROPS} from '@garden/contracts';

export const profileAppearanceSchema=z.object({
 avatar:z.enum(PROFILE_AVATARS),
 frame:z.enum(PROFILE_FRAMES),
 backdrop:z.enum(PROFILE_BACKDROPS),
}).strict();
