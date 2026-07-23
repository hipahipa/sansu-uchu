/* =====================================================================
   app.js  ―  画面・出題・採点・演出・つまずき記録
   ===================================================================== */

/* ---------- 保存（ユーザー別） ----------
   store = { currentUser: 名前, users: { 名前: {profile, topics, missLog, history} } }
   save  = いま使っているユーザーのデータ（従来と同じ形） */
const STORE_KEY = "sansu_save_v3";
const store = loadStore();
if (!store.rankings) store.rankings = {};   // 単元ごとの得点ランキング { topicId: [{name, score, d}] }
let save = store.currentUser ? store.users[store.currentUser] : null;

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.users) return s;
  } catch {}
  // 旧形式(v2)からの引きこし
  try {
    const old = JSON.parse(localStorage.getItem("sansu_save_v2"));
    if (old && old.profile && old.profile.name) {
      const s = { currentUser: old.profile.name, users: { [old.profile.name]: old } };
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      localStorage.removeItem("sansu_save_v2");
      return s;
    }
  } catch {}
  return { currentUser: null, users: {} };
}
function freshUser(name, grade) {
  return { profile: { name, grade }, topics: {}, missLog: {}, history: [] };
}
function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }

// HTML に名前を出すときのエスケープ
function esc(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function topicSave(id) {
  if (!save.topics[id]) save.topics[id] = { best: 0, bestStreak: 0, played: 0, correct: 0 };
  return save.topics[id];
}

/* ---------- 学年・★・アンロック ---------- */
function gradeNum(t) { return t.grade === "受験" ? 7 : parseInt(t.grade, 10); }
function gradeLabel(g) { return g === 7 ? "じゅけんレベル" : `${g}年生`; }
// ★はベストスコアから算出：10点=★5、8-9=★4、6-7=★3、4-5=★2、2-3=★1
function starsOf(id) {
  const b = ((save && save.topics[id]) || {}).best || 0;
  return b >= 10 ? 5 : Math.floor(b / 2);
}
function starRow(n) { return "⭐".repeat(n) + "☆".repeat(5 - n); }
function totalStars() { return TOPICS.reduce((a, t) => a + starsOf(t.id), 0); }
// 見られる学年の上限。
// 4年生以上で登録しても 3年生までと同じ扱いでスタートし、
// 表示中の全単元が★5なら 1学年ずつ上へ開いていく。
const UNLOCK_STARS = 4;   // 学年が開く条件：その学年までの全単元が ★4 以上
function unlockedMax() {
  if (!save || !save.profile) return 6;
  let g = Math.min(save.profile.grade, 3);
  while (g < 7 && TOPICS.filter((t) => gradeNum(t) <= g).every((t) => starsOf(t.id) >= UNLOCK_STARS)) g++;
  return g;
}

// パスワードの簡易ハッシュ（端末内保存用）
function hashPw(pw) {
  const s = pw + "sansu-hunter-salt";
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/* ---------- マスコット：顔のある太陽「ソル先生」（SVG） ---------- */
function sunSVG(mood = "normal") {
  let face;
  if (mood === "happy") {
    // 目を閉じて大わらい
    face = `
      <path d="M45 51 Q50 45 55 51" class="sun-line"/>
      <path d="M65 51 Q70 45 75 51" class="sun-line"/>
      <path d="M48 60 Q60 74 72 60 Q60 65 48 60 Z" fill="#7c2d12"/>
      <circle cx="42" cy="60" r="4.5" fill="#fb923c" opacity=".75"/>
      <circle cx="78" cy="60" r="4.5" fill="#fb923c" opacity=".75"/>`;
  } else if (mood === "think") {
    // 上目づかい＋かた眉上げ＋汗
    face = `
      <path d="M43 42 Q49 38 55 43" class="sun-line"/>
      <path d="M65 46 Q71 44 77 46" class="sun-line"/>
      <circle cx="49" cy="51" r="3.4" fill="#7c2d12"/>
      <circle cx="69" cy="51" r="3.4" fill="#7c2d12"/>
      <circle cx="50.2" cy="49.8" r="1.1" fill="#fff8e1"/>
      <circle cx="70.2" cy="49.8" r="1.1" fill="#fff8e1"/>
      <path d="M53 66 Q60 63 67 66" class="sun-line"/>
      <path d="M90 36 q4.5 6.5 0 9.5 q-4.5 -3 0 -9.5" fill="#7dd3fc"/>`;
  } else {
    // おだやかスマイル
    face = `
      <path d="M44 45 Q50 42 56 45" class="sun-line"/>
      <path d="M64 45 Q70 42 76 45" class="sun-line"/>
      <circle cx="50" cy="52" r="3.4" fill="#7c2d12"/>
      <circle cx="70" cy="52" r="3.4" fill="#7c2d12"/>
      <circle cx="51.2" cy="50.8" r="1.1" fill="#fff8e1"/>
      <circle cx="71.2" cy="50.8" r="1.1" fill="#fff8e1"/>
      <path d="M50 63 Q60 70 70 63" class="sun-line"/>
      <circle cx="43" cy="59" r="4" fill="#fb923c" opacity=".6"/>
      <circle cx="77" cy="59" r="4" fill="#fb923c" opacity=".6"/>`;
  }
  // 12方向の光線
  let rays = "";
  for (let i = 0; i < 12; i++) {
    rays += `<path d="M60 3 L66.5 20 L53.5 20 Z" transform="rotate(${i * 30} 60 60)" fill="url(#sunrays-${mood})"/>`;
  }
  return `
  <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="sun" aria-hidden="true">
    <defs>
      <radialGradient id="suncore-${mood}" cx="42%" cy="38%" r="70%">
        <stop offset="0" stop-color="#fff3c4"/>
        <stop offset=".55" stop-color="#fcd34d"/>
        <stop offset="1" stop-color="#f59e0b"/>
      </radialGradient>
      <linearGradient id="sunrays-${mood}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fde047"/>
        <stop offset="1" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    ${rays}
    <circle cx="60" cy="60" r="33" fill="url(#suncore-${mood})" stroke="#d97706" stroke-width="1.5"/>
    ${face}
  </svg>`;
}
const SUN = { normal: sunSVG("normal"), happy: sunSVG("happy"), think: sunSVG("think") };
const MASCOT = SUN.normal;

/* ---------- 背景：またたく星空 ---------- */
function initStars() {
  const box = document.createElement("div");
  box.className = "space-stars";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 90; i++) {
    const s = document.createElement("span");
    const size = Math.random() < 0.85 ? 1 + Math.random() * 1.6 : 2.4 + Math.random() * 1.8;
    s.style.width = s.style.height = size.toFixed(1) + "px";
    s.style.left = (Math.random() * 100) + "%";
    s.style.top = (Math.random() * 100) + "%";
    s.style.animationDelay = (Math.random() * 4) + "s";
    s.style.animationDuration = (2.5 + Math.random() * 3.5) + "s";
    const roll = Math.random();
    if (roll < 0.12) s.style.background = "#fde68a";        // 金色の星
    else if (roll < 0.28) s.style.background = "#a5b4fc";   // 青白い星
    box.appendChild(s);
  }
  document.body.appendChild(box);
}
const CHEERS = ["やったね！", "その調子！", "すごい！", "バッチリ！", "冴えてる！", "天才かも！"];
const STREAK_CHEERS = { 3: "3れんぞく！🔥", 5: "5れんぞく！すごい！⭐", 10: "10れんぞく！はかせ級！👑" };

/* ---------- 効果音（Web Audio・音声ファイル不要） ---------- */
let audioCtx = null;
function getAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function tone(freq, delay, dur, type = "sine", vol = 0.22) {
  const ctx = getAudio();
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = ctx.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
// ピンポン♪（正解）
function playPinpon() { tone(1046.5, 0, 0.16); tone(1318.5, 0.16, 0.45); }
// ブブー（不正解）
function playBubu() { tone(120, 0, 0.16, "square", 0.15); tone(95, 0.2, 0.4, "square", 0.15); }

/* ---------- DOM 参照 ---------- */
const app = document.getElementById("app");

/* ---------- 画面右上の「TOP画面へ」ボタン ---------- */
function topRowHTML() {
  return `<div class="top-row"><button class="top-btn" id="topBtn">TOP画面へ</button></div>`;
}
function wireTopBtn() {
  const b = document.getElementById("topBtn");
  if (b) b.addEventListener("click", renderProfileSetup);
}

/* ==================== TOP画面（ログイン／ゲスト） ==================== */
// 新規登録はTOPからはできない。アカウント作成は管理者画面からのみ。
const ADMIN_ID = "あるこじゅく";
const ADMIN_PW_HASH = "921170065";
// ゲストが遊べる単元。この順に、★4いじょうをとるごとに 次の1単元が現れる。
const GUEST_TOPICS = ["add-sub-100", "kuku", "dec-add-sub", "reduce", "unit-convert"];
// ゲストで いま見えている単元（★4以上を達成した数＋1つ先まで）
function guestVisibleIds() {
  let n = 1;
  for (const id of GUEST_TOPICS) {
    if (starsOf(id) >= UNLOCK_STARS) n++; else break;
  }
  return GUEST_TOPICS.slice(0, Math.min(n, GUEST_TOPICS.length));
}

/* ---------- 単元アイコン：実在の天体（名前・色・種類） ---------- */
const STARS = {
  "add-sub-20":     { name: "月",           kind: "moon",    c1: "#efece0", c2: "#a8a495" },
  "add-sub-100":    { name: "金星",         kind: "venus",   c1: "#ffedc4", c2: "#d29a4b" },
  "kuku":           { name: "火星",         kind: "mars",    c1: "#f0956a", c2: "#b8431f" },
  "div-rem":        { name: "水星",         kind: "mercury", c1: "#cfc7bb", c2: "#847668" },
  "mul-2x1":        { name: "木星",         kind: "jupiter", c1: "#f0dcbb", c2: "#c08a4e" },
  "div-long":       { name: "土星",         kind: "saturn",  c1: "#f3e0ae", c2: "#c49b58" },
  "dec-add-sub":    { name: "天王星",       kind: "uranus",  c1: "#d9f6f4", c2: "#5cc0cd" },
  "dec-mul-div":    { name: "海王星",       kind: "neptune", c1: "#8db4ff", c2: "#2e50c9" },
  "frac-same":      { name: "冥王星",       kind: "pluto",   c1: "#e6cfae", c2: "#96714f" },
  "reduce":         { name: "シリウス",     kind: "star",    c1: "#ffffff", c2: "#8ab8ff" },
  "common-denom":   { name: "ベガ",         kind: "star",    c1: "#f2f8ff", c2: "#6fa8e8" },
  "frac-mul-div":   { name: "アルタイル",   kind: "star",    c1: "#ffffff", c2: "#a8bfd2" },
  "angle":          { name: "北極星",       kind: "star",    c1: "#fffbe8", c2: "#e0c96e" },
  "area-rect":      { name: "アンタレス",   kind: "star",    c1: "#ffc9a8", c2: "#d84a26" },
  "area-triangle":  { name: "ベテルギウス", kind: "star",    c1: "#ffd0ab", c2: "#e05c1d" },
  "area-trapezoid": { name: "リゲル",       kind: "star",    c1: "#eef5ff", c2: "#5b88ec" },
  "circle":         { name: "デネブ",       kind: "star",    c1: "#f7fbff", c2: "#88a5e0" },
  "volume":         { name: "アルデバラン", kind: "star",    c1: "#ffe0ae", c2: "#e0862e" },
  "trees":          { name: "スピカ",       kind: "star",    c1: "#eef6ff", c2: "#679ae8" },
  "elimination":    { name: "カペラ",       kind: "star",    c1: "#fff8d6", c2: "#e0b545" },
  "ratio":          { name: "プロキオン",   kind: "star",    c1: "#fffef4", c2: "#d4c078" },
  "percentage":     { name: "レグルス",     kind: "star",    c1: "#f2f8ff", c2: "#7aa5e8" },
  "speed":          { name: "ハレーすい星", kind: "comet",   c1: "#eafaff", c2: "#66b5d6" },
};

/* ---------- 天体SVG：実際の見た目に寄せた描画 ---------- */
function starIcon(id) {
  const st = STARS[id] || { kind: "star", c1: "#fff", c2: "#889" };
  const u = "si-" + id;
  const defs = `
    <defs>
      <radialGradient id="${u}" cx="35%" cy="30%" r="80%">
        <stop offset="0" stop-color="${st.c1}"/>
        <stop offset=".55" stop-color="${st.c2}"/>
        <stop offset="1" stop-color="#1a1208" stop-opacity=".78"/>
      </radialGradient>
      <radialGradient id="${u}-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${st.c1}"/>
        <stop offset=".45" stop-color="${st.c2}" stop-opacity=".55"/>
        <stop offset="1" stop-color="${st.c2}" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="${u}-c"><circle cx="36" cy="36" r="20"/></clipPath>
    </defs>`;
  const sphere = `<circle cx="36" cy="36" r="20" fill="url(#${u})"/>`;
  const wrap = (inner) =>
    `<svg viewBox="0 0 72 72" class="body-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${defs}${inner}</svg>`;
  const k = st.kind;

  if (k === "moon") {
    // 海（暗い模様）とクレーター
    return wrap(`${sphere}
      <g clip-path="url(#${u}-c)" fill="#75725f" opacity=".5">
        <ellipse cx="30" cy="29" rx="8" ry="5.5"/>
        <ellipse cx="42" cy="39" rx="5.5" ry="4"/>
        <ellipse cx="27" cy="42" rx="4" ry="3"/>
      </g>
      <g clip-path="url(#${u}-c)" fill="none" stroke="#75725f" stroke-width="1.1" opacity=".5">
        <circle cx="44" cy="26" r="2.6"/>
        <circle cx="36" cy="47" r="2"/>
        <circle cx="21" cy="33" r="1.6"/>
      </g>`);
  }
  if (k === "mercury") {
    return wrap(`${sphere}
      <g clip-path="url(#${u}-c)" fill="#5e5347" opacity=".45">
        <circle cx="29" cy="30" r="3"/>
        <circle cx="42" cy="40" r="2.4"/>
        <circle cx="38" cy="25" r="1.7"/>
        <circle cx="25" cy="42" r="2"/>
        <circle cx="45" cy="31" r="1.4"/>
      </g>`);
  }
  if (k === "venus") {
    // 雲のうずまき
    return wrap(`${sphere}
      <g clip-path="url(#${u}-c)" fill="none" stroke="#e8ba6d" stroke-width="3.2" stroke-linecap="round" opacity=".55">
        <path d="M15 29 Q32 22 56 30"/>
        <path d="M14 38 Q36 33 57 40"/>
        <path d="M18 47 Q38 43 54 49"/>
      </g>`);
  }
  if (k === "mars") {
    // 暗い地形と極冠
    return wrap(`${sphere}
      <g clip-path="url(#${u}-c)" fill="#7e2913" opacity=".5">
        <path d="M20 34 Q29 27 41 33 Q34 41 22 38 Z"/>
        <ellipse cx="45" cy="42" rx="6" ry="3.5"/>
      </g>
      <ellipse cx="35" cy="18" rx="7" ry="3" fill="#fff" opacity=".85" clip-path="url(#${u}-c)"/>`);
  }
  if (k === "jupiter") {
    // 縞もようと大赤斑
    return wrap(`${sphere}
      <g clip-path="url(#${u}-c)">
        <rect x="14" y="22.5" width="44" height="3.4" fill="#b5793c" opacity=".55"/>
        <rect x="14" y="29" width="44" height="4.2" fill="#8a5a2b" opacity=".6"/>
        <rect x="14" y="37" width="44" height="3.4" fill="#b5793c" opacity=".55"/>
        <rect x="14" y="44" width="44" height="4" fill="#8a5a2b" opacity=".5"/>
        <rect x="14" y="51" width="44" height="2.6" fill="#b5793c" opacity=".45"/>
        <ellipse cx="43" cy="41.5" rx="5.2" ry="3.4" fill="#d84b2a" opacity=".95"/>
        <ellipse cx="43" cy="41.5" rx="2.6" ry="1.6" fill="#f0906a"/>
      </g>`);
  }
  if (k === "saturn") {
    // 縞もよu＋大きな環
    return wrap(`
      <g transform="rotate(-16 36 36)">
        <ellipse cx="36" cy="36" rx="33" ry="9.5" fill="none" stroke="#d9b878" stroke-width="2" opacity=".5"/>
      </g>
      ${sphere}
      <g clip-path="url(#${u}-c)">
        <rect x="14" y="26" width="44" height="3" fill="#caa15e" opacity=".5"/>
        <rect x="14" y="33" width="44" height="4" fill="#a37d43" opacity=".5"/>
        <rect x="14" y="42" width="44" height="3" fill="#caa15e" opacity=".45"/>
      </g>
      <g transform="rotate(-16 36 36)" fill="none">
        <path d="M3.5 36 a32.5 9.2 0 0 0 65 0" stroke="#e6c98a" stroke-width="3.4" opacity=".95"/>
        <path d="M8 38.5 a28 7.6 0 0 0 56 0" stroke="#b8934f" stroke-width="1.6" opacity=".8"/>
      </g>`);
  }
  if (k === "uranus") {
    // ほぼ横倒し＝縦向きの環
    return wrap(`
      <g transform="rotate(78 36 36)">
        <ellipse cx="36" cy="36" rx="30" ry="7.5" fill="none" stroke="#9adfe0" stroke-width="1.6" opacity=".5"/>
      </g>
      ${sphere}
      <g transform="rotate(78 36 36)" fill="none">
        <path d="M6 36 a30 7.5 0 0 0 60 0" stroke="#bdeeee" stroke-width="2.2" opacity=".85"/>
      </g>`);
  }
  if (k === "neptune") {
    // 大暗斑とうすい縞
    return wrap(`${sphere}
      <g clip-path="url(#${u}-c)">
        <rect x="14" y="28" width="44" height="3" fill="#1e3aa8" opacity=".5"/>
        <rect x="14" y="43" width="44" height="3.6" fill="#1e3aa8" opacity=".45"/>
        <ellipse cx="31" cy="35" rx="5.5" ry="3.4" fill="#16277d" opacity=".85"/>
        <ellipse cx="45" cy="24" rx="4" ry="1.6" fill="#e8f1ff" opacity=".6"/>
      </g>`);
  }
  if (k === "pluto") {
    // ハートもよう（トンボー地域）
    return wrap(`${sphere}
      <g clip-path="url(#${u}-c)">
        <path d="M38 34 c2.5-4.5 9-4 9 1.2 c0 4.4-6.5 7.6-9 9.8 c-2.5-2.2-9-5.4-9-9.8 c0-5.2 6.5-5.7 9-1.2 Z"
              fill="#f4e3c8" opacity=".9"/>
        <ellipse cx="27" cy="26" rx="5" ry="3.5" fill="#6e4f33" opacity=".5"/>
      </g>`);
  }
  if (k === "comet") {
    // 核＋コマ＋ちり・イオンの2本の尾
    return wrap(`
      <path d="M2 4 L40 34 L33 42 Z" fill="url(#${u}-glow)" opacity=".75"/>
      <path d="M14 2 L41 33 L36 38 Z" fill="#9fd9ff" opacity=".38"/>
      <circle cx="41" cy="40" r="13" fill="url(#${u}-glow)" opacity=".9"/>
      <circle cx="41" cy="40" r="6.5" fill="${st.c1}"/>
      <circle cx="41" cy="40" r="3.4" fill="#ffffff"/>`);
  }
  // 恒星：光芒（十字のスパイク）と輝き
  return wrap(`
    <circle cx="36" cy="36" r="22" fill="url(#${u}-glow)"/>
    <g fill="${st.c1}" opacity=".9">
      <path d="M36 4 L38.4 33 L36 68 L33.6 33 Z"/>
      <path d="M4 36 L33 33.6 L68 36 L33 38.4 Z"/>
    </g>
    <circle cx="36" cy="36" r="10" fill="${st.c2}" opacity=".6"/>
    <circle cx="36" cy="36" r="6.8" fill="${st.c1}"/>
    <circle cx="36" cy="36" r="3.6" fill="#ffffff"/>`);
}

function renderProfileSetup() {
  stopTimer();
  app.innerHTML = `
    <header class="home-head">
      <div class="mascot-big">${MASCOT}</div>
      <h1>算数で宇宙を旅しよう</h1>
      <p class="tag">IDと パスワードを 入れて ログインしてね</p>
    </header>
    <div class="setup-card">
      <label class="setup-label">ユーザーID</label>
      <input id="pname" class="setup-input" maxlength="12" placeholder="れい：はなこ" autocomplete="off">
      <label class="setup-label">パスワード</label>
      <input id="ppw" class="setup-input" type="password" maxlength="20" autocomplete="off">
      <div class="setup-err" id="setupErr"></div>
      <button class="primary-btn big-btn" id="loginBtn">ログイン</button>
      <div class="guest-sep">アカウントが なくても おためしで 遊べるよ</div>
      <button class="next-btn big-btn" id="guestBtn">🎮 ゲストで 遊ぶ<br>（たし算ひき算・九九・小数・約分・単位）</button>
    </div>
    <div class="admin-row">
      <button class="admin-btn" id="adminBtn">管理者ログイン</button>
    </div>`;

  const showErr = (msg) => {
    const e = document.getElementById("setupErr");
    e.textContent = msg; e.classList.add("show");
  };
  document.getElementById("loginBtn").addEventListener("click", () => {
    const name = document.getElementById("pname").value.trim();
    const pw = document.getElementById("ppw").value.trim();
    const u = store.users[name];
    if (!name || !pw || !u) { showErr("IDまたは パスワードが ちがうよ"); return; }
    if (!u.pw) {
      // パスワード未設定の旧アカウント → 今回の入力を登録
      if (!/^[A-Za-z0-9]{6,}$/.test(pw)) { showErr("パスワードは 半角英数字6文字以上で 入れてね"); return; }
      u.pw = hashPw(pw);
      u.pwPlain = pw;
    } else if (u.pw !== hashPw(pw)) {
      showErr("IDまたは パスワードが ちがうよ");
      return;
    } else if (!u.pwPlain) {
      u.pwPlain = pw;   // 旧形式アカウント：ログイン成功時に一覧表用へ反映
    }
    store.currentUser = name;
    save = u;
    persist();
    renderHome();
  });
  // ゲスト：記録は端末に残さない（メモリ上だけ）
  document.getElementById("guestBtn").addEventListener("click", () => {
    save = freshUser("ゲスト", 3);
    save.guest = true;
    store.currentUser = null;
    persist();
    renderHome();
  });
  document.getElementById("adminBtn").addEventListener("click", renderAdminLogin);
}

/* ==================== 管理者ログイン ==================== */
function renderAdminLogin() {
  stopTimer();
  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← もどる</button>
      <h2>🔑 管理者ログイン</h2>
    </header>
    <div class="setup-card">
      <label class="setup-label">管理者ID</label>
      <input id="aid" class="setup-input" maxlength="20" autocomplete="off">
      <label class="setup-label">パスワード</label>
      <input id="apw" class="setup-input" type="password" maxlength="30" autocomplete="off">
      <div class="setup-err" id="setupErr"></div>
      <button class="primary-btn big-btn" id="aloginBtn">ログイン</button>
    </div>`;
  document.getElementById("backBtn").addEventListener("click", renderProfileSetup);
  document.getElementById("aloginBtn").addEventListener("click", () => {
    const id = document.getElementById("aid").value.trim();
    const pw = document.getElementById("apw").value.trim();
    if (id === ADMIN_ID && hashPw(pw) === ADMIN_PW_HASH) {
      renderAdmin();
    } else {
      const e = document.getElementById("setupErr");
      e.textContent = "IDまたは パスワードが ちがいます";
      e.classList.add("show");
    }
  });
}

/* ==================== 管理者画面 ==================== */
function renderAdmin() {
  const names = Object.keys(store.users);
  // 全ユーザーの ID・パスワード一覧表
  const rows = names.map((nm) => {
    const u = store.users[nm];
    return `<tr>
      <td>${esc(nm)}</td>
      <td class="pw-cell">${u.pwPlain ? esc(u.pwPlain) : "（不明）"}</td>
      <td>${gradeLabel(u.profile.grade)}</td>
    </tr>`;
  }).join("");
  // すべての単元（学年の解放に関係なく全部）をグループごとに一覧表示
  const tgroups = {};
  TOPICS.forEach((t) => { (tgroups[t.group] ||= []).push(t); });
  const topicsHtml = Object.entries(tgroups).map(([g, list]) => `
    <div class="admin-topic-group">
      <div class="admin-topic-gname">${g}</div>
      <div class="admin-topic-grid">
        ${list.map((t) => `
          <button class="admin-topic-item" data-id="${t.id}">
            <span class="ati-emoji">${t.emoji}</span>
            <span class="ati-name">${t.name}</span>
            <span class="ati-grade">${t.grade}</span>
          </button>`).join("")}
      </div>
    </div>`).join("");

  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← TOPへ</button>
      <h2>🛠 管理者画面</h2>
    </header>
    <h3 class="sec-title">📚 ぜんぶの単元（${TOPICS.length}）— タップで開く</h3>
    <div class="admin-topics">${topicsHtml}</div>
    <div class="setup-card admin-menu">
      <button class="primary-btn big-btn" id="regBtn">user新規登録</button>
      <button class="next-btn big-btn" id="histBtn">user学習履歴</button>
    </div>
    <h3 class="sec-title">👥 ユーザー一覧（${names.length}人）</h3>
    <div class="stats-card">
      <table class="pw-table">
        <thead><tr><th>userID</th><th>パスワード</th><th>学年</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="pw-empty">まだ ユーザーがいません</td></tr>`}</tbody>
      </table>
    </div>`;
  document.getElementById("backBtn").addEventListener("click", renderProfileSetup);
  document.getElementById("regBtn").addEventListener("click", renderAdminRegister);
  document.getElementById("histBtn").addEventListener("click", renderAdminHistory);
  // 単元をタップ → プレビュー用の一時セッションで開く（実ユーザーの記録は汚さない）
  document.querySelectorAll(".admin-topic-item").forEach((b) =>
    b.addEventListener("click", () => {
      save = freshUser("管理者", 6);
      save.guest = true;
      store.currentUser = null;
      startTopic(b.dataset.id);
    }));
}

/* ---------- 管理者：user新規登録 ---------- */
function renderAdminRegister() {
  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← 管理者画面</button>
      <h2>📝 user新規登録</h2>
    </header>
    <div class="setup-card">
      <label class="setup-label">userID（ひらがな 12文字以下）</label>
      <input id="rname" class="setup-input" maxlength="12" placeholder="れい：はなこ" autocomplete="off">
      <label class="setup-label">userパスワード（半角英数 10桁）</label>
      <input id="rpw" class="setup-input" maxlength="10" placeholder="れい：abcde12345" autocomplete="off">
      <label class="setup-label">がくねん</label>
      <div class="grade-row">
        ${[1, 2, 3, 4, 5, 6].map((g) =>
          `<button class="grade-btn${g === 3 ? " sel" : ""}" data-g="${g}">${g}年</button>`).join("")}
      </div>
      <div class="setup-err" id="setupErr"></div>
      <div class="setup-ok" id="setupOk"></div>
      <button class="primary-btn big-btn" id="regGoBtn">登録する</button>
    </div>`;
  let grade = 3;
  document.querySelectorAll(".grade-btn").forEach((b) =>
    b.addEventListener("click", () => {
      grade = +b.dataset.g;
      document.querySelectorAll(".grade-btn").forEach((x) => x.classList.toggle("sel", +x.dataset.g === grade));
    }));
  document.getElementById("backBtn").addEventListener("click", renderAdmin);
  document.getElementById("regGoBtn").addEventListener("click", () => {
    const name = document.getElementById("rname").value.trim();
    const pw = document.getElementById("rpw").value.trim();
    const err = document.getElementById("setupErr"), ok = document.getElementById("setupOk");
    err.classList.remove("show"); ok.classList.remove("show");
    const showErr = (m) => { err.textContent = m; err.classList.add("show"); };
    if (!/^[ぁ-んー]{1,12}$/.test(name)) { showErr("userIDは ひらがな12文字以下 で入力してください"); return; }
    if (!/^[A-Za-z0-9]{10}$/.test(pw)) { showErr("パスワードは 半角英数字ちょうど10桁 で入力してください"); return; }
    if (store.users[name]) { showErr(`「${name}」は すでに登録されています`); return; }
    store.users[name] = freshUser(name, grade);
    store.users[name].pw = hashPw(pw);
    store.users[name].pwPlain = pw;   // 管理者一覧表で見られるように保持
    persist();
    ok.textContent = `✅ 「${name}」（${grade}年生）を登録しました。TOP画面からログインできます`;
    ok.classList.add("show");
    document.getElementById("rname").value = "";
    document.getElementById("rpw").value = "";
  });
}

/* ---------- 管理者：user学習履歴 ---------- */
function renderAdminHistory() {
  const names = Object.keys(store.users);
  let body;
  if (!names.length) {
    body = `<div class="empty">まだ ユーザーが 登録されていません</div>`;
  } else {
    body = names.map((n) => {
      const u = store.users[n];
      const played = Object.values(u.topics).reduce((a, s) => a + (s.played || 0), 0);
      const correct = Object.values(u.topics).reduce((a, s) => a + (s.correct || 0), 0);
      const stars = TOPICS.reduce((a, t) => {
        const b = (u.topics[t.id] || {}).best || 0;
        return a + (b >= 10 ? 5 : Math.floor(b / 2));
      }, 0);
      const recent = (u.history || []).slice(-5).reverse().map((h) => {
        const t = TOPICS.find((x) => x.id === h.t);
        const d = new Date(h.d);
        return `<div class="hist-row"><span>${d.getMonth() + 1}/${d.getDate()}</span><span>${t ? t.emoji + " " + t.name : h.t}</span><b>${h.score}/10</b></div>`;
      }).join("") || `<div class="hist-row none">まだ プレイ記録なし</div>`;
      const misses = Object.entries(u.missLog || {}).sort((a, b) => b[1].count - a[1].count).slice(0, 2)
        .map(([k, m]) => `<div class="hist-miss">💥 ${m.title}（${m.count}回）</div>`).join("");
      return `
        <div class="stats-card hist-user">
          <div class="profile-line">
            <b>👤 ${esc(n)}</b>
            <span class="chip">${gradeLabel(u.profile.grade)}</span>
            <span class="chip">⭐ ${stars}</span>
          </div>
          <div class="profile-line sub">といた問題 ${played}問 ／ 1回目せいかい ${correct}問${played ? `（${Math.round(correct / played * 100)}%）` : ""}</div>
          <div class="hist-list">${recent}</div>
          ${misses}
        </div>`;
    }).join("");
  }
  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← 管理者画面</button>
      <h2>📊 user学習履歴</h2>
    </header>
    ${body}`;
  document.getElementById("backBtn").addEventListener("click", renderAdmin);
}

/* ==================== ホーム画面 ==================== */
function renderHome() {
  stopTimer();
  if (!save || !save.profile) { renderProfileSetup(); return; }
  const isGuest = !!save.guest;
  const un = unlockedMax();
  const gIds = isGuest ? guestVisibleIds() : null;
  const visible = isGuest
    ? gIds.map((id) => TOPICS.find((t) => t.id === id)).filter(Boolean)
    : TOPICS.filter((t) => gradeNum(t) <= un);
  const groups = {};
  visible.forEach((t) => { (groups[t.group] ||= []).push(t); });

  // アンロック状況バナー
  let lockBanner;
  if (isGuest) {
    const cur = TOPICS.find((t) => t.id === gIds[gIds.length - 1]);
    const done = gIds.length - (starsOf(cur.id) >= UNLOCK_STARS ? 0 : 1);
    if (done >= GUEST_TOPICS.length) {
      lockBanner = `<div class="lock-banner open">🎉 ゲストの4単元 全部 ★${UNLOCK_STARS}いじょう たっせい！ アカウントを つくると もっと たくさん 遊べるよ</div>`;
    } else {
      lockBanner = `<div class="lock-banner">🎮 ゲストモード（${done}/${GUEST_TOPICS.length} クリア）：<b>${cur.name}</b> で ★${UNLOCK_STARS}いじょう（8問せいかい）を とると 次の単元が 現れるよ！ きろくは のこらないよ</div>`;
    }
  } else if (un < 7) {
    const remaining = visible.filter((t) => starsOf(t.id) < UNLOCK_STARS).length;
    lockBanner = `<div class="lock-banner">🔒 全部の単元で ★${UNLOCK_STARS}いじょう（8問せいかい）を とると、<b>${gradeLabel(un + 1)}</b> の問題が 開くよ！（のこり <b>${remaining}</b> 単元）</div>`;
  } else {
    lockBanner = `<div class="lock-banner open">🎉 すべての学年が 開いたよ！ 全部 ★5 をめざそう！</div>`;
  }

  let html = `
    <div class="hdr-row">
      <button class="hdr-btn slim" id="topBtn">TOP画面へ</button>
      <button class="hdr-btn name" id="profBtn">${isGuest ? "🎮 ゲスト" : `👤 ${esc(save.profile.name)}・${gradeLabel(save.profile.grade)}`}</button>
      <button class="hdr-btn slim" id="starBtn">⭐ ${totalStars()}</button>
      <button class="hdr-btn" id="statsBtn">📊 学習きろく</button>
    </div>
    <header class="home-head">
      <div class="mascot-big">${MASCOT}</div>
      <h1>算数で宇宙を旅しよう</h1>
      <p class="tag">問題をといて 新しい星へ 向かおう！</p>
      ${lockBanner}
    </header>`;

  for (const g in groups) {
    html += `<section class="group"><h2>${g}</h2><div class="grid">`;
    groups[g].forEach((t) => {
      html += `
        <button class="card lv${starsOf(t.id)}${starsOf(t.id) === 5 ? " maxed" : ""}" data-id="${t.id}">
          <div class="card-star-name">${(STARS[t.id] || {}).name || "星"}</div>
          <div class="card-emoji" style="--p2:${(STARS[t.id] || {}).c2 || "#888"}">${starIcon(t.id)}</div>
          <div class="card-name">${t.name}</div>
          <div class="card-meta">${t.grade}</div>
          <div class="card-stars">${starRow(starsOf(t.id))}</div>
        </button>`;
    });
    html += `</div></section>`;
  }
  app.innerHTML = html;

  document.querySelectorAll(".card").forEach((c) =>
    c.addEventListener("click", () => startTopic(c.dataset.id)));
  document.getElementById("statsBtn").addEventListener("click", renderStats);
  document.getElementById("profBtn").addEventListener("click", renderProfileSetup);
  document.getElementById("starBtn").addEventListener("click", renderStats);
  wireTopBtn();
}

/* ==================== 学習きろく画面（成長・苦手・つまずき） ==================== */
function renderStats() {
  const p = save.profile || { name: "君", grade: 3 };
  const un = unlockedMax();
  const totalPlayed = Object.values(save.topics).reduce((a, s) => a + (s.played || 0), 0);
  const totalCorrect = Object.values(save.topics).reduce((a, s) => a + (s.correct || 0), 0);

  /* --- 成長：最近のセッション得点をバーで --- */
  const hist = (save.history || []).slice(-10);
  let growth;
  if (!hist.length) {
    growth = `<div class="empty small">まだ きろくが ないよ。10問 さいごまで やってみよう！</div>`;
  } else {
    growth = `<div class="chart">` + hist.map((h) => {
      const t = TOPICS.find((x) => x.id === h.t);
      return `
        <div class="bar-wrap">
          <div class="bar${h.score === 10 ? " full" : ""}" style="height:${Math.max(h.score * 10, 6)}%"><span class="bar-score">${h.score}</span></div>
          <div class="bar-label">${t ? t.emoji : "❓"}</div>
        </div>`;
    }).join("") + `</div>
    <p class="chart-note">さいきん ${hist.length} 回の 10問チャレンジのけっか（右が 新しい）</p>`;
  }

  /* --- 苦手分野：1回目せいかい率が低い単元ワースト3 --- */
  const weak = TOPICS.map((t) => {
    const s = save.topics[t.id];
    if (!s || !s.played) return null;
    return { t, acc: s.correct / s.played, played: s.played };
  }).filter((x) => x && x.acc < 0.8).sort((a, b) => a.acc - b.acc).slice(0, 3);
  let weakHtml;
  if (!totalPlayed) {
    weakHtml = `<div class="empty small">まだ データが ないよ。</div>`;
  } else if (!weak.length) {
    weakHtml = `<div class="empty small">いまのところ 大きな 苦手は ないよ！ すごい！</div>`;
  } else {
    weakHtml = weak.map((w) => `
      <div class="weak-item">
        <span class="weak-emoji">${w.t.emoji}</span>
        <div class="weak-body">
          <div class="weak-name">${w.t.name}</div>
          <div class="weak-meta">${starRow(starsOf(w.t.id))}</div>
        </div>
        <div class="weak-acc">${Math.round(w.acc * 100)}%</div>
      </div>`).join("");
  }

  /* --- よくある つまずき（累計） --- */
  const entries = Object.entries(save.missLog).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  let missHtml;
  if (!entries.length) {
    missHtml = `<div class="empty small">まだ つまずきは 見つかっていないよ。</div>`;
  } else {
    missHtml = `<div class="miss-list">` + entries.map(([tag, info]) => `
      <div class="miss-item">
        <div class="miss-count">${info.count}回</div>
        <div class="miss-body">
          <div class="miss-title">${info.title}</div>
          <div class="miss-topic">📚 ${info.topicName}</div>
        </div>
      </div>`).join("") + `</div>`;
  }

  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← もどる</button>
      <h2>📊 ${esc(p.name)}さんの 学習きろく</h2>
      <div class="play-score"><button class="top-btn" id="topBtn">TOP画面へ</button></div>
    </header>

    <div class="stats-card">
      <div class="profile-line">
        <span class="chip">${gradeLabel(p.grade)}</span>
        <span class="chip">⭐ ${totalStars()}</span>
        <span class="chip">開いている学年：${gradeLabel(un)} まで</span>
      </div>
      <div class="profile-line sub">といた問題 ${totalPlayed}問 ／ 1回目せいかい ${totalCorrect}問${totalPlayed ? `（${Math.round(totalCorrect / totalPlayed * 100)}%）` : ""}</div>
    </div>

    <h3 class="sec-title">📈 せいちょう</h3>
    ${growth}

    <h3 class="sec-title">💪 苦手かも しれない単元</h3>
    ${weakHtml}

    <h3 class="sec-title">🔍 よくある つまずき</h3>
    <p class="stats-lead">ここを 直すのが 点数アップの 近道！</p>
    ${missHtml}

    <button class="reset-btn" id="resetAllBtn">${esc(p.name)}さんの きろくを リセット</button>`;

  document.getElementById("backBtn").addEventListener("click", renderHome);
  wireTopBtn();
  document.getElementById("resetAllBtn").addEventListener("click", () => {
    if (confirm(`${p.name}さんの なまえ・★・きろくを 全部 消す？（ほかの人の きろくは のこるよ）`)) {
      delete store.users[p.name];
      store.currentUser = null;
      save = null;
      persist();
      renderProfileSetup();
    }
  });
}

/* ==================== 出題画面 ==================== */
let cur = null; // { topic, problem, answered }

const QUESTIONS_PER_SESSION = 10;
const TIME_LIMIT = 180;   // 制限時間（秒）
const TIME_BONUS = 10;    // 正解ボーナス（秒）

function startTopic(id) {
  const topic = TOPICS.find((t) => t.id === id);
  renderStart(topic);
}
let session = { streak: 0, count: 0, correct: 0, correctSigs: new Set(), misses: [], timeLeft: TIME_LIMIT, timerId: null };

/* ---------- タイマー ---------- */
function stopTimer() {
  if (session.timerId) { clearInterval(session.timerId); session.timerId = null; }
}
function startTimer(topic) {
  stopTimer();
  session.timerId = setInterval(() => {
    session.timeLeft--;
    updateTimerUI();
    if (session.timeLeft <= 0) {
      stopTimer();
      renderComplete(topic, true);   // タイムアップ
    }
  }, 1000);
}
function updateTimerUI() {
  const el = document.getElementById("timerChip");
  if (!el) return;
  el.textContent = `⏱ ${Math.max(session.timeLeft, 0)}`;
  el.classList.toggle("low", session.timeLeft <= 30);
}
function showTimeBonus() {
  const el = document.getElementById("timerChip");
  if (!el) return;
  const b = document.createElement("span");
  b.className = "time-bonus";
  b.textContent = `+${TIME_BONUS}`;
  el.appendChild(b);
  setTimeout(() => b.remove(), 900);
}
// 開発用：残り時間を外から変更できるフック
window.__setTime = (t) => { session.timeLeft = t; updateTimerUI(); };

/* ---------- 単元ごとの得点ランキング TOP30 ---------- */
function rankingHTML(topic) {
  const list = (store.rankings || {})[topic.id] || [];
  if (!list.length) {
    return `<div class="rank-box empty-rank">🏆 まだ ランキングは ないよ。<br>10問全部正解して のこり秒数で 1位を ねらおう！</div>`;
  }
  const medal = ["🥇", "🥈", "🥉"];
  return `
    <div class="rank-box">
      <div class="rank-title">🏆 得点ランキング TOP30</div>
      <div class="rank-list">
        ${list.map((r, i) => `
          <div class="rank-row${i < 3 ? " top3" : ""}">
            <span class="rank-no">${medal[i] || (i + 1)}</span>
            <span class="rank-name">${esc(r.name)}</span>
            <b class="rank-score">${r.score}<small>秒</small></b>
          </div>`).join("")}
      </div>
    </div>`;
}

/* ==================== スタート画面 ==================== */
function renderStart(topic) {
  stopTimer();
  const st = starsOf(topic.id);
  const sv = topicSave(topic.id);
  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← もどる</button>
      <div class="play-score"><button class="top-btn" id="topBtn">TOP画面へ</button></div>
    </header>
    <div class="start-card">
      <div class="start-sun">${SUN.normal}</div>
      <div class="start-topic">${topic.emoji} ${topic.name}</div>
      <div class="start-stars">${starRow(st)}</div>
      ${sv.best ? `<div class="start-best">ベスト ${sv.best}/10</div>` : ""}
      <ul class="start-rules">
        <li>⏱ せいげん時間は <b>${TIME_LIMIT}秒</b></li>
        <li>➕ せいかいすると <b>+${TIME_BONUS}秒</b></li>
        <li>📝 全部で <b>${QUESTIONS_PER_SESSION}問</b>。1回目のせいかいが 点数になるよ</li>
        <li>🏆 <b>10問全部正解</b>すると、のこり秒数が スコアになって ランキングに のるよ</li>
      </ul>
      ${rankingHTML(topic)}
      <button class="primary-btn big-btn" id="goBtn">スタート！</button>
      <button class="next-btn big-btn" id="testBtn">📝 10問テストモード</button>
      <div class="test-note">10問を 縦に ならべて 一気に とくよ（時間せいげん・ランキングは なし）</div>
    </div>`;
  document.getElementById("backBtn").addEventListener("click", renderHome);
  document.getElementById("goBtn").addEventListener("click", () => beginSession(topic));
  document.getElementById("testBtn").addEventListener("click", () => beginTest(topic));
  wireTopBtn();
}

function beginSession(topic) {
  session = { streak: 0, count: 0, correct: 0, correctSigs: new Set(), misses: [], timeLeft: TIME_LIMIT, timerId: null };
  startTimer(topic);
  nextProblem(topic);
}

function nextProblem(topic) {
  if (session.count >= QUESTIONS_PER_SESSION) { renderComplete(topic); return; }
  // session.count が「これから出す問題の番号(0始まり)」になる。
  // 正解済みの問題は同じものを出さない（重複回避）。
  let problem, tries = 0;
  do { problem = topic.gen(session.count); tries++; }
  while (session.correctSigs.has(problem.text) && tries < 40);
  cur = { topic, problem, answered: false, attempt: 0 };
  renderPlay();
}

/* ==================== 結果画面（10問終わり／タイムアップ） ==================== */
function renderComplete(topic, timedOut = false) {
  stopTimer();
  const c = session.correct, total = QUESTIONS_PER_SESSION;
  let face, msg;
  if (c === 10) { face = "🏆"; msg = "すごい！かんぺきだよ！"; }
  else if (c >= 8) { face = "🌟"; msg = "おしい！まん点をめざそう！"; }
  else if (c >= 6) { face = "😊"; msg = "いいね！もう少しだね！"; }
  else { face = "💪"; msg = "もう一度がんばろう"; }

  // 記録：ベスト更新・学習履歴・学年アンロック判定
  const sv = topicSave(topic.id);
  const prevUn = unlockedMax();
  sv.best = Math.max(sv.best || 0, c);
  save.history.push({ t: topic.id, d: new Date().toISOString(), score: c, miss: session.misses.length });
  if (save.history.length > 200) save.history = save.history.slice(-200);
  persist();

  // 🏆 10問全部正解 → のこり秒数が「その回の点数」としてランキングに記録される
  let rankNote = "";
  if (c === total) {
    const score = Math.max(session.timeLeft, 0);
    if (!save.guest) {
      const list = (store.rankings[topic.id] ||= []);
      const entry = { name: save.profile.name, score, d: new Date().toISOString() };
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      if (list.length > 30) list.length = 30;
      const rank = list.indexOf(entry) + 1;
      persist();
      rankNote = rank > 0
        ? `<div class="rank-note">⏱ のこり <b>${score}秒</b> が 今回の点数！ ${esc(save.profile.name)}さんは <b>${rank}位</b> に ランクイン🏆</div>`
        : `<div class="rank-note">⏱ のこり <b>${score}秒</b>。おしい！ TOP30には あと一歩…</div>`;
    } else {
      rankNote = `<div class="rank-note">⏱ のこり <b>${score}秒</b>！ ゲストの点数は ランキングに のらないよ</div>`;
    }
  }
  const newUn = unlockedMax();
  const unlockMsg = newUn > prevUn
    ? `<div class="unlock-banner">🎉 やったね！ <b>${gradeLabel(newUn)}</b> の問題が 開いたよ！</div>` : "";
  const sesStars = c >= 10 ? 5 : Math.floor(c / 2);

  // ハンターの本領：このセッションで見つかった「つまずき」を集計してアドバイス
  const agg = {};
  session.misses.forEach((m) => {
    if (!agg[m.tag]) agg[m.tag] = { ...m, count: 0 };
    agg[m.tag].count++;
  });
  const tops = Object.values(agg).sort((a, b) => b.count - a.count).slice(0, 2);
  let advice = "";
  if (tops.length) {
    advice = `
      <div class="advice">
        <div class="advice-title">🔍 ハンターが見つけた 君の つまずき</div>
        ${tops.map((m) => `
          <div class="advice-item"><b>${m.title}</b>${m.count > 1 ? `（${m.count}回）` : ""}
            <div class="advice-hint">🔑 ${m.hint}</div>
          </div>`).join("")}
        <div class="advice-foot">ここを 直せば ぐんと 点数アップ！ もう一度 ためしてみよう。</div>
      </div>`;
  } else if (c === total) {
    advice = `
      <div class="advice perfect">
        <div class="advice-title">✨ つまずき ゼロ！</div>
        <div class="advice-item">この単元は マスターしたよ。次の単元に 進もう！</div>
      </div>`;
  } else {
    advice = `
      <div class="advice">
        <div class="advice-title">🔍 おしいミスが あったみたい</div>
        <div class="advice-item">大きなつまずきは 見つからなかったよ。計算ミスかも。メモに しっかり書いて、たしかめ算をすると ふせげるよ。</div>
      </div>`;
  }

  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← ホーム</button>
      <h2>けっか</h2>
      <div class="play-score"><button class="top-btn" id="topBtn">TOP画面へ</button></div>
    </header>
    <div class="complete">
      <div class="complete-face">${timedOut ? "⏰" : face}</div>
      ${timedOut ? `<div class="timeout-note">タイムアップ！</div>` : ""}
      <div class="complete-topic">${topic.emoji} ${topic.name}</div>
      <div class="complete-score"><b>${c}</b><span> / ${total} せいかい</span></div>
      <div class="complete-stars">${starRow(sesStars)}</div>
      <div class="complete-msg">${msg}</div>
      ${rankNote}
      ${unlockMsg}
      ${advice}
      <div class="complete-actions">
        <button class="primary-btn" id="againBtn">もう一度</button>
        <button class="next-btn" id="homeBtn">ホームへ</button>
      </div>
    </div>`;
  document.getElementById("backBtn").addEventListener("click", renderHome);
  document.getElementById("homeBtn").addEventListener("click", renderHome);
  document.getElementById("againBtn").addEventListener("click", () => beginSession(topic));
  wireTopBtn();
  if (c >= 8) burst();
}

// 分数の答えが整数（約分して分母1）になる問題は、整数で答えさせる。
function effAnswerType(topic, p) {
  if (topic.answerType === "frac" && p.reduced && p.reduced[1] === 1) return "int";
  return topic.answerType;
}

/* ==================== 10問テストモード ====================
   全10問を縦に並べて一度に解く。1問1回・時間せいげんなし・ランキング対象外。
   ベストと学習きろく（履歴・つまずき）には反映する。 */
function beginTest(topic) {
  stopTimer();
  const problems = [];
  const seen = new Set();
  for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
    let p, tries = 0;
    do { p = topic.gen(i); tries++; } while (seen.has(p.text) && tries < 40);
    seen.add(p.text);
    problems.push(p);
  }
  renderTest(topic, problems);
}

// 問題文（式＝／文章題／分数）を組み立てる（出題画面と同じルール）
function problemTextOf(topic, p) {
  return topic.display
    ? topic.display(p)
    : (/[？?]/.test(p.text) ? p.text : `${p.text} ＝`);
}

function renderTest(topic, problems) {
  const rows = problems.map((p, i) => {
    const atype = effAnswerType(topic, p);
    const figure = topic.figure ? `<div class="figure">${topic.figure(p)}</div>` : "";
    return `
      <div class="test-item">
        <div class="test-no">${i + 1}</div>
        <div class="test-body">
          ${figure}
          <div class="calc-row${atype === "twofrac" ? " calc-tight" : ""}">
            <div class="problem-text">${problemTextOf(topic, p)}</div>
            ${answerInputHTMLIndexed(atype, p, i)}
          </div>
        </div>
      </div>`;
  }).join("");

  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← やめる</button>
      <div class="play-score"><button class="top-btn" id="topBtn">TOP画面へ</button></div>
    </header>
    <div class="play-topic">${topic.emoji} ${topic.name} <span class="test-badge">📝 10問テスト</span></div>
    <p class="test-lead">10問 ぜんぶ 書けたら、下の「答え合わせ」を おそう！</p>
    <div class="test-list">${rows}</div>
    <div class="play-actions">
      <div class="test-actions-row">
        <button class="next-btn" id="a4Btn">🖨 A4ダウンロード</button>
        <button class="primary-btn" id="gradeBtn">答え合わせ（10問）</button>
      </div>
      <div class="test-note">「A4ダウンロード」は 5問ずつ 2ページの PDF（紙で といてね）／ 空らんは 不正解に なるよ</div>
    </div>`;

  document.getElementById("backBtn").addEventListener("click", renderHome);
  document.getElementById("gradeBtn").addEventListener("click", () => gradeTest(topic, problems));
  document.getElementById("a4Btn").addEventListener("click", () => downloadA4(topic, problems));
  wireTopBtn();

  // 入力欄は Enter / 次へ で下の欄へ送る
  const flds = [...document.querySelectorAll(".test-list .fld")];
  flds.forEach((f, idx) => {
    f.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); (flds[idx + 1] || document.getElementById("gradeBtn")).focus(); }
    });
  });
  flds[0]?.focus();
}

/* ---------- A4プリント（PDF）ダウンロード ----------
   10問を A4たて・5問ずつ の 2ページ PDF にして ダウンロードする。
   jsPDF と html2canvas を CDN から遅延読み込みして、
   紙のプリント（図形・分数もそのまま）を画像として貼り付ける。 */
const A4_LIBS = {
  html2canvas: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
};
function loadScriptOnce(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some((s) => s.src === src)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("読み込み失敗: " + src));
    document.head.appendChild(s);
  });
}

// A4 1ページぶんの要素を作る（794×1123px ＝ A4たて @96dpi）
function buildA4Page(topic, problems, startIndex, pageNo, pageTotal) {
  const page = document.createElement("div");
  page.className = "a4-page";
  const items = problems.map((p, k) => {
    const no = startIndex + k + 1;
    const figure = topic.figure ? `<div class="a4-fig">${topic.figure(p)}</div>` : "";
    const unit = p.unit ? `<span class="a4-unit">${p.unit}</span>` : "";
    return `
      <div class="a4-item">
        <div class="a4-no">${no}</div>
        <div class="a4-qbody">
          <div class="a4-q">
            <span class="a4-qtext">${problemTextOf(topic, p)}</span>
            <span class="a4-blank"></span>${unit}
          </div>
          ${figure}
        </div>
      </div>`;
  }).join("");
  page.innerHTML = `
    <div class="a4-head">
      <div class="a4-title">${topic.emoji} ${topic.name} <span class="a4-sub">10問テスト</span></div>
      <div class="a4-meta">なまえ <span class="a4-namebox"></span></div>
    </div>
    <div class="a4-items">${items}</div>
    <div class="a4-foot">${pageNo} / ${pageTotal} まい　　算数で宇宙を旅しよう</div>`;
  return page;
}

// タイトルが1行に収まるまでフォントを小さくする（要DOM挿入後）
function fitA4Title(page) {
  const head = page.querySelector(".a4-head");
  const title = page.querySelector(".a4-title");
  const meta = page.querySelector(".a4-meta");
  if (!head || !title) return;
  title.style.whiteSpace = "nowrap";
  const gap = 18;
  const avail = head.clientWidth - (meta ? meta.offsetWidth : 0) - gap;
  let fs = 27;
  while (title.scrollWidth > avail && fs > 12) {
    fs -= 1;
    title.style.fontSize = fs + "px";
  }
}

// 各問の中身（問題文＋図）が行の高さに収まるまで、問題文と図を少し小さくする
function fitA4Item(item) {
  const body = item.querySelector(".a4-qbody");
  const q = item.querySelector(".a4-q");
  const fig = item.querySelector(".a4-fig svg");
  if (!body || !q) return;
  const cs = getComputedStyle(item);
  const avail = item.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let fs = 28, figMax = 108;
  const blank = item.querySelector(".a4-blank");
  const unit = item.querySelector(".a4-unit");
  for (let k = 0; k < 14 && body.scrollHeight > avail; k++) {
    fs = Math.max(14, fs - 1.5);
    q.style.fontSize = fs + "px";
    if (blank) blank.style.height = fs + "px";
    if (unit) unit.style.fontSize = (fs * 0.75) + "px";
    if (fig) { figMax = Math.max(60, figMax - 6); fig.style.maxHeight = figMax + "px"; }
  }
}

async function downloadA4(topic, problems) {
  const btn = document.getElementById("a4Btn");
  const label = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "PDFを作成中…"; }
  // 画面外に作って html2canvas で撮る用の入れもの
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;";
  document.body.appendChild(stage);
  try {
    await Promise.all([loadScriptOnce(A4_LIBS.html2canvas), loadScriptOnce(A4_LIBS.jspdf)]);
    const jsPDF = (window.jspdf || {}).jsPDF;
    if (!window.html2canvas || !jsPDF) throw new Error("ライブラリを読み込めませんでした");

    const half = Math.ceil(problems.length / 2); // 前半5問／後半5問
    const pages = [
      buildA4Page(topic, problems.slice(0, half), 0, 1, 2),
      buildA4Page(topic, problems.slice(half), half, 2, 2),
    ];
    pages.forEach((pg) => stage.appendChild(pg));
    // レイアウト確定後に自動調整：タイトルは1行に、各問は図が見切れないように
    pages.forEach((pg) => {
      fitA4Title(pg);
      [...pg.querySelectorAll(".a4-item")].forEach(fitA4Item);
    });

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    for (let i = 0; i < pages.length; i++) {
      const canvas = await window.html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const img = canvas.toDataURL("image/jpeg", 0.94);
      if (i > 0) doc.addPage();
      doc.addImage(img, "JPEG", 0, 0, W, H);
    }
    const safe = topic.name.replace(/[\\/:*?"<>|・（）]/g, "").replace(/\s+/g, "");
    doc.save(`${safe}_10問テスト.pdf`);
  } catch (e) {
    alert("PDFを作れませんでした。ネットにつながっているか たしかめてね。\n(" + (e && e.message ? e.message : e) + ")");
  } finally {
    stage.remove();
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

// index 付きの回答入力欄（IDが重複しないよう _i を付ける）
function answerInputHTMLIndexed(type, p, i) {
  if (type === "frac")
    return `
      <div class="ans-frac"><div class="frac">
        <input class="fld" id="fldN_${i}" inputmode="numeric" placeholder="分子" autocomplete="off">
        <div class="frac-bar"></div>
        <input class="fld" id="fldD_${i}" inputmode="numeric" placeholder="分母" autocomplete="off">
      </div></div>`;
  if (type === "mixed")
    return `
      <div class="ans-mixed">
        <input class="fld mix-w" id="fldW_${i}" inputmode="numeric" placeholder="整数" autocomplete="off">
        <div class="frac">
          <input class="fld" id="fldN_${i}" inputmode="numeric" placeholder="分子" autocomplete="off">
          <div class="frac-bar"></div>
          <input class="fld" id="fldD_${i}" inputmode="numeric" placeholder="分母" autocomplete="off">
        </div>
      </div>`;
  if (type === "twofrac")
    return `
      <div class="ans-twofrac">
        <span class="tf-paren">(</span>
        <div class="frac">
          <input class="fld" id="fldN1_${i}" inputmode="numeric" placeholder="分子" autocomplete="off">
          <div class="frac-bar"></div>
          <input class="fld" id="fldD1_${i}" inputmode="numeric" placeholder="分母" autocomplete="off">
        </div>
        <span class="tf-comma">,</span>
        <div class="frac">
          <input class="fld" id="fldN2_${i}" inputmode="numeric" placeholder="分子" autocomplete="off">
          <div class="frac-bar"></div>
          <input class="fld" id="fldD2_${i}" inputmode="numeric" placeholder="分母" autocomplete="off">
        </div>
        <span class="tf-paren">)</span>
      </div>`;
  if (type === "quorem")
    return `
      <div class="ans-quorem">
        <input class="fld wide" id="fldQ_${i}" inputmode="numeric" placeholder="商" autocomplete="off">
        <span class="qr-label">あまり</span>
        <input class="fld wide" id="fldR_${i}" inputmode="numeric" placeholder="あまり" autocomplete="off">
      </div>`;
  return `
    <div class="ans-single">
      <input class="fld big" id="fldA_${i}" inputmode="${type === "dec" ? "decimal" : "numeric"}" placeholder="?" autocomplete="off">
      ${p.unit ? `<span class="unit">${p.unit}</span>` : ""}
    </div>`;
}

// 全角の数字・記号を半角へそろえる（全角入力でも 半角と同じに 丸つけできるように）
function toHalfWidth(s) {
  return String(s == null ? "" : s)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)) // ０-９→0-9
    .replace(/[．。]/g, ".")              // 全角ピリオド・句点→小数点
    .replace(/[／]/g, "/")               // 全角スラッシュ→/
    .replace(/[－ー―–—−]/g, "-")         // 全角マイナス・長音・各種ダッシュ→-
    .replace(/[，、]/g, "")               // 全角カンマ・読点（桁区切り）は除去
    .replace(/\s+/g, "");                // 空白（全角スペース含む）は除去
}
// 半角化してから数値化する
function pInt(v) { return parseInt(toHalfWidth(v), 10); }
function pFloat(v) { return parseFloat(toHalfWidth(v)); }

// 帯分数の読み取り（整数部が空なら0／分数部が両方空なら分数なし）
function readMixedFrom(getVal) {
  const wRaw = toHalfWidth(getVal("fldW"));
  const nRaw = toHalfWidth(getVal("fldN"));
  const dRaw = toHalfWidth(getVal("fldD"));
  const hasFrac = nRaw !== "" || dRaw !== "";
  if (wRaw === "" && !hasFrac) return null;          // 全部空
  const w = wRaw === "" ? 0 : parseInt(wRaw, 10);
  if (isNaN(w)) return null;
  let n = 0, d = 1;
  if (hasFrac) {
    n = parseInt(nRaw, 10); d = parseInt(dRaw, 10);
    if (isNaN(n) || isNaN(d)) return null;
  }
  return { w, n, d };
}

function readAnswerIndexed(type, i) {
  const val = (id) => (document.getElementById(`${id}_${i}`) || {}).value;
  if (type === "mixed") return readMixedFrom(val);
  if (type === "frac") {
    const n = pInt(val("fldN")), d = pInt(val("fldD"));
    if (isNaN(n) || isNaN(d)) return null;
    return { n, d };
  }
  if (type === "twofrac") {
    const n1 = pInt(val("fldN1")), d1 = pInt(val("fldD1"));
    const n2 = pInt(val("fldN2")), d2 = pInt(val("fldD2"));
    if ([n1, d1, n2, d2].some((x) => isNaN(x))) return null;
    return { n1, d1, n2, d2 };
  }
  if (type === "quorem") {
    const q = pInt(val("fldQ"));
    const rRaw = toHalfWidth(val("fldR"));
    const r = rRaw === "" ? 0 : parseInt(rRaw, 10);
    if (isNaN(q) || isNaN(r)) return null;
    return { q, r };
  }
  const raw = toHalfWidth(val("fldA"));
  if (raw === "") return null;
  const num = type === "dec" ? parseFloat(raw) : parseInt(raw, 10);
  return isNaN(num) ? null : num;
}

function gradeTest(topic, problems) {
  const results = problems.map((p, i) => {
    const atype = effAnswerType(topic, p);
    let ans = readAnswerIndexed(atype, i);
    const blank = ans === null;
    // 整数入力の分数問題は {n, d:1} に直して採点
    if (!blank && topic.answerType === "frac" && atype === "int") ans = { n: ans, d: 1 };
    const res = blank ? { correct: false } : topic.diagnose(ans, p);
    return { p, res, blank };
  });
  const correct = results.filter((r) => r.res.correct).length;

  // 記録：ベスト・履歴・つまずき（ランキングは対象外）
  const sv = topicSave(topic.id);
  const prevUn = unlockedMax();
  sv.best = Math.max(sv.best || 0, correct);
  sv.played += problems.length;
  sv.correct += correct;
  save.history.push({ t: topic.id, d: new Date().toISOString(), score: correct, miss: problems.length - correct, mode: "test" });
  if (save.history.length > 200) save.history = save.history.slice(-200);
  results.forEach((r) => { if (!r.res.correct && r.res.tag) logMiss(topic, r.res); });
  persist();

  const newUn = unlockedMax();
  renderTestResult(topic, problems, results, correct, newUn > prevUn ? newUn : 0);
}

function renderTestResult(topic, problems, results, correct, unlockedTo) {
  const total = problems.length;
  const sesStars = correct >= 10 ? 5 : Math.floor(correct / 2);
  let face, msg;
  if (correct === 10) { face = "🏆"; msg = "かんぺき！ ぜんぶ 正解だよ！"; }
  else if (correct >= 8) { face = "🌟"; msg = "おしい！ まん点を めざそう！"; }
  else if (correct >= 6) { face = "😊"; msg = "いいね！ もう少し！"; }
  else { face = "💪"; msg = "くりかえせば きっと のびる！"; }

  const list = results.map((r, i) => {
    const ok = r.res.correct;
    const missBlock = (!ok && r.res.tag)
      ? `<div class="tr-miss"><b>${r.res.title}</b><div class="tr-hint">🔑 ${r.res.hint}</div></div>`
      : (!ok && r.blank ? `<div class="tr-blank">空らん（答えを 書いていないよ）</div>` : "");
    return `
      <div class="tr-item ${ok ? "ok" : "ng"}">
        <div class="tr-mark">${ok ? "⭕" : "❌"}<span class="tr-no">${i + 1}</span></div>
        <div class="tr-body">
          <div class="tr-q">${problemTextOf(topic, r.p)} <b class="tr-ans">${formatAnswer(topic, r.p)}</b></div>
          ${missBlock}
        </div>
      </div>`;
  }).join("");

  const unlockMsg = unlockedTo
    ? `<div class="unlock-banner">🎉 やったね！ <b>${gradeLabel(unlockedTo)}</b> の問題が 開いたよ！</div>` : "";

  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← ホーム</button>
      <h2>10問テストのけっか</h2>
      <div class="play-score"><button class="top-btn" id="topBtn">TOP画面へ</button></div>
    </header>
    <div class="complete">
      <div class="complete-face">${face}</div>
      <div class="complete-topic">${topic.emoji} ${topic.name}</div>
      <div class="complete-score"><b>${correct}</b><span> / ${total} 正解</span></div>
      <div class="complete-stars">${starRow(sesStars)}</div>
      <div class="complete-msg">${msg}</div>
      ${unlockMsg}
    </div>
    <h3 class="sec-title">📋 答え合わせ</h3>
    <div class="tr-list">${list}</div>
    <div class="complete-actions">
      <button class="primary-btn" id="againBtn">もう一度（新しい10問）</button>
      <button class="next-btn" id="homeBtn">ホームへ</button>
    </div>`;

  document.getElementById("backBtn").addEventListener("click", renderHome);
  document.getElementById("homeBtn").addEventListener("click", renderHome);
  document.getElementById("againBtn").addEventListener("click", () => beginTest(topic));
  wireTopBtn();
  if (correct >= 8) burst();
}

function renderPlay() {
  const { topic, problem } = cur;
  const s = topicSave(topic.id);
  const atype = effAnswerType(topic, problem);
  cur.atype = atype; // 採点時に使う

  // 表示用テキスト。display() を持つ分野（分数など）は横棒つきHTMLを使う。
  // それ以外は、計算問題（式だけ）に末尾 ＝ を付け、文章題（？）には付けない。
  const problemText = topic.display
    ? topic.display(problem)
    : (/[？?]/.test(problem.text) ? problem.text : `${problem.text} ＝`);

  // 計算系（式＝答え の形）は、式と答え欄を横1行に並べる。
  const isCalc = !!topic.display || !/[？?]/.test(problem.text);
  // 通分（分数4つ）は横に長いので、少し小さめにして1行に収める。
  const rowClass = atype === "twofrac" ? "calc-row calc-tight" : "calc-row";
  const problemBlock = isCalc
    ? `<div class="${rowClass}">
         <div class="problem-text" id="ptext">${problemText}</div>
         ${answerInputHTML(atype, problem)}
       </div>`
    : `<div class="problem-text" id="ptext">${problemText}</div>
       ${topic.figure ? `<div class="figure">${topic.figure(problem)}</div>` : ""}
       ${answerInputHTML(atype, problem)}`;

  app.innerHTML = `
    <header class="sub-head">
      <button class="back" id="backBtn">← やめる</button>
      <div class="play-score">
        <span class="chip timer" id="timerChip">⏱ ${session.timeLeft}</span>
        <span class="chip">📝 ${session.count + 1}/${QUESTIONS_PER_SESSION}</span>
        <span class="chip">🔥 ${session.streak}</span>
        <span class="chip">⭐ ${starsOf(topic.id)}</span>
        <button class="top-btn" id="topBtn">TOP画面へ</button>
      </div>
    </header>

    <div class="progress"><div class="progress-fill" style="width:${(session.count / QUESTIONS_PER_SESSION) * 100}%"></div></div>

    <div class="play-topic">${topic.emoji} ${topic.name}</div>

    <div class="problem-box">
      <div class="mascot-play" id="mascot">${MASCOT}</div>
      ${problemBlock}
    </div>

    <div class="feedback" id="feedback"></div>

    <div class="play-actions">
      <button class="primary-btn" id="checkBtn">答え合わせ</button>
      <button class="next-btn hidden" id="nextBtn">次の問題 →</button>
    </div>

    <div class="keypad-area">
      ${keypadHTML(atype)}
    </div>

    <div class="memo-full">
      <div class="memo-head">
        <span>✏️ メモ（手書き）</span>
        <button class="memo-clear" id="memoClear">消す</button>
      </div>
      <canvas id="memo" class="memo-canvas"></canvas>
    </div>
  `;

  document.getElementById("backBtn").addEventListener("click", renderHome);
  document.getElementById("checkBtn").addEventListener("click", onCheck);
  document.getElementById("nextBtn").addEventListener("click", () => nextProblem(topic));
  wireTopBtn();

  setupInputs(atype);
  wireKeypad(atype);
  setupMemo();
}

/* ---------- 回答入力のHTML ---------- */
function answerInputHTML(type, p) {
  if (type === "frac")
    return `
      <div class="ans-frac">
        <div class="frac">
          <input class="fld" id="fldN" inputmode="numeric" placeholder="分子" autocomplete="off">
          <div class="frac-bar"></div>
          <input class="fld" id="fldD" inputmode="numeric" placeholder="分母" autocomplete="off">
        </div>
      </div>`;
  if (type === "mixed")   // 帯分数：整数部 ＋ 分子／分母（真分数なら整数部は空でOK）
    return `
      <div class="ans-mixed">
        <input class="fld mix-w" id="fldW" inputmode="numeric" placeholder="整数" autocomplete="off">
        <div class="frac">
          <input class="fld" id="fldN" inputmode="numeric" placeholder="分子" autocomplete="off">
          <div class="frac-bar"></div>
          <input class="fld" id="fldD" inputmode="numeric" placeholder="分母" autocomplete="off">
        </div>
      </div>`;
  if (type === "twofrac")
    return `
      <div class="ans-twofrac">
        <span class="tf-paren">(</span>
        <div class="frac">
          <input class="fld" id="fldN1" inputmode="numeric" placeholder="分子" autocomplete="off">
          <div class="frac-bar"></div>
          <input class="fld" id="fldD1" inputmode="numeric" placeholder="分母" autocomplete="off">
        </div>
        <span class="tf-comma">,</span>
        <div class="frac">
          <input class="fld" id="fldN2" inputmode="numeric" placeholder="分子" autocomplete="off">
          <div class="frac-bar"></div>
          <input class="fld" id="fldD2" inputmode="numeric" placeholder="分母" autocomplete="off">
        </div>
        <span class="tf-paren">)</span>
      </div>`;
  if (type === "quorem")
    return `
      <div class="ans-quorem">
        <input class="fld wide" id="fldQ" inputmode="numeric" placeholder="商" autocomplete="off">
        <span class="qr-label">あまり</span>
        <input class="fld wide" id="fldR" inputmode="numeric" placeholder="あまり" autocomplete="off">
      </div>`;
  // int / dec
  return `
    <div class="ans-single">
      <input class="fld big" id="fldA" inputmode="${type === "dec" ? "decimal" : "numeric"}" placeholder="?" autocomplete="off">
      ${p.unit ? `<span class="unit">${p.unit}</span>` : ""}
    </div>`;
}

let activeField = null;
function setupInputs(type) {
  const flds = [...document.querySelectorAll(".fld")];
  flds.forEach((f) => {
    f.addEventListener("focus", () => (activeField = f));
    f.addEventListener("keydown", (e) => { if (e.key === "Enter") onCheck(); });
  });
  activeField = flds[0];
  flds[0]?.focus();
}

/* ---------- 画面キーパッド（1〜5／6〜0 の2行） ---------- */
function keypadHTML(type) {
  const row = (arr) =>
    `<div class="key-row">${arr.map((d) => `<button class="key" data-k="${d}">${d}</button>`).join("")}</div>`;
  const dot = type === "dec" ? `<button class="key" data-k=".">.</button>` : "";
  return `
    <div class="keypad keypad-2row">
      ${row([1, 2, 3, 4, 5])}
      ${row([6, 7, 8, 9, 0])}
      <div class="key-row key-row-ctrl">
        ${dot}
        <button class="key wide-key" data-k="del">⌫ けす</button>
      </div>
    </div>`;
}
function wireKeypad(type) {
  document.querySelectorAll(".key[data-k]").forEach((k) =>
    k.addEventListener("click", () => {
      if (!activeField) activeField = document.querySelector(".fld");
      if (!activeField) return;
      const v = k.dataset.k;
      if (v === "del") activeField.value = activeField.value.slice(0, -1);
      else activeField.value += v;
      activeField.focus();
    }));
}

/* ---------- 手書きメモパッド ---------- */
function setupMemo() {
  const canvas = document.getElementById("memo");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // 表示サイズに合わせて解像度を設定（Retina対応）
  function fit() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return; // まだレイアウトされていない
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#dbe4ff";   // ダーク背景用の明るいペン
  }
  fit();                              // レイアウト直後に同期で確定
  requestAnimationFrame(fit);         // 念のため次フレームでも
  window.addEventListener("resize", fit);

  let drawing = false, lastX = 0, lastY = 0;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    [lastX, lastY] = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    // 点だけ打った場合も残るように小さな点を描く
    ctx.lineTo(lastX + 0.1, lastY + 0.1);
    ctx.stroke();
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    [lastX, lastY] = [x, y];
    e.preventDefault();
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("pointerleave", stop);

  document.getElementById("memoClear")?.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

/* ---------- 回答の読み取り ---------- */
function readAnswer(type) {
  if (type === "mixed") return readMixedFrom((id) => (document.getElementById(id) || {}).value);
  if (type === "frac") {
    const n = pInt(document.getElementById("fldN").value);
    const d = pInt(document.getElementById("fldD").value);
    if (isNaN(n) || isNaN(d)) return null;
    return { n, d };
  }
  if (type === "twofrac") {
    const n1 = pInt(document.getElementById("fldN1").value);
    const d1 = pInt(document.getElementById("fldD1").value);
    const n2 = pInt(document.getElementById("fldN2").value);
    const d2 = pInt(document.getElementById("fldD2").value);
    if ([n1, d1, n2, d2].some((x) => isNaN(x))) return null;
    return { n1, d1, n2, d2 };
  }
  if (type === "quorem") {
    const q = pInt(document.getElementById("fldQ").value);
    const rRaw = toHalfWidth(document.getElementById("fldR").value);
    const r = rRaw === "" ? 0 : parseInt(rRaw, 10);
    if (isNaN(q) || isNaN(r)) return null;
    return { q, r };
  }
  const raw = toHalfWidth(document.getElementById("fldA").value);
  if (raw === "") return null;
  const num = type === "dec" ? parseFloat(raw) : parseInt(raw, 10);
  return isNaN(num) ? null : num;
}

/* ---------- 答え合わせ ---------- */
function onCheck() {
  if (cur.answered) return;
  const { topic, problem } = cur;
  let ans = readAnswer(cur.atype);
  if (ans === null) { flashInput(); return; }
  // 整数入力の分数問題は、整数を分数 {n, d:1} に直して採点する
  if (topic.answerType === "frac" && cur.atype === "int") ans = { n: ans, d: 1 };

  const res = topic.diagnose(ans, problem);
  const s = topicSave(topic.id);
  const fb = document.getElementById("feedback");
  const mascot = document.getElementById("mascot");

  /* ---- 1回目の不正解：ブブー → 答えは見せず 同じ問題に再チャレンジ ---- */
  if (!res.correct && cur.attempt === 0) {
    playBubu();
    shakeBox();
    cur.attempt = 1;
    session.streak = 0;
    if (res.tag) {
      logMiss(topic, res);
      session.misses.push({ tag: res.tag, title: res.title, hint: res.hint, topicName: topic.name });
    }
    mascot.innerHTML = SUN.think;
    mascot.classList.remove("think"); void mascot.offsetWidth; mascot.classList.add("think");
    fb.className = "feedback show wrong";
    fb.innerHTML = `
      <div class="fb-head retry">❌ ブブー！ もう一度 チャレンジ！</div>
      ${res.title ? `<div class="retry-hint">🔍 ヒント：${res.title}</div>` : ""}`;
    // 入力を消して、同じ問題をもう一度
    document.querySelectorAll(".fld").forEach((f) => (f.value = ""));
    flashInput();
    const first = document.querySelector(".fld");
    if (first) { activeField = first; first.focus(); }
    persist();
    updateScoreChips();
    return;
  }

  /* ---- 正解、または2回目の不正解 → この問題は終わり ---- */
  cur.answered = true;
  session.count++;
  s.played++;
  document.getElementById("checkBtn").classList.add("hidden");
  const nextBtn = document.getElementById("nextBtn");

  if (res.correct) {
    playPinpon();
    session.timeLeft += TIME_BONUS;   // 正解ボーナス +10秒
    updateTimerUI();
    showTimeBonus();
    session.correctSigs.add(problem.text); // 正解した問題は再出題しない
    mascot.innerHTML = SUN.happy;
    mascot.classList.remove("happy"); void mascot.offsetWidth; mascot.classList.add("happy");
    fb.className = "feedback show correct";
    if (cur.attempt === 0) {
      // 1回目で正解 → 得点にカウント
      session.streak++;
      session.correct++;
      s.correct++;
      s.bestStreak = Math.max(s.bestStreak, session.streak);
      const cheer = STREAK_CHEERS[session.streak] || pick(CHEERS);
      fb.innerHTML = `
        <div class="fb-head">⭕ せいかい！ <span class="cheer">${cheer}</span></div>
        ${res.note ? `<div class="fb-note">💡 ${res.note}</div>` : ""}`;
      burst();
    } else {
      // 2回目で正解 → ほめるけど得点にはしない
      fb.innerHTML = `
        <div class="fb-head">⭕ せいかい！ <span class="cheer">リベンジ成功！次は1回で！</span></div>`;
    }
    // 正解したら自動で次の問題へ（ボタン操作なし）
    const token = cur;
    setTimeout(() => {
      if (cur !== token) return;   // すでに画面が変わっていたら何もしない
      if (session.count >= QUESTIONS_PER_SESSION) renderComplete(topic);
      else nextProblem(topic);
    }, 1100);
  } else {
    // 不正解のときだけ「次の問題」ボタンを出す（つまずきカードを読む時間を確保）
    nextBtn.classList.remove("hidden");
    if (session.count >= QUESTIONS_PER_SESSION) nextBtn.textContent = "けっかを見る →";
    nextBtn.focus();
    // 2回目も不正解 → つまずきカードと正しい答えを見せて 次へ
    playBubu();
    shakeBox();
    session.streak = 0;
    mascot.innerHTML = SUN.think;
    mascot.classList.remove("think"); void mascot.offsetWidth; mascot.classList.add("think");
    fb.className = "feedback show wrong";
    if (res.tag) {
      logMiss(topic, res);
      session.misses.push({ tag: res.tag, title: res.title, hint: res.hint, topicName: topic.name });
      fb.innerHTML = `
        <div class="fb-head miss">💥 つまずき発見！</div>
        <div class="miss-card">
          <div class="miss-card-title">${res.title}</div>
          <div class="miss-card-msg">${res.msg}</div>
          <div class="miss-card-hint">🔑 ${res.hint}</div>
        </div>
        <div class="correct-ans">正しい答え：<b>${formatAnswer(topic, problem)}</b></div>`;
    } else {
      fb.innerHTML = `
        <div class="fb-head miss">ざんねん…</div>
        <div class="correct-ans">正しい答え：<b>${formatAnswer(topic, problem)}</b></div>`;
    }
  }
  persist();
  updateScoreChips();
}

function updateScoreChips() {
  const chips = document.querySelectorAll(".play-score .chip");
  if (chips[1]) chips[1].textContent = `🔥 ${session.streak}`;
  if (chips[2]) chips[2].textContent = `⭐ ${starsOf(cur.topic.id)}`;
  // 進捗チップ(chips[0])は次の問題描画時に更新される
}

/* ---------- つまずき記録 ---------- */
function logMiss(topic, res) {
  const key = `${topic.id}:${res.tag}`;
  if (!save.missLog[key]) save.missLog[key] = { count: 0, title: res.title, topicName: topic.name };
  save.missLog[key].count++;
  save.missLog[key].title = res.title;
}

/* 分数を 帯分数で表示する（整数／真分数／帯分数）。n/d は既約の想定。 */
function mixedHTML(n, d) {
  if (d === 1 || n % d === 0) return `${n / d}`;   // 整数
  if (n < d) return fr(n, d);                       // 真分数
  const w = Math.floor(n / d);                      // 帯分数
  return `${w}${fr(n - w * d, d)}`;
}

/* ---------- 正答の表示 ---------- */
function formatAnswer(topic, p) {
  const a = p.answer;
  if (topic.answerType === "mixed") {
    const [n, d] = p.reduced || [a.n, a.d];
    return mixedHTML(n, d);
  }
  if (topic.answerType === "frac") {
    // reduced があればそれを（約分・計算系）、なければ answer をそのまま（通分など）
    const [n, d] = p.reduced || [a.n, a.d];
    return d === 1 ? `${n}` : fr(n, d);
  }
  if (topic.answerType === "twofrac")
    return `( ${fr(a.n1, a.d)} , ${fr(a.n2, a.d)} )`;
  if (topic.answerType === "quorem")
    return a.r === 0 ? `${a.q}` : `${a.q} あまり ${a.r}`;
  return `${a}${p.unit ? p.unit : ""}`;
}

/* ---------- 演出 ---------- */
function flashInput() {
  document.querySelectorAll(".fld").forEach((f) => {
    f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
  });
}
// 不正解時：問題カード全体をシェイク
function shakeBox() {
  const box = document.querySelector(".problem-box");
  if (!box) return;
  box.classList.remove("shake-box"); void box.offsetWidth; box.classList.add("shake-box");
}
function burst() {
  const box = document.createElement("div");
  box.className = "confetti";
  const emojis = ["⭐", "✨", "🎊", "🌟", "💫"];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement("span");
    s.textContent = pick(emojis);
    s.style.left = Math.random() * 100 + "%";
    s.style.animationDelay = Math.random() * 0.3 + "s";
    s.style.fontSize = 14 + Math.random() * 18 + "px";
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1400);
}

/* ---------- 起動 ---------- */
initStars();
renderHome();
