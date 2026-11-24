# 이벤트 헤더 v112

이벤트의 회녹색 단색 대기 배경을 밝은 정원 풍경으로 보완하고, 제목을 기존 길드 원본과 같은 파란색·금색 간판으로 구성했다. 제목은 실제 번역 텍스트이며 기존 선물 아이콘을 사용한다. 이벤트 데이터나 보상·탭 규칙은 변경하지 않았다.

## 변경

- `HubPage.tsx`: 이벤트에만 `events-header-v112`를 적용하고, 실제 제목/아이콘과 기존 blue/gold 원본 간판을 배치한다. 친구·길드·상점의 헤더 및 개인 레벨 표시 정책을 바꾸지 않는다.
- `EventHeaderBackdrop.tsx`:160px 정원 미리보기를 `?inline`으로 번들에 포함한다. 원본 이미지 요청 전이나 실패 중에도 풍경이 남는다. 원본은 decode 성공 후 표시하고, 출석 원본의 fetchPriority를 높인다. 탭별 배경 선택은 기존 CSS 조건을 유지한다.
- `event-headers-v73.css`: 회녹색 바탕을 없애고 미리보기/원본 레이어를 정리했다. 이벤트 제목판은 폭300px/좁은 화면272px, 헤더72px/좁은 화면68px/짧은 화면64px다. 기존 safe-area와 탭·푸터 경계를 유지한다.
- `packages/assets/event-header-v112/runtime/attendance-preview.webp`: 기존 `event-header-attendance-v73.webp`를 sharp로 폭160px/quality55 WebP 내보내기한 약1.4KB 파생 미리보기다. 기존 원본과 간판은 수정하지 않았다.

## 검증

`output/verification/event-header-v112/`에 근거를 보존했다.

- `typecheck.log`, `build.log`: 타입 검사와 Vite production build 통과. 기존 큰 bundle 안내가 있다.
- 실제 App의 한국어 로딩/완료/탭 전환 및320/390/430/768px 화면은 `fallback-390.png`, `loading-390.png`, `ready-390.png`와 `ready-{320,430,768}.png`에서 확인했다. `loading-final-390.png`/`ready-final-390.png`도 실제 App 근거다. 인위적으로 API를 보류한 경우 시간 경과 후 재시도 상태가 보일 수 있다.
- `header-browser.json`: HMR/인증 부팅과 분리한 실제 HubPage/EventHeaderBackdrop/EventsLoadingContent 컴포넌트 검수11건 통과. 원본6개 이미지 요청 실패에도 inline 미리보기 유지, 복구 후 decode 전환, 시즌/출석 배경 선택,320×568/430×932/768×1024,320px 영어/일본어 제목 표시, pageErrors0을 확인했다. 이미지 실패는 네트워크 조건을 의도적으로 주입한 것이다.
- `header-before-after.png`: 사용자가 지적한 기존 합본의 왼쪽390×260 헤더와 새390×260 헤더를 같은 크기로 비교했다. 공유하는 최종 이미지는 헤더 영역이다.
- 원래 푸터 코드는 수정하지 않았으며 실제 App 캡처에서 유지됨을 확인했다. 별도 헤더 fixture는 스타일 로드 순서가 전체 App과 다르므로 그 fixture의 푸터 캡처는 전체 앱 디자인 비교 근거로 사용하지 않는다.
- 변경 파일 `git diff --check` 통과.

초기 검수에서 Vite의 이미지 import 모듈까지 차단해 앱 초기화가 실패한 조건은 실제 이미지 요청만 차단하도록 수정했다. 전체 App의 언어별 새 문서 진입 검수에는 초기화 대기 시간 초과가 남아 있으며, 최종 언어별 헤더 검증은 HMR을 끈5242 로컬 서버의 컴포넌트 fixture로 수행했다. 운영 API·실기기·배포·네이티브 동기화는 이번 범위가 아니다.
