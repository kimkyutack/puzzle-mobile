# 첫 퍼즐 → 첫 정원 복구 튜토리얼

첫 판을 자동 시작하는 기존 동작에 다음 강제 안내 단계를 연결했다.

1. level1이며 복구 기록이 없는 계정은 첫 퍼즐을 완성한다. 첫 스왑 힌트의 건너뛰기, 일시정지의 진행 보관·정원 이동·판 종료를 숨긴다. 앱 내부 탭 이동/종료 핸들러와 브라우저 popstate도 같은 단계 조건으로 막는다. 음향·플레이 설정과 인게임 도구는 유지한다.
2. 첫 승리 화면의 단일 진행 버튼은 ‘정원 복구하러 가기’다. 보상이 서버에 확정되기 전에는 비활성화된다. 다음 레벨/정원으로/닫기 우회 경로를 제공하지 않는다. 기존 프롤로그 이야기를 읽은 뒤 실제 첫 복구 안내가 열린다.
3. 꽃별1개로 실제 첫 작업 `sky-path`(정원 입구 고치기)를 복구한다. 기존 `/garden/restore` 및 idempotent 경제 처리/연출을 사용한다. 하단 탭과 배경 입력은 복구가 끝날 때까지 막는다. 정원 데이터/이미지가 준비돼야 복구 버튼을 누를 수 있고, 로딩 실패에는 ‘다시 불러오기’가 있다. 복구 요청 실패는 안내로 돌아가 재시도한다.
4. 복구 연출이 끝나면 기존 ‘문틈의 초대장’ 이야기와 일반 홈/꾸미기/다음 레벨 흐름을 사용한다.

진행 조건은 서버 `player.level`, `player.restored`, 현재 run이다. 임의의 로컬 완료 플래그를 쓰지 않는다. 첫 클리어 후 재실행하면 level2/복구 없음 조건으로 안내를 다시 보여 주며, 저장된 복구가 있거나 level3 이상인 기존 계정은 강제 안내하지 않는다. 별 지급/차감, 반복 지급 방지, 재도전 하트 정책 등 서버 규칙은 변경하지 않았다.

## 변경 위치

- `apps/client/src/first-garden-tutorial.ts`: 계정별 단계 판정과 첫 복구 작업.
- `App.tsx`: 진입/나가기 제한, 승리 후 연결, 복구 중 입력 제한/준비 상태/재시도.
- `FirstGardenGuide.tsx`, `first-garden-guide.css`: 기존 캐릭터·정원 원화와 공용 버튼을 쓰는 복구 안내 및 재도전 화면.
- `WinModal.tsx`, `RunMenus.tsx`: 첫 판에만 적용되는 선택적 안내 props. 일반 판 기본 동작은 유지한다.
- `HomeHub.tsx`, `garden-world/HomeGardenWorld.tsx`: 정원 데이터·이미지 준비 상태 전달. 준비 재시도는 HomeHub를 다시 마운트해 기존 로딩 경로를 사용한다.
- `platform/lifecycle.ts`: 안내 중에만 Android back listener를 등록하고 완료/계정 전환/해제 때 반환한다. 웹·iOS에는 별도 listener를 붙이지 않는다.
- `localized-copy.ts`: 새 안내의 영어/일본어 번역.

## 검증

`output/verification/first-garden-onboarding-v1/`에 실제 App와 실제 게임 엔진을 쓰는 격리 모의 API를 두었다. 다른 작업의 fixture나 운영 계정은 편집하지 않는다. 상태를 fixture 전용 저장소에 보관해 재실행을 검증한다.

- `browser.json`: 첫 판 자동 진입, 힌트 건너뛰기 제거, 일시정지의 종료 경로 없음, browser back 차단, 실제 보드의 접근성 키보드 입력 경로로 두 매치(25→18,0→7) 실행 후 승리, 첫 승리의 다음 레벨/닫기 없음, 기존 프롤로그→복구 안내, 재실행 후 복구 재개, 복구 API 오류 시 별 유지, 성공 시 별1개 사용, 복구 후 재실행/일반 레벨 모달 닫기 허용, 첫 판 실패 재도전,320/430px 한·영·일 버튼 노출. runtime pageErrors0.
- `loading-retry.json`: 첫 정원 요청을 의도적으로 실패시켜 복구 버튼 비활성·재시도·지도 canvas 준비를 확인했다. 초기 녹색 빈 지도에서 복구가 먼저 끝나는 문제를 발견해 정원 준비 상태를 연결한 뒤 전체 흐름을 다시 통과했다.
- `tests.log`: 단계/재개/완료·기존 계정 예외, Android back 등록/해제의 SDK mock 계약, 기존 보상/번역/이야기 회귀 등5파일24건 통과.
- `build.log`: TypeScript 포함 production build 통과. 기존 큰 bundle 안내는 남는다.
- `first-puzzle.png`, `first-pause.png`, `first-win.png`, `first-restore-guide.png`, `first-restore-building.png`, `first-restored-story.png`, `tutorial-complete-home.png`, `restore-guide-*.png`: 실제 렌더링 근거.

운영 API/실제 보상 지급·Android 실기기 hardware back·iOS WebView 재실행은 직접 검증하지 않았다. 배포·네이티브 동기화/아카이브는 실행하지 않았다.
