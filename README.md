# 구름정원: 루미의 초대장 / Cloud Garden: Lumi's Invitation

루미와 구름 위 정원을 복원하는 세로형 솔로 매치3 게임입니다. 원본 요구사항은 [`docs/requirements.ko.txt`](docs/requirements.ko.txt)에 보존되어 있습니다. 첫 접속에서 한국어·영어를 선택하며 설정에서 변경할 수 있습니다. 제목 로고도 언어별 투명 이미지로 표시합니다. 번역 구조와 적용 범위는 [`docs/localization.md`](docs/localization.md)에 정리합니다.

React + TypeScript + Vite가 앱 흐름을, PixiJS가 이미지 기반 보드와 이펙트를 담당합니다. Cloudflare Workers와 D1이 게스트 계정·하트·재화·판 정산·길드 지원의 권위 저장소입니다. 로컬 개발도 같은 Workers API와 D1 SQL을 사용하며 브라우저 저장소가 재화를 결정하지 않습니다.

2026-11-05 iOS **1.04 (5)** 준비와 운영 API 배포를 완료했습니다. 엔진 1.3.0·승인된 10,000개 퍼즐, 총 63개 연속 복원·64개 이야기, 일일 구조 보상과 20칸당 1,000코인 정원 확장을 포함합니다. 배포 범위와 실제 운영 검증은 [릴리스 기록](docs/release-1.04-5.ko.md)에 정리했습니다. 아래 visual-v8/v9 설명은 초기 제작 기록입니다.

2026-11-03 visual-v9는 홈·푸터·헤더와 전체 메뉴를 새 입체 PNG 재질로 교체했습니다. 정원 옆 보라색 배지는 하늘색·골드, 지역 표시는 주황색으로 구분하고, 독립 재화 표시창과 선명한 주요 버튼을 배치했습니다. 상점·길드·이벤트는 페이지 이동, 패스·순위는 홈 바로가기를 유지합니다. 각 화면의 카드 색상과 글자 대비를 별도로 검수했습니다. 패스의 모두 받기·프리미엄 구매 진입과 코인 도구 구매 확인창도 제공합니다. 신규 원화21종과 정확한 제작 기록은 [`prompts-ui-v9.json`](packages/assets/prompts-ui-v9.json), 화면 비교는 [`design-qa.md`](design-qa.md)에 있습니다.

2026-11-02 visual-v8는 **루미와 잃어버린 구름편지**의 첫 세 지역을 연결합니다. 첫 클리어와 18개 정원 복원에 맞춘 19개 이야기, 토리·나루, 지역 포스터 3종을 추가했습니다. 홈의 편지 기록장에서 열린 이야기를 다시 보고, 복원한 벤치·화단·등불의 자연/축제 장식을 무료로 바꾸면 정원에 실제 그림이 바뀝니다. 이야기 감상·장식은 별도 서버 상태로 저장하며 기존 진행·재화와 복원 비용은 유지합니다. 기존 플레이어에게 지나간 이야기를 자동으로 연속 재생하지 않습니다.

상점·홈·길드·이벤트의 고정 하단 페이지와 홈의 패스·순위 바로가기, 이미지 상점, 간결한 순위표도 유지합니다. [검증 근거](docs/verification.md)와 [네이티브 설정](docs/native-services.md)에 상세히 기록합니다. 이야기는 하늘 정원·온실 작업실·분수 테라스에서 바람 우체국·반딧불 연못·숲속 기차역까지 순서대로 이어집니다.

## 로컬 실행

Node.js 22.14 이상과 npm을 사용합니다. 의존성 버전은 `package-lock.json`에 고정했습니다.

```bash
npm ci
npm run db:migrate
npm run dev
```

브라우저에서 <http://localhost:5173>을 엽니다. API는 <http://localhost:8787/health>에서 확인할 수 있습니다. Vite의 `/api` 프록시가 Workers와 연결됩니다. 첫 실행은 언어를 선택한 뒤 리소스를 준비하고 게스트 계정을 만든 다음 첫 퍼즐을 시작합니다. 로그인이나 외부 공급자 키 없이 코어 퍼즐과 로컬 정산을 사용할 수 있습니다.

로컬 데이터는 `.wrangler` 내부에 유지됩니다. 브라우저를 새로고침해도 같은 세션과 활성 판으로 복귀합니다. 저장소를 임의로 지우면 게스트 토큰을 잃을 수 있으므로 계정 복구 실험에는 별도 브라우저 프로필을 사용하세요. 광고·실결제·실계정 로그인은 외부 설정이 필요하며 연결되지 않은 상태에서 보상을 흉내 내지 않습니다.

기본 조작은 타일을 누른 뒤 이웃 타일을 누르거나 드래그하는 방식입니다. 같은 모양 3개, 직선 4/5개, L/T, 2×2를 만들 수 있습니다. 특수 블록은 탭으로도 발동하며 인벤토리 도구는 선택 후 대상 칸을 누릅니다. 홈의 정원 복원은 최초 클리어로 받은 별을 사용합니다.

## 검사와 데이터 생성

```bash
npm test
npm run typecheck
npm run build
npm run api:types
npm run api:check
npm run levels:validate
npm run levels:campaign:verify
npm run levels:bulk:verify
```

현재 캠페인은 1~10,000판이다. 최초 300판은 보존하고, 이후는 기존 18개 공략 유형의 720개 승인 변형과 판별 이동 예산을 조합한다. `levels:campaign:verify`는 최초 300판, `levels:bulk:verify`는 승인 변형과 공개된 모든 판의 무구매 승리 경로를 다시 재생한다. 제작 기준과 적용 범위는 [일괄 확장 문서](docs/campaign-bulk.ko.md)에 있다.

```bash
npm run levels:bulk:build -- --to=20000
npm run levels:bulk:build -- --to=30000
```

위 명령으로 기존 공개 판을 보존하며 다음 1만 판을 한 번에 생성·검증할 수 있다. 검증이 모두 통과한 뒤에만 공개 범위가 갱신된다. 아래 `levels:validate`와 과거 후보 생성 도구는 기존 200판 엔진 자료용이며 현재 캠페인 전체 검증과 구분한다.

```bash
node --import tsx tools/level-validation/validate.ts --build
node --import tsx tools/level-validation/evaluate.ts
```

후보 생성과 승리 경로 탐색은 앱의 판 시작 API에서 실행되지 않습니다. 검증에 실패한 후보를 사용자에게 게시하지 않습니다. 자동 플레이 성공률은 사람의 난이도나 재미 검증을 대신하지 않습니다. 수량·내구도·배치 재사용으로 규모를 늘리며 쉬운 판과 연쇄 축제를 유지합니다. 새 미술·규칙이 무한 생성되는 구조는 아닙니다.

`npm run assets`는 생성 원본의 런타임 변환과 manifest/atlas 처리를 실행합니다. 생성 이미지와 제작 프롬프트, manifest 위치는 [`docs/art-guide.md`](docs/art-guide.md)를 참고하세요. 원본 파일을 바꾸면 해시와 atlas를 다시 빌드해야 합니다.

## 구조

| 경로 | 역할 |
|---|---|
| `apps/client` | React 앱 흐름, PixiJS 보드, 실제 입력·접근성, 네이티브 어댑터 |
| `apps/api` | Workers API, D1 거래·원장, 길드 Durable Object, 공급자 검증 |
| `packages/contracts` | 클라이언트/서버 공용 타입·버전 |
| `packages/game-core` | 결정론 엔진, 매치·특수 조합·장애물·낙하 |
| `packages/content` | 고정 레벨, 승인된 seed, 승리 로그, 상품·복원 데이터 |
| `packages/assets` | 생성된 제작 원본과 에셋 관리 데이터 |
| `tools/asset-pipeline` | 이미지 검사·최적화·atlas 생성 |
| `tools/level-validation` | 정적 검증, 후보 생성, 자동 플레이·재생 검증 |
| `tests` | 엔진·콘텐츠·서버·공급자 회귀 테스트 |
| `output/verification` | 실제 실행한 검사 보고서와 시각 검수 자료 |

## 서버 권위와 복구

새 판 시작과 클리어는 하트를 소비하지 않습니다. 실패를 확정하거나 진행 중인 판을 포기할 때만 하트 1개를 소비합니다. 활성 판 재접속과 +5 이어하기도 하트를 소비하지 않습니다. 시작 부스터의 배치 가능성을 먼저 검증하고 하트·재고·run 생성을 D1 거래로 확정합니다.

클라이언트는 오프라인에서도 이미 시작한 판의 일반 이동을 계산하고 순서 있는 행동 로그를 보관합니다. 서버는 같은 엔진으로 합법적인 행동을 재생해 승인합니다. 재연결 전에는 새 아이템 사용이나 다음 레벨 보상을 지급하지 않습니다. 게임 승패와 네트워크 오류는 별도 상태입니다. 활성 판의 기본 복구 기간은 24시간입니다.

DB의 고유 키, 버전 비교와 실패 시 전체 batch를 중단시키는 SQL assertion으로 중복 요청·경합을 처리합니다. 길드 알림은 D1 outbox를 통해 재시도하며 Durable Object 알림 성공을 재화 지급의 조건으로 삼지 않습니다.

## 모바일 및 외부 서비스 설정

`.env.example`은 공개 클라이언트 설정과 Worker 전용 비밀값 이름을 구분합니다. 비밀값을 `VITE_` 변수나 공개 R2에 넣지 마세요. 네이티브 SDK 설정, 상품 등록, OAuth, Apple 인증서, AdMob UMP/SSV 연결은 [`docs/native-services.md`](docs/native-services.md)에 정리합니다.

```bash
npm run native:local
npx cap open android
npx cap open ios
npm run native:ios-simulator
```

`native:local`은 이 Mac의 `http://localhost:8787/api`를 사용하는 개발 앱을 만듭니다. API를 계속 실행하고 Android 에뮬레이터/USB 기기에서는 `adb reverse tcp:8787 tcp:8787`을 설정하세요. iOS 시뮬레이터의 localhost는 이 Mac을 가리킵니다. `native:ios-simulator`는 보안 저장소가 작동하도록 로컬 ad hoc 서명을 포함합니다. 서명을 끈 빌드는 Keychain 저장에 실패하므로 사용하지 않습니다.

운영 빌드는 `npm run native:release`로 준비합니다. `config/deployment.json`의 Cloudflare API 주소를 기본으로 사용하며 `VITE_API_URL`로 별도 HTTPS API를 지정할 수도 있습니다. 로컬 API 설정으로 Release 빌드를 시도하면 차단됩니다. Android 에뮬레이터와 iOS 시뮬레이터의 설치·첫 퍼즐·실제 입력을 확인했습니다. 물리 기기 성능·실계정 OAuth·스토어 sandbox 구매·광고 지급은 확인하지 않았습니다. 검사 결과와 실행 파일은 [`docs/verification.md`](docs/verification.md)를 참고하세요.

API는 `puzzle-mobile` Worker에 연결되어 있습니다. 루트 `wrangler.jsonc`는 운영 D1/R2 바인딩을, `apps/api/wrangler.jsonc`는 기존 로컬 DB를 사용합니다. Git 빌드 명령과 앱 요청 방식은 [`docs/cloudflare-deployment.md`](docs/cloudflare-deployment.md), 운영 절차는 [`docs/operations.md`](docs/operations.md)를 참고하세요.

플레이 시작은 `/health`에서 확인한 운영 엔진과 협상하며 목표 미리보기에도 같은 버전을 사용합니다. 시작 오류 수정, 가로·세로 폭탄 원화와 무지개등 연출은 [`start-special-v25.ko.md`](docs/start-special-v25.ko.md)에 정리했습니다.

추가 문서: [`architecture.md`](docs/architecture.md), [`game-rules.md`](docs/game-rules.md), [`economy.md`](docs/economy.md), [`art-guide.md`](docs/art-guide.md), [`localization.md`](docs/localization.md).
