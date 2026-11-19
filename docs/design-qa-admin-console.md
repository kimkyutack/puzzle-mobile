# 운영 콘솔 검증 · 2026-11-06

## 구현과 실제 연결

- `/admin` 관리자 화면 12개 메뉴와 별도 서버 인증을 구현했습니다. 임의 표본 수치 대신 실제 D1 데이터를 조회합니다.
- 점검/최소 버전/이용 제한/기능 제공 여부를 게임에 연결했습니다. 게임 설정에 공지사항·고객센터·이벤트 보상을 추가했습니다.
- 기존 Worker/D1/R2/DO/Smart Placement를 유지합니다. 기존 퍼즐 엔진과 게임 계산 경로는 변경하지 않았습니다.
- 운영 배포: `7e37cd45-1463-4d14-97de-584fec60293a`.
- 운영 D1에 `0012_operations_console.sql` 적용 완료. 실제 사용자 보상·이용 제한·공지·점검 정책을 검증용으로 변경하지 않았습니다.

## 자동 검증

- 전체 72개 파일 / 507개 테스트 통과. 마지막 접근 제한 보강 후 운영 콘솔 15개 테스트 추가 재검증 통과.
- TypeScript, 관리자 Vite 빌드, Worker production dry-run 통과.
- 실제 로컬 Worker HTTP 검사: 별도 D1/R2 상태에서 관리자 등록/로그인, 이미지 업로드, 공지 게시, 보상 중복 방지, CS 답변/내부 메모 분리 확인.
- 운영 HTTP 검사: `/admin` 및 `/admin/events` HTML과 JS 200, CSP/HTML no-store, 미인증 `/api/admin/users` 401, 최초 등록 보안 설정 준비, 기본 점검 꺼짐, 게임 health 정상.
- 초기 소유자 이메일은 공개 auth meta 응답에 포함되지 않습니다.
- Release 웹 리소스 536개가 Android/iOS 폴더와 SHA-256 기준 모두 일치합니다. 아카이브와 스토어 업로드는 수행하지 않았습니다.

## 실제 브라우저 검증

- 1280px 운영 화면 전체 메뉴와 390×844 모바일 전체 메뉴에서 페이지 가로 넘침/오류 안내 없음. 메뉴 드로어, 입력과 표 스크롤 확인.
- 실제 앱에서 점검 화면, 점검 해제, 최소 버전 안내/복구, 공지 상세 확인.
- 실제 앱에서 건의 접수 → 콘솔 목록/상세 → 답변 검토/적용 → 앱에 운영팀 답변 표시 확인.
- 실제 앱에서 이벤트 보상 수령 후 수령 완료 상태 확인. 테스트 전용 코인 500에서 보상 50을 받는 격리 계정만 사용했습니다.
- 이벤트 포스터가 카드 높이를 넘어 제목을 덮는 문제와 점검 안내의 아트 레이어 누락을 검수 중 발견하여 수정 후 확인했습니다.
- 수정 후 관리자 브라우저 경고/오류 로그 없음.
- 운영 주소에서 실제 관리자 최초 등록 화면과 소유자 이메일 입력 상태까지 확인했습니다. 비밀번호 설정은 사용자에게 인계했습니다.

## 근거 파일

`output/admin-console/`의 `tests-final.log`, `tests-admin-final.log`, `typecheck-final.log`, `build-admin.log`, `worker-dry-run.log`, `local-check.json`, `production-check.json`, `browser-pages.json`, `browser-mobile-pages.json`, `native-check.json`, `deploy.log`.

스크린샷: `screenshots/overview.png`, `events.png`, `game-maintenance.png`, `game-notice.png`, `game-support-reply.png`, `game-live-event.png`, `game-update.png`, `mobile-version.png`, `production-initial-setup.png`.

## 남은 사용 단계와 범위

- 최초 소유자의 비밀번호 입력·등록 완료는 사용자 작업입니다. 이 단계 전에는 운영 데이터 화면에 접근할 수 없습니다.
- 기존 설치 앱은 새 운영 UI가 없으므로 업데이트가 필요합니다. 이번 리소스는 네이티브 프로젝트에 동기화했습니다.
- App Store/Play Store 빌드 업로드, 스토어 결제 환불, 실행 코드 교체는 이 콘솔의 기능이 아닙니다. 결제 화면은 실제 처리 상태 조회를 제공합니다.
- 실제 Android/iPhone 하드웨어에서 신규 고객센터 입력/키보드 확인과 스토어 심사는 이번 브라우저 검증에 포함되지 않습니다.
