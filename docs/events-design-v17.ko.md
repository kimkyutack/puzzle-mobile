# 이벤트 화면 디자인 v17

이벤트 화면의 반복적인 카드 테두리를 제거하고, 개별 일러스트 장면과 아이콘 칩으로 재구성했다.

- 보물 카드: 기존 카드 테이블 일러스트를 전면에 배치하고, 참여 횟수·하트 소모 없음·시작 동작을 아래 행동 영역에 모았다.
- 출석: 새 루미·달력·선물 포스터, 코랄 색상의 출석 스탬프, 7일차 망치 보상, 수령 후 체크 표시를 사용한다.
- 시즌: 새 저녁 정원 축제 포스터 아래에 개인·길드 진행과 보상을 배치한다. 진행 막대는 주황·로즈 색으로 구분한다.
- 상단은 보물 카드·출석·시즌 아이콘 칩으로 이동한다. 비활성 시즌은 기존 패스 진입 칩으로 대체한다.
- 이벤트만 전용 등불·깃발 배경과 프레임 없는 타이틀을 사용한다. 다른 허브 페이지의 제목·배경은 기존 렌더링을 유지한다.

## 이미지

내장 `image_gen`으로 네 이미지를 제작했다. 원본은 `packages/assets/source/*_v17.png`, 런타임은 아래 파일이며, 정확한 프롬프트·참조·생성 원본 경로는 `packages/assets/event-art-v17-prompts.json`에 기록했다.

- `packages/assets/events-v17/poster_attendance_v17.webp`
- `packages/assets/events-v17/poster_season_v17.webp`
- `packages/assets/events-v17/icon_attendance_v17.webp` — 실제 투명 알파 유지
- `packages/assets/events-v17/bg_events_v17.webp`

Sharp는 리사이즈·투명 여백 정리·WebP 압축만 수행한다. 네 파일의 총 용량은 약 440KB다. `event-art-v17.ts`의 Vite import로 독립 패키징하므로 진행 중인 타일 아틀라스와 전역 에셋 매니페스트를 재생성하지 않는다. 원본 이미지에 글자를 넣지 않고 번역 가능한 DOM 텍스트를 사용한다.

## 구현과 검증

`EventsContent.tsx`가 기존 `CommunityMenus.tsx` 이벤트 분기의 표시를 담당한다. 출석·시즌 보상은 원래 콜백과 API를 사용한다. 새 미니게임 규칙이나 API·재화 지급 정책 변경은 없다.

`tools/events-v17-fixture.html`과 `tools/events-v17-harness.tsx`는 실제 표시 컴포넌트와 로컬 가상 데이터를 사용한다. 계정을 읽거나 생성하지 않으며 실서버 보상 지급 요청을 하지 않는다.

- `npm run build` 통과. 기존 메인 청크 크기 경고는 남아 있다.
- `node tools/check-localization.mjs` 통과: 1,000개 항목, 리터럴 호출 800개, 누락 0개.
- 브라우저 390×844 한국어, 320×740 영어, 430×932 한국어 확인.
- 칩 이동, 기존 보물 카드 화면 진입, 출석 수령 후 스탬프·알림 점·비활성 버튼, 7일차 표시, 시즌 보상 수령 표시, 길드 미가입 동작을 확인했다. 수령 검사는 로컬 fixture 상태 전환 검증이다.
- 시즌 비활성·참여 횟수 0 표시를 확인했다.
- 가로 넘침과 이미지 미로딩 없음. 320px 영문 제목의 넘침을 수정하고 재확인했다.
- 스크롤 후 버튼 프레임과 글자의 상대 위치 차이 0px. 시즌 마지막 영역은 푸터 위에서 끝난다.
- 개발 중 fixture 핫 리로드에서 발생한 중복 React root 경고를 fixture 초기화 단계에서 수정했다. 최종 새 탭 로드의 오류·경고는 0개였다.

측정: `output/verification/events-v17.json`

이미지: `events-home-v17.png`, `events-attendance-v17.png`, `events-season-v17.png`, `events-320-en-v17.png` (위 검증 폴더).

웹 빌드까지 완료했다. 이 작업에서는 네이티브 설치본 재설치나 운영 배포를 수행하지 않았다.
