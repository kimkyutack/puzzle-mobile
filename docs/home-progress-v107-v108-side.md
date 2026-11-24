# 홈 카드 이미지 보정과 접기 슬라이드

final result: passed

사용자가 지적한 v106 선물 아이콘의 흰 윗선/노란 아래 조각은 이전 이미지에 남아 있던 배경이었다. 홈 전용 homeCard에서만 새 투명 선물 아이콘을 사용하도록 변경했다. 공유 아이콘은 그대로 두었다. 노란 카드와 하늘색 무지개등 면도 선택한 2안을 참조하여 새 raster로 제작했다. 부분 border-image 대신 전체 면을 배치하여 둥근 모서리와 하이라이트를 보존했다. [원본 PNG, runtime WebP, 생성 프롬프트](../packages/assets/home-progress-v107/prompts.md).

접기 시 hidden으로 즉시 제거하던 방식을 변경했다. extras를 유지한 채 grid 높이와 content의 수직 위치를 320ms 동안 전환한다. 닫힌 내용은 aria-hidden/inert로 포커스와 입력에서 제외한다. CSS transition으로 전환하므로 반대 방향으로 바꿔도 현재 위치에서 이어진다. reduced-motion에서는 전환을 생략한다.

실제 App fixture를 Chrome 390×844에서 클릭하고 requestAnimationFrame으로 중간 레이아웃을 기록했다. 닫기 172→0px, 펼치기 0→172px 사이에 각각 15개 중간 높이가 측정됐다. 도크 윗선은 y474↔655로 이동했다. 모든 샘플에서 메인 버튼 y668, 푸터 y751이 고정됐다. 열린 화면의 기록·패스 행 y590도 기존과 일치했다. [전체 프레임 측정](../output/verification/home-progress-v108-side/slide-traces.json).

![왼쪽 펼침, 오른쪽 접힘](../output/verification/home-progress-v108-side/expanded-collapsed.png)

기존 격리 fixture의 API 응답을 사용한 브라우저 검증이며 실기기나 운영 검증은 아니다. npm run build(TypeScript+Vite) 통과. 운영 배포와 네이티브 동기화는 하지 않았다.
