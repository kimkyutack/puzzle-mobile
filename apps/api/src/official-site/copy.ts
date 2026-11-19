import {business,type SiteLocale} from './model';

type Feature={title:string;description:string;alt:string};
type Copy={name:string;title:string;tagline:string;description:string;genre:string;home:string;downloads:string;planned:string;download:string;language:string;policies:string;skip:string;contact:string;effective:string;version:string;top:string;featureTitle:string;artAlt:string;previewPlay:string;previewStop:string;featuresList:[Feature,Feature,Feature]};
export const copy:Record<SiteLocale,Copy>={
 ko:{
  previewPlay:'플레이 영상',previewStop:'영상 멈추기',
  name:'구름정원',title:business.serviceName,tagline:'퍼즐 한 판, 정원 한 조각.',description:'알록달록한 타일을 맞추고, 루미와 함께 구름 위에 나만의 정원을 꾸며 보세요.',genre:'매치 3 퍼즐 · 정원 꾸미기',home:'게임 소개',downloads:'다운로드',planned:'출시 예정',download:'다운로드',language:'언어 선택',policies:'정책 및 고객지원',skip:'본문으로 바로가기',contact:'고객센터',effective:'시행일',version:'버전',top:'맨 위로',featureTitle:'구름 위에서 만나는 작은 즐거움',artAlt:'루미와 동물 친구들이 꽃이 핀 하늘 정원에 정자를 짓는 모습',featuresList:[
   {title:'타일을 맞추는 손맛',description:'같은 색 타일을 잇고 로켓과 폭탄으로 장애물을 시원하게 터뜨려요.',alt:'알록달록한 타일과 장애물이 있는 실제 퍼즐 보드'},
   {title:'나만의 하늘 정원',description:'분수와 산책로를 놓고, 정원을 넓혀 내 취향대로 꾸며 보세요.',alt:'분수와 꽃 장식이 놓인 실제 정원 화면'},
   {title:'동물 친구와 떠나는 원정',description:'숲속 원정에 도전해 새로운 친구를 만나고, 꽃빛축제의 장식을 모아요.',alt:'루미가 개울 너머 동물 친구를 돕는 숲속 원정 일러스트'}]},
 en:{
  previewPlay:'Watch gameplay',previewStop:'Stop preview',
  name:'Cloud Garden',title:"Cloud Garden: Lumi’s Invitation",tagline:'One puzzle. A little more garden.',description:'Match colorful tiles and join Lumi to grow a garden of your own above the clouds.',genre:'Match-3 puzzle · Garden decorating',home:'About the game',downloads:'Download',planned:'Coming soon',download:'Download on',language:'Choose language',policies:'Policies and support',skip:'Skip to content',contact:'Support',effective:'Effective',version:'Version',top:'Back to top',featureTitle:'Little joys above the clouds',artAlt:'Lumi and animal friends building a pavilion in a flowering garden above the clouds',featuresList:[
   {title:'Colorful matches',description:'Match tiles of the same color and use rockets and bombs to clear tricky obstacles.',alt:'An in-game puzzle board with colorful tiles and obstacles'},
   {title:'Your own sky garden',description:'Place fountains and paths, expand your garden, and make it your own.',alt:'The in-game garden decorated with fountains and flowers'},
   {title:'Adventures with animal friends',description:'Meet new friends on forest expeditions and collect decorations at the Flowerlight Festival.',alt:'Lumi helping animal friends across a stream in the forest'}]},
 ja:{
  previewPlay:'プレイ映像',previewStop:'再生を停止',
  name:'雲の庭',title:'雲の庭：ルミの招待状',tagline:'パズルを解いて、庭を育てよう。',description:'色とりどりのタイルをそろえて、ルミと一緒に雲の上の庭を自分好みに飾りましょう。',genre:'マッチ3パズル・庭づくり',home:'ゲーム紹介',downloads:'ダウンロード',planned:'配信予定',download:'ダウンロード',language:'言語を選択',policies:'ポリシーとサポート',skip:'本文へ移動',contact:'お問い合わせ',effective:'施行日',version:'バージョン',top:'ページ上部へ',featureTitle:'雲の上で見つける、小さな楽しみ',artAlt:'ルミと動物の仲間たちが、花の咲く雲の上の庭に東屋を建てている様子',featuresList:[
   {title:'タイルをそろえる爽快感',description:'同じ色のタイルをそろえ、ロケットや爆弾で障害物を一気に片づけましょう。',alt:'色とりどりのタイルと障害物が並ぶ実際のパズル画面'},
   {title:'自分だけの空中庭園',description:'噴水や小道を配置し、庭を広げてお気に入りの空間をつくりましょう。',alt:'噴水や花で飾った実際の庭の画面'},
   {title:'動物の仲間と冒険へ',description:'森の遠征で新しい仲間に出会い、花あかり祭りの飾りを集めましょう。',alt:'森の小川でルミが動物の仲間を助けるイラスト'}]}
};

export const puzzlePreview='puzzle-gameplay-v1.mp4';
export const assetNames=['garden-hero.webp','garden-hero-small.webp','title-ko.webp','title-en.webp','title-ja.webp','app-icon.webp','puzzle-play.webp','garden-play.webp','animal-expedition.webp','tile-blue.webp','tile-red.webp','tile-yellow.webp',puzzlePreview] as const;
