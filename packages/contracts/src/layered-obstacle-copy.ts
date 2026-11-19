export const layeredObstacleCopy={
  layers:[
    ['겹겹 정원','장애물 옆에서 같은 색 타일을 3개 이상 맞추면 한 겹이 깨져요.'],
    ['Layered garden','Match three or more tiles of the same color beside an obstacle to break one layer.'],
    ['重なる庭','障害物の隣で同じ色を3つ以上そろえると、一層壊れます。'],
  ],
  cases:[
    ['항아리 상자','상자 옆에서 타일을 맞춰 열고, 나온 항아리 옆에서 다시 맞추세요.'],
    ['Jar crates','Match beside a crate to open it, then match beside the jar inside.'],
    ['壺入りの木箱','木箱の隣でそろえて開け、中から出た壺の隣でもう一度そろえましょう。'],
  ],
  cabinet:[
    ['큰 보관 상자','큰 상자를 열면 항아리 네 개가 나와요. 각 항아리를 나눠서 깨세요.'],
    ['Supply chests','Open a large chest to reveal four jars. Clear each jar separately.'],
    ['大きな保管箱','大箱を開けると壺が4つ出ます。それぞれ壊しましょう。'],
  ],
  vault:[
    ['겹 상자 창고','큰 상자 안에 작은 상자가 네 개 있어요. 작은 상자와 그 안의 항아리까지 깨세요.'],
    ['Nested storage','Each large chest holds four small crates. Open those crates and clear the jars inside.'],
    ['入れ子の倉庫','大箱の中に小箱が4つあります。小箱と中の壺まで壊しましょう。'],
  ],
  wind:[
    ['건너편 풍차','씨앗 주머니 옆에서 타일을 맞춰 깨세요. 씨앗이 같은 표식의 풍차로 날아가 한 겹을 깎아요.'],
    ['Windmill wall','Match beside a seed pouch to break it. Its seed flies to the matching windmill and removes one layer.'],
    ['向こう側の風車','種袋の隣でそろえて壊すと、種が同じ印の風車に飛び、一層を削ります。'],
  ],
} as const;
