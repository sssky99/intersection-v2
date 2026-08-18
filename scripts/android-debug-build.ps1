$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot "android"
$sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$microsoftJdkRoot = "C:\Program Files\Microsoft"

$jdk = Get-ChildItem -LiteralPath $microsoftJdkRoot -Directory -Filter "jdk-21*" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $jdk) {
  throw "JDK 21이 없습니다. Microsoft OpenJDK 21을 먼저 설치해주세요."
}

if (-not (Test-Path -LiteralPath $sdkRoot)) {
  throw "Android SDK가 없습니다. Android Studio의 SDK Manager에서 Android SDK를 설치해주세요."
}

$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = $sdkRoot

Push-Location $projectRoot
try {
  & npm.cmd run android:sync
  if ($LASTEXITCODE -ne 0) {
    throw "Capacitor Android 동기화에 실패했습니다."
  }

  Push-Location $androidRoot
  try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
      throw "Android debug APK 빌드에 실패했습니다."
    }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

$apkPath = Join-Path $androidRoot "app\build\outputs\apk\debug\app-debug.apk"
Write-Host "Debug APK: $apkPath"
