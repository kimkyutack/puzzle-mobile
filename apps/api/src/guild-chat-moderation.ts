// Keep this list limited to abusive words, slurs and directed threats.
// Ordinary game language such as "공격", "죽었어요", and "kill the boss" is allowed.
const korean = /씨발|씨팔|시팔|시발(?!점|역|열차)|(?<!질)병신|븅신|개새끼|씹새끼|좆까|존나|꺼져버려|너죽여버릴|너죽여버린다|자살해라|자살하길/;
const japanese = /死ね(?!ない|ば|る)|くたばれ|ぶっ殺す|自殺しろ|糞野郎|クソ野郎/;

const englishTerms = [
  'fuck', 'fucks', 'fucked', 'fucking', 'fuckyou', 'motherfucker',
  'shit', 'sh1t', 'bullshit', 'bitch', 'b1tch', 'asshole', 'cunt', 'faggot',
  'nigger', 'retard', 'killyourself', 'iwillkillyou', 'gokillyourself',
];
const english = new RegExp(
  `(?<![\\p{Script=Latin}\\p{N}])(?:${englishTerms.map(term => [...term].join('[\\s\\p{P}\\p{S}]*')).join('|')})(?![\\p{Script=Latin}\\p{N}])`,
  'u',
);

export function isHarmfulGuildChat(text: string): boolean {
  const normalized = text.normalize('NFKC').toLowerCase().replace(/\p{Default_Ignorable_Code_Point}/gu, '');
  const compact = normalized.replace(/[^\p{L}\p{N}\p{M}]/gu, '').normalize('NFKC');
  return korean.test(compact) || japanese.test(compact) || english.test(normalized);
}
