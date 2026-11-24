# 보물 카드 본문 v72

final result: passed (local web presentation scope)

## 선택 시안과 범위

선택된 `events-v3-calendar-flower-cards.png`의 오른쪽 보물 카드 본문을 구현했다. 원본의 x1032/y204/w504/h698 영역을 `output/playwright/treasure-design-v72/reference-body.png`로 보존했다. 기존 이벤트 헤더·탭·하단 메뉴는 유지하고 본문만 변경했다.

청록색 felt 배경, 금색 테두리의 파란 카드 뒷면/아이보리 앞면,3열×4행 카드판, 크림색 진행/보상판, 기존 게임 Button을 사용한다. 배경과 카드 앞·뒷면은 built-in image_gen으로 새로 제작했고 코인·도구·카드 내용은 기존 게임 원화다. 생성 원본과 프롬프트/참조/준비 과정은 `packages/assets/event-design-v62/treasure-v72-prompts.json`에 보존했다.

## 규칙과 데이터 경계

`TreasureMenu`의 기존 시작/뒤집기/700ms 판정/진행 저장/12회 제한/완료 응답 처리는 그대로 유지하고, 이벤트 본문에서만 새 `TreasureCardScene`을 사용한다. 모달 등 기존 기본 presentation은 유지했다. 실제 진행 상태의 `attempt.deck`, `result.matched/turns`, `flipped`, remaining을 그대로 표시한다.

시안의 300코인+망치는 예시다. 현재 `apps/api/src/treasure.ts:finishTreasure`의 실제 지급은25코인+무작위 도구1개이므로 보상판에도 이 내용을 표시했다. 성공 후에는 기존처럼 finish 응답의 `attempt.reward`만 표시하고 `TreasureRewardReveal`로 전달한다. 추가 지급 요청이나 서버 규칙 변경은 없다. 시안의 파란 보석은 기존 게임의 파란 블록 등 실제 여섯 색 원화로 대체했다. 플레이 중에는 카드 버튼을 직접 사용하는 기존 동작을 유지하므로 시작 CTA 대신 ‘카드를 눌러 뒤집어요’ 안내를 표시한다.

## 시각 비교와 수정

원본과 구현을 직접 열고 `reference-comparison.jpg` 한 입력 안에서 나란히 비교했다. 원본 본문504×698을 폭402로 정규화하면 높이557이며, 실제 기존 헤더/도크를 유지한402×874 화면의 본문은402×613이다. 시안을 세로로 왜곡하지 않고 두 본문을 나란히 놓았으며, 늘어난 본문 높이에 따른 세로 간격 차이는 반응형 조정으로 구분했다. 의미상 동일한1쌍/남은10회 상태를 비교했다. 별도 `reward-detail-comparison.jpg`에서 보상판/게임 버튼도 확대 비교했다. 예시 보상과 실제 지급/자체 코인·도구/기존 게임 Button 차이는 위와 같이 의도적으로 유지한다.

- 첫 구현의 정보/보상판이 주황색의 각진 프레임으로 보여 승인 시안과 달랐다. 기존 크림색 postcard raster의9-slice로 교체했다.
- 플레이 중 안내가 크림색 판 아래 경계에 흰색으로 겹쳤다. 판 안쪽으로 이동하고 짙은 남색으로 바꾼 뒤402px와320px 영문에서 재캡처했다.
- 320px 영문/도전 소진 상태에서 긴 설명과 초기화 시간이 버튼에 겹쳤다. 안내를 ‘12번 안에 같은 그림6쌍’으로 줄이고, 소진 시 안내 자리에 초기화 시간 하나만 표시했다. 아이콘/간격을 보정하고 CTA 최소 높이44px를 확보했다. 최종 시간 안내 bottom576.52, 버튼 top580.55로 겹침이 없다.

## 실제 브라우저 및 자동 확인

production 빌드 CSS와 실제 React 컴포넌트를 사용하는 로컬 fixture에서 검수했다. 계정·시각·API 응답은 합성이며 실제 사용자의 도전 횟수나 보상은 변경하지 않는다.

- 402×874 한국어 초기 상태: 카드12장, 본문 client/scroll613/613, 이미지 누락0, 설명 bottom720.66/버튼 top736.64로 분리됨.
- 시작→카드 두 장 공개→한 쌍 완료 후 열린 상태/초록 체크 유지→여섯 쌍 성공→기존 보상 상자→열기 후25코인/망치1 표시 확인.
- 같은 그림이 아닌 두 장을12회 선택해0쌍/남은0회/실패 안내 및 재도전 버튼을 확인했다. 성공 보상 dialog는 나오지 않았다.
- 320×694 영문 진행/도전 소진 상태: 가로 client/scroll320/320, 본문454/454, 문구/보상/안내가 영역 안에 표시된다. 진행 안내는 보상판 bottom605.53 안쪽 y579.19–595.19에 있다.
- 브라우저 mouse dispatch가 두 차례 도구 단계에서 시간 초과되어 그 뒤 기능 확인은 실제 버튼의 Enter 활성화로 수행했다. 제품의 pointer 클릭 오류로 단정하지 않았으며 실물 터치 검수로 대체해 주장하지 않는다.
- 최종 console error/warning0. 미리보기 탭 유지, 임시 뷰포트 해제 완료.
- TypeScript 포함 `npm run build`, 기존 보물 규칙/이벤트 탭 테스트25개(2파일), `git diff --check` 통과. 빌드의 기존 chunk/cycle 안내는 남아 있다.

## 근거 파일

`output/playwright/treasure-design-v72/`:

- `final-402.jpg`: 최종 한국어 시작 화면.
- `reference-state-402.jpg`, `reference-comparison.jpg`:1쌍/남은10회 비교. 이 캡처 뒤의 추가 보정은 하단 도구 아이콘/짧은 안내/CTA 간격이며 최종 결과는 아래320px 및 최종402px 캡처로 재검토했다.
- `playing-en-320.jpg`: 최종 영문 진행 상태.
- `empty-en-320.jpg`: 최종 영문 도전 소진/초기화 시간.
- `one-pair-402.jpg`: 쌍 판정 근거(안내 색/위치 보정 전이므로 최종 시각 근거로 제외).
- `reward-open-402.jpg`: 실제 컴포넌트의 보상 상자/합성 finish 응답 표시.
- `lost-402.jpg`:12회 불일치 후 실패 상태.
- `reward-detail-comparison.jpg`: 보상판과 버튼 확대 비교.
- `initial.jpg`: 초기314×682로 축소된 캡처이므로 최종1:1 근거에서 제외.
- `build.log`, `tests.log`.

운영 배포·네이티브 동기화·실물 iOS/Android 터치 검수는 이번 범위에 포함하지 않았다. 다른 기능의 이전 QA 판정을 덮어쓰지 않는다.
