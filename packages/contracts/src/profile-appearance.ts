export const PROFILE_AVATARS=['lumi','tori','rabbit'] as const;
export const PROFILE_FRAMES=['gold','leaf','violet'] as const;
export const PROFILE_BACKDROPS=['greenhouse','flowerlight','terrace'] as const;

export interface ProfileAppearance {
 avatar:typeof PROFILE_AVATARS[number];
 frame:typeof PROFILE_FRAMES[number];
 backdrop:typeof PROFILE_BACKDROPS[number];
 customImage?:string;
}

export const DEFAULT_PROFILE_APPEARANCE:Readonly<ProfileAppearance>=Object.freeze({
 avatar:'lumi',frame:'gold',backdrop:'greenhouse',
});
