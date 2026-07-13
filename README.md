# Hospital Softphone

병원 상담원 전용 **소프트폰 데스크톱 앱** (Tauri + Vite + React).
twillo-callbot 백엔드(Cloud Run)를 공유하며, Twilio Voice SDK로 수신/발신 통화를 처리합니다.

## 구조
- `src/` — Vite + React 프론트엔드
  - `features/softphone/SoftphoneConsole.tsx` — 소프트폰 콘솔(수신 대기·통화·세션 로그)
  - `auth/Login.tsx` — 로그인(twillo 백엔드 JWT)
  - `shared/api` — axios 클라이언트 · 토큰 저장 · API 환경
  - `shared/tauri/useAppUpdate.ts` — 자동 업데이트 상태머신
- `src-tauri/` — Tauri(Rust) 셸
  - `Info.plist` — `NSMicrophoneUsageDescription` (Twilio Voice 마이크 필수)
  - `Entitlements.plist` — `com.apple.security.device.audio-input`

## 개발
```bash
npm install
npm run tauri dev     # 데스크톱 앱 실행
npm run build         # Vite 프론트 빌드
npm run tauri build   # .app / .dmg 번들
```

## 릴리스 / 자동 업데이트
`v*` 태그 푸시 시 `.github/workflows/tauri-release.yml`가 빌드·릴리스합니다.
활성화하려면 서명 키(`TAURI_SIGNING_PRIVATE_KEY`)와 Apple 서명 시크릿을 GitHub Secrets에 등록하고,
`src-tauri/tauri.conf.json`의 `plugins.updater`(pubkey·endpoints)와 `createUpdaterArtifacts: true`를 복구해야 합니다.
