@echo off
setlocal EnableExtensions

rem ============================================================
rem  MazenmiX Windows Cleaner
rem  Safe cleanup only: temporary files, browser caches, and
rem  Windows error-report caches. No personal folders, registry
rem  changes, service disabling, Prefetch deletion, or Recycle Bin.
rem ============================================================

title MazenmiX Windows Cleaner
color 0A
mode con: cols=88 lines=32 >nul 2>&1
cls

echo.
echo  #   #   ###   #####  ####   #   #  #   #  #####  #   #
echo  ## ##  #   #      #  #      ##  #  ## ##    #     # #
echo  # # #  #   #     #   #      # # #  # # #    #      #
echo  #   #  #####    #    ####   #  ##  #   #    #      #
echo  #   #  #   #   #     #      #   #  #   #    #      #
echo  #   #  #   #  #      #      #   #  #   #    #     # #
echo  #   #  #   #  #####  ####   #   #  #   #  #####  #   #
echo.
echo                    M a z e n m i X   C L E A N E R
echo  ======================================================================
echo.

rem Detect administrator rights without requesting elevation.
fltmc >nul 2>&1
if errorlevel 1 (
    set "IS_ADMIN=0"
) else (
    set "IS_ADMIN=1"
)

echo  [1/7] Cleaning your temporary files...
call :ClearFolder "%TEMP%"
if /i not "%TEMP%"=="%LOCALAPPDATA%\Temp" call :ClearFolder "%LOCALAPPDATA%\Temp"

echo  [2/7] Cleaning Windows internet cache...
call :ClearFolder "%LOCALAPPDATA%\Microsoft\Windows\INetCache"

echo  [3/7] Cleaning Google Chrome cache...
call :CleanChromium "%LOCALAPPDATA%\Google\Chrome\User Data"

echo  [4/7] Cleaning Microsoft Edge cache...
call :CleanChromium "%LOCALAPPDATA%\Microsoft\Edge\User Data"

echo  [5/7] Cleaning Brave and Firefox cache...
call :CleanChromium "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data"
if exist "%LOCALAPPDATA%\Mozilla\Firefox\Profiles" (
    for /d %%P in ("%LOCALAPPDATA%\Mozilla\Firefox\Profiles\*") do (
        call :ClearFolder "%%~fP\cache2"
    )
)

echo  [6/7] Cleaning Windows error-report cache...
call :ClearFolder "%LOCALAPPDATA%\Microsoft\Windows\WER\ReportArchive"
call :ClearFolder "%LOCALAPPDATA%\Microsoft\Windows\WER\ReportQueue"

if "%IS_ADMIN%"=="1" (
    echo  [7/7] Cleaning protected Windows temporary files...
    call :ClearFolder "%SystemRoot%\Temp"
) else (
    echo  [7/7] Standard mode: protected Windows Temp was safely skipped.
)

echo.
echo  ======================================================================
echo                CLEANING COMPLETE - WINDOWS IS READY
echo  ======================================================================
echo.

rem No pause and no key press. Close automatically.
timeout /t 2 /nobreak >nul
exit /b 0


:CleanChromium
set "BROWSER_ROOT=%~1"
if not exist "%BROWSER_ROOT%" exit /b 0

rem Clean only disposable Chromium cache folders. Profiles, history,
rem passwords, bookmarks, cookies, extensions, and sessions are untouched.
call :ClearFolder "%BROWSER_ROOT%\Crashpad\reports"
for /d %%P in ("%BROWSER_ROOT%\*") do (
    call :ClearFolder "%%~fP\Cache"
    call :ClearFolder "%%~fP\Code Cache"
    call :ClearFolder "%%~fP\GPUCache"
)
exit /b 0


:ClearFolder
set "TARGET=%~1"
if not defined TARGET exit /b 0
if not exist "%TARGET%" exit /b 0

rem Resolve the path and reject critical roots as a final safety barrier.
for %%I in ("%TARGET%") do set "TARGET=%%~fI"
if /i "%TARGET%"=="%SystemDrive%\" exit /b 0
if /i "%TARGET%"=="%SystemRoot%" exit /b 0
if /i "%TARGET%"=="%USERPROFILE%" exit /b 0
if /i "%TARGET%"=="%LOCALAPPDATA%" exit /b 0
if /i "%TARGET%"=="%APPDATA%" exit /b 0
if /i "%TARGET%"=="%ProgramData%" exit /b 0

rem Locked/in-use files are skipped automatically; the parent folder remains.
del /a /f /s /q "%TARGET%\*" >nul 2>&1
for /d %%D in ("%TARGET%\*") do rd /s /q "%%~fD" >nul 2>&1
exit /b 0
