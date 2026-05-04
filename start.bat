@echo off
REM 尋寶獵人 — Windows 一鍵啟動
REM 雙擊本檔即可啟動本機伺服器 + 自動開啟瀏覽器
REM 關閉伺服器：直接關掉跳出的 cmd 視窗，或按 Ctrl+C

cd /d "%~dp0"

set PORT=8765
set URL=http://localhost:%PORT%/index.html

echo.
echo ============================================
echo   🏴‍☠️  尋寶獵人 Treasure Hunt
echo ============================================
echo.
echo   伺服器啟動中...
echo   網址：%URL%
echo.

REM 偵測 Python
where python >nul 2>nul
if %errorlevel% == 0 (
  start "" "%URL%"
  echo   按 Ctrl+C 可關閉伺服器
  echo --------------------------------------------
  python -m http.server %PORT%
  goto end
)

where python3 >nul 2>nul
if %errorlevel% == 0 (
  start "" "%URL%"
  echo   按 Ctrl+C 可關閉伺服器
  echo --------------------------------------------
  python3 -m http.server %PORT%
  goto end
)

REM 沒 Python，試 npx
where npx >nul 2>nul
if %errorlevel% == 0 (
  start "" "%URL%"
  echo   按 Ctrl+C 可關閉伺服器
  echo --------------------------------------------
  npx --yes http-server -p %PORT% -c-1
  goto end
)

echo.
echo X 找不到 Python 或 Node.js
echo   請先安裝其中一個：
echo   - Python: https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org/
echo.
pause

:end
