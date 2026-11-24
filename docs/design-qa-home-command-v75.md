# 홈 커맨드 도크와 정원 v75

final result: passed (local web presentation and isolated functional checks)

## 선택 시안과 범위

사용자가 고른 **가장 최근 시안 세트의 세 번째 이미지**를 기준으로 기존 앱에 구현했다. 첫 세트의 보라색 시안이 아니다.

- 원본: `/Users/kimkyutack/.codex/generated_images/01a19a0c-6a0f-7292-88a9-af1911f52d1b/exec-ae916851-2232-471b-8997-69fe65fd0dbe.png`
- 비교용 원본: `output/verification/home-command-dock/selected-target.png`
- 구현: 실제 `App`, `HomeHub`, `HubNavigation`, `HomeGardenWorld`, `WorldMap`을 격리 API fixture로 실행했다.
- 390×844와 320×640, 한국어·영어·일본어. 네이티브 안전 영역을 흉내 낸 위 48px/아래 22px는 유지했다.

홈의 긴 좌우 메뉴 열을 하단 아이보리 도크의 아이콘 행으로 옮겼다. 초록 레벨 버튼과 코랄 정원 꾸미기 버튼, 노란 연승 캡슐, 파란 선택 홈 탭을 배치했다. 두 종류 패키지와 선물함은 실제 판매/알림 상태에 따라 지도 위에 표시한다. 주간 이벤트와 무제한 도구의 기존 진입점과 접근 조건은 유지했다.

정원은 새 잔디·밝은 판석, 홈 기본 배율과 가려지지 않는 초점으로 변경했다. 평상시 잔디는 이어 보이고 편집 중에는 소유 영역 대비를 유지한다. 저장된 건물/동물/산책로 좌표, 소유/확장/충돌/이동/회전 모델은 이 디자인 변경으로 수정하지 않는다. 시안의 조경은 예시이며 실제 화면의 조경은 이용자가 배치한 물건으로 렌더링한다.

## 시안 대조와 수정 이력

1. 최초 캡처 `home-v75-first-390.png`: 주간 이벤트·무제한에 옛 파란 라벨이 남음(P2), 긴 축약 문구 미번역(P2), 첫 초점이 아래쪽으로 내려감(P2). 도크 표현을 분리하고 짧은 라벨을 3개 언어로 등록했으며 첫 pending-focus 경로도 실제 보이는 지도 영역을 기준으로 보정했다.
2. `comparison-full.png`/`comparison-dock.png`: 버튼 코너가 9-slice 압축으로 직사각에 가까워짐(P2), 연승 선물의 이전 금테가 남음(P2). 버튼 높이의 반에 해당하는 코너 슬라이스로 변경하고, 시안에 맞춘 별도 노란 캡슐 원화를 제작했다. 단순 색상 필터를 사용하지 않는다.
3. `comparison-complete.png`/`comparison-dock-complete.png`: 기존 홈 여백 규칙이 도크 자체 여백에 추가되어 주 버튼 폭이 좁아짐(P2). 새 도크 내부의 버튼 줄에만 중복 여백을 제거했다. 최종 캡처와 세부 대조에서 재확인했다.

## 최종 필수 대조 항목

- **글꼴/문구**: 앱에 있는 게임 글꼴을 사용했다. 메뉴 캡션은 짧은 기록/패스/순위/미션과 해당 언어의 축약형, 전체 이름은 접근성 레이블에 남는다. 주요 버튼은 390px에서 25px/16px, 좁은 화면에서 22px/14px. 시안 예시의 무지개등 `2/10`은 107레벨에서 실제 규칙상 잠금 상태이므로 `Lv.200`을 표시한다.
- **배치/간격**: 하단 메뉴 행과 두 주 버튼의 계층을 시안에 맞췄다. 390px의 도크 높이는 약194px, 320px은 약175px. 메뉴 터치 폭은 모두44px 이상. 공통 바깥 여백 안에서 연승 요약·메뉴·주 버튼을 정렬했다. 타이머는 아이콘 영역 안에 absolute로 겹치고 캡션과 간격을 둔다.
- **색상/표면**: 아이보리 도크, 밝은 라임 주 버튼, 코랄 보조 버튼, 노란 연승 캡슐, 아주르 선택 탭. 금색 프레임과 색상 필터 대신 새 래스터 원화를 쓴다.
- **이미지 품질**: 원화와 프롬프트를 보존했다. UI 모서리는 9-slice로 유지하며 정원은 실제 래스터 오브젝트와 새 타일을 Canvas에 그린다. 배경 스크린샷을 붙여 정원 조작을 대체하지 않았다. 잔디/돌길 런타임 알파는 기존 256×128 다이아몬드와 동일하다.
- **상태/내용**: 연승 보너스, 강화 무지개등, 주간 로테이션, 무제한 시간, 실제 패키지 상태, 새 이벤트/운영 알림을 그대로 사용한다. 예시보다 패키지 버튼이 하나 더 보일 수 있고, 진행도와 새 알림은 실제 상태를 우선한다. OS 안전 영역과 이용자 조경 차이는 의도된 차이다.
- **좁은 화면**: 320px의 한국어/영어/일본어에서 가로 페이지 넘침0, 메뉴 행 넘침0, 타이머 텍스트 잘림0, 옛 파란 라벨0, 최소 터치 폭44px 이상.

## 동작 검수

`output/verification/home-command-dock/flows.json`에 실제 앱 브라우저 결과를 저장했다.

- 연승 선물 안내, 무제한 도구 안내, 한정/연쇄 패키지, 정원 패스 진입.
- 주간 동물 구출 별도 페이지 및 홈 복귀, 하단 이벤트/홈 이동.
- 지도 드래그/확대 후 저장 좌표 불변.
- 실제 정원 편집 UI에서 물건 이동 모드→회전→놓기 저장. 격리 fixture가 실제 `applyGardenCommand`를 호출해 변경된 회전을 확인했다.
- 레벨 준비 모달→플레이→실제 퍼즐 보드 진입.
- 해당 브라우저 흐름의 pageerror0.

`final-skin.json`에는 최종 표면/여백 변경 이후 4개 화면의 잘림·메뉴 폭·시간 표기·터치 크기 재검증을 저장했다. 실제 구매, 운영 API/DB, 스토어/실기기, 네이티브 동기화와 운영 배포 검증은 범위에 포함하지 않는다.

## 래스터 자산과 생성 프롬프트

내장 Image Gen 도구로 제작했다. 개별 UI 원본과 정확한 프롬프트는 `packages/assets/home-dock-v75/`에, 정원 원본/프롬프트/패킹/반복 검수는 `packages/garden-world/art/home-v75/`에 있다.

| 자산 | 런타임 경로 | 프롬프트 |
|---|---|---|
| 아이보리 도크 | `packages/assets/home-dock-v75/runtime/ivory-dock.webp` | `ivory-dock-prompt.md` |
| 초록 버튼 | `packages/assets/home-dock-v75/runtime/lime-button.webp` | `lime-button-prompt.md` |
| 코랄 버튼 | `packages/assets/home-dock-v75/runtime/coral-button.webp` | `coral-button-prompt.md` |
| 선택 홈 탭 | `packages/assets/home-dock-v75/runtime/active-home.webp` | `active-home-prompt.md` |
| 연승 선물 캡슐 | `packages/assets/home-dock-v75/runtime/gift-capsule.webp` | `gift-capsule-prompt.md` |
| 잔디 | `packages/garden-world/art/home-v75/runtime/ground.webp` | `prompt-ground.md` |
| 돌길 | `packages/garden-world/art/home-v75/runtime/path.webp` | `prompt-path.md` |

## 검사 결과와 근거

- `npm run build`: TypeScript 포함 통과. 기존 대형 번들 경고는 남아 있다.
- 정원 모델/미리보기/주민/라이브·연승 선물·이벤트 발견/탭/알림 8개 파일 **90개 테스트 통과**.
- 변경 파일의 `git diff --check` 통과.
- 최종 화면: `output/playwright/home-v75-complete-390-ko.png`, `home-v75-complete-320-{ko,en,ja}.png`.
- 편집 화면: `output/playwright/home-v75-editor-390.png`.
- 전체 비교 및 읽을 수 있는 하단 확대 비교를 동일 입력에 나란히 묶어서 열어 확인했다.

남은 P3: 시안에 쓰인 일부 장식 아이콘의 세부 모양과 현재 앱의 원본 아이콘은 다르다. 기능/명칭/알림과 사용자 자산을 보존하는 범위에서 기존 아이콘을 재사용했다.
