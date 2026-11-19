# 구름정원 공식 홈페이지

귀신 컷! 공식 사이트의 **대표 일러스트 → 한 줄 소개·스토어 버튼 → 이미지가 있는 게임 특징 → 정책 링크** 구성을 구름정원의 밝은 정원 테마에 적용했다.

| 언어 | 홈페이지 | 개인정보처리방침 | 이용약관 | 계정 삭제 |
|---|---|---|---|---|
| 한국어 | `/official/` | `/official/privacy` | `/official/terms` | `/official/account-deletion` |
| English | `/official/en/` | `/official/en/privacy` | `/official/en/terms` | `/official/en/account-deletion` |
| 日本語 | `/official/ja/` | `/official/ja/privacy` | `/official/ja/terms` | `/official/ja/account-deletion` |

언어를 바꿔도 현재 페이지를 유지하고 본문·메타데이터·삭제 요청 이메일 양식까지 선택한 언어로 제공한다. 이전 공개 주소 `/privacy`, `/terms`, `/account-deletion`도 유지한다. 앱 설정 링크는 현재 앱 언어에 맞는 한국어, 영어 또는 일본어 페이지를 연다.

## 출시 후 다운로드 버튼 연결

`config/official-site.json`의 `stores.googlePlay`, `stores.appStore`에 **공개 상품 상세 주소**를 입력한다. `null`인 플랫폼은 ‘출시 예정’으로 표시한다. 테스트플라이트나 다른 게임 주소를 대신 연결하지 않는다.

## 구성과 나중에 통합하는 방법

- `config/official-site.json`: 게임 식별자, 경로, 웹사이트 도메인, 앱 식별자, 스토어 주소. `origin`이 비어 있으면 현재 Worker 도메인을 사용한다. 나중에 스튜디오 공용 도메인을 연결할 때는 API 주소와 독립적으로 설정할 수 있다.
- `config/legal.json`: 승인된 사업자 정보와 정책 버전. 원본 증명서나 문서 전용 식별 정보는 포함하지 않는다.
- `apps/api/src/official-site/`: 공통 헤더·푸터와 서버 렌더링, 게임별 소개·테마, 언어별 정책 본문을 분리했다. 통합 시 공통 셸을 재사용하고 게임별 설정·번역·미디어를 각 게임 경로로 묶을 수 있다.
- `apps/admin/public/official/media/`: 기존 대표 일러스트·로고·앱 아이콘·검수용 플레이 화면을 웹용 WebP로 변환한 파일. 기존 정적 자산 빌드에 함께 포함하며, 게임 앱의 패키지 크기를 늘리지 않는다.

미디어 출처는 `apps/client/public/splash/garden-build-wide-v52.webp`, `packages/assets/branding/`의 한국어·영어·일본어 로고, iOS 앱 아이콘, `output/verification/normal-v51/board-390.png`, `output/verification/garden-v51/home-overview-540.png`, `packages/assets/flowerlight-v42/expedition-poster.webp`이다. 공개 페이지는 기존 API·운영 콘솔과 구분하며, 조회에 로그인이나 D1 조회를 요구하지 않는다.

## 로컬 미리보기

```bash
node --import tsx tools/official-site-preview.ts 5351
```

`http://127.0.0.1:5351/official/`에서 확인한다. 이 미리보기는 운영 API에 접속하지 않는다. 실제 배포 전에는 [개인정보·삭제 정책과 실제 운영을 맞출 항목](legal-pages.ko.md)을 계속 확인해야 한다.
