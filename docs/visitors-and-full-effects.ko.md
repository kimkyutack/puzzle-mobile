# 방문객 분산·외형과 전체 연출

2026-11-05. 이번 변경은 클라이언트 설정과 정원 방문객 표시를 대상으로 한다.

설정에서 `연출 줄이기` 스위치를 제거했다. 기존 서버 프로필이나 오프라인 저장값이 `true`여도 `applyPreferences`에서 `false`로 정규화한다. 일반 퍼즐·구출 퍼즐·홈 정원은 더 이상 해당 저장값으로 연출을 생략하지 않는다. 효과음·배경 음악·진동 설정은 계속 독립적으로 적용된다. 구버전 앱과의 데이터 호환을 위해 서버 계약의 필드는 유지한다.

방문객의 시작 위치를 중앙에서 가까운 순으로 고르던 방식을 바꿨다. 이동 가능한 칸에서 기존 주민과 간격을 확보하고, 먼 구석으로만 밀리지 않도록 중심 거리를 함께 고려한다. 정원 소유자에 따라 위치와 보행 단계가 달라지며, 처음부터 각자의 경로를 걷는다. 정상적인 정원 데이터 갱신 시 기존 주민의 좌표·동작을 보존한다. 건물·잠긴 땅을 피하는 경로와 동물의 하품·수면 동작은 유지한다.

기존 여성 `visitor_a`와 남성 `visitor_b`에 여성 `visitor_c`와 남성 `visitor_d`를 추가했다. 새 여성은 금발 포니테일·하늘색 카디건·남색 치마, 새 남성은 검은 곱슬머리·크림색 셔츠·주황빛 바지로 구분된다. 각 캐릭터에 앞·뒤 보행 8장과 기존 상태 선택에 대응하는 휴식 6장, 총 28장의 투명 PNG가 연결된다. 두 방향의 원화를 좌우 반전해 네 방향을 표시한다.

이미지는 내장 `image_gen`으로 제작했다. 전체 프롬프트와 원본 위치는 [residents-variety-v29-prompts.json](../packages/garden-world/art/residents-variety-v29-prompts.json), 추출 결과는 `packages/garden-world/art/residents-variety-v29-report.json`에 있다. 프로젝트 보존 원본은 `packages/garden-world/art/source/residents-variety-v29/`, 실제 사용 이미지는 `packages/garden-world/art/runtime/residents-variety-v29/`다. `node --import tsx tools/garden-world/build-visitor-variety.ts`가 셀 추출·분리된 알파 잡티 정리·동일 비율 크기 보정만 수행한다.

관련 10파일 47검사와 별도 출력 경로의 클라이언트 프로덕션 빌드가 통과했다. 이번 변경 범위의 타입 검사도 통과했다. 전체 타입 검사는 별도 작업 중인 `tools/api-story-v30-http.ts:56`의 `Headers`/`HeadersInit` 불일치가 남아 있어 통과하지 못했다. 해당 파일은 이번 변경에서 수정하지 않았다. 실제 컴포넌트를 쓰는 계정 없는 격리 페이지를 고정 빌드로 검수했다. 390×844와 320×740에서 다섯 방문객의 분산·이동·네 외형과 수평 넘침 없음을 확인했고, 실제 설정 화면에는 효과음·배경 음악·진동 세 스위치만 표시된다. 과거 `reducedMotion:true`인 검수 프로필로 대폭탄을 사용했을 때 2635ms 연출이 유지되고 충전·타격 중 클리어 표시가 나타나지 않으며 연출 종료 뒤 표시되는 것을 확인했다.

증거는 `output/verification/residents-variety-v29/`의 `browser.json`, `garden-390.png`, `garden-320.png`, `settings-390.png`, `bomb-charge-390.png`, `bomb-impact-390.png`, `four-visitors.png`에 있다. 검수 전용 데이터의 초기 import 오류와 개발 자동 갱신에 의한 재시작을 피하도록 최종 검수는 별도의 고정 빌드를 사용했다. APK/IPA 재빌드·설치나 운영 배포는 이번 작업에서 수행하지 않았다.
