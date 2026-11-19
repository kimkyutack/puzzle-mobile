# Android APK 1.10 (7)

2026-11-09. Android 표시 버전을 `1.10`, 내부 versionCode를 `7`로 설정하고 `assembleDebug`로 설치용 APK를 만들었습니다. 기존 Android Debug 인증서를 사용했으며, 스토어용 Release 서명 APK는 아닙니다.

- APK: `output/native/cloud-garden-1.10-7.apk` (194,620,137바이트)
- 패키지: `com.cloudgarden.match`
- 운영 API: `https://puzzle-mobile.ddr1323.workers.dev/api`
- 사용자가 동기화한 Android 리소스를 그대로 사용했습니다. 네이티브 동기화를 다시 실행하지 않았습니다.
- APK에 포함된 웹 리소스 596개가 현재 웹 빌드와 바이트까지 일치합니다. `native-build.json`의 release 모드·운영 API·로컬 도구 비활성화도 확인했습니다.
- APK 서명 검증과 실제 바이너리의 버전·패키지·대상 SDK 36을 확인했습니다. 기기 설치 및 플레이 테스트는 실행하지 않았습니다.
- 초기 Android Studio 내장 Java의 클래스 버전 불일치 후 Java 21.0.11로 성공했습니다. Java 경로: `/Users/kimkyutack/Library/Java/JavaVirtualMachines/jbr-21.0.11/Contents/Home`.

SHA-256: `c173012fa41348e5c445accf7e286a8e56ae24c9042d54e746ab18a8fde199c4`

검증 기록: `output/verification/android-1.10-7/apk-verification.json`, `apk-signature.txt`, `apk-badging.txt`, `gradle-build.log`.
