# 최신 앱 정원 상점 39종 운영 복구 (2026-11-23)

final result: passed

## 원인과 수정 범위

운영 Worker `cc2ef36a-a779-47a5-83e3-b26100f50b1b`는 `garden-v64`까지만 인식했다. 최신 iOS/Android 번들은 `gardenArt=garden-v78`을 보냈고, 이 요청은 `showcase=false`로 처리되어 `shopVersion=2`를 보내도 구버전용 14종으로 내려갔다. 실제 운영 API에서 수정 전에 재현했다.

로컬에는 이미 최신 상품 39종과 호환 처리가 있었으나 운영에 미반영된 상태였다. 다른 진행 중인 변경을 배포하지 않기 위해 내려받은 운영 원본에 다음 소스에 대응하는 여섯 부분만 적용했다. 그 외 Worker 본문 바이트는 유지했다.

- `packages/garden-world/src/catalog.ts`: 기존 카탈로그에 새 조경 7종을 추가.
- `packages/garden-world/src/live.ts`: 최신 39종과 이전 32/16/14종 가격표 구분.
- `apps/api/src/garden-art-compat.ts`: 최신 아트 식별 및 구버전 외형 대체.
- `apps/api/src/garden-world.ts`: 아트 버전에 맞는 가격표 선택.
- `apps/api/src/index.ts`: 조회와 응답에 botanical capability 전달.

DB 마이그레이션, 지급, 사용자 저장 배치 변경, 네이티브 빌드/동기화는 하지 않았다. 운영 설정·바인딩·시크릿·정적 에셋·런타임은 기존 버전에서 상속하고 동일함을 확인했다.

## 검증 결과

| 요청 | 수정 전 운영 | 수정 후 운영 |
|---|---:|---:|
| 최신 `shopVersion=2&gardenArt=garden-v78` | 14 | 39 |
| 이전 `shopVersion=2&gardenArt=garden-v64` | 32 | 32 |
| 이전 `shopVersion=2&gardenArt=garden-v62` | 16 | 16 |
| 기존 무버전 요청 | 14 | 14 |

- 실제 운영에서 별도 검증용 게스트로 조회했다. 검증 계정은 전후 모두 삭제했으며 개인 계정/토큰을 사용하지 않았다. 조회 전후 잔액·레벨·복원 상태가 같음을 확인했다.
- 내려받은 운영 원본과 수정본을 각각 Miniflare/격리 D1에서 실행해 위 현상과 수정 결과를 비교했다.
- 새 조경 7종 각 2개 구매, 같은 요청 재전송 시 중복 차감 방지, 정식 상품 ID 저장, 회전 배치와 재조회, 구버전 외형 대체를 확인했다.
- 잘못된 견적·비판매 스토리 시설·시설 레벨 미충족을 거부했다. 레벨 5에서도 최신 목록은 39종을 유지했다.
- 기존 정원 상점/실시간 정원 테스트 2파일 16개 통과. 관련 소스 `git diff --check`와 후보 Worker 문법 검사 통과.
- 39종의 상품 아트 파일이 모두 존재하고 웹/iOS/Android 동기화 번들이 `garden-v78`을 포함함을 읽기 전용으로 확인했다. 이번 작업에서 실기기 화면을 새로 실행하지는 않았다.

## 운영 배포

- Worker: `puzzle-mobile`
- 운영 API: `https://puzzle-mobile.ddr1323.workers.dev/api`
- 배포 버전: `f1cf697f-80b0-46db-9fac-ec8cec43c93d`
- Deployment: `d1f16e0b-38da-45f8-9960-f77f19dcfb75`
- 트래픽: 100%

이미 열려 있는 앱은 조회한 가격표를 메모리에 보관하므로 완전히 종료한 뒤 다시 켜야 한다. 최신 앱을 다시 빌드할 필요는 없다.

재현 스크립트, 운영 원본/수정본 해시, 변경 범위, 격리 검사 결과 및 배포 전후 API 근거는 `output/verification/garden-shop-39-release/`에 보관했다. 운영 원본과 비밀 바인딩 메타데이터가 포함된 해당 폴더는 공개 배포/공유 대상이 아니다.

배포 API 기준: [Cloudflare version upload](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/), [deployment create](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/create/).
