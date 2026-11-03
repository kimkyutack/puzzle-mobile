# Cloudflare API 배포

운영 API는 `https://puzzle-mobile.ddr1323.workers.dev/api`입니다. 공개 기본 주소는 `config/deployment.json` 한 곳에서 웹 클라이언트와 네이티브 Release 빌드가 함께 읽습니다. HTTP와 길드 WebSocket도 같은 주소를 사용합니다.

## Git 배포

- 저장소: `kimkyutack/puzzle-mobile`, 프로덕션 브랜치: `main`
- Worker: `puzzle-mobile`
- 루트 디렉터리: `/`
- 빌드 명령: 비움 (Wrangler가 API TypeScript를 번들링)
- 배포 명령: `npm run deploy`

`npm run deploy`는 아직 적용되지 않은 원격 D1 마이그레이션을 먼저 적용하고 Worker를 배포합니다. Git 빌드 토큰에는 이 Worker의 배포 권한과 D1 마이그레이션 권한이 필요합니다. 실행 중인 요청/기존 앱과 호환되도록 마이그레이션을 추가하세요.

루트 `wrangler.jsonc`는 운영 전용입니다. `apps/api/wrangler.jsonc`는 기존 로컬 개발 DB와 실행 설정을 유지합니다. 운영 리소스는 D1 `puzzle-mobile-db`, R2 `puzzle-mobile-assets`, Durable Object `GUILD_ROOMS`입니다. Cron은 5분마다 이미 검증된 알림/지급 outbox를 재처리합니다.

```sh
npm ci
npm run api:check:production
npm run deploy
node --import tsx tools/api-cloudflare-check.ts
```

마지막 명령은 원격 서버에 별도 게스트를 만들고 실제 퍼즐 저장/보상/CORS를 검사한 뒤 그 계정을 익명화하고 세션을 폐기합니다. 개인 계정 토큰이나 로컬 DB를 읽지 않습니다.

## 앱 요청과 로컬 개발

```sh
npm run native:release
```

이 명령은 운영 API 주소를 넣어 빌드하고 iOS/Android 프로젝트에 동기화합니다. 실제 기기 설치·서명·TestFlight 업로드는 별도 단계입니다. `VITE_API_URL`로 명시한 HTTPS API 주소로 바꿀 수도 있습니다.

Vite 개발 서버(`npm run dev`)는 기존 `/api` 로컬 프록시를 유지합니다. `npm run native:local`도 Mac의 `http://localhost:8787/api`를 사용합니다. 로컬 개발용 하트 충전은 운영 서버에서 비활성화되어 있습니다.

운영/로컬 로그인 저장소를 분리하므로 로컬 테스트 계정은 로컬에 남고 운영 서버에서는 새 계정을 사용합니다. 기존 로컬 진행 데이터를 원격 DB에 자동으로 복사하지 않습니다. 데이터베이스와 계정이 다르므로 로컬 게스트 토큰을 운영 서버로 보내지 않습니다.

이미지/오디오는 네이티브 앱에 계속 포함합니다. 이번 API 전환은 제작 원본이나 개인 데이터를 R2로 공개하지 않습니다. R2 런타임 팩 업로드는 `docs/operations.md`의 별도 절차를 따릅니다.

OAuth·광고·인앱결제는 실제 공급자 설정과 Worker secrets를 등록한 뒤 검증해야 합니다. Git 빌드 환경변수와 Worker 런타임 secrets는 구분하며 비밀값을 `VITE_` 변수나 Git 파일에 넣지 마세요.

## 확인한 동작 (2026-11-03)

원격 Worker에서 별도 게스트로 로그인/갱신, 실제 퍼즐 행동 재생과 보상 중복 방지, 화면별 API, 운영 하트 충전 차단, iOS/Android/browser CORS를 확인했습니다. 정상 플레이로 길드를 해제하고 WSS ping/pong, D1 outbox 알림, 일회용 접속표 재사용 차단까지 통과했습니다. 검증 계정은 종료 후 익명화했습니다.

전체 240개 테스트와 타입 검사가 통과했고 Git에 포함된 API 파일만 추출한 별도 디렉터리에서도 Worker 번들을 생성했습니다. 운영 웹 번들의 브라우저 요청이 실제 HTTPS Worker에 도달하는 것을 확인했고 iOS/Android Release 웹 번들에 같은 API 주소를 기록했습니다. 기존 설치 앱에 반영하려면 해당 네이티브 앱을 다시 빌드해야 합니다.

Cloudflare 공식 문서: [Workers Builds 설정](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [D1 마이그레이션](https://developers.cloudflare.com/d1/reference/migrations/).
