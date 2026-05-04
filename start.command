#!/bin/bash
# 尋寶獵人 — macOS 一鍵啟動
# 雙擊本檔即可啟動本機伺服器 + 自動開啟瀏覽器
# 關閉伺服器：直接關掉跳出的 Terminal 視窗，或按 Ctrl+C

set -e

# 切到本檔所在目錄（讓使用者放在桌面/隨身碟都能跑）
cd "$(dirname "$0")"

PORT=8765
URL="http://localhost:$PORT/index.html"

echo "============================================"
echo "  🏴‍☠️  尋寶獵人 Treasure Hunt"
echo "============================================"
echo ""
echo "  伺服器啟動中…"
echo "  網址：$URL"
echo ""

# 嘗試 Python 3 → Python 2 → Node
if command -v python3 >/dev/null 2>&1; then
  RUNTIME="python3 -m http.server $PORT"
elif command -v python >/dev/null 2>&1; then
  RUNTIME="python -m SimpleHTTPServer $PORT"
elif command -v node >/dev/null 2>&1; then
  if ! command -v npx >/dev/null 2>&1; then
    echo "❌ 找不到 npx，請安裝 Node.js 或 Python"; exit 1
  fi
  RUNTIME="npx --yes http-server -p $PORT -c-1"
else
  echo ""
  echo "❌ 找不到 Python 或 Node.js"
  echo "   請先安裝其中一個："
  echo "   - Python: 從 App Store 安裝「Xcode Command Line Tools」"
  echo "   - 或從 python.org 下載"
  echo ""
  read -p "按 Enter 關閉…"
  exit 1
fi

# 開瀏覽器（背景）
( sleep 1 && open "$URL" ) &

echo "  ▶  按 Ctrl+C 可關閉伺服器"
echo ""
echo "--------------------------------------------"
exec $RUNTIME
