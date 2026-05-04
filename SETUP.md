# 尋寶獵人 v2 — 設置與部署指南

> 給活動主辦方的完整安裝、設定、部署指南

---

## 📦 系統架構速覽

```
[玩家手機]    [服務員手機]    [主辦方手機]    [大螢幕]
   │            │              │              │
   └────────── HTTPS ──────────┴──────────────┘
                       │
                  Apps Script Web App
                       │
                  Google Sheet（資料庫）
```

| 角色 | URL | 功能 |
|------|-----|------|
| 玩家 | `hunt.xxx.com/`（或 `/index.html`） | 建玩家、選卡、出示 QR、玩 7 關、領獎 |
| 服務員 | `hunt.xxx.com/admin.html` | 必登入，啟動客人、$100 抽獎、領獎驗證 |
| 主辦方 | `hunt.xxx.com/admin.html` 用 organizer 帳號 | 多一個「🎲 抽大獎」按鈕 |
| 大螢幕 | `hunt.xxx.com/screen.html` | 投影中獎名單 + 即時統計 |

> 🔒 **玩家與後台是兩個獨立檔案**：玩家頁完全沒有後台入口，玩家拿不到 `/admin.html` 網址就進不來。後台網址只發給工作人員、不公開。

---

## ✅ 安裝步驟

### Step 1：建立 Google Sheet（5 分鐘）

1. 用**公司 Google 帳號**登入 → [Google Drive](https://drive.google.com)
2. 新增 → Google 試算表 → 命名「**尋寶獵人 2026**」
3. 上方選單 **擴充功能 → Apps Script**
4. 編輯器跳出後，**刪掉**預設的 `function myFunction()`
5. 把 [`backend.gs`](backend.gs) 整份貼進去
6. 按 **💾 存檔**
7. 上方下拉選單選 **`setupSheets`** → 按 ▶ 執行
8. 第一次跳「需要授權」→ 同意流程：
   - 「審查權限」→ 選您的 Google 帳號
   - 「Google 尚未驗證」→ 「進階」→ 「前往（不安全）」→ 「允許」
9. 跑完回到試算表 → Cmd+R 刷新 → 應看到 **5 個分頁**

### Step 2：設定密碼（5 分鐘）

預設密碼都是 `change-me`，**務必改掉**。

1. 在 Apps Script 編輯器最下面找到 `passwordHash()`
2. 把 `'change-me'` 改成您要的密碼（例如 `'A1b2c3d4'`）
3. 選 `passwordHash` 函式 → 執行
4. 看「執行紀錄」裡的 hash（一長串 64 字元）
5. 拷貝 → 回 Sheet「工作人員」分頁 → 貼到對應帳號的 B 欄
6. 重複步驟 2-5 為每個帳號設密碼

> 預設帳號：`admin`(主辦方)、`s01`、`s02`(服務員)。要加更多服務員，直接在「工作人員」分頁新增列。

### Step 3：部署 Apps Script Web App（3 分鐘）

1. Apps Script 編輯器右上角 → **「部署」** 按鈕（藍色）
2. 「**新增部署作業**」
3. 點齒輪 ⚙ → 選 **「網頁應用程式」**
4. 設定：
   - 說明：`v1`（隨意）
   - 執行身份：**「我」**
   - 誰可以存取：**「任何人」** ⭐ 必須選這個
5. 點「部署」
6. 拷貝那串 URL（`https://script.google.com/macros/s/.../exec`）

### Step 4：把 URL 寫進前端（1 分鐘）

只需要改**兩個檔案的 `API_URL`**（玩家頁完全不打 API，不用改）：

1. 開 [`admin.html`](admin.html)，找到 `const API_URL = 'https://...'`，換成 Step 3 拿到的 URL
2. 開 [`screen.html`](screen.html)，找到 `const API_URL`，也換成同一個 URL
3. 順便改 `screen.html` 的 `SCREEN_USER` / `SCREEN_PASS` 為您剛建的帳密

### Step 5：託管前端（5 分鐘）

選一種：

**方案 A：Vercel（推薦，免費，自動 HTTPS）**
1. 註冊 [Vercel](https://vercel.com)（GitHub 登入即可）
2. 安裝 [Vercel CLI](https://vercel.com/cli)：`npm i -g vercel`
3. 在 `app/` 資料夾下執行：`vercel deploy --prod`
4. 拿到 `https://xxx.vercel.app`

**方案 B：Cloudflare Pages（同樣免費 + 可自訂域名）**
1. [Cloudflare Pages](https://pages.cloudflare.com) → 上傳 `app/` 資料夾即可

**方案 C：本機伺服器（測試用）**
- macOS：雙擊 `start.command`
- Windows：雙擊 `start.bat`
- 開啟瀏覽器訪問 `http://localhost:8765/index.html`

> ⚠️ 相機掃描需要 HTTPS 或 localhost。本機跑 `start.command` 沒問題，對外要部署到 https。

---

## 🎬 活動當日流程

### 開場前 30 分鐘
- 確認 Sheet 與 Web App 還可正常運作
- 印好 7 個站點 QR Code（在後台 → 📷 站點 QR 分頁）
- 把 7 個 QR 紙本貼到對應道具旁
- 大螢幕投影機接好，瀏覽器打開 `screen.html`
- 服務員手機都加到主畫面（PWA）並登入

### 開場後
- 客人到櫃台 → 服務員啟動：
  - 點「🎫 啟動」→ 📷 掃客人手機 QR
  - 確認姓名、選 $100 / $200
  - 收費完成
- 客人按「✅ 已付費」→ 進入遊戲
- 客人玩關卡 → 完成 3 關後看到「去櫃台抽 $100 獎」訊息

### $100 即時抽獎
- 客人走到櫃台 → 點「🎁 $100 抽獎」→ 📷 掃領獎 QR
- 系統檢查：付過 $100/$200 卡 + 完成 ≥3 關 + 沒抽過
- 通過 → 服務員讓客人現場抽（轉盤/抽籤桶）
- 系統自動標記，無法重抽

### $200 大獎時段抽（每 2 小時）
- 主辦方手機後台 → 點「🎲 抽大獎」
- 看池內人數 → 輸入抽出人數 → 點「開始抽獎」
- 系統隨機抽出 → 大螢幕自動更新（10 秒內）
- 已中獎者下次自動排除

### 領獎驗證
- 客人來領基礎獎/限量贈品 → 服務員點「✅ 領獎驗證」→ 📷 掃 QR
- 系統顯示「應發獎項」清單
- 服務員依清單發獎，再點「✍️ 寫備註」記錄

---

## 🛠 維運疑難

| 問題 | 解法 |
|------|------|
| 「token expired」 | 重登入即可（每 12 小時自動失效）|
| 「QR 已失效或無效」 | 站點 hashKey 被重產，重貼新 QR |
| 後台跑不出資料 | 看 Apps Script 執行紀錄是否報錯 |
| 大螢幕沒更新 | 檢查 `screen.html` 的 SCREEN_USER/PASS、瀏覽器 console |
| 想加服務員 | 直接在 Sheet「工作人員」分頁新增列、跑 `passwordHash()` 取 hash 貼上 |
| 想改題目/答案 | 後台「📷 站點 QR」分頁 → 改題目 → 儲存（注意：每台裝置本機獨立，建議活動前統一設好）|
| 想撤銷誤啟動 | 直接到 Sheet「玩家清單」分頁刪該列 |
| 想匯出名單 | Sheet 「檔案 → 下載 → CSV」|
| 改密碼 | Apps Script 跑 `passwordHash('新密碼')` → 拷 hash → 貼回工作人員分頁 |
| 升級 Apps Script | 編輯器改 code → 「部署」→ 「管理部署作業」→ 修改現有的 → 「部署」（URL 不變）|

---

## 🔐 安全注意

1. **API URL 公開但有保護**：所有寫入操作都需 token；token 只能透過密碼登入取得
2. **密碼用 SHA-256 hash 存**，明文不留
3. **大螢幕用低權限帳號**（建議建一個只讀的）
4. **資料只在 Google Sheet**，可隨時備份/匯出
5. **localStorage 只用於玩家本機進度**（離線可玩、補關不會 lost）

---

## 📊 預估成本

| 項目 | 規模 | 月費 |
|------|------|------|
| Google Sheet + Apps Script | 1000 玩家 | **$0** |
| Vercel 託管 | < 100 GB 流量 | **$0** |
| 域名（選用）| .com 一年 | NT$300-500 |
| **總計** | | **$0**（不買域名）|

---

## 📁 檔案清單

```
app/
├ index.html       👤 玩家專用（純 localStorage，零 API 呼叫）
├ admin.html       🛠 後台專用（必登入，工作人員 + 主辦方）
├ screen.html      📺 大螢幕中獎名單投影
├ backend.gs       貼到 Apps Script 的後端 code
├ manifest.json    PWA 設定
├ sw.js            Service Worker（離線快取，玩家+後台共用）
├ start.command    Mac 一鍵啟動本機伺服器
├ start.bat        Windows 一鍵啟動本機伺服器
├ vendor/          QR / 相機 / Tailwind 函式庫
├ icons/           PWA 圖示
├ README.txt       v1 demo 用，可保留參考
└ SETUP.md         本檔
```

## 🔒 為什麼分成兩個檔案？

| 安全層級 | 說明 |
|---------|------|
| **玩家頁** (`/`) | 沒有「後台」按鈕、沒有登入框、沒有載入 admin 程式碼 → 玩家**完全找不到後台入口** |
| **後台頁** (`/admin.html`) | 玩家不知道有這個 URL；就算被知道，也必須輸入 Sheet「工作人員」分頁裡的帳密才能進入 |
| **API 寫入保護** | 後端每個寫入操作都驗 token，token 只能透過正確帳密登入取得 |
