export const ENGINE_VERSION = '1.1.0';
export const LEGACY_ENGINE_VERSION = '1.0.0';
export const supportsEngine = (version:string)=>version===ENGINE_VERSION||version===LEGACY_ENGINE_VERSION;
export const CONTENT_VERSION = 'garden-2026.11.03-flow-v1';
export const COLORS = ['berry','drop','sun','sprout','flower','acorn'] as const;
export type Color = typeof COLORS[number];
export type Special = 'wind-row'|'wind-column'|'bomb'|'glider'|'rainbow';
export type Booster = 'hammer'|'sweep-row'|'sweep-column'|'shuffle';
export type PreBooster = 'wind-row'|'bomb'|'rainbow';
export type Item = Booster | PreBooster;
export type Tile = {id:number; kind:'normal';color:Color} | {id:number;kind:Special} | {id:number;kind:'seed'};
export type ObstacleKind = 'crate'|'vine'|'pot'|'moss'|'cabinet';
export interface Obstacle {id:string;kind:ObstacleKind;hp:number;maxHp:number;anchor:number;footprint:number[];color?:Color;charge?:number;seeds?:number}
export interface Cell {exists:boolean;tile:Tile|null;frost:number;obstacleId?:string;exit?:boolean}
export interface Goal {kind:Color|'crate'|'vine'|'frost'|'seed'|'pot'|'moss'|'cabinet';count:number;remaining:number}
export interface LevelDefinition {
 id:number;version:string;engineVersion:string;width:number;height:number;colors:Color[];moves:number;
 seed:number;shape:boolean[];goals:Goal[];obstacles:Obstacle[];frost?:Record<number,number>;
 exits?:number[];inlets?:number[];gravity?:number[][];initial?:Array<Tile|null>;
 difficulty:'normal'|'hard'|'super';tutorial?:{text:string;from:number;to:number;feature:string};
 protectedCells?:number[];approved?:boolean;
}
export interface GameState {
 engineVersion:string;levelId:number;width:number;height:number;cells:Cell[];obstacles:Record<string,Obstacle>;
 goals:Goal[];moves:number;turn:number;rng:number;nextTileId:number;effectSequence:number;
 status:'playing'|'won'|'lost'|'error';error?:string;colors:Color[];gravity:number[][];
}
export type Action = {type:'swap';from:number;to:number}|{type:'tap';at:number}|{type:'booster';item:Booster;at?:number}|{type:'continue';moves:5};
export interface GameEvent {type:'swap'|'invalid'|'hit'|'remove'|'spawn'|'fall'|'special'|'shuffle'|'win'|'lose'|'moss'|'error';cells:number[];kind?:string;effectId?:number;from?:number;to?:number}
export interface ActionResult {state:GameState;events:GameEvent[];accepted:boolean;reason?:string}
export interface InventoryCount {normal:number;bound:number}
export interface Player {
 id:string;nickname:string;level:number;coins:number;boundCoins:number;stars:number;hearts:number;
 heartAt:number;unlimitedUntil:number;freeClaimAt:number;version:number;
 inventory:Record<Item,InventoryCount>;restored:string[];tutorials:string[];settings:{sound:boolean;music:boolean;haptics:boolean;reducedMotion:boolean;language:'ko'|'en'};
 guildId:string|null;passPoints:number;
}
export interface Run {
 id:string;userId:string;level:LevelDefinition;state:GameState;sequence:number;status:'active'|'won'|'lost'|'abandoned'|'expired';
 startedAt:number;expiresAt:number;preBoosters:PreBooster[];heartSpent:boolean;continues:number;
 reward?:{coins:number;stars:number};
}
export interface Envelope<T> {data:T;serverNow:number;stateVersion:number}
export interface ApiError {error:{code:string;message:string};serverNow:number}
export interface StateResponse {player:Player;activeRun:Run|null}
export interface PassClaimAllResponse {player:Player;claimed:{tier:number;track:'free'|'premium'}[];seasonId:string|null;reason:'CLAIMED'|'NOTHING_TO_CLAIM'}
export interface AuthResponse extends StateResponse {accessToken:string;refreshToken:string}
export interface StartRequest {idempotencyKey:string;preBoosters:PreBooster[]}
export interface ActionRequest {idempotencyKey:string;sequence:number;actions:Action[]}
export interface Gift {id:string;senderName:string;kind:'heart'|Item;quantity:number;bound:boolean;createdAt:number}
export interface Guild {id:string;name:string;description:string;mode:'open'|'approval';minLevel:number;emblem:number;members:number}
export interface GuildMember {userId:string;nickname:string;role:'leader'|'officer'|'member';level:number;contribution:number}
export interface SupportRequest {id:string;userId:string;nickname:string;kind:'heart'|Booster;received:number;maximum:number;expiresAt:number}
export interface ChatMessage {id:string;userId:string;nickname:string;text:string;createdAt:number}
export type AdPlacement = 'heart'|'coin_bonus';
export interface RewardIntent {id:string;placement:AdPlacement;amount:number;status:'reserved'|'pending'|'granted'|'cancelled'|'review';adUnit:string;expiresAt:number;runId?:string}
export interface OfferDefinition {kind:'limited'|'timed'|'chain';campaign:string;title:string;description:string;referencePriceKrw:number;step?:number;previousProductId?:string}
export interface Product {id:string;kind:'coins'|'starter'|'boosters'|'pass';coins:number;items:Partial<Record<Item,number>>;unlimitedSeconds:number;oneTime:boolean;offer?:OfferDefinition}
export interface ShopOffer {product:Product;periodId:string;startsAt:number;endsAt:number;status:'available'|'locked'|'purchased'|'refunded'|'expired';reason?:string}
export interface OffersResponse {offers:ShopOffer[];serverTime:number}
export type RankingScope = 'players'|'guilds'|'friends';
export type FriendRelation='none'|'outgoing'|'incoming'|'friend'|'self'|'blocked';
export interface FriendProfile {userId:string;nickname:string;level:number;highestClear:number;guildName:string|null;relation:FriendRelation}
export interface FriendHeartRequest {id:string;userId:string;nickname:string;received:number;maximum:number;expiresAt:number;helped:boolean}
export interface FriendsResponse {
 friends:FriendProfile[];incoming:FriendProfile[];outgoing:FriendProfile[];recommendations:FriendProfile[];
 heartRequests:FriendHeartRequest[];myRequest:FriendHeartRequest|null;gifts:Gift[];
 heartNextAt:number;heartsSent:number;heartsReceived:number;storedHearts:number;nextReset:number;
}
export interface RankingEntry {
 id:string;name:string;rank:number|null;position:number|null;score:number;tied:boolean;isMine:boolean;
 emblem?:number;members?:number;
}
export interface RankingsResponse {
 scope:RankingScope;metric:'highest_clear'|'member_highest_sum';entries:RankingEntry[];me:RankingEntry|null;
 participants:number;limit:number;updatedAt:number;
}

export type StorySpeaker='lumi'|'tori'|'naru';
export type StoryChapterId='sky'|'workshop'|'terrace';
export type GardenStyle='classic'|'festival';
export interface StoryBeat {speaker:StorySpeaker;text:string}
export interface StoryScene {id:string;chapterId:StoryChapterId;title:string;taskId?:string;art:string;beats:StoryBeat[]}
export interface StoryChapter {id:StoryChapterId;title:string;summary:string;art:string;sceneIds:string[]}
export interface StoryState {contentVersion:string;unlocked:string[];seen:string[];styles:Record<string,GardenStyle>;completedEpisodes?:string[]}
export interface LocalFeatures {freeHeartRefill:boolean}
