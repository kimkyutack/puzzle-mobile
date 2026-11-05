# 상점 포스터 v11

사용자 요청(2026-11-03 13:00): 상점·이벤트 제목 단순화, 도구 하늘색 통일, 코인 주황색 통일, 패키지·꾸러미 전용 포스터 배경.

## 구현

- HubPage의 페이지 제목은 상점·이벤트. 상점의 보조 모달 제목과 메뉴 번역도 상점으로 정리.
- 도구 7종 모두 card_ice_v9, 코인 6종 모두 card_peach_v9. 가격·보유량·구매 확인 동작은 기존 계약 유지.
- 특별 패키지 배너에는 poster_offer_v11(1200×600), 첫 정원 꾸러미·공략 도구 꾸러미·정원 패스에는 각각 전용 poster_starter_v11 / poster_tools_v11 / poster_pass_v11(1200×800).
- 패키지 상세의 한정·타임 특가·월간 연쇄도 포스터 배경 사용. pass 그림은 실제 pass 상품에만 연결.
- 포스터 그림 전체를 원본 비율로 표시. 금색 외곽선을 nine-slice로 늘리지 않음. 실제 구성품과 가격·판매 상태는 DOM으로 표시.
- 그림 위 버튼·가격판은 PNG FrameFace로 직접 표시. 외부 배경 canvas에 가려지지 않고, 상품별 추가 WebGL context를 만들지 않음.

## 원화·패키지

built-in image_gen.imagegen으로 전용 원화 4종 제작. 생성된 파일과 source 원본의 SHA256/바이트 동일성 확인. 정확한 프롬프트·참조 역할·생성 및 저장 경로는 packages/assets/prompts-ui-v11.json과 output/design-v11/prompts/에 기록. 초기 도구 2:1 원본도 output/design-v11/generated/에 보존.

통합 에셋 garden-2026.11.03-shop-v11: 166항목, atlas3, sequence17, 누락0. 이전 story/flow/localization 변경 보존. 4개 포스터 runtime SHA256·비율·비nine-slice 확인. pack dry-run292파일/92,880,718바이트, 원격 업로드 없음.

타입 검사 및 production build 통과. commerce-offers / providers-purchases-platform 기존2파일9테스트 통과. 실제 결제·가격·receipt·구매확인·pass 일괄 수령 서버 동작 변경 없음. 화면 검수와 네이티브 결과는 output/verification/visual-v11/ 기록을 따름.

## 좁은 패키지 화면 보정

360px 검수에서 그림의 파란 영역보다 문구가 왼쪽으로 밀리고, 타임 특가 제목이 위로2.5px 잘리는 문제를 발견해 수정. 중복 특가 라벨을 제거하고 copy를 원화의 오른쪽 영역에 맞춰54% 지점에서 시작. Offers 모달 내부 여백과 작은 화면의 구성품/가격판을 조정. 임시 좌우8px 확장은 scroll clip에5px 잘려 채택하지 않았으며 최종3px/모달18px 내부 여백으로 포스터300×200과 clip x30~330이 일치함을 확인. 4단계8구성/120분/기준가격 최대 상태도 copy172px/card200px, 비율1.5, 넘침0.

패스 보상 보기 버튼은 white text가 밝은 PNG 위에서 대비가 부족한 것을 발견해1px 남색 외곽선과 구형 WebView의4방향 shadow를 적용. 최종20텍스트 영역 실패0. 한정·타임 특가 최종36영역과 chain-ready31영역도 실패0. 이 수치는 CUA의 격리된 한국어 렌더 화면이며 실제 스토어 구매 검증은 아님. 최종 집계는 agent 보고서로 보완.

## 로컬 네이티브 산출물

2026-11-03T04:26:06.011Z/local/API localhost8787. Android debug와 iOS Simulator 빌드 성공, cloud-garden-shop-v11-local-debug.apk 및 cloud-garden-shop-v11-ios-simulator.zip 생성. root의 별도 checker가 각327개 dist 파일·166개 asset SHA256·21개 JS/CSS/HTML·정확한 metadata·fixture 배제를 확인했으며 모두 일치. output/verification/native-v11-archive-audit.json 참고.

iOS는 설치 직전 활성판0·대기0 확인 후 업데이트. 진행33/2150코인/별6/ledger132 유지. root가 별도로 localStorage5개 값의 동일성과 Preferences plist 파일이 전후 모두 부재함을 확인. 첫 실행 LanguageGate를 캡처했고 사용자 설정은 대신 쓰지 않음. 따라서 native 상점 GUI는 언어 선택 전 단계까지만 확인했고 상세 렌더 검수는 격리 브라우저 기록과 구분.

Android AVD는 준비 시 실행 중이었지만 설치 시 devices0/process0, graceful shutdown 로그를 확인. 종료 원인을 crash로 단정하지 않았고 재기동·최종 설치·입력 없이 APK를 제공. API8787은 계속 실행.

## 최종 화면 검수

채택본25쌍/535텍스트 영역, 대비실패0·텍스트 넘침0·uncaught/unhandled0·실제/합성 쓰기0. 360×667,360×780,402×874,430×932의 한국어 검수이며 root가 저장된 모든 채택본 geometry/대비 데이터를 별도로 집계. output/verification/visual-v11/root-final-qa-summary.json 참고. 구매확인 취소·잔액부족·패스 진입·마지막상품 스크롤·이벤트 제목은 읽기 전용 격리 fixture로 확인. 실제 스토어 결제 완료는 이번 디자인 변경 검수 범위에 포함하지 않음.

세 장의 변경하지 않은402×874 화면을 나란히 배치한 최종 미리보기: output/design-v11/shop-v11-preview.png.

검수 종료 시 생성한 fixture5키만 제거하고 원래16키/값을 정확히 복원, API차단·cache/SW bypass·viewport를 해제한 뒤 임시 탭 종료. 최종 콘솔 error0. Pixi 리소스 해제 시 textureSource/textureSampler still bound 경고26개(2종)는 UI예외0과 구분해 console-final.json에 보존.
