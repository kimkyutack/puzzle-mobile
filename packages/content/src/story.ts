import type {Player,StoryChapter,StoryChapterId,StoryScene,StorySpeaker} from '@garden/contracts';
import {STORY_CONTINUATION} from './story-continuation';

export const STORY_VERSION='cloud-letters-2';

export const STORY_SPEAKERS:Record<StorySpeaker,{name:string;art:string}>={
 lumi:{name:'루미',art:'lumi'},
 tori:{name:'토리',art:'tori_v8'},
 naru:{name:'나루',art:'naru_v8'}
};

const chapterArt:Record<StoryChapterId,string>={
 sky:'story_sky_v8',workshop:'story_workshop_v8',terrace:'story_terrace_v8',postal:'story_postal_v30',firefly:'story_firefly_v30',station:'story_station_v30'
};

function scene(chapterId:StoryChapterId,taskId:string,title:string,beats:StoryScene['beats']):StoryScene{
 return {id:'letters-'+taskId,chapterId,taskId,title,art:chapterArt[chapterId],beats};
}

/** Authored scenes follow existing restoration IDs. They never grant or spend resources. */
export const STORY_SCENES:StoryScene[]=[
 {
  id:'letters-prologue',chapterId:'sky',title:'다시 열리는 정원',art:chapterArt.sky,
  beats:[
   {speaker:'lumi',text:'구름길이 끊긴 뒤로, 이 정원에는 편지 한 통 오지 않았어.'},
   {speaker:'lumi',text:'오늘 도와준 덕분에 오래된 문을 고칠 수 있겠네!'},
   {speaker:'lumi',text:'먼저 입구부터 열어 보자. 누가 기다리고 있을지도 몰라.'}
  ]
 },
 scene('sky','sky-path','문틈의 초대장',[
  {speaker:'lumi',text:'앗, 문틈에 초대장이 끼어 있었어. 꽃빛축제에 와 달래!'},
  {speaker:'lumi',text:'폭풍이 오기 전에 보낸 편지인가 봐. 봉투에 꽃씨도 들어 있어.'},
  {speaker:'lumi',text:'아직 늦지 않았을 거야. 이 꽃부터 피워 보자.'}
 ]),
 scene('sky','sky-planter','편지 속의 꽃씨',[
  {speaker:'lumi',text:'새싹이 고개를 들었어! 초대장에 그려진 꽃이랑 똑같아.'},
  {speaker:'lumi',text:'누가 오더라도 반갑게 맞아 줄 수 있겠네.'},
  {speaker:'lumi',text:'이번에는 잠깐 쉬어 갈 자리도 마련해 주자.'}
 ]),
 scene('sky','sky-bench','쉼터에 내려앉은 손님',[
  {speaker:'tori',text:'잠깐만! 그 벤치, 날개 좀 쉬어 가도 될까?'},
  {speaker:'lumi',text:'물론이지! 나는 루미야. 혹시 이 초대장을 아니?'},
  {speaker:'tori',text:'내가 배달하던 편지잖아! 나는 토리. 아직 못 전한 초대장이 잔뜩 있어.'},
  {speaker:'lumi',text:'그럼 우리 정원부터 불을 켜자. 길을 찾을 수 있게!'}
 ]),
 scene('sky','sky-lamp','불빛에 나타난 길',[
  {speaker:'tori',text:'등불에 비추니까 봉투에 무늬가 보여. 섬들을 잇는 길이야!'},
  {speaker:'lumi',text:'물이 흐르는 곳을 따라가면 되는 걸까?'},
  {speaker:'tori',text:'분수 소리가 들리면 멀리서도 이 정원을 찾기 쉬울 거야.'}
 ]),
 scene('sky','sky-fountain','분수 뒤의 수리공',[
  {speaker:'naru',text:'푸하! 물이 다시 나온다! 잠깐, 내가 서 있는 쪽으로는 말고!'},
  {speaker:'lumi',text:'아하하! 젖었네. 나는 루미야. 분수를 고쳐 주고 있었구나?'},
  {speaker:'naru',text:'수리공 나루야. 그런데 옆 섬 온실로 가는 물길은 아직 조용해.'},
  {speaker:'tori',text:'망원경으로 보면 어느 길이 끊겼는지 알 수 있겠어!'}
 ]),
 scene('sky','sky-arch','구름 너머의 온실',[
  {speaker:'lumi',text:'보여! 구름 너머에 온실이 있어. 꽃들이 고개를 숙이고 있네.'},
  {speaker:'naru',text:'내 작업실이야. 물도 빛도 제대로 돌지 않아서 꽃들이 잠들었지.'},
  {speaker:'tori',text:'여기 초대장도 그 온실로 가는 거야. 이번에는 꼭 전하고 싶어.'},
  {speaker:'lumi',text:'우리 정원은 준비됐어. 이제 함께 옆 섬으로 가 보자!'}
 ]),
 scene('workshop','workshop-door','잠든 꽃의 작업실',[
  {speaker:'naru',text:'문이 열렸어. 어서 와! 꽃빛축제에 쓸 꽃을 돌보던 곳이야.'},
  {speaker:'lumi',text:'잎은 튼튼한데 꽃봉오리가 꼭 다물려 있네.'},
  {speaker:'naru',text:'먼저 꽃을 살필 자리를 만들자. 도구를 어디 뒀더라…'}
 ]),
 scene('workshop','workshop-table','벤치 위의 설계도',[
  {speaker:'lumi',text:'벤치를 정리하니 작업대로 쓰기 딱 좋겠어!'},
  {speaker:'naru',text:'찾았다, 물길 설계도! 어쩐지 화분 밑에서 바스락거리더라.'},
  {speaker:'tori',text:'이 동그라미는 꽃 자리야? 봉투에 그려진 꽃과 닮았어.'},
  {speaker:'naru',text:'맞아. 차가운 바닥에서 화분을 옮겨 주면 다시 기운을 낼 거야.'}
 ]),
 scene('workshop','workshop-planter','꽃이 좋아하는 자리',[
  {speaker:'lumi',text:'화분을 옮기니까 잎이 조금씩 펴지고 있어.'},
  {speaker:'naru',text:'이 꽃은 따뜻한 빛을 모아야 피어나. 물만 많이 주면 안 되지.'},
  {speaker:'tori',text:'나는 물 주는 것밖에 안 했는데… 등불부터 준비하자!'}
 ]),
 scene('workshop','workshop-lamp','첫 꽃잎이 열리는 순간',[
  {speaker:'tori',text:'봐! 빛이 닿으니까 꽃잎 하나가 열렸어!'},
  {speaker:'lumi',text:'초대장 속 꽃도 이렇게 반짝였겠지?'},
  {speaker:'naru',text:'좋아, 이제 작은 분수까지 물을 올려 보자. 꽃들도 목이 마를 거야.'}
 ]),
 scene('workshop','workshop-shelf','한쪽으로만 흐르는 물',[
  {speaker:'naru',text:'작은 분수는 잘 움직여. 그런데 한쪽 물관이 비어 있어.'},
  {speaker:'lumi',text:'설계도에서는 그 물관이 어디로 이어져?'},
  {speaker:'tori',text:'테라스야! 그쪽으로 보낼 씨앗 주머니도 아직 내 가방에 있어.'}
 ]),
 scene('workshop','workshop-roof','꽃이 가리킨 물길',[
  {speaker:'lumi',text:'관측대에서 보니 물길이 테라스 앞에서 뚝 끊겨 있어.'},
  {speaker:'naru',text:'길을 이으면 씨앗도, 물도 다시 도착할 수 있겠네.'},
  {speaker:'tori',text:'온실의 꽃은 활짝 피었어! 축제에 가져갈 꽃을 챙겨 둘게.'},
  {speaker:'lumi',text:'이제 꽃을 기다리는 테라스로 가자. 초대장도 함께!'}
 ]),
 scene('terrace','terrace-path','씨앗을 기다리는 테라스',[
  {speaker:'tori',text:'드디어 도착! 이 문 안으로 씨앗을 배달하려고 한참 헤맸어.'},
  {speaker:'lumi',text:'빈 화단이 정말 많네. 작은 축제를 열기에도 좋겠어.'},
  {speaker:'naru',text:'서두르기 전에 쉬어 갈 곳부터 만들자. 토리 날개가 축 늘어졌어.'}
 ]),
 scene('terrace','terrace-bench','이번에는 함께 앉아서',[
  {speaker:'tori',text:'고마워. 이번 벤치에서는 혼자 쉬지 않아도 되네.'},
  {speaker:'lumi',text:'우리 셋이 만난 것도 첫 정원의 벤치 덕분이었지.'},
  {speaker:'naru',text:'이제 힘이 좀 나? 씨앗을 기다리는 화단부터 살펴보자.'}
 ]),
 scene('terrace','terrace-planter','제자리에 도착한 씨앗',[
  {speaker:'tori',text:'씨앗 배달 완료! 가방이 이렇게 가벼운 건 오랜만이야.'},
  {speaker:'lumi',text:'온실에서 가져온 꽃도 심었어. 빈자리가 색으로 가득해졌네.'},
  {speaker:'naru',text:'앞으로도 길을 잃지 않게, 물길 옆에 안내등을 켜 두자.'}
 ]),
 scene('terrace','terrace-lamp','돌아오는 길의 불빛',[
  {speaker:'lumi',text:'등불이 켜지니까 여기까지 이어진 길이 한눈에 보여.'},
  {speaker:'tori',text:'이제 길을 잃어도 저 불빛만 찾으면 되겠다!'},
  {speaker:'naru',text:'좋아. 망원경으로 물길 끝도 살펴보자. 막힌 곳이 남았을지 몰라.'}
 ]),
 scene('terrace','terrace-telescope','멀리서 반짝인 답장',[
  {speaker:'tori',text:'저기, 멀리서 불빛이 반짝였어. 꼭 답장하는 것 같아!'},
  {speaker:'naru',text:'바람 우체국이 있는 방향이야. 구름길을 다시 알아본 걸까?'},
  {speaker:'lumi',text:'우리도 분수를 켜서 인사하자. 이곳은 다시 열렸다고!'}
 ]),
 scene('terrace','terrace-fountain','다시 시작하는 꽃빛축제',[
  {speaker:'naru',text:'물이 끝까지 흘러왔어! 세 정원의 물길이 다시 이어졌네.'},
  {speaker:'tori',text:'꽃도, 초대장도, 친구들도 도착했어. 이제 축제를 열 수 있겠다!'},
  {speaker:'lumi',text:'아담한 축제지만 우리가 함께 만들었잖아. 정말 고마워!'},
  {speaker:'tori',text:'어? 바람 우체국에서 답장이 왔어. 아직 전하지 못한 편지가 더 있대.'},
  {speaker:'lumi',text:'그 편지도 함께 찾아가자. 오늘은 먼저, 우리 정원을 마음껏 즐기고!'}
 ]),
 ...STORY_CONTINUATION.map(task=>scene(task.area as StoryChapterId,task.id,task.title,task.beats))
];

export const STORY_CHAPTERS:StoryChapter[]=[
 {id:'sky',title:'초대장이 도착한 정원',summary:'오래된 문을 열고, 구름길에서 길을 잃은 친구들을 만나요.',art:chapterArt.sky,sceneIds:STORY_SCENES.filter(scene=>scene.chapterId==='sky').map(scene=>scene.id)},
 {id:'workshop',title:'잠든 꽃을 깨우는 온실',summary:'작업실의 빛과 물길을 고쳐 꽃빛축제에 가져갈 꽃을 피워요.',art:chapterArt.workshop,sceneIds:STORY_SCENES.filter(scene=>scene.chapterId==='workshop').map(scene=>scene.id)},
 {id:'terrace',title:'다시 흐르는 꽃빛축제',summary:'기다리던 씨앗을 전하고, 세 정원을 잇는 작은 축제를 열어요.',art:chapterArt.terrace,sceneIds:STORY_SCENES.filter(scene=>scene.chapterId==='terrace').map(scene=>scene.id)},
 {id:'postal',title:'바람 우체국의 밀린 편지',summary:'반송된 봉투를 정리하고 첫 야간 배달을 준비해요.',art:chapterArt.postal,sceneIds:STORY_SCENES.filter(s=>s.chapterId==='postal').map(s=>s.id)},
 {id:'firefly',title:'반딧불이 지켜 준 답장',summary:'작은 불빛을 따라 연못에 멈춰 있던 편지를 찾아요.',art:chapterArt.firefly,sceneIds:STORY_SCENES.filter(s=>s.chapterId==='firefly').map(s=>s.id)},
 {id:'station',title:'다시 출발하는 숲속 열차',summary:'멈춘 역을 고쳐 초대장과 친구들을 축제로 데려와요.',art:chapterArt.station,sceneIds:STORY_SCENES.filter(s=>s.chapterId==='station').map(s=>s.id)}
];

/** Legacy completed tasks unlock their scenes without replaying or charging for restoration. */
export function getUnlockedStories(player:Pick<Player,'level'|'restored'>):string[]{
 const restored=new Set(player.restored),intro=player.level>=2||restored.size>0;
 return STORY_SCENES.filter(scene=>scene.taskId?restored.has(scene.taskId):intro).map(scene=>scene.id);
}

export function storyForTask(taskId:string):StoryScene|undefined{
 return STORY_SCENES.find(scene=>scene.taskId===taskId);
}
