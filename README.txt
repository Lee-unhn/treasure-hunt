# 尋寶獵人 Treasure Hunt

> 活動用 PWA：玩家掃 QR 收集 7 關寶藏 → 自動產生領獎憑證；後台一鍵核對、抽獎、匯出 CSV。

**Author**: [@Lee-unhn](https://github.com/Lee-unhn) · a2264563@gmail.com

## 專案簡介 / Overview

尋寶獵人是一個給實體活動用的單頁 PWA：玩家輸入名字建立帳號 → 工作人員啟動（$100 / $200 卡別）→ 出現 7 格寶藏地圖，到各關位掃 QR、答題集點 → 達標自動產生領獎憑證 QR。內建後台分頁可掃啟動碼、重產站點 QR（防作弊換 hashKey）、編輯題目答案、驗證領獎、抽獎、看統計。Demo 階段資料只存 localStorage，正式活動可串雲端後端。離線可用（vendor 內建函式庫 + sw.js cache）。

## 架構 / Architecture

```mermaid
flowchart TD
  PLAYER(["玩家手機 / 電腦"])
  STAFF(["工作人員"])
  INDEX["index.html\n主程式（玩家 + 後台分頁）"]
  ADMIN["admin.html\n獨立管理畫面"]
  SCREEN["screen.html\n投影 / 大螢幕顯示"]
  MANIFEST["manifest.json\nPWA metadata"]
  SW["sw.js\nService Worker · 離線快取"]
  LS[("localStorage\n玩家 / 啟動 / 集點 / 領獎")]
  QR["vendor/qrcode.min.js\n生 QR"]
  SCAN["vendor/html5-qrcode.min.js\n掃 QR"]
  TW["vendor/tailwind.min.js\nCSS"]
  GS["backend.gs\n(可選) Google Apps Script"]
  START["start.bat / start.command\n一鍵本機伺服器"]

  PLAYER --> INDEX
  STAFF --> INDEX
  STAFF --> ADMIN
  STAFF --> SCREEN
  INDEX --> QR
  INDEX --> SCAN
  INDEX --> TW
  INDEX --> LS
  ADMIN --> LS
  INDEX -. PWA install .-> MANIFEST
  INDEX -. offline .-> SW
  START --> INDEX
  GS -. 雲端後端 (可選) .-> INDEX
```

## 技術棧 / Tech Stack

- 純前端 HTML5 + JS（無 framework）
- Tailwind（`vendor/tailwind.min.js`，離線可用）
- `html5-qrcode` 掃 QR、`qrcode.min.js` 生 QR
- PWA：`manifest.json` + `sw.js`（service worker 離線快取）
- localStorage 做資料持久化（Demo），多裝置同步可改接 `backend.gs`（Google Apps Script）
- `start.bat` / `start.command` 各平台一鍵啟動本機 HTTP server（port 8765）

## 主要檔案 / Key Files

- `index.html` — 主程式，內含玩家流程 + 後台分頁
- `admin.html` — 獨立管理畫面（可投放給工作人員）
- `screen.html` — 大螢幕 / 投影顯示用
- `backend.gs` — 可選的 Google Apps Script 後端（多裝置同步時用）
- `manifest.json` + `sw.js` — PWA 與離線快取
- `start.command` / `start.bat` — Mac / Windows 一鍵啟動本機伺服器
- `vendor/` — 離線可用的第三方函式庫（html5-qrcode / qrcode / tailwind）
- `SETUP.md` — 正式部署與後端串接說明

## 使用 / Usage

### 一、快速試玩（電腦版）

**macOS**：
1. 將整個 app 資料夾放在桌面或任意位置
2. 雙擊 `start.command`（被 Gatekeeper 擋就右鍵 → 打開 → 確認）
3. 瀏覽器會自動跳出 → 直接開始試玩

**Windows**：
1. 將整個 app 資料夾放在桌面或任意位置
2. 雙擊 `start.bat`
3. 瀏覽器會自動跳出 → 直接開始試玩

結束：直接關掉 Terminal / cmd 視窗即可。

### 二、安裝到手機（PWA — 體驗最佳）

前置：手機需與電腦在同一個 WiFi。

1. 電腦先依上一節啟動伺服器
2. 查電腦的 IP（Mac 系統設定 → 網路；Win 命令列 `ipconfig`）
3. 手機瀏覽器輸入：`http://<電腦 IP>:8765/index.html`
4. 安裝到主畫面：
   - iPhone Safari：分享 → 加到主畫面
   - Android Chrome：右上角選單 → 安裝應用程式

⚠ 相機掃描需要 HTTPS。手機要用相機掃 QR，請直接在電腦試玩（localhost 例外允許相機），或部署到 `https://` 網址。

### 三、預設關卡與門檻

- 7 關預設題目可在「📷 站點 QR」頁面編輯
- 完成 3 關 → 🎁 基礎獎品（$100、$200 共通）
- 完成 7 關 → ✨ 限量贈品 + 🧳 行李箱抽獎（限 $200 卡）

### 四、注意事項

- Demo 版資料只在 localStorage，**多裝置不同步**；正式活動請串 `backend.gs` 或其他雲端 DB
- 後台無密碼保護，正式上線前需加
- 右下角紅色「🗑 清除全部」可重置所有資料（需確認）

## License

MIT。
