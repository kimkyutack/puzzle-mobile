# 꾸러미 구매 버튼 보정 v12

2026-11-03 13:40 사용자 화면에서 꾸러미 구매 버튼이 없는 것을 확인. 원인은 ShopMenu가 `prices[product.id]`가 있을 때만 버튼 자체를 렌더하던 조건이다. `native-build.mjs local`은 결제를 명시적으로 끄므로 로컬 앱에서 가격이 없고 버튼도 사라졌다.

- 첫 정원 꾸러미·공략 도구 꾸러미·정원 패스 및 같은 조건이 있던 코인 상품에 구매 진입 버튼을 항상 표시.
- 가격이 없으면 구매하기, 실제 SDK 가격을 받으면 해당 가격을 표시. 가짜 금액이나 구매 성공을 만들지 않음.
- 구매 진입은 구성/가격 확인창만 열고 취소 가능. 최종 결제는 실제 SDK 활성+실제 상품 가격이 있어야 가능하며 기존 prepare/verify/receipt 처리 유지.
- 가격 조회 중/실패/빈 결과와 재조회 상태를 표시. 로컬 결제 비활성 설정 유지.
- 포스터의 조용한 파란 영역에 구매/상태를 배치하고, 밝은 탁자 위 상태 문구를 피하도록 구매 버튼 위로 이동.
- 좁은 실가격 버튼에서 구매하기+금액을 함께 쓰면 단어가 쪼개져, 가격을 받은 버튼은 일반 게임 상점처럼 금액만 한 줄 표시. 재조회 링크도 어두운 글자로 대비 보정.

원화·에셋팩은 변경 없는 garden-2026.11.03-shop-v11/166항목을 재사용. 이전 원화·아카이브와 다른 작업 변경 보존.

검증: 타입 검사와 기존 commerce-offers/providers-purchases-platform 2파일9테스트 통과. CUA 격리 fixture의 360/402 화면에서 최종8쌍168텍스트 대비 실패0, DOM 넘침/예외/POST0. 3개 꾸러미 진입/취소, 가격 unavailable/error/empty/loading/ready 상태와 재조회 검수. native SDK 가격 stub은 테스트 탭에서만 쓰며 실제 결제·재화 지급은 하지 않았음. 실제 스토어 결제 성공 검증과 구분.

미리보기 output/design-v12/purchase-buttons-preview.png는 변경하지 않은 최종402×874 검수 화면 두 장을 나란히 배치한 이미지. QA 기록은 output/verification/visual-v12/summary.json.

## 네이티브와 병행 빌드 구분

우리 v12 local snapshot은 2026-11-03T04:50:35.943Z. Android/iOS 캐시 빌드 성공 후 v12 APK/Simulator ZIP을 생성하고, 활성판/대기0을 확인해 iOS 업데이트. 즉시 전후 Player·진행·ledger132·seen9·styles2·설정7키 유지. 실제 상점 상단 진입/취소/홈 복귀는 CUA로 확인했으며 실제 꾸러미 하단 진입은 도구 스크롤 제약으로 브라우저 검수와 구분. Android는 종료 상태여서 설치/재기동 없이 APK 제공.

별도 정원 편집 작업이 이어서 shared dist/public과 iOS 앱을 04:53/04:55 snapshot으로 갱신. 이를 되돌리거나 빌드를 방해하지 않음. 따라서 mutable current dist와 우리 v12의 byte 일치를 주장하지 않는다. 첫 current-dist 비교 실패와 차이는 parallel-build-investigation.json / installed-ios-archive-comparison.json에 보존.

root는 기록된 우리 sync metadata·변경 없는166에셋 SHA·GUI 검수된3개 source hash·컴파일된 실제 구매 fallback·fixture 미포함 및 두 v12 archive의 public365개 파일 상호 일치를 별도로 확인. output/verification/native-v12-archive-audit.json과 check-v12-frozen-packages.py 참고. 원래21개 아카이브와 병행 작업은 보존.

최신 외부 설치04:55:04.027Z에도 구매 진입/확인/재조회 marker와 가격이 없을 때 구매하기 fallback 및 !SDK/!price 최종결제 disabled가 유지됨을 compiledJS에서 읽기 확인. installed-latest-purchase-markers.json 참고. 원래21개 archive SHA 모두 불변, 신규2개를 더한23개 SHA 목록 완료. 다른 빌드/설치에 추가 쓰기 없이 종료.
