# 이벤트별 헤더 v73

final result: passed (local web scope)

## 요청과 구현

사용자는 이벤트 탭의 메뉴를 누르면 헤더 배경도 해당 본문에 어울리는 새 이미지로 바뀌도록 요청했다. 현재 노출되는6메뉴에 맞춰 built-in image_gen으로1024×512 WebP 헤더6장을 제작했다. 기존 이벤트 제목·아이콘·가로 탭·버튼·알림·본문·하단 메뉴와 게임/보상 처리는 유지했다.

| 선택 메뉴 | 새 헤더 배경 | 연결한 기존 본문 |
|---|---|---|
| 출석 선물 | 아침 피크닉 정원과 잎사귀 | 출석 달력 |
| 꽃빛축제 | 꽃/나뭇가지/정자가 있는 정원 | 꽃밭/꽃잎 장면 |
| 보물 카드 | 짙은 청록 felt와 잎사귀 | 청록 카드판 |
| 도구 축제 | 나무 벽/창문/식물이 있는 작업실 | 작업실 도구판 |
| 시즌 이벤트 | 푸른 하늘/구름/장미 덩굴 | 공중 정원 |
| 이벤트 보상 | 정원 우편 분위기와 작은 봉투 | 우편함/선물 엽서 |

새 원화에는 텍스트·탭·버튼·깃발/전구를 그려 넣지 않았다. 기존 번역과 라이브 버튼을 유지하며 장식은 가장자리 위주로 제한했다. 여섯 파일 합계257,362bytes. 생성 원본/프롬프트/참조/준비 과정은 `packages/assets/event-design-v62/event-headers-v73-prompts.json`에 보존했다. 기존 원화와 생성 원본은 삭제하지 않았다.

`EventHeaderBackdrop.tsx`는6장을 eager image로 미리 불러오고, CSS가 실제 렌더된 `data-event-panel`을 따라 정확히 한 장만 표시한다. 별도의 선택 상태나 비동기 setter를 만들지 않아 초기 선택, 가용 탭 fallback, 키보드 전환과 같은 시점에 헤더가 결정된다. 데이터 준비 전에는 출석 헤더를 표시한다. 기존 이벤트 전체 배경만 이 컴포넌트로 교체했고 다른 Hub 페이지의 배경은 변경하지 않았다.

## 시각 근거와 비교

기존 본문6장의 원화를 직접 보고 `body-references.png`로 묶어 색·재질·조명을 확인한 뒤 새 헤더 생성에 각 본문을 참조로 제공했다. `generated-headers.png`에서 여섯 결과를 직접 검토했다.

실제 production 빌드 CSS + 실제 React 컴포넌트의 로컬 전용 fixture를 Chrome으로 열어6메뉴를 직접 클릭하고 캡처했다. fixture 계정·API 응답·시각은 합성이며 운영 데이터 변경은 없다.

- `generated-vs-rendered-headers.jpg`: 왼쪽 생성 원화/오른쪽 실제 헤더를 같은402×184 슬롯으로 나란히 비교. 원화는 실제 cover 규칙과 같은402×210 슬롯에서 상단184px로 정규화했다. 기존 제목과 탭을 제외한 원화·크롭이 일치하고 중요한 장식/텍스트 잘림이 없음을 확인했다.
- `headers-and-bodies-402.jpg`: 실제6페이지의 상단320px를 묶어 헤더와 본문의 색·재질 연결을 함께 검토했다. 순서는 출석/꽃빛/보물/도구/시즌/보상이다.
- `before-after-treasure.jpg`: 같은402px 보물 카드 초기 상태의 이전 공통 깃발/전구 헤더와 새 청록 헤더를 나란히 비교했다. 제목/탭/본문 위치를 유지하면서 배경만 바뀌었다.
- 402×874:6메뉴마다 본문과 표시 헤더 ID가 일치하고 visible image 수1. 본문 시작 y184.515625가 모든 메뉴에서 동일하다. 최초 출석에서6이미지가 모두 로드된 것도 확인했다.
- 320×694:6메뉴를 다시 직접 클릭해 모든 ID 일치/visible 수1, 가로 client/scroll320/320, 본문 시작 y171.5546875 동일 확인. `Home` 키로 보상→출석을 선택했을 때 헤더도 출석으로 돌아왔다.
- 320px 영문 시즌에서 Events 제목, 기존 탭 번역과 새 하늘 헤더를 함께 확인했다. 이미지 내 고정 텍스트 없음, 가로 넘침 없음.
- 최종 보물 카드 미리보기에서 표시 ID treasure/6이미지 로드 완료, 신규 console error/warning0. 임시 뷰포트 해제, 미리보기 유지.

P0/P1/P2 차이 없음. 본문마다 다른 원화에 각각 연결하는 요청이므로 원화 사이의 풍경을 하나의 동일 사진처럼 이어 붙였다는 의미의 pixel seam 일치는 주장하지 않는다. 추가 애니메이션이나 제목/탭 디자인 변경도 없다.

## 근거 파일

`output/playwright/event-headers-v73/`:

- `attendance-402.jpg`, `flowerlight-402.jpg`, `treasure-402.jpg`, `power-festival-402.jpg`, `season-402.jpg`, `live-events-402.jpg`: 각 실제 전체 화면.
- 같은 이름의 `-320.jpg`6개: 작은 한국어 화면.
- `season-en-320.jpg`: 영문 제목/탭 확인.
- `body-references.png`, `generated-headers.png`: 본문 참조/생성 결과.
- `generated-vs-rendered-headers.jpg`, `headers-and-bodies-402.jpg`, `before-after-treasure.jpg`: 비교 입력과 최종 묶음.
- `browser-checks.json`: 실제 브라우저의4개402px 및6개320px 전환 수치. 출석/꽃빛402px 결과는 본문과 직접 캡처에 별도로 기록했다.
- `build.log`, `tests.log`.

TypeScript 포함 `npm run build`, 기존 이벤트 탭14테스트(1파일), `git diff --check` 통과. 기존 대용량 chunk 안내는 남아 있다. 운영 배포·네이티브 동기화·실물 iOS/Android 검수는 실행하지 않았다. 이전 기능들의 QA 판정을 변경하지 않는다.
