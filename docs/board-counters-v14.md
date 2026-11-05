# 장애물 숫자 전면 표시 v14

사용자 캡처의 화분 HP 숫자가 타일에 가려지는 문제를 수정. 장애물별 이미지 그룹에 붙어 있던 Text를 별도의 최상위 obstacle-counters 레이어로 분리하여, 나중에 그려지는 다른 장애물·이동/제거 타일·효과·하이라이트가 숫자를 덮지 않도록 함.

- 기존 흰색/짙은 외곽선/15px 숫자 재질과 HP>1 표시 정책 유지.
- 숫자 오른쪽 아래를 자기 칸 안에 고정해 끝 행/열에서도 보드 테두리 밖으로 밀리지 않도록 배치.
- 기존 impact 단계에서 이전 Text를 제거하고 새 HP를 표시. HP1/파괴 시 숫자를 제거하며 전체 redraw/resize에서도 map과 Text를 함께 정리.
- 숫자 레이어는 입력을 가로채지 않고 보드 전체 흔들림과 함께 이동.
- 변경 파일은 Board.tsx뿐. 규칙·목표·HP 계산·이벤트 타이밍·에셋팩 변경 없음. 기존 설정/구매 버튼 변경도 보존.

타입 검사와 기존 client-impact-overlays/client-board-geometry 2파일7테스트 통과. 실제 사용자 판은 건드리지 않고 별도 Board renderer fixture로 시각·레이어·HP lifecycle을 검수. 기록: output/verification/visual-v14/.

## 최종 검수

360/402 왕복에서 실제 Pixi stage 마지막 obstacle-counters 레이어와 Text4개, eventMode=none, 셀 내부 bounds/중복0 확인. 숫자18이 타격까지 유지되고 계획525ms에 대해 실측526.1ms에17로 갱신. HP1/제거 후 이전 숫자 잔상0. departure sprite2개/FX28개 동시 상태에서도17이 가장 위에 표시됨. root가01/06/08 원본 PNG를 열어 숫자·끝 셀·폭발 중 표시를 확인.

API 요청0, 실제 사용자 판/계정 설정 변경0. 원래16저장소 키 정확히 보존, 테스트 탭과 임시 override 정리. pageerror0, resize 시 기존 Pixi 리소스 해제 경고6건은 렌더 실패와 구분해 기록. source render fixture의 합성 HP 전환 검수이며 게임 규칙/실제 플레이 검증과 구분.

output/design-v14/counter-foreground-detail.png는 원본01/08의 숫자 주변을 잘라 균일2배 확대한 검수 자료. 왼쪽 정상18, 오른쪽 이펙트 중17이며 두 화면 모두 수정 후 상태.

## 패키지

local snapshot2026-11-03T06:03:05.119Z를 frozen-dist363파일/SHA로 동결하고 기존 private DerivedData 캐시로 빌드. root 독립 감사에서 양쪽363파일·166asset SHA·21web파일·정확한 metadata·counter/settings/commerce marker·fixture 배제가 일치. 두 public365파일도 상호 동일하고 서명 검증 통과. output/verification/native-v14-archive-audit.json 참고.

실사용자 활성 판1/대기0이 남아 있어 설치·재시작·입력 없이 완료. 해당 작업 전후 진행·원장·설정7키 불변. Android off 유지, API8787 실행 유지. 이전25개 아카이브 보존, 신규2개 포함27개 SHA 기록. v13 설정 변경과 이전 구매 버튼 수정도 포함.
