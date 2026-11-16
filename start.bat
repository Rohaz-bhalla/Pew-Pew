@echo off
REM Starts the backend (Spring Boot) and the frontend (Next.js) in two windows.
REM Put this file in the project root, next to the "backend" and "frontend" folders.
REM Nothing to install: it downloads Maven by itself the first time.
REM Close the two windows to stop everything.

cd /d "%~dp0"
title Pew Pew launcher

echo.
echo === Pew Pew ===
echo.

REM ---- 1. Node.js ----
where npm >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js / npm was not found. Install Node.js from https://nodejs.org
  echo.
  pause
  exit /b 1
)

REM ---- 2. Java 17 or newer ----
REM If Java is not on PATH, use the one IntelliJ downloaded into %USERPROFILE%\.jdks
where java >nul 2>nul
if errorlevel 1 (
  if not defined JAVA_HOME (
    for /d %%J in ("%USERPROFILE%\.jdks\*") do if exist "%%J\bin\java.exe" set "JAVA_HOME=%%J"
  )
)
where java >nul 2>nul
if errorlevel 1 (
  if not defined JAVA_HOME (
    echo [!] Java was not found. Install JDK 17 or newer, for example from https://adoptium.net
    echo.
    pause
    exit /b 1
  )
)

REM ---- 3. Maven: use the installed one, or download a private copy ----
set "MVN=mvn"
where mvn >nul 2>nul
if errorlevel 1 (
  set "MVN=%~dp0.tools\apache-maven-3.9.9\bin\mvn.cmd"
  if not exist "%~dp0.tools\apache-maven-3.9.9\bin\mvn.cmd" (
    echo Maven was not found. Downloading a private copy, about 9 MB, first run only...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; New-Item -ItemType Directory -Force -Path '.tools' | Out-Null; Invoke-WebRequest -UseBasicParsing 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip' -OutFile '.tools\maven.zip'; Expand-Archive -Force '.tools\maven.zip' '.tools'; Remove-Item '.tools\maven.zip'"
    if not exist "%~dp0.tools\apache-maven-3.9.9\bin\mvn.cmd" (
      echo.
      echo [!] The Maven download failed. Check your internet connection or proxy.
      echo     Or start the backend from IntelliJ and use this script for the frontend only.
      echo.
      pause
      exit /b 1
    )
  )
)

REM ---- 4. Private database settings ----
if not exist "backend\src\main\resources\application-local.properties" (
  echo [!] backend\src\main\resources\application-local.properties is missing.
  echo     It holds your Neon database URL, user and password.
  echo     application-example.properties shows what goes in it.
  echo.
  pause
  exit /b 1
)

REM ---- 5. Frontend packages, first time only ----
if not exist "frontend\node_modules" (
  echo Installing frontend packages, first run only...
  pushd frontend
  call npm install
  popd
)

REM ---- 6. Start both, each in its own window ----
echo Starting the backend. The first run also downloads libraries and can take a few minutes...
start "Pew Pew - Backend" /d "%~dp0backend" cmd /k call "%MVN%" spring-boot:run

echo Starting the frontend...
start "Pew Pew - Frontend" /d "%~dp0frontend" cmd /k npm run dev

echo.
echo Backend : http://localhost:8080   (test it at http://localhost:8080/db-check)
echo Website : http://localhost:3000
echo.
echo Opening the website in 20 seconds...
timeout /t 20 /nobreak >nul
start "" http://localhost:3000