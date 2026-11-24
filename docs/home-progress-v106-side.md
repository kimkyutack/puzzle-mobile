# 홈 진행 카드 v106 — 선택한 2안 적용

final result: passed

## 적용 범위

- 왼쪽 노란 연승 선물 카드, 오른쪽 위 강화 무지개등·아래 도구 축제의 두 줄 배치.
- 처음 선택한 접기 1안: 흰 도크에 이어지는 금색 윗선과 파란 중앙 탭. 접으면 화살표만 반전한다.
- 기존 게임 아이콘과 글꼴을 사용하고, 작은 보상 아이템 나열 대신 제목·진행 상태를 확대했다.
- 기록·패스 등 utility 메뉴, 레벨·정원 꾸미기 버튼, 공통 푸터와 기존 모달은 수정하지 않았다.
- 연승 단계·200레벨 해금·10연승 강화·축제 잔여 시간·알림·기존 클릭 경로를 유지했다. 생성 시안의 `30초 도전`은 실제 서비스 값인 `30분 도전`으로 표시한다.

## 원본과 실제 화면 비교

선택한 두 번째 시안과 실제 Chrome의 App 렌더를 함께 놓고 비교했다. 시안은 상단 부분만 있는 이미지이므로 동일한 390px 너비로 맞추고, 실제 화면에서 해당 영역을 잘랐다. 상태가 없는 장식 시안의 숫자나 아이템 이미지를 게임 규칙으로 취급하지 않았다.

![왼쪽 선택 시안, 오른쪽 적용 화면](../output/verification/home-progress-v106-side/reference-final-comparison.png)

초기 대조에서 제목과 선물 아이콘이 작았던 P2를 수정했다. 제목을 최대 15~16px, 연승 숫자를 26px로 키우고 선물 아이콘도 확대했다. 노란 카드와 파란 축제 면, 연결된 접기 테두리, 흰 화살표는 각각 생성한 raster 자산을 사용한다. 최종 대조에 남은 P0/P1/P2는 없다. 손가락으로 누를 수 있는 실제 메뉴 높이와 기존 게임 글꼴/아이콘을 유지하기 위해 시안보다 카드 영역을 넉넉하게 두었다.

## 검증 근거

실제 App·HomeHub·모달을 사용하는 기존 격리 fixture를 Chrome에서 실행했다. API는 fixture 응답이며 운영 계정은 사용하지 않았다.

- 390×844 한국어: 연승 0/3, Lv.200 해금 전, 축제 준비 표시.
- 320×740 한국어: 가로 overflow 없이 세 카드 표시.
- 430×932 영어 및 320×740 영어: 연승 3/3, 강화 무지개등 2/10, 긴 이름이 카드 안에 줄바꿈됨.
- 320×740 일본어, 레벨31: 연승 선물 미해금 시 남는 슬롯 없이 나머지 두 카드가 전체 너비를 채움.
- 세 카드 클릭 시 기존 연승 안내·강화 무지개등 안내·도구 축제 모달이 열림.
- 새 접기 탭으로 접기·펼치기, 화살표 반전 및 기존 레벨 버튼 유지 확인.
- 변경 전후 390px 화면에서 utility 메뉴 `(10,590,370,71)`, 메인 버튼 `(10,668,372,78)`, 푸터 `(0,751,390,93)`의 좌표와 크기가 동일함. 아래 항목의 마크업과 CSS는 유지했다. 캡처 사이 알림/안티앨리어싱 차이가 있어 pixel-identical을 주장하지 않는다.
- TypeScript 및 Vite production build 통과. 기존 큰 청크 경고는 남아 있다.
- 최종 재로딩 후 새로운 런타임 오류 없음. 초기 파일 생성 도중 일시적인 HMR 모듈 오류가 있었고, 정상 재로딩과 이후 상태들에서는 재현되지 않았다.

운영 배포·네이티브 동기화·실기기 검증은 이 작업 범위에 포함하지 않았다.

## 파일

- [최종 전체 화면](../output/verification/home-progress-v106-side/after-390.png)
- [최종 확대](../output/verification/home-progress-v106-side/detail-390.png)
- [접은 상태](../output/verification/home-progress-v106-side/collapsed-390.png)
- [320px](../output/verification/home-progress-v106-side/after-320.png)
- [430px 영문](../output/verification/home-progress-v106-side/after-430-en.png)
- [해금 전 일본어](../output/verification/home-progress-v106-side/level-31-ja.png)
- [기존 메뉴 좌표: 이전](../output/verification/home-progress-v106-side/before-geometry.json), [이후](../output/verification/home-progress-v106-side/after-geometry.json)
- [생성 프롬프트](../packages/assets/home-progress-v106/prompts.md), source PNG와 runtime WebP는 같은 자산 폴더에 보관.

위 320px·영문 캡처는 최종 제목 확대 이전의 반응형 검증 기록이며, 최종 한국어 화면은 확대 보정 후 다시 캡처했다.
