import type {GardenStageDefinition,GardenStageState} from './garden-stages';
import type {FlowerFestivalProgress,AnimalExpeditionProgress} from './content-events';
import type {CampaignDevice,CampaignDevicesState} from './campaign-devices';
import type {BreakableObstacleKind,CrateContents,PlanterCover} from './breakable-obstacles';
import type {GardenDirection,GardenPuzzle,GardenPuzzleState,WireLayers} from './garden-puzzles';
import type {GardenGameId,GardenGameProgress} from './garden-games';
import type {ProfileAppearance} from './profile-appearance';
import type {ChapterObstacle} from './chapter-obstacles';
export {DEFAULT_PROFILE_APPEARANCE,PROFILE_AVATARS,PROFILE_FRAMES,PROFILE_BACKDROPS,type ProfileAppearance} from './profile-appearance';
export type {FlowerFestivalProgress,AnimalExpeditionProgress,AnimalExpeditionAttempt,AnimalExpeditionRoundProgress,ExpeditionAnimal,ExclusiveExpeditionAnimal,FestivalStage} from './content-events';
export type {GardenStageKind,GardenStageDefinition,GardenStageState} from './garden-stages';
export const SEED_DELIVERY_ENGINE_VERSION = '1.11.0';
export const CAMPAIGN_DEVICE_ENGINE_VERSION = '1.12.0';
export const GLIDER_SWARM_ENGINE_VERSION = '1.13.0';
export const GARDEN_WORKSHOP_ENGINE_VERSION = '1.14.0';
export const GREENHOUSE_ENGINE_VERSION = '1.15.0';
export const OBSTACLE_GARDEN_ENGINE_VERSION = '1.16.0';
export const POWER_RAINBOW_ENGINE_VERSION = '1.17.0';
export const PLANTER_GARDEN_ENGINE_VERSION = '1.18.0';
export const GARDEN_PUZZLE_ENGINE_VERSION = '1.19.0';
export const DENSE_GARDEN_PUZZLE_ENGINE_VERSION = '1.20.0';
export const CUTOUT_REFILL_ENGINE_VERSION = '1.21.0';
export const VISIBLE_TARGETS_ENGINE_VERSION = '1.22.0';
export const OBJECTIVE_POWERS_ENGINE_VERSION = '1.23.0';
export const MATCH_FIRST_ENGINE_VERSION = '1.24.0';
export const RISING_CAMPAIGN_ENGINE_VERSION = '1.25.0';
export const CAMPAIGN_EXPANSION_ENGINE_VERSION = '1.26.0';
export const CHAPTER_OBSTACLE_ENGINE_VERSION = '1.27.0';
export const LAYERED_OBSTACLE_ENGINE_VERSION = '1.28.0';
export const CONTINUOUS_REFILL_ENGINE_VERSION = '1.29.0';
export const ENGINE_VERSION = CONTINUOUS_REFILL_ENGINE_VERSION;
export const FLOW_GRAVITY_ENGINE_VERSION = '1.10.0';
export const ENDPOINT_PIPE_ENGINE_VERSION = '1.9.0';
export const IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION = '1.8.0';
export const OPEN_GARDEN_STAGE_ENGINE_VERSION = '1.7.0';
export const GARDEN_STAGE_ENGINE_VERSION = '1.6.0';
export const BEEHIVE_ENGINE_VERSION = '1.5.0';
export const PERPENDICULAR_ROCKET_ENGINE_VERSION = '1.4.0';
export const SCULPTED_ENGINE_VERSION = '1.2.0';
export const PREVIOUS_ENGINE_VERSION = '1.1.0';
export const LEGACY_ENGINE_VERSION = '1.0.0';
export const GARDEN_ENGINE_VERSION = '1.3.0';
// Keep the legacy health field stable for already-installed clients. New clients
// negotiate supportedEngineVersions, even when a newer ruleset is published.
export const LEGACY_HEALTH_ENGINE_VERSION = GARDEN_ENGINE_VERSION;
// Simulation rules, independent of Worker deployments and content publications.
export const SUPPORTED_ENGINE_VERSIONS = Object.freeze([ENGINE_VERSION,LAYERED_OBSTACLE_ENGINE_VERSION,CHAPTER_OBSTACLE_ENGINE_VERSION,CAMPAIGN_EXPANSION_ENGINE_VERSION,RISING_CAMPAIGN_ENGINE_VERSION,MATCH_FIRST_ENGINE_VERSION,OBJECTIVE_POWERS_ENGINE_VERSION,VISIBLE_TARGETS_ENGINE_VERSION,CUTOUT_REFILL_ENGINE_VERSION,DENSE_GARDEN_PUZZLE_ENGINE_VERSION,GARDEN_PUZZLE_ENGINE_VERSION,PLANTER_GARDEN_ENGINE_VERSION,POWER_RAINBOW_ENGINE_VERSION,OBSTACLE_GARDEN_ENGINE_VERSION,GREENHOUSE_ENGINE_VERSION,GARDEN_WORKSHOP_ENGINE_VERSION,GLIDER_SWARM_ENGINE_VERSION,CAMPAIGN_DEVICE_ENGINE_VERSION,SEED_DELIVERY_ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION,ENDPOINT_PIPE_ENGINE_VERSION,IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION,OPEN_GARDEN_STAGE_ENGINE_VERSION,GARDEN_STAGE_ENGINE_VERSION,BEEHIVE_ENGINE_VERSION,PERPENDICULAR_ROCKET_ENGINE_VERSION,GARDEN_ENGINE_VERSION,SCULPTED_ENGINE_VERSION,PREVIOUS_ENGINE_VERSION,LEGACY_ENGINE_VERSION]);
export const LEVEL_SCHEMA_VERSION = 1;
export const supportsEngine = (version:string)=>SUPPORTED_ENGINE_VERSIONS.some(known=>known===version);
export const commonEngine = (client:readonly string[],server:readonly string[]=SUPPORTED_ENGINE_VERSIONS)=>client.find(version=>server.includes(version));
export const supportsContinuousRefill = (version:string)=>version===CONTINUOUS_REFILL_ENGINE_VERSION;
export const supportsLayeredObstacles = (version:string)=>version===LAYERED_OBSTACLE_ENGINE_VERSION||supportsContinuousRefill(version);
export const supportsChapterObstacles = (version:string)=>version===CHAPTER_OBSTACLE_ENGINE_VERSION||supportsLayeredObstacles(version);
export const supportsCampaignExpansion = (version:string)=>version===CAMPAIGN_EXPANSION_ENGINE_VERSION||supportsChapterObstacles(version);
export const supportsRisingCampaign = (version:string)=>version===RISING_CAMPAIGN_ENGINE_VERSION||supportsCampaignExpansion(version);
export const supportsMatchFirst = (version:string)=>version===MATCH_FIRST_ENGINE_VERSION||supportsRisingCampaign(version);
export const supportsObjectivePowers = (version:string)=>version===OBJECTIVE_POWERS_ENGINE_VERSION||supportsMatchFirst(version);
export const supportsVisibleTargets = (version:string)=>version===VISIBLE_TARGETS_ENGINE_VERSION||supportsObjectivePowers(version);
export const supportsCutoutRefill = (version:string)=>version===CUTOUT_REFILL_ENGINE_VERSION||supportsVisibleTargets(version);
export const supportsDenseGardenPuzzles = (version:string)=>version===DENSE_GARDEN_PUZZLE_ENGINE_VERSION||supportsCutoutRefill(version);
export const supportsGardenPuzzles = (version:string)=>version===GARDEN_PUZZLE_ENGINE_VERSION||supportsDenseGardenPuzzles(version);
export const supportsPlanterGarden = (version:string)=>version===PLANTER_GARDEN_ENGINE_VERSION||supportsGardenPuzzles(version);
export const supportsPowerRainbow = (version:string)=>version===POWER_RAINBOW_ENGINE_VERSION||supportsPlanterGarden(version);
export const supportsObstacleGarden = (version:string)=>version===OBSTACLE_GARDEN_ENGINE_VERSION||supportsPowerRainbow(version);
export const supportsGreenhouse = (version:string)=>version===GREENHOUSE_ENGINE_VERSION||supportsObstacleGarden(version);
export const supportsGardenWorkshop = (version:string)=>version===GARDEN_WORKSHOP_ENGINE_VERSION||supportsGreenhouse(version);
export const supportsGliderSwarm = (version:string)=>version===GLIDER_SWARM_ENGINE_VERSION||supportsGardenWorkshop(version);
export const supportsCampaignDevices = (version:string)=>version===CAMPAIGN_DEVICE_ENGINE_VERSION||supportsGliderSwarm(version);
export const supportsSeedDelivery = (version:string)=>version===SEED_DELIVERY_ENGINE_VERSION||supportsCampaignDevices(version);
export const supportsFlowGravity = (version:string)=>version===FLOW_GRAVITY_ENGINE_VERSION||supportsSeedDelivery(version);
export const supportsEndpointPipes = (version:string)=>version===ENDPOINT_PIPE_ENGINE_VERSION||supportsFlowGravity(version);
export const supportsImmediateGardenStages = (version:string)=>version===IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION||supportsEndpointPipes(version);
export const supportsOpenGardenStages = (version:string)=>version===OPEN_GARDEN_STAGE_ENGINE_VERSION||supportsImmediateGardenStages(version);
export const supportsGardenStages = (version:string)=>version===GARDEN_STAGE_ENGINE_VERSION||supportsOpenGardenStages(version);
export const supportsBeehive = (version:string)=>version===BEEHIVE_ENGINE_VERSION||supportsGardenStages(version);
export const supportsGardenMechanics = (version:string)=>version===GARDEN_ENGINE_VERSION||version===PERPENDICULAR_ROCKET_ENGINE_VERSION||supportsBeehive(version);
export const perpendicularRockets = (version:string)=>version===PERPENDICULAR_ROCKET_ENGINE_VERSION||supportsBeehive(version);
export const CONTENT_VERSION = 'garden-2026.11.04-campaign-v20';
export const COLORS = ['berry','drop','sun','sprout','flower','acorn'] as const;
export type Color = typeof COLORS[number];
export type Special = 'wind-row'|'wind-column'|'bomb'|'glider'|'rainbow'|'beehive';
export type Booster = 'hammer'|'sweep-row'|'sweep-column'|'shuffle'|'sweep-border'|'world-bomb'|'cross-firework'|'color-magnet'|'move-hourglass';
export type PreBooster = 'wind-row'|'bomb'|'rainbow';
export interface StartBoosterGuide {
 item:Extract<PreBooster,'wind-row'|'bomb'>;
 cell:number;
 trial?:true;
}
export type Item = Booster | PreBooster;
export type Tile = {id:number; kind:'normal';color:Color} | {id:number;kind:Special} | {id:number;kind:'seed'};
export type ObstacleKind = 'crate'|'vine'|'pot'|'moss'|'cabinet'|'pipe'|'bud'|'carousel'|'curtain'|BreakableObstacleKind;
export type ObstacleRule = 'shutter-open'|'shutter-closed'|'regrow'|'match-shell'|'power-shell'|'twin'|'pigment'|'directional'|'fuse';
export interface Obstacle {id:string;kind:ObstacleKind;hp:number;maxHp:number;anchor:number;footprint:number[];color?:Color;charge?:number;seeds?:number;path?:number[];endOnly?:true;contents?:CrateContents;link?:string;cover?:PlanterCover;storedRocket?:'wind-row'|'wind-column';direction?:GardenDirection;wire?:WireLayers;rule?:ObstacleRule;pair?:number;lastHitColor?:Color;detonateAt?:number;strikeSide?:GardenDirection;chapter?:ChapterObstacle}
export interface Cell {exists:boolean;tile:Tile|null;frost:number;obstacleId?:string;exit?:boolean}
export interface Goal {kind:Color|ObstacleKind|'frost'|'seed'|'combo'|'special'|'garden-water'|'garden-route'|'device';count:number;remaining:number}
export type CampaignBeat='introduction'|'practice'|'easy'|'normal'|'hard'|'super'|'celebration';
export interface CampaignPosition {pack:number;position:number;beat:CampaignBeat;lesson?:ObstacleKind;phase:1|2|3|4|5}
export interface LevelDefinition {
 powerRainbow?:true;
 goldGarden?:true;
 gardenStage?:GardenStageDefinition;
 gardenPuzzle?:GardenPuzzle;
 devices?:CampaignDevice[];
 id:number;version:string;engineVersion:string;width:number;height:number;colors:Color[];moves:number;
 seed:number;shape:boolean[];goals:Goal[];obstacles:Obstacle[];frost?:Record<number,number>;
 exits?:number[];inlets?:number[];gravity?:number[][];initial?:Array<Tile|null>;
 difficulty:'normal'|'hard'|'super';tutorial?:{text:string;from:number;to:number;feature:string};
 protectedCells?:number[];approved?:boolean;
 startBoosterGuide?:StartBoosterGuide;
 strategy?:{id:string;name:string;hint:string};
 campaign?:CampaignPosition;
}
export interface LevelPreview {schemaVersion:number;contentVersion:string;level:LevelDefinition;levelHash?:string}
export interface GameState {
 powerRainbow?:true;
 goldGarden?:{coinCells:number[]};
 gardenStage?:GardenStageState;
 gardenPuzzle?:GardenPuzzleState;
 devices?:CampaignDevicesState;
 engineVersion:string;levelId:number;width:number;height:number;cells:Cell[];obstacles:Record<string,Obstacle>;
 goals:Goal[];moves:number;turn:number;rng:number;nextTileId:number;effectSequence:number;
 status:'playing'|'won'|'lost'|'error';error?:string;colors:Color[];gravity:number[][];
}
export type Action = {type:'swap';from:number;to:number}|{type:'tap';at:number}|{type:'booster';item:Booster;at?:number}|{type:'continue';moves:5};
export interface GameEvent {type:'swap'|'invalid'|'hit'|'remove'|'spawn'|'fall'|'special'|'shuffle'|'win'|'lose'|'moss'|'error'|'mechanic';cells:number[];kind?:string;effectId?:number;from?:number;to?:number;inlet?:number;localRefill?:true;obstacleId?:string;obstacleAfter?:Obstacle|null;payload?:Special;routes?:number[][];powered?:true}
export interface ActionResult {state:GameState;events:GameEvent[];accepted:boolean;reason?:string}
export interface InventoryCount {normal:number;bound:number}
export const APP_LOCALES = ['ko','en','ja'] as const;
export type AppLocale = typeof APP_LOCALES[number];
export interface Player {
 profileAppearance?:ProfileAppearance;
 winStreak?:number;
 usedStartBoosterTrial?:true;
 flowerFestival?:FlowerFestivalProgress;
 animalExpedition?:AnimalExpeditionProgress;
 powerFestival?:PowerFestivalState;
 hiddenPowerMission?:HiddenPowerMissionState;
 gardenGames?:Partial<Record<GardenGameId,GardenGameProgress>>;
 id:string;nickname:string;level:number;coins:number;boundCoins:number;stars:number;hearts:number;
 heartAt:number;unlimitedUntil:number;freeClaimAt:number;version:number;
 inventory:Record<Item,InventoryCount>;restored:string[];tutorials:string[];settings:{sound:boolean;music:boolean;haptics:boolean;reducedMotion:boolean;language:AppLocale};
 guildId:string|null;passPoints:number;
}
export interface Run {
 usedStartBoosterTrial?:true;
 /** Authoritative activation totals, outside the deterministic board state. */
 powerUses?:PowerUseCounts;
 id:string;userId:string;level:LevelDefinition;state:GameState;sequence:number;status:'active'|'won'|'lost'|'abandoned'|'expired';
 startedAt:number;expiresAt:number;preBoosters:PreBooster[];heartSpent:boolean;continues:number;
 /** Absent on legacy runs that paid at entry. Unlimited protection lasts for this whole attempt. */
 heartCharge?:'failure'|'protected';
 /** A server-authorized free starting item window; does not cover in-game tools. */
 startBoosterFreeUntil?:number;
 reward?:{coins:number;stars:number;items?:Partial<Record<Item,number>>;flowerPetals?:number;powerRainbowUnlocked?:true};
}
export interface Envelope<T> {data:T;serverNow:number;stateVersion:number}
export interface ApiError {error:{code:string;message:string};serverNow:number}
export interface StateResponse {player:Player;activeRun:Run|null}
export interface PassClaimAllResponse {player:Player;claimed:{tier:number;track:'free'|'premium'}[];seasonId:string|null;reason:'CLAIMED'|'NOTHING_TO_CLAIM'}
export interface AuthResponse extends StateResponse {accessToken:string;refreshToken:string}
export interface StartRequest {idempotencyKey:string;preBoosters:PreBooster[];useFreeStartTrial?:boolean}
export function freeStartTrialItem(level:LevelDefinition|undefined,player:Player):PreBooster|undefined{
 const guide=level?.startBoosterGuide;
 return guide?.trial&&!player.usedStartBoosterTrial?guide.item:undefined;
}
export interface ActionRequest {idempotencyKey:string;sequence:number;actions:Action[]}
export interface Gift {id:string;senderName:string;kind:'heart'|Item;quantity:number;bound:boolean;createdAt:number}
export interface Guild {id:string;name:string;description:string;mode:'open'|'approval';minLevel:number;emblem:number;members:number}
export interface GuildMember {userId:string;nickname:string;role:'leader'|'officer'|'member';level:number;contribution:number}
export interface SupportRequest {id:string;userId:string;nickname:string;kind:'heart'|Booster;received:number;maximum:number;expiresAt:number}
export interface ChatMessage {id:string;userId:string;nickname:string;text:string;createdAt:number}
export type AdPlacement = 'heart'|'coin_bonus';
export interface AdRewardQuota {limit:number;remaining:number;resetsAt:number}
export type AdRewardQuotas=Record<AdPlacement,AdRewardQuota>;
export interface RewardIntent {id:string;placement:AdPlacement;amount:number;status:'reserved'|'pending'|'granted'|'cancelled'|'review';adUnit:string;expiresAt:number;runId?:string}
export interface OfferDefinition {kind:'limited'|'timed'|'chain';campaign:string;title:string;description:string;referencePriceKrw:number;step?:number;previousProductId?:string}
export interface Product {id:string;kind:'coins'|'starter'|'boosters'|'pass';coins:number;items:Partial<Record<Item,number>>;unlimitedSeconds:number;oneTime:boolean;monthlyLimit?:true;referencePriceKrw?:number;offer?:OfferDefinition}
export interface MonthlyBundleStatus {productId:string;purchased:boolean;resetsAt:number}
export interface ShopOffer {product:Product;periodId:string;startsAt:number;endsAt:number;status:'available'|'locked'|'purchased'|'refunded'|'expired';reason?:string}
export interface OfferChainReward {
 id:string;
 previousProductId:string;
 periodId:string;
 reward:ActivityReward;
 status:'locked'|'available'|'claimed';
}
export interface OffersResponse {offers:ShopOffer[];chainRewards?:OfferChainReward[];serverTime:number}
export type RankingScope = 'players'|'guilds'|'friends';
export type FriendRelation='none'|'outgoing'|'incoming'|'friend'|'self'|'blocked';
export interface FriendProfile {userId:string;nickname:string;level:number;highestClear:number;guildName:string|null;relation:FriendRelation;profileAppearance?:ProfileAppearance}
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
export type StoryChapterId='sky'|'workshop'|'terrace'|'postal'|'firefly'|'station';
export type GardenStyle='classic'|'festival';
export interface StoryBeat {speaker:StorySpeaker;text:string}
export interface StoryScene {id:string;chapterId:StoryChapterId;title:string;taskId?:string;art:string;beats:StoryBeat[]}
export interface StoryChapter {id:StoryChapterId;title:string;summary:string;art:string;sceneIds:string[]}
export interface DailyRescueState {periodId:string;endsAt:number;reward:{item:Item;quantity:number};claimed:boolean}
export interface DailyRescueResult {player:Player;dailyRescue:DailyRescueState}
export interface StoryState {contentVersion:string;unlocked:string[];seen:string[];styles:Record<string,GardenStyle>;completedEpisodes?:string[];dailyRescue?:DailyRescueState}
export interface LocalFeatures {freeHeartRefill:boolean}

export type MissionPeriod='daily'|'weekly';
export type ActivityMetric='clears'|'hard-clears'|'tiles'|'collect-drop'|'collect-berry'|'specials-made'|'specials-used'|'combos'|'boosters-used'|'minigame-wins'|'active-days';
export interface ActivityReward {coins:number;items:Partial<Record<Item,number>>}
export type PowerUseKind='rocket'|'bomb'|'glider'|'rainbow';
export type PowerUseCounts=Record<PowerUseKind,number>;
export interface PowerFestivalState {id:string;day:string;startedAt:number;endsAt:number;counts:PowerUseCounts;claimedStages:number}
export interface HiddenPowerMissionState {
 milestone:number;
 kind:PowerUseKind;
 endsAt?:number;
 uses:number;
 claimedStages:number;
}
export interface MissionDefinition {id:string;period:MissionPeriod;title:string;metric:ActivityMetric;target:number;icon:string;reward:ActivityReward}
export interface MissionProgress extends MissionDefinition {progress:number;claimed:boolean;claimable:boolean}
export interface MissionWindow {id:string;endsAt:number;missions:MissionProgress[]}
export interface TreasurePair {first:number;second:number}
export interface TreasureAttempt {id:string;day:string;deck:Color[];maxTurns:number;startedAt:number;expiresAt:number;status:'playing'|'won'|'lost';reward?:ActivityReward}
export interface NotificationCounts {flowerlight?:number;expedition?:number;festival?:number;missions:number;events:number;pass:number;gifts:number;friends:number;guild:number;minigame:number;shop:number}
export interface EventRewardState {
 daily:{available:boolean;coins:number;nextReset:number};
 season:{id:string;ends_at:number}|null;
 personal:{progress:number;target:number;coins:number;claimed:boolean};
 guild:{progress:number;target:number;coins:number;claimed:boolean};
 pass:{points:number;premium:boolean;tiers:Array<{tier:number;points:number;freeClaimed:boolean;premiumClaimed:boolean}>;guildGifts:Array<{seasonId:string;sent:boolean}>};
}
export interface ProgressionResponse {
 player:Player;daily:MissionWindow;weekly:MissionWindow;
 milestone:{clears:number;progress:number;target:10;awarded:number;owned:number};
 minigame:{remaining:number;maximum:3;nextReset:number;active:TreasureAttempt|null};
 notifications:NotificationCounts;
 /** Optional for older servers; built from the existing event/gift queries, without extra DB reads. */
 eventRewards?:EventRewardState;
 giftCounts?:{hearts:number;items:number};
}

export const POWER_RAINBOW_WINS=10;
/** The enhanced lantern opens once the player reaches this level; only wins from then on count toward the streak. */
export const POWER_RAINBOW_LEVEL=200;
export const powerRainbowReached=(player:Pick<Player,'level'>)=>player.level>=POWER_RAINBOW_LEVEL;
export const powerRainbowUnlocked=(player:Pick<Player,'winStreak'|'level'>)=>powerRainbowReached(player)&&(player.winStreak??0)>=POWER_RAINBOW_WINS;
export const LEVEL_CLEAR_COINS={normal:30,hard:40,super:50} as const;
export const CONTINUE_COSTS=[500,1000,1500] as const;
export const SHOP_ITEM_MAX_QUANTITY=100;
export const SHOP_ITEM_PRICES={
 hammer:250,
 shuffle:250,
 'wind-row':300,
 bomb:400,
 'sweep-row':450,
 'sweep-column':450,
 'move-hourglass':450,
 rainbow:600,
 'sweep-border':600,
 'cross-firework':650,
 'color-magnet':800,
 'world-bomb':2200,
} as const satisfies Record<Item,number>;
export function levelClearCoins(level:Pick<LevelDefinition,'difficulty'>):number{
 return LEVEL_CLEAR_COINS[level.difficulty];
}
