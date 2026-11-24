# 길드 지도실 v109

승인한 지도실 구성을 실제 길드 화면에 연결했다. 미가입 입구는 민트색 방, 찾기·창설·가입 후는 옅은 하늘색 방이다. 길드 타이틀은 `길드`, 하위 화면은 `길드 찾기`/`길드 창설`이다. 하위 화면 뒤로 제어는 safe-area 아래 좌측 상단의44×44px 파란 버튼과 별도 투명 왼쪽 화살표 이미지다. 글자 `뒤로`는 접근성 이름으로만 남는다.

## 구현

- `HubPage.tsx`: 페이지 전용 skin/state, live heading, title/arrow raster. 기존 푸터와 모달 컴포넌트는 변경하지 않는다.
- `CommunityMenus.tsx`: 입구 안내/두 공용 버튼, 검색 양식과 실제 목록, 창설 양식/8문장, 가입 후 문장/공지/탭/프로필 대화 UI를 연결했다. 선물함은 대화 패널 상단으로 옮겼다.
- `guild-map-v109.css`: `.game-page.guild-map-v109` 범위의 스타일만 적용한다. 기존 Jua/Lilita 폰트, 네모난 공용 버튼과 원본 길드 문장을 유지한다. 긴 길드 이름/소개는 최대2줄, 실제 전체 텍스트와 title은 유지한다. 배너는 내용 높이에 맞춰 늘어난다.
- `localized-copy.ts`: 새 안내5문구에 영어/일본어 번역 추가.
- `packages/assets/guild-map-v109/source/`: 생성 원본 및 프롬프트. `runtime/`: 미가입/기본 방, 입구/찾기/창설/가입후 캐릭터, 간판, 뒤로 화살표 WebP. 배경만 불투명이며 UI 문구·정보는 DOM이다.

## 유지한 기능과 계약

문장 인덱스0–7, level5/아동계정/운영 feature gate, 허브 hash 하위 경로와 뒤로 이력, 검색 비동기 sequence/error 처리, 공개 가입/승인 신청/정원 가득/최소 레벨 조건, 창설 초안, 가입 방식·최소 레벨·문장 payload, 대화·IME Enter guard, 지원 요청·차단·신고·멤버 관리/탈퇴 확인을 유지한다. 운영 API나 저장소 코드는 이번 작업에서 편집하지 않았다.

## 검증 근거

`output/verification/guild-map-v109/app.html`은 실제 App를 마운트하고 별도 init.js에서만 API를 모의한다. 운영 데이터로는 검수하지 않았다.

- `functional.json`: 검색/빈 결과/오류 회복, 승인 대기, 가득 찬 길드 비활성, 뒤로 위치/44px 크기/이미지, 창설 초안과8문장/실제 payload, 대화 전송, 하트 요청, 멤버/관리 PATCH, 일반 멤버 관리 숨김, 기존 프로필 열기·닫기. runtime page error0.
- `responsive-final.json`:4화면×320×568/320×640/390×844/430×932/768×1024,320px 영어/일본어 찾기·창설,level4 직접 경로 차단. 가로 넘침/푸터 겹침 없음. 짧은 화면의 본문은 실제 세로 스크롤이다.
- `footer-before.png`/`footer-after.png`: 같은 DOM에서 skin만 끄고 켜 비교,390×93 전체 픽셀 차이0.
- `profile-before.png`/`profile-after.png`:296×274 카드 내부12px inset 차이0. 바깥625픽셀은 투명 모서리 뒤 배경 변화다.
- `final-check.log`: 최종4화면 및320px 긴 이름·소개 배너가 탭을 가리지 않는지 확인.
- `build-final.log`: 타입 검사+Vite production build. 기존 큰 chunk 안내는 남는다.
- `i18n-tests.log`: 기존 번역 사전/placeholder 검사8건 통과.

실기기/WebView 키보드, 실시간 서버 대화·결제, 운영 배포·네이티브 동기화는 수행하지 않았다. 비교 시안은 하드코딩된 예시 데이터와 재생성한 원본 아이콘이므로 실제 사용자 정보·보존한 원본 푸터/버튼 모양 및 OS safe-area는 의도된 차이다.
