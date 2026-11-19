# 정원 홈 아이콘과 꽃빛 축제 아치

내장 `image_gen`으로 미션 체크리스트, 순위 트로피, 꽃빛 축제 아치의 앞·뒷모습을 제작했습니다. 기존 정원 선물 상자는 아이콘의 광택·색감 참고, 장미 아치와 꽃빛 분수는 축제 건축물의 그림체 참고용으로 사용했습니다.

- `runtime/missions.webp`: 256×256, 투명 배경 체크리스트와 연필. 기록용 편지와 구분합니다.
- `runtime/ranking.webp`: 256×256, 왕관 문양이 있는 금색 트로피.
- `runtime/festival-arch.webp`, `festival-arch-rear.webp`: 2×1칸 아치의 별도 앞·뒷면. 좌우 반전과 조합해 네 방향을 표현합니다.
- `source/`: 생성 원본. 아치는 1536×1024 두 시점 시트입니다.
- `prompts.json`: 최종 생성 프롬프트와 사용 방법.
- `build-report.json`: 런타임 출력과 파일 크기.

재처리: `node --import tsx tools/garden-world/build-garden-v51.ts`

Sharp는 알파 경계 추출·축소·WebP 변환에만 사용했습니다. 캐릭터나 장식의 형태를 코드로 다시 그리지 않았습니다.
