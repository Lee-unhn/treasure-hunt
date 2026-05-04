/**
 * 尋寶獵人 2026 — Apps Script 後端
 *
 * 部署：擴充功能 → Apps Script → 貼上本檔 → 部署 → 新增部署作業
 *       類型: 網頁應用程式
 *       執行身份: 我
 *       存取權: 任何人
 *       → 取得 Web App URL，貼到 admin 前端的 API_URL
 *
 * 改密碼：把明文密碼貼到下方 helper passwordHash() 跑一下，貼回 Sheet 第 4 分頁 B 欄
 */

const SHEET_PLAYERS = '玩家清單';
const SHEET_LOTTERY_LOG = '大獎抽獎記錄';
const SHEET_ACTIVATION_LOG = '啟動明細';
const SHEET_STAFF = '工作人員';
const SHEET_SETTINGS = '設定';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// ============== Web App entry ==============

function doGet(e) {
  return jsonResponse({ ok: false, error: 'Use POST' });
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'invalid JSON' });
  }
  const action = body.action || '';
  try {
    switch (action) {
      case 'login':         return jsonResponse(actionLogin(body));
      case 'playerCheck':   return jsonResponse(actionPlayerCheck(body));
      case 'activate':      return jsonResponse(actionActivate(body));
      case 'lottery100':    return jsonResponse(actionLottery100(body));
      case 'claim':         return jsonResponse(actionClaim(body));
      case 'draw200':       return jsonResponse(actionDraw200(body));
      case 'eligible200':   return jsonResponse(actionEligible200(body));
      case 'note':          return jsonResponse(actionNote(body));
      case 'stats':         return jsonResponse(actionStats(body));
      case 'lookup':        return jsonResponse(actionLookup(body));
      case 'lotteryLog':    return jsonResponse(actionLotteryLog(body));
      default:              return jsonResponse({ ok: false, error: 'unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============== Auth ==============

function actionLogin(body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  if (!username || !password) return { ok: false, error: '帳密不可空白' };
  const staff = getStaffSheet().getDataRange().getValues();
  for (let i = 1; i < staff.length; i++) {
    const [u, hash, role, name] = staff[i];
    if (u === username && hash === sha256(password)) {
      const token = Utilities.getUuid();
      const cache = CacheService.getScriptCache();
      cache.put('tok:' + token, JSON.stringify({ u: username, r: role, n: name, t: Date.now() }), TOKEN_TTL_MS / 1000);
      return { ok: true, token, role, name };
    }
  }
  return { ok: false, error: '帳號或密碼錯誤' };
}

// ============== 玩家自助查詢（無需登入，只回最少資訊）==============

function actionPlayerCheck(body) {
  const uid = String(body.uid || '').trim();
  if (!uid) throw new Error('uid required');
  const players = getPlayersSheet();
  const row = findRowByUid(players, uid);
  if (row <= 0) return { ok: true, activated: false };
  const data = players.getRange(row, 1, 1, 5).getValues()[0];
  return {
    ok: true,
    activated: true,
    tier: String(data[2] || '').replace('$', ''),
    name: String(data[1] || '')
  };
}

function authOf(body) {
  const token = String(body.token || '');
  if (!token) throw new Error('missing token');
  const raw = CacheService.getScriptCache().get('tok:' + token);
  if (!raw) throw new Error('token expired, please re-login');
  const sess = JSON.parse(raw);
  return sess; // { u, r, n, t }
}

function requireRole(sess, ...allowed) {
  if (!allowed.includes(sess.r)) throw new Error('權限不足');
}

// ============== Activate ==============

function actionActivate(body) {
  const sess = authOf(body);
  const uid = String(body.uid || '').trim();
  const name = String(body.name || '').trim();
  const tier = String(body.tier || '').trim();
  if (!uid) throw new Error('uid 必填');
  if (!name) throw new Error('姓名必填');
  if (tier !== '100' && tier !== '200') throw new Error('卡別需為 100 或 200');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const players = getPlayersSheet();
    const existing = findRowByUid(players, uid);
    if (existing > 0) {
      const tierExisting = players.getRange(existing, 3).getValue();
      throw new Error(`此 UID 已啟動為 $${tierExisting} 卡（` + players.getRange(existing, 4).getValue() + '）');
    }
    const now = new Date();
    players.appendRow([uid, name, '$' + tier, now, sess.n, '', '', '', '', '', '']);
    getActivationLogSheet().appendRow([now, uid, name, '$' + tier, sess.n]);
    return { ok: true, message: `已啟動：${name} ($${tier})` };
  } finally {
    lock.releaseLock();
  }
}

// ============== $100 instant lottery ==============

function actionLottery100(body) {
  const sess = authOf(body);
  const uid = String(body.uid || '').trim();
  const points = Number(body.points || 0);
  if (!uid) throw new Error('uid 必填');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const players = getPlayersSheet();
    const row = findRowByUid(players, uid);
    if (row <= 0) return { ok: false, status: 'not_registered', message: '查無此 UID（未付費啟動）' };
    const data = players.getRange(row, 1, 1, 11).getValues()[0];
    const [, name, tier, , , doneN, , drawnAt] = data;
    const settings = getSettings();
    const threshold = Number(settings.$100抽獎門檻關數 || 3);

    if (tier !== '$100' && tier !== '$200') return { ok: false, status: 'wrong_tier', message: '此卡別不適用' };
    // points 來自 QR；以「Sheet 已記錄完成關數」與「客戶端送來的 points」取大者
    const effectivePoints = Math.max(Number(doneN || 0), points);
    if (effectivePoints < threshold) {
      return { ok: false, status: 'not_enough', message: `尚未達 ${threshold} 關（目前 ${effectivePoints}）`, points: effectivePoints, name };
    }
    if (drawnAt) {
      return { ok: false, status: 'already_drawn', message: `已抽過獎（${formatDate(drawnAt)}）`, name };
    }
    const now = new Date();
    players.getRange(row, 8).setValue(now); // H 欄
    return { ok: true, message: `${name} 可抽 $100 獎`, name, tier, points: effectivePoints, drawnAt: now };
  } finally {
    lock.releaseLock();
  }
}

// ============== Claim (verify) ==============

function actionClaim(body) {
  const sess = authOf(body);
  const uid = String(body.uid || '').trim();
  const points = Number(body.points || 0);
  if (!uid) throw new Error('uid 必填');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const players = getPlayersSheet();
    const row = findRowByUid(players, uid);
    if (row <= 0) return { ok: false, status: 'not_registered', message: '查無此 UID（未付費啟動）→ 不發獎' };
    const data = players.getRange(row, 1, 1, 11).getValues()[0];
    const [, name, tier, , , prevDone] = data;
    const newDone = Math.max(Number(prevDone || 0), points);
    const now = new Date();
    players.getRange(row, 6).setValue(newDone); // F: 完成關數
    if (!data[6]) players.getRange(row, 7).setValue(now); // G: 完成時間（首次）

    const settings = getSettings();
    const basicTh = Number(settings.$100抽獎門檻關數 || 3);
    const fullTh = Number(settings.$200大獎門檻關數 || 7);
    const eligibility = {
      basic: newDone >= basicTh,
      lottery100: tier === '$100' && newDone >= basicTh && !data[7],
      grandPool: tier === '$200' && newDone >= fullTh && !data[8]
    };
    return { ok: true, name, tier, points: newDone, eligibility, alreadyWon: !!data[8], wonRound: data[8] || null };
  } finally {
    lock.releaseLock();
  }
}

// ============== $200 grand prize draw ==============

function actionDraw200(body) {
  const sess = authOf(body);
  requireRole(sess, 'organizer');
  const round = String(body.round || '').trim();
  const count = Number(body.count || 0);
  if (!round) throw new Error('輪次名稱必填（如：第 1 輪 12:00）');
  if (count < 1) throw new Error('抽出人數 ≥ 1');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const players = getPlayersSheet();
    const settings = getSettings();
    const fullTh = Number(settings.$200大獎門檻關數 || 7);
    const data = players.getDataRange().getValues();
    const eligible = []; // {row, uid, name}
    let alreadyWon = 0;
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const tier = r[2], done = Number(r[5] || 0), wonRound = r[8];
      if (tier === '$200' && done >= fullTh) {
        if (wonRound) alreadyWon++;
        else eligible.push({ row: i + 1, uid: r[0], name: r[1] });
      }
    }
    if (eligible.length < count) {
      throw new Error(`合資格人數 ${eligible.length} 少於要抽的 ${count}`);
    }
    // Fisher–Yates
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    const winners = eligible.slice(0, count);
    const now = new Date();
    winners.forEach(w => {
      players.getRange(w.row, 9).setValue(round); // I
      players.getRange(w.row, 10).setValue(now);  // J
    });
    getLotteryLogSheet().appendRow([
      round, now, sess.n,
      eligible.length + alreadyWon,
      alreadyWon,
      winners.length,
      winners.map(w => w.uid).join(', ')
    ]);
    return { ok: true, round, winners: winners.map(w => ({ uid: w.uid, name: w.name })), drawnAt: now };
  } finally {
    lock.releaseLock();
  }
}

function actionEligible200(body) {
  authOf(body);
  const players = getPlayersSheet();
  const settings = getSettings();
  const fullTh = Number(settings.$200大獎門檻關數 || 7);
  const data = players.getDataRange().getValues();
  const eligible = [];
  let alreadyWon = 0;
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (r[2] === '$200' && Number(r[5] || 0) >= fullTh) {
      if (r[8]) alreadyWon++;
      else eligible.push({ uid: r[0], name: r[1] });
    }
  }
  return { ok: true, eligible, count: eligible.length, alreadyWon };
}

// ============== Notes / Stats / Lookup ==============

function actionNote(body) {
  authOf(body);
  const uid = String(body.uid || '').trim();
  const note = String(body.note || '');
  const players = getPlayersSheet();
  const row = findRowByUid(players, uid);
  if (row <= 0) throw new Error('查無 UID');
  players.getRange(row, 11).setValue(note);
  return { ok: true };
}

function actionLookup(body) {
  authOf(body);
  const uid = String(body.uid || '').trim();
  const players = getPlayersSheet();
  const row = findRowByUid(players, uid);
  if (row <= 0) return { ok: false, error: '查無 UID' };
  const r = players.getRange(row, 1, 1, 11).getValues()[0];
  return {
    ok: true, uid: r[0], name: r[1], tier: r[2],
    activatedAt: r[3], activatedBy: r[4],
    points: Number(r[5] || 0), completedAt: r[6],
    lottery100At: r[7], grandRound: r[8], grandAt: r[9],
    note: r[10]
  };
}

function actionStats(body) {
  authOf(body);
  const players = getPlayersSheet();
  const data = players.getDataRange().getValues();
  let total = 0, t100 = 0, t200 = 0, completed3 = 0, completed7 = 0,
      drew100 = 0, won200 = 0;
  const recent100 = []; // {name, at}
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    total++;
    if (r[2] === '$100') t100++;
    if (r[2] === '$200') t200++;
    const pts = Number(r[5] || 0);
    if (pts >= 3) completed3++;
    if (pts >= 7) completed7++;
    if (r[7]) {
      drew100++;
      recent100.push({ name: String(r[1] || '?'), at: r[7] });
    }
    if (r[8]) won200++;
  }
  // 近 10 位 $100 抽獎中獎者，依時間倒序
  recent100.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const recent100Winners = recent100.slice(0, 10).map(w => w.name);
  // 活動名稱
  const settings = getSettings();
  const eventName = String(settings['活動名稱'] || '尋寶獵人');
  return { ok: true, total, t100, t200, completed3, completed7, drew100, won200, recent100Winners, eventName };
}

function actionLotteryLog(body) {
  authOf(body);
  const sheet = getLotteryLogSheet();
  const data = sheet.getDataRange().getValues();
  // 建立 uid → name 對照
  const players = getPlayersSheet().getDataRange().getValues();
  const uidToName = {};
  for (let i = 1; i < players.length; i++) {
    if (players[i][0]) uidToName[players[i][0]] = String(players[i][1] || '');
  }
  const rows = [];
  for (let i = Math.max(1, data.length - 50); i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    const uids = String(r[6] || '').split(',').map(s => s.trim()).filter(Boolean);
    const winners = uids.map(uid => ({ uid, name: uidToName[uid] || '?' }));
    rows.push({
      round: r[0], at: r[1], by: r[2],
      eligibleSnapshot: r[3], excludedWon: r[4], drewCount: r[5],
      winners
    });
  }
  return { ok: true, rows };
}

// ============== Sheet helpers ==============

function ss() { return SpreadsheetApp.getActive(); }
function getPlayersSheet() { return ss().getSheetByName(SHEET_PLAYERS); }
function getLotteryLogSheet() { return ss().getSheetByName(SHEET_LOTTERY_LOG); }
function getActivationLogSheet() { return ss().getSheetByName(SHEET_ACTIVATION_LOG); }
function getStaffSheet() { return ss().getSheetByName(SHEET_STAFF); }

function getSettings() {
  const sheet = ss().getSheetByName(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) out[data[i][0]] = data[i][1];
  }
  return out;
}

function findRowByUid(sheet, uid) {
  const col = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (let i = 1; i < col.length; i++) if (col[i][0] === uid) return i + 1;
  return -1;
}

function formatDate(d) {
  if (!d) return '';
  return Utilities.formatDate(new Date(d), 'Asia/Taipei', 'MM/dd HH:mm');
}

// ============== Crypto ==============

function sha256(text) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** ★ 用法：在 Apps Script 編輯器手動跑這個函式，把回傳值貼到 Sheet 第 4 分頁 B 欄 */
function passwordHash() {
  const password = 'change-me'; // ← 改這裡
  Logger.log(sha256(password));
}

/**
 * ★★ 一鍵改密碼 ★★
 *
 * 用法：
 *   1. 改下面兩行的 username 和 newPassword
 *   2. 上方下拉選 setMyPassword → ▶ 執行
 *   3. 完成！直接用新密碼登入後台即可
 *
 * 不用回 Sheet 貼 hash、不用重部署 Web App。
 */
function setMyPassword() {
  const username = 'admin';      // ← 要改誰的密碼？(admin / s01 / s02 ...)
  const newPassword = '我的新密碼'; // ← 換成您想設的密碼

  const sheet = getStaffSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.getRange(i + 1, 2).setValue(sha256(newPassword));
      Logger.log(`✅ ${username} 的密碼已更新為「${newPassword}」`);
      return;
    }
  }
  Logger.log(`❌ 找不到帳號「${username}」。請先在「工作人員」分頁新增該帳號。`);
}

/**
 * ★ 一鍵新增工作人員（含密碼）★
 *
 * 用法：
 *   1. 改下面四行
 *   2. 執行
 */
function addStaff() {
  const username    = 's03';        // ← 帳號（不能跟現有重複）
  const newPassword = 'mypass';     // ← 密碼
  const role        = 'staff';      // ← 'staff' 或 'organizer'
  const displayName = '小華';       // ← 顯示名稱

  const sheet = getStaffSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      Logger.log(`❌ 帳號「${username}」已存在。請改用 setMyPassword 改密碼，或換不同帳號。`);
      return;
    }
  }
  sheet.appendRow([username, sha256(newPassword), role, displayName]);
  Logger.log(`✅ 新增帳號「${username}」(${role}) 完成，密碼為「${newPassword}」`);
}

// ============== 一鍵建表 ==============

/**
 * ★ 第一次部署時跑一次：自動建立所有分頁與欄位名稱、凍結首列、設定預設值
 *   重複執行也安全：已存在的分頁會跳過，不會覆蓋資料
 */
function setupSheets() {
  const wb = ss();
  const log = [];

  const schema = [
    {
      name: SHEET_PLAYERS,
      headers: ['UID', '姓名', '卡別', '啟動時間', '啟動服務員',
                '完成關數', '完成時間', '$100抽獎時間',
                '大獎中獎輪次', '大獎中獎時間', '領獎/備註'],
      colWidths: [130, 100, 70, 145, 100, 80, 145, 145, 110, 145, 200]
    },
    {
      name: SHEET_LOTTERY_LOG,
      headers: ['抽獎輪次', '執行時間', '抽獎人', '合資格人數',
                '已中獎排除', '本輪抽出', '中獎 UIDs'],
      colWidths: [130, 145, 90, 90, 90, 90, 400]
    },
    {
      name: SHEET_ACTIVATION_LOG,
      headers: ['時間', 'UID', '姓名', '卡別', '服務員'],
      colWidths: [145, 130, 100, 70, 100]
    },
    {
      name: SHEET_STAFF,
      headers: ['帳號', '密碼 (sha256)', '角色', '顯示名稱'],
      colWidths: [100, 530, 90, 100],
      seedRows: [
        // 預設密碼皆為 "change-me"，請務必跑 passwordHash() 改掉
        ['admin', sha256('change-me'), 'organizer', '主辦方'],
        ['s01', sha256('change-me'), 'staff', '服務員1'],
        ['s02', sha256('change-me'), 'staff', '服務員2']
      ]
    },
    {
      name: SHEET_SETTINGS,
      headers: ['參數', '值'],
      colWidths: [200, 200],
      seedRows: [
        ['大獎每輪人數', 5],
        ['$100抽獎門檻關數', 3],
        ['$200大獎門檻關數', 7],
        ['活動名稱', '2026 春季尋寶']
      ]
    }
  ];

  schema.forEach(spec => {
    let sheet = wb.getSheetByName(spec.name);
    if (sheet) {
      log.push(`[skip] ${spec.name} 已存在`);
      return;
    }
    sheet = wb.insertSheet(spec.name);
    // 標題列
    sheet.getRange(1, 1, 1, spec.headers.length).setValues([spec.headers])
      .setFontWeight('bold').setBackground('#fff8e6').setHorizontalAlignment('center');
    // 凍結首列
    sheet.setFrozenRows(1);
    // 欄寬
    spec.colWidths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
    // 預填資料
    if (spec.seedRows && spec.seedRows.length) {
      sheet.getRange(2, 1, spec.seedRows.length, spec.seedRows[0].length).setValues(spec.seedRows);
    }
    // 刪掉多餘欄
    const maxCol = sheet.getMaxColumns();
    if (maxCol > spec.headers.length) {
      sheet.deleteColumns(spec.headers.length + 1, maxCol - spec.headers.length);
    }
    log.push(`[created] ${spec.name}（${spec.headers.length} 欄${spec.seedRows ? `，含 ${spec.seedRows.length} 筆預設` : ''}）`);
  });

  // 把預設的「工作表 1」刪掉（如果存在）
  const def = wb.getSheetByName('工作表1') || wb.getSheetByName('Sheet1');
  if (def && wb.getSheets().length > 1) {
    wb.deleteSheet(def);
    log.push('[cleanup] 刪除預設「工作表1」');
  }

  Logger.log(log.join('\n'));
  return log;
}
