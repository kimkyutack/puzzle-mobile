import {RESTORATIONS,STORY_SCENES} from '@garden/content';
// Each row follows the append-only restoration order: task name, scene title, two dialogue beats.
const rows=[
 ['Connect the post office path','Following the reply','This is where the terrace reply came from. Leaves cover the entrance.','Let us open the flower path and tell them we came to deliver a letter.'],
 ['Repair the scattered hedge','Where the wind passed','The fallen hedge let the wind scatter letters all over the yard.','Once the yard is sheltered, we can find each letter carefully.'],
 ['Restore the red mailbox','Letters that never arrived','This mailbox is full of returned letters. Did their recipients leave?','We do not know yet. Let us check the addresses one by one.'],
 ['Plant mailbox flowers','Pollen on an envelope','Several letters have yellow pollen on them. Perhaps they came from the same place.','Let us plant the same flowers. Their sender might recognize this spot.'],
 ['Build a courier rest stop','Tori sets down his bag','I kept every undelivered letter in my bag. Setting them down felt wrong.','We can carry them together now. Sit here and start with the oldest one.'],
 ['Plant a shade tree','An address fading in sunlight','The addresses are fading in the sun. Shade will keep them safe.','Every letter has been waiting. This time, we will look after them.'],
 ['Place a sorting table','Three bundles of letters','Pollen, water drops and wheel marks. I sorted the letters into three bundles.','There is a little firefly on the wet envelope. Our next clue!'],
 ['Light the sorting lamp','Words beneath a lantern','The faded words appear under the lamp! It says the way opens after sunset.','An address we can only find at night. Let us prepare before we go.'],
 ['Raise the delivery arch','An entrance reconnected','Under the tangled cord, I found a sign for the old delivery route.','Now everyone can find the entrance to the post office again.'],
 ['Shelter the mail','A small roof against the rain','The letters can stay dry here. I can finally empty my bag.','Every letter has a place in line. Let us fix the post office itself.'],
 ['Reopen the post office','The shuttered counter','The delivery book says the last route stopped at Firefly Pond.','There must be an undelivered letter there. Let us prepare the next delivery.'],
 ['Place courtyard lights','A greeting in the dark','As the sun sets, tiny lights are appearing beyond the yard.','They seem to be showing us a path. Let us greet them with our own light.'],
 ['Set up the night lookout','Blinking by the water','Lights are coming on toward the pond in a regular sequence!','Tori can note the pattern while Naru checks the path. We can follow them.'],
 ['Tend the departure flowers','A lighter mailbag','The letters have a new waterproof cover. Rain will not stop us now.','Let us leave flowers to welcome us back. This place will stay open.'],
 ['Connect the night route','Our first night delivery','The letter is from Forest Station to Firefly Pond. Time to go!','Our first night delivery! Let us reach the pond before the lights disappear.'],
 ['Place pond stepping stones','Lights beyond the mist','We arrived, but I cannot see an address. Only lights moving through the mist.','Before we approach the water, let us put down safe stepping stones.'],
 ['Connect the waterside hedge','Where the footsteps stop','The old courier stopped here. The bank must have collapsed.','Let us mark the edge so nobody loses the path in the mist.'],
 ['Tend the firefly flowers','An envelope in the reeds','There is a waterproof envelope caught in the reeds. It has waited a long time.','Pulling it might tear it. We should clear the plants around it first.'],
 ['Restore the lily pond','Still water stirs','The little stream is blocked. Flowing water should help clear the mist.','As the lilies lift their heads, the lights are drawing nearer.'],
 ['Light the waterside lamp','Follow the golden light','The fireflies seem to like a small warm light more than a bright white one.','Then we will guide the way with a gentle lantern.'],
 ['Place a waterside bench','A delivery without hurry','The lights come closer when I sit still. They leave when I rush.','This delivery needs patience more than speed.'],
 ['Revive the firefly willow','A reply inside a tree','There is a letter box in the hollow! The fireflies have been guarding it.','They kept it safe until someone arrived. Now we can carry it onward.'],
 ['Build the observation jetty','A lost timetable','A station timetable washed under the jetty. The last departure is circled.','The pond deliveries were connected to the railway all along.'],
 ['Plant a firefly shade tree','A path that lasts through daylight','The fireflies need somewhere to rest during the day, too.','With shade to shelter them, their night path can keep shining.'],
 ['Build the pond gazebo','A place to wait together','We can read here even in the wind. Shall we open the envelope?','They are waiting for the station to reopen. The letter was an invitation!'],
 ['Watch the forest lights','A signal standing still','The forest station signal stays on one color. Is it broken?','Naru can inspect it. I want to meet the friend who wrote this letter.'],
 ['Light the jetty path','A promise for the way home','Let us leave lights so the returning courier can find the path.','This time, no letter will be stranded along the way.'],
 ['Raise the forest arch','Tracks among the leaves','Through the arch, I can see tracks. There was a route from the pond to the station.','They are old, but still connected. We can repair them a little at a time.'],
 ['Plant promise flowers','Friends awaiting a letter','There is a flower festival drawing on the envelope. The station friends wanted to come.','The invitation is late, but we can hold the festival again. Let us prepare together.'],
 ['Connect the station route','To the next stop','The fireflies have lined up toward the tracks. They are seeing us off.','We received the letter and the feelings inside it. On to Forest Station!'],
 ['Repair the station entrance','Arriving at a silent station','The station is quiet, but flowers sit at the counter. Someone still cares for it.','Someone is still waiting here. Let us open the entrance first.'],
 ['Build the platform hedge','A safe starting line','Without a hedge, the edge of the platform is hard to see. We should not rush.','Before we depart again, we need to make the station safe.'],
 ['Tend the welcome flowers','A welcome that never faded','Someone has been watering these pots. They never gave up on the station.','Now we will help care for it, so it can welcome even more friends.'],
 ['Place a waiting bench','An invitation in an empty seat','Another invitation is tucked in the bench. They could not send it to the post office.','The same invitation brought us here. This time, it will arrive.'],
 ['Relight the station signal','The signal changes','The signal contacts were rusty. I cleaned them, and the colors change again!','That was the light we saw from the pond. The route is coming back together.'],
 ['Plant platform shade','A restful place to wait','Friends who arrive late need a comfortable place to wait, too.','A bench and some shade will make the wait feel less lonely.'],
 ['Reopen Forest Station','The little ticket window','The counter is open! The first ticket is for the flower festival!','We always had a reason to depart. Let us get the train ready.'],
 ['Reconnect the garden track','Two rails meet again','I straightened the bent piece of track. Both ends line up perfectly.','Only one little piece, but without it we could not go anywhere.'],
 ['Repair the flower carriage','Seats to share','The floor and seats are sturdy again. I even made space for the mailbag.','This delivery can travel with all our friends!'],
 ['Place the station worktable','Writing a new timetable','No more crowded timetables. We need time to wait at the pond, too.','Let us make a schedule that never leaves a friend behind.'],
 ['Raise the departure arch','The old departure bell','I found a little bell above the arch. It still rings clearly!','It sounds like a greeting after a long wait. We will ring it for our first departure.'],
 ['Shelter the station mail','A promise to every passenger','Friends are not the only travelers. These letters each have a destination.','We will watch over everyone until they arrive where they belong.'],
 ['Survey the next cloud path','A signal beyond the horizon','Another island replied! There are still gardens waiting for a connection.','We will not lose our way this time. Now we know how to help.'],
 ['Light the first departure','The final check','Doors, track, signal, mailbag. Everything is ready. Time to call our friends.','Tell the post office and the pond: the first train is leaving!'],
 ['Finish the departure courtyard','Every invitation delivered','All aboard! The letters that could not be delivered have finally found their way.','We restored more than buildings. Let us keep connecting the path together.']
];
export const storyContinuationCopy:Record<string,string>={
 '바람 우체국':'Wind Post Office','반딧불 연못':'Firefly Pond','숲속 기차역':'Forest Station',
 '빨간 우편함':'Red Mailbox','반딧불 버드나무':'Firefly Willow','물가 관찰 나루':'Pond Observation Jetty','꽃빛 객차':'Flower Carriage','정원 열차 선로':'Garden Railway Track',
 '바람 우체국의 밀린 편지':'Letters awaiting delivery','반송된 봉투를 정리하고 첫 야간 배달을 준비해요.':'Sort the returned letters and prepare the first night delivery.',
 '반딧불이 지켜 준 답장':'The reply guarded by fireflies','작은 불빛을 따라 연못에 멈춰 있던 편지를 찾아요.':'Follow the tiny lights to find a letter stranded at the pond.',
 '다시 출발하는 숲속 열차':'The forest train departs again','멈춘 역을 고쳐 초대장과 친구들을 축제로 데려와요.':'Restore the silent station and take friends and invitations to the festival.',
 '이어지는 정원 이야기':'The continuing garden story','이어지는 이야기 목록':'The continuing story',
 '한 통의 편지로 이어지는 정원':'Gardens connected by a letter','복원한 정원마다 다음 이야기가 기다려요.':'Every restored corner has another story waiting.',
 '복원하면 다음 이야기가 이어져요.':'Restore this spot to continue the story.',
 '정원을 가꾸면서 저장하고 있어요.':'Restoring your garden and saving your progress.',
 '모든 복원을 마쳤어요!':'Every restoration is complete!',
 '완성한 시설을 옮기거나 상점에서 장식을 더해 보세요.':'Move your completed facilities or find more decorations in the shop.',
 '복원한 시설은 보관함에 있어요. 원하는 자리에 놓아 주세요.':'Your restored facility is in storage. Place it wherever you like.'
};
for(const [index,row]of rows.entries()){
 const task=RESTORATIONS[index+18]!,scene=STORY_SCENES.find(scene=>scene.taskId===task.id)!;
 storyContinuationCopy[task.name]=row[0]!;storyContinuationCopy[scene.title]=row[1]!;
 scene.beats.forEach((beat,i)=>{storyContinuationCopy[beat.text]=row[i+2]!;});
}
