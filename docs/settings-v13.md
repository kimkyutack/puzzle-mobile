# 설정 화면 정리 v13

2026-11-03 14:34 요청 반영:

- 설정의 튜토리얼 다시 보기 항목과 해당 초기화 핸들러 제거. 플레이 중 튜토리얼 시스템은 별도 유지.
- 언어가 마지막인 편안한 플레이 카드 다음에 계정 연동 카드를 별도로 배치. 기존 계정/구매 disclosure 밖이므로 펼치지 않아도 표시.
- Google/Apple 연결과 충돌/대기 인증 처리는 기존 코드 그대로 이동. 남은 disclosure 제목은 구매 및 계정 관리.
- 계정 삭제는 red Button tone. 검증된 기존 hud_moves의 빨간색/금테 PNG를 nine-slice로 재사용, 새로운 그림/에셋팩 생성 없음.
- 삭제 확인 단어 입력, working 상태, 실제 DELETE 요청/세션 정리 로직은 그대로 유지. 실제 계정 삭제나 연결·로그아웃은 검수 중 실행하지 않음.

변경 파일: Menus.tsx, ui.tsx, ui-v9.css, locales/catalog.en.json. 기존 garden-2026.11.03-shop-v11/166에셋을 그대로 사용. 타입 검사 통과. 시각/네이티브 증거는 output/verification/visual-v13/에 기록.

## 화면 검수

공식 CUA의 격리된360×780/402×874 한국어 화면8쌍,97텍스트 영역 대비 실패0, 넘침/런타임 예외/POST·DELETE0. language→계정 연동 Card→관리 details 순서와 accountInsideDetails=false, tutorialReplay=false를 DOM으로 확인. 삭제 버튼은 입력 전 disabled와 fixture에만 삭제를 입력한 enabled 상태를 검사했으며 최종 삭제는 누르지 않음. root가 실제 캡처04/05/09를 열어 배치와 빨간 PNG 재질을 확인.

계정 연결/로그아웃/개인정보/설정 변경 버튼은 누르지 않음. 테스트 후 원래16저장소 키/값을 정확히 복원하고 자체3키만 제거, Network/cache/SW/viewport를 복구하고 임시 탭 종료. 콘솔 error0, Pixi 종료 경고2는 별도로 보존. summary.json 참고.

미리보기 output/design-v13/settings-preview.png는 변경하지 않은402px 화면 두 장을 나란히 배치한 검수 자료.

## 네이티브 산출물과 설치 보류

local web snapshot 2026-11-03T05:43:15.452Z를 sync 직후 frozen-dist 전체363파일/SHA로 동결. Android 빌드와 별도 DerivedData iOS 빌드 성공. 컴파일 중 병행 sync가 iOS public의 native-build.json 하나를 바꾼 것은 ios-copy-race.json에 기록. 공유 파일을 원복하지 않고 별도 완성 App 사본에 동결 public 전체를 넣어 ad-hoc 재서명/검증 후 ZIP 생성.

root 별도 checker에서 두 산출물 모두 동결363파일·166asset SHA·21web파일·정확한 metadata·settings/link/red-delete marker·fixture 배제 확인. 양쪽 public365개 파일도 상호 동일. output/verification/native-v13-archive-audit.json 참고. 이전23개 아카이브는 보존.

실제 사용자는 작업 중 퍼즐을 진행하고 있었고 마지막 읽기에서도 activeRun1이어서 iOS 재시작·설치·GUI 입력을 하지 않음. 사용자 진행 변동은 검수 쓰기가 아닌 실제 플레이와 구분. Android도 종료 상태여서 설치/재기동하지 않음. 새 APK/Simulator ZIP만 제공하고 API8787은 계속 유지. 실제 native settings GUI 검증으로 주장하지 않음.
