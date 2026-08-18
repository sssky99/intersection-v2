# Android 테스트 앱

이 앱은 초기 검증 단계에서 배포 중인 Next.js 웹앱을 Android WebView로 불러옵니다. 웹과 앱의 기능이 갈라지지 않으면서 로그인, 지도, 키보드, 뒤로가기, 사진 업로드 같은 실제 기기 동작을 먼저 확인하기 위한 구성입니다.

## 준비

1. Android Studio를 설치합니다. 설치 과정에서 Android SDK와 Android Virtual Device도 함께 설치합니다.
2. Android Studio가 사용하는 JDK 21을 선택합니다.
3. 프로젝트 루트에서 `npm install`을 실행합니다.

명령줄 빌드는 설치된 JDK 21과 Android SDK를 자동으로 찾아 사용합니다.

```powershell
npm run android:build:debug
```

완성된 설치 파일은 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다.

## 배포된 웹으로 실행

```powershell
npm run android:sync
npm run android:open
```

Android Studio에서 에뮬레이터 또는 USB 디버깅을 켠 실제 기기를 선택한 뒤 Run을 누릅니다.

## 로컬 웹 수정사항으로 실행

에뮬레이터에서는 다음 순서로 실행합니다.

```powershell
npm run dev
$env:CAPACITOR_SERVER_URL = "http://10.0.2.2:3000"
npm run android:sync
npm run android:open
```

실제 기기에서는 `10.0.2.2` 대신 PC의 같은 Wi-Fi 대역 IPv4 주소를 사용하고, Next.js를 네트워크에 공개해 실행합니다.

```powershell
npm run dev -- --hostname 0.0.0.0
$env:CAPACITOR_SERVER_URL = "http://192.168.x.x:3000"
npm run android:sync
```

로컬 테스트가 끝나면 새 PowerShell 창을 열거나 아래 명령으로 환경 변수를 지운 뒤 다시 동기화합니다.

```powershell
Remove-Item Env:CAPACITOR_SERVER_URL
npm run android:sync
```

## 첫 검증 항목

- 휴대폰 번호 인증이 정상적으로 완료되는지
- 앱 종료 후 다시 열어도 로그인 상태가 유지되는지
- Android 뒤로가기 버튼이 화면 이력대로 동작하는지
- 루트 화면에서 뒤로가기를 누르면 앱이 백그라운드로 내려가는지
- 네이버 지도와 길찾기 링크가 정상적으로 열리는지
- 사진 선택과 업로드, 키보드 입력이 정상인지
- 네트워크가 끊겼을 때 오류 안내가 나오는지

현재 `server.url` 방식은 내부 알파 테스트용입니다. Play Store 정식 심사 전에는 앱 업데이트 전략, 딥링크, 외부 결제/인앱결제 경계와 네트워크 장애 화면을 별도로 확정해야 합니다.
