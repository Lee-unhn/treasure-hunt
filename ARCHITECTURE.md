# 🏗 尋寶獵人 · 系統架構與流程

> 版本 v42（2026 春季尋寶 · 單一票價模式）

---

## 1. 整體架構

```mermaid
flowchart TB
    subgraph Frontend["📱 前端 · GitHub Pages 託管"]
        PLAYER["index.html<br/>👤 玩家頁"]
        ADMIN["admin.html<br/>🛠 後台<br/>（必須登入）"]
        SCREEN["screen.html<br/>📺 大螢幕<br/>（無需登入）"]
    end

    subgraph Storage["☁️ 資料層 · Google Sheet"]
        S1[玩家清單<br/>含 L 欄發票號碼]
        S2[大獎抽獎記錄]
        S3[啟動明細]
        S4[工作人員<br/>SHA-256 密碼]
        S5[設定<br/>門檻、輪次人數]
    end

    subgraph Backend["⚙️ Google Apps Script · Web App"]
        API["/exec<br/>10 個 action 端點"]
    end

    subgraph Hosting["🌐 GitHub"]
        REPO["repo: Lee-unhn/treasure-hunt"]
        PAGES["GitHub Pages CDN<br/>lee-unhn.github.io/treasure-hunt/"]
    end

    PLAYER -.→ |"playerCheck<br/>每 8 秒 poll"| API
    PLAYER -.→ |"掃站點 QR<br/>本機記錄"| LS[(localStorage<br/>個人進度)]
    ADMIN -.→ |"login/activate/claim/<br/>lottery100/draw200/note"| API
    SCREEN -.→ |"stats/lotteryLog<br/>(公開唯讀)"| API
    API <-.→ |"讀寫"| Storage

    REPO --> |"git push 自動部署"| PAGES
    PAGES --> PLAYER
    PAGES --> ADMIN
    PAGES --> SCREEN

    style PLAYER fill:#fff8e6
    style ADMIN fill:#1f1b16,color:#fff
    style SCREEN fill:#d97706,color:#fff
    style Storage fill:#34a853,color:#fff
    style API fill:#4285f4,color:#fff
    style PAGES fill:#000,color:#fff
```

---

## 2. 玩家流程

```mermaid
flowchart TD
    A([掃海報 QR<br/>輸入網址]) --> B[輸入名字 → 點「參加遊戲」]
    B --> C[顯示註冊 QR<br/>UID + URL 編碼姓名]
    C --> D{服務員是否已啟動？<br/>每 8 秒 poll Sheet}
    D -- 否 --> C
    D -- 是 --> E[🏴‍☠️ 寶藏獵人歡迎參賽<br/>✅ 已付款，可玩全 7 關]
    E --> F[7 格寶藏地圖<br/>+ 場地大地圖<br/>+ 📷 掃描關卡 QR 大按鈕]
    F --> G[點按鈕 → 開啟相機]
    G --> H[對準現場站點 QR]
    H --> I{有效關卡？}
    I -- 否 --> F
    I -- 是 --> J[💎 大彈窗：恭喜找到 XX 關<br/>+ 震動]
    J --> K{已達 3 關？}
    K -- 否 --> F
    K -- 是 --> L[🎟 領獎憑證 QR 出現<br/>含完成關數]
    L --> M[繼續玩到 7 關<br/>→ 自動進大獎池]
    M --> N([至兌獎處<br/>領獎品 / 等候大獎抽籤])

    style A fill:#fff8e6
    style E fill:#fbbf24
    style J fill:#10b981,color:#fff
    style L fill:#f59e0b,color:#fff
    style N fill:#d97706,color:#fff
```

---

## 3. 服務員流程

```mermaid
flowchart TD
    A([開 admin.html]) --> B[輸入帳密]
    B --> C{Sheet 工作人員<br/>分頁比對 SHA-256}
    C -- 失敗 --> B
    C -- 通過 --> D[後台 6 分頁]

    D --> E1[🎫 啟動]
    D --> E2[🎁 過 3 關抽獎]
    D --> E3[✅ 領獎驗證]
    D --> E4[📷 站點 QR<br/>列印用]
    D --> E5["🎲 過 7 關大獎抽籤<br/>（主辦方限定）"]
    D --> E6[📊 統計]

    E1 --> F1[掃玩家 QR → 自動帶 UID+姓名<br/>+ 必填「發票號碼」<br/>→ 點「$100 啟動」]
    F1 --> G1[寫入 Sheet 玩家清單<br/>A-E 欄 + L 欄發票]

    E2 --> F2[掃 claim QR → 系統檢查<br/>完成 ≥3 關 + 未抽過<br/>→ 通過寫 H 欄]

    E3 --> F3[掃 claim QR → 顯示應發獎項<br/>自動寫「已領基礎獎 HH:MM」<br/>到 K 欄 → 依綠框發獎]

    E5 --> F5[輸輪次名稱 + 人數<br/>→ 後端篩 $200 + 7 關 + 未中過<br/>→ Fisher-Yates 隨機<br/>→ 寫 I/J 欄 + 抽獎記錄分頁]

    style D fill:#1f1b16,color:#fff
    style E5 fill:#fbbf24
    style F1 fill:#10b981,color:#fff
    style F3 fill:#10b981,color:#fff
    style F5 fill:#f59e0b,color:#fff
```

---

## 4. 大螢幕流程

```mermaid
flowchart TD
    A([開 screen.html<br/>無需登入]) --> B[每 10 秒 poll<br/>stats + lotteryLog]
    B --> C{有抽獎紀錄？}
    C -- 否 --> D[💎 等候畫面<br/>+ 池內人數即時更新<br/>+ 8 種期待感標語輪換]
    D --> B
    C -- 是 --> E{最末輪是 5 分鐘內<br/>且 localStorage 沒紀錄演過？}
    E -- 否 --> F[直接顯示中獎名單<br/>姓名隱碼如「王小*」]
    E -- 是 --> G["🎬 ~13 秒開獎儀式"]

    G --> G1[Phase 1: 標題彈出 2.5s<br/>大獎即將揭曉]
    G1 --> G2[Phase 2: 鼓聲鋪墊 4.4s<br/>2 句輪播]
    G2 --> G3[Phase 3: 倒數 3→2→1 共 3s]
    G3 --> G4["Phase 4: 揭曉 + 3 波彩帶 3s"]
    G4 --> H[標記此輪已演<br/>localStorage]
    H --> F

    F --> B

    style A fill:#d97706,color:#fff
    style D fill:#fbbf24
    style G fill:#dc2626,color:#fff
    style G4 fill:#10b981,color:#fff
```

---

## 5. 資料寫入權限

```mermaid
flowchart LR
    subgraph PUB["🌍 公開（無需登入）"]
        P1[stats]
        P2[lotteryLog]
        P3[playerCheck]
    end

    subgraph AUTH["🔐 需 token（服務員可）"]
        A1[activate<br/>含發票必填]
        A2[lottery100]
        A3[claim]
        A4[note]
        A5[eligible200]
        A6[lookup]
    end

    subgraph ORG["👑 需 organizer 角色"]
        O1[draw200]
    end

    subgraph SHEET["📊 Google Sheet"]
        SH1[玩家清單<br/>A-L 共 12 欄]
        SH2[大獎抽獎記錄]
        SH3[啟動明細]
    end

    P1 -.讀.-> SH1
    P2 -.讀.-> SH2
    P3 -.讀.-> SH1

    A1 -.寫.-> SH1
    A1 -.寫.-> SH3
    A2 -.寫 H 欄.-> SH1
    A3 -.寫 F/G/K 欄.-> SH1
    A4 -.寫 K 欄.-> SH1

    O1 -.寫 I/J 欄.-> SH1
    O1 -.寫.-> SH2

    style PUB fill:#dbeafe
    style AUTH fill:#fef3c7
    style ORG fill:#fbcfe8
    style SHEET fill:#34a853,color:#fff
```

---

## 6. 玩家清單 Sheet 欄位

| 欄 | 名稱 | 寫入時機 | 寫入者 |
|---|------|---------|--------|
| A | UID | 啟動時 | activate |
| B | 姓名 | 啟動時 | activate |
| C | 卡別 | 啟動時 | activate（單一票價：仍寫 $200）|
| D | 啟動時間 | 啟動時 | activate |
| E | 啟動服務員 | 啟動時 | activate |
| F | 完成關數 | 領獎驗證時 | claim |
| G | 完成時間 | 第一次領獎驗證 | claim |
| H | $100 抽獎時間 | 過 3 關抽獎時 | lottery100 |
| I | 大獎中獎輪次 | 大獎抽中時 | draw200 |
| J | 大獎中獎時間 | 大獎抽中時 | draw200 |
| K | 領獎/備註 | 領獎時自動 + 手動 | claim, note |
| **L** | **發票號碼** | **啟動時必填** | **activate** |

---

## 7. 關鍵設定一覽

| 項目 | 數值 |
|------|------|
| 活動模式 | 單一票價（$100） |
| 大獎參賽資格 | 完成 7 關（全員適用） |
| 玩家總關卡 | 7 關 |
| 過 N 關即時抽獎門檻 | 3 關 |
| 過 N 關大獎抽籤門檻 | 7 關 |
| Token 有效期 | 12 小時 |
| 玩家 poll 頻率 | 8 秒 |
| 大螢幕刷新頻率 | 10 秒 |
| 開獎儀式長度 | ~13 秒 |
| 站點 QR 列印 | 6 / 24 張每 A4（兩種模式可選） |

---

## 8. 啟動單筆完整流程（時序圖）

```mermaid
sequenceDiagram
    actor Customer as 客人
    actor Staff as 服務員
    participant PlayerApp as 玩家手機 (index.html)
    participant AdminApp as 服務員手機 (admin.html)
    participant API as Apps Script
    participant Sheet as Google Sheet

    Customer->>PlayerApp: 開 lee-unhn.github.io
    Customer->>PlayerApp: 輸入名字、點「參加遊戲」
    PlayerApp->>PlayerApp: 顯示 QR
    loop 每 8 秒
        PlayerApp->>API: playerCheck(uid)
        API->>Sheet: 查詢 uid
        Sheet-->>API: not activated
        API-->>PlayerApp: { activated: false }
    end

    Customer->>Staff: 出示手機 + 付 $100
    Staff->>Staff: 開立發票（記下號碼）
    Staff->>AdminApp: 點 [🎫 啟動]
    Staff->>AdminApp: 掃 QR → uid 自動帶入
    Staff->>AdminApp: 輸入發票號碼
    Staff->>AdminApp: 點 [$100 啟動]
    AdminApp->>API: activate(uid, name, tier, invoiceNo, token)
    API->>API: 驗 token、檢查發票必填
    API->>Sheet: 寫入玩家清單 A-E + L 欄
    API->>Sheet: 寫入啟動明細
    Sheet-->>API: OK
    API-->>AdminApp: { ok: true, message }
    AdminApp-->>Staff: 「✅ 已啟動：XXX · 發票 ABXXX」

    Note over PlayerApp,API: 下一次 8 秒 poll
    PlayerApp->>API: playerCheck(uid)
    API->>Sheet: 查詢 uid
    Sheet-->>API: activated, tier=$200
    API-->>PlayerApp: { activated: true, tier, name }
    PlayerApp->>PlayerApp: 🏴‍☠️ 歡迎參賽！跳轉遊戲畫面
```

---

## 9. 站點掃描完整流程

```mermaid
sequenceDiagram
    actor Customer as 客人
    participant PlayerApp as 玩家手機
    participant Cam as 手機相機

    Customer->>PlayerApp: 進入遊戲畫面
    Customer->>PlayerApp: 點 [📷 掃描關卡 QR]
    PlayerApp->>Cam: openScanner()
    Cam-->>PlayerApp: 啟動相機（後置）
    Customer->>Cam: 對準現場 QR
    Cam-->>PlayerApp: 解碼 → ?sid=3
    PlayerApp->>PlayerApp: extractSid → 3
    PlayerApp->>PlayerApp: markStationFound(3)
    PlayerApp->>PlayerApp: 寫入 localStorage scanLogs
    PlayerApp-->>Customer: 💎 跳大彈窗「恭喜找到中國城最後一家店的收據！」
    Customer->>PlayerApp: 繼續玩...
```

---

## 10. 大獎抽籤完整流程

```mermaid
sequenceDiagram
    actor Org as 主辦方
    participant Admin as admin.html
    participant API as Apps Script
    participant Sheet as Google Sheet
    participant Screen as 大螢幕 screen.html

    Org->>Admin: 「🎲 過 7 關大獎抽籤」
    Admin->>API: eligible200(token)
    API->>Sheet: 篩 $200 + 完成 7 關 + 未中過
    API-->>Admin: count + list
    Admin-->>Org: 顯示可抽人數
    Org->>Admin: 輸入「第 1 輪 (12:00)」「抽 5 位」
    Org->>Admin: 點 [🎲 開始抽獎]
    Admin->>API: draw200(round, count, token)
    API->>API: requireRole(organizer)
    API->>API: Fisher-Yates 洗牌
    API->>Sheet: 寫入玩家清單 I/J 欄
    API->>Sheet: 寫入大獎抽獎記錄
    Sheet-->>API: OK
    API-->>Admin: { winners }
    Admin-->>Org: 顯示中獎名單

    Note over Screen,API: 大螢幕 10 秒輪詢
    Screen->>API: lotteryLog (公開)
    API-->>Screen: 最新一輪 + winners
    Screen->>Screen: 偵測 5 分鐘內 + 未演過
    Screen->>Screen: 🎬 播放 13 秒開獎儀式
    Screen-->>Screen: 顯示中獎名單（隱碼）
```
