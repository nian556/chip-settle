// Tailwind 自訂顏色與字型（對應 style.css 的色彩變數）
tailwind.config = {
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', sunken: 'var(--sunken)',
        ink: 'var(--ink)', muted: 'var(--muted)', line: 'var(--line)',
        accent: 'var(--accent)', 'accent-ink': 'var(--accent-ink)', 'accent-soft': 'var(--accent-soft)',
        error: 'var(--error)', 'error-soft': 'var(--error-soft)'
      },
      fontFamily: {
        display: ['"Noto Serif TC"', '"PMingLiU"', 'serif'],
        sans: ['"Noto Sans TC"', '"Microsoft JhengHei"', '"PingFang TC"', 'system-ui', 'sans-serif'],
        num: ['"Roboto Mono"', 'ui-monospace', 'Consolas', 'monospace']
      }
    }
  }
};

(function () {
  const STORE_KEY = 'mj-settle-v1';
  const $ = (id) => document.getElementById(id);

  function defaults() {
    return {
      initAll: 2000, rate: 1, sample: false,
      players: ['A', 'B', 'C', 'D'].map((c) => ({ name: '玩家 ' + c, initial: 2000, final: '' }))
    };
  }
  function sample() {
    const s = defaults();
    [3250, 1580, 2470, 700].forEach((v, i) => { s.players[i].final = v; });
    s.sample = true;
    return s;
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && Array.isArray(s.players) && s.players.length >= 2 ? s : null;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 無法儲存時照常運作 */ }
  }

  let state = load() || sample();

  // ---------- 工具 ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 計算邏輯放在 calc.js
  const { num, settle } = ChipCalc;
  const fmt = (n) => n.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
  const money = (cents) => fmt(Math.abs(cents) / 100) + ' 元';
  const signed = (cents) => (cents > 0 ? '+' : cents < 0 ? '−' : '') + money(cents);
  const nameOf = (i) => (state.players[i].name || '').trim() || ('玩家 ' + (i + 1));

  const compute = () => ChipCalc.compute(state);

  // ---------- 畫面 ----------
  function playerCard(p, i) {
    const canRemove = state.players.length > 2;
    return `
      <div class="rounded-2xl bg-surface border border-line p-3 flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <input id="name-${i}" data-i="${i}" data-k="name" type="text" value="${esc(p.name)}" aria-label="第 ${i + 1} 位玩家名字"
                 class="flex-1 min-w-0 h-11 rounded-lg bg-transparent px-2 text-lg font-bold border border-transparent hover:border-line focus:border-line">
          ${canRemove ? `<button type="button" data-remove="${i}" aria-label="移除 ${esc(p.name)}"
                 class="h-11 w-11 flex-none rounded-lg text-2xl leading-none text-muted hover:bg-sunken">×</button>` : ''}
        </div>
        <div class="grid grid-cols-[1fr_1.5fr] gap-2">
          <label class="flex flex-col gap-1 min-w-0">
            <span class="text-xs text-muted">帶入</span>
            <input id="init-${i}" data-i="${i}" data-k="initial" type="number" inputmode="numeric" step="any" value="${esc(p.initial)}"
                   class="num h-12 w-full rounded-xl border border-line bg-sunken px-3 text-base text-muted">
          </label>
          <label class="flex flex-col gap-1 min-w-0">
            <span class="text-xs text-muted">結算剩餘籌碼</span>
            <input id="final-${i}" data-i="${i}" data-k="final" type="number" inputmode="numeric" step="any" value="${esc(p.final)}" placeholder="輸入籌碼"
                   class="num h-12 w-full rounded-xl border-2 border-accent bg-surface px-3 text-xl font-bold">
          </label>
        </div>
        <div class="flex items-center justify-between gap-2 border-t border-line pt-2">
          <span class="text-sm text-muted">損益</span>
          <span data-pnl="${i}" class="num font-bold text-right"></span>
        </div>
      </div>`;
  }

  function renderPlayers() {
    $('players').innerHTML = state.players.map(playerCard).join('');
    $('addPlayer').hidden = state.players.length >= 8;
    renderResults();
  }

  function renderSettings() {
    $('initAll').value = state.initAll;
    $('rate').value = state.rate;
  }

  function renderResults() {
    const r = compute();
    $('sampleNote').hidden = !state.sample;

    // 每張玩家卡的損益
    r.rows.forEach((row) => {
      const el = document.querySelector(`[data-pnl="${row.i}"]`);
      if (!el) return;
      if (row.diff === null) { el.textContent = '—'; el.className = 'num font-bold text-right text-muted'; return; }
      const chips = (row.diff > 0 ? '+' : row.diff < 0 ? '−' : '') + fmt(Math.abs(row.diff)) + ' 籌碼';
      const showMoney = num(state.rate) !== 1;
      el.textContent = showMoney ? `${chips}（${signed(row.cents)}）` : signed(row.cents);
      el.className = 'num font-bold text-right text-ink';
    });

    // 防呆檢核
    const st = $('status');
    if (r.missing > 0) {
      st.innerHTML = `<div class="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        還有 <b class="text-ink">${r.missing}</b> 位玩家沒填結算籌碼。</div>`;
    } else if (r.gap !== 0) {
      st.innerHTML = `<div class="rounded-xl border-2 border-error bg-error-soft px-4 py-3 text-error">
        <p class="font-bold text-base">⚠ 籌碼總數對不上，${r.gap > 0 ? '多了' : '少了'} <span class="num">${fmt(Math.abs(r.gap))}</span></p>
        <p class="text-sm mt-1">結算合計 <span class="num">${fmt(r.totalFin)}</span>，帶入合計 <span class="num">${fmt(r.totalInit)}</span>。請重新點一次籌碼，或檢查有沒有打錯。</p>
      </div>`;
    } else {
      st.innerHTML = `<div class="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm text-ink">
        ✓ 籌碼總數相符（合計 <span class="num font-bold">${fmt(r.totalFin)}</span>）</div>`;
    }

    // 盈虧
    const pnl = $('pnl');
    if (!r.balanced) {
      pnl.innerHTML = `<p class="text-sm text-muted">全部填好、而且總數相符後，這裡會列出每個人輸贏多少。</p>`;
      $('pnlTotal').textContent = '';
    } else {
      // 排序：贏最多 → 輸最多
      const sorted = [...r.rows].sort((a, b) => b.cents - a.cents);
      const max = Math.max(1, ...sorted.map((x) => Math.abs(x.cents)));
      // 圖例：中線是 0，左邊是輸、右邊是贏
      const legend = `<div class="flex justify-between text-xs text-muted -mb-1"><span>← 輸</span><span>0</span><span>贏 →</span></div>`;
      pnl.innerHTML = legend + sorted.map((x) => {
        const kind = x.cents > 0 ? 'win' : x.cents < 0 ? 'loss' : '';
        // 條的長度最多佔半邊（50%）
        const w = (Math.abs(x.cents) / max * 50).toFixed(1);
        return `
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span class="truncate font-medium">${esc(nameOf(x.i))}</span>
          <span class="num text-lg font-bold text-right ${kind ? 'text-' + kind : 'text-muted'}">${signed(x.cents)}</span>
          <div class="col-span-2 pnl-track">${kind ? `<div class="bar ${kind}" style="width:${w}%"></div>` : ''}</div>
        </div>`;
      }).join('');
      const total = r.rows.reduce((a, x) => a + x.cents, 0);
      $('pnlTotal').textContent = `合計 ${money(total)} ✓`;
    }

    // 付款方案
    const list = $('transfers');
    if (!r.balanced) {
      list.innerHTML = `<li class="text-sm text-muted">籌碼總數相符後，會算出最少的付款方式。</li>`;
      $('txCount').textContent = '';
      $('copyBtn').hidden = true;
      $('copyBox').hidden = true;
      lastText = '';
      return;
    }
    const tx = settle(r.rows.map((x) => ({ i: x.i, amt: x.cents })));
    $('txCount').textContent = tx.length ? `共 ${tx.length} 筆，已是最少` : '';
    list.innerHTML = tx.length
      ? tx.map((t) => `
        <li class="flex items-center gap-3 rounded-xl border border-line bg-sunken px-3 py-3">
          <div class="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2">
            <span class="font-bold truncate max-w-full">${esc(nameOf(t.from))}</span>
            <span class="text-sm text-muted">付給</span>
            <span class="font-bold truncate max-w-full">${esc(nameOf(t.to))}</span>
          </div>
          <span class="num text-xl font-bold flex-none">${money(t.amt)}</span>
        </li>`).join('')
      : `<li class="text-sm text-muted">大家打平，不用付錢。</li>`;

    // 準備複製文字
    const d = new Date();
    const lines = [`籌碼結算 ${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`, '', '【盈虧】'];
    [...r.rows].sort((a, b) => b.cents - a.cents).forEach((x) => lines.push(`${nameOf(x.i)}  ${signed(x.cents)}`));
    lines.push('', '【付款】');
    if (tx.length) tx.forEach((t) => lines.push(`${nameOf(t.from)} → ${nameOf(t.to)}  ${money(t.amt)}`));
    else lines.push('大家打平');
    lastText = lines.join('\n');
    $('copyBtn').hidden = false;
    $('copyBox').hidden = true;
  }
  let lastText = '';

  // ---------- 事件 ----------
  $('players').addEventListener('input', (e) => {
    const el = e.target;
    const i = Number(el.dataset.i), k = el.dataset.k;
    if (!k || !state.players[i]) return;
    state.players[i][k] = el.value;
    if (k === 'final') state.sample = false;
    save();
    renderResults();
  });
  $('players').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    state.players.splice(Number(btn.dataset.remove), 1);
    save();
    renderPlayers();
  });
  $('addPlayer').addEventListener('click', () => {
    const n = state.players.length;
    state.players.push({ name: '玩家 ' + String.fromCharCode(65 + n), initial: state.initAll, final: '' });
    save();
    renderPlayers();
    const el = $('name-' + n);
    if (el) el.focus();
  });
  $('initAll').addEventListener('input', (e) => {
    state.initAll = e.target.value;
    state.players.forEach((p, i) => { p.initial = e.target.value; const el = $('init-' + i); if (el) el.value = e.target.value; });
    save();
    renderResults();
  });
  $('rate').addEventListener('input', (e) => { state.rate = e.target.value; save(); renderResults(); });

  $('newRound').addEventListener('click', () => {
    state.players.forEach((p) => { p.final = ''; });
    state.sample = false;
    save();
    renderPlayers();
    const el = $('final-0');
    if (el) el.focus();
  });

  // 「全部重設」要按兩次才執行，避免誤觸
  let armTimer = null;
  $('resetAll').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!armTimer) {
      btn.textContent = '再按一次確認';
      btn.classList.add('border-error', 'text-error');
      armTimer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    state = defaults();
    save();
    renderSettings();
    renderPlayers();
  });
  function disarm() {
    clearTimeout(armTimer);
    armTimer = null;
    const btn = $('resetAll');
    btn.textContent = '全部重設';
    btn.classList.remove('border-error', 'text-error');
  }

  $('copyBtn').addEventListener('click', () => {
    const btn = $('copyBtn');
    const done = () => { btn.textContent = '已複製 ✓'; setTimeout(() => { btn.textContent = '複製結算結果（貼到 LINE）'; }, 1800); };
    const fallback = () => {
      const box = $('copyBox');
      box.value = lastText;
      box.hidden = false;
      box.focus();
      box.select();
      btn.textContent = '無法自動複製，請手動複製下方文字';
    };
    try {
      navigator.clipboard.writeText(lastText).then(done, fallback);
    } catch (err) { fallback(); }
  });

  // ---------- 區塊收起 / 展開 ----------
  const FOLD_KEY = 'chip-settle-fold';
  let folded = {};
  try { folded = JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch (e) { folded = {}; }

  // 依照狀態切換內容顯示與按鈕文字
  function applyFold(btn, isFolded) {
    const body = $(btn.dataset.target);
    body.hidden = isFolded;
    btn.setAttribute('aria-expanded', String(!isFolded));
    btn.textContent = isFolded ? '展開' : '收起';
  }

  document.querySelectorAll('.fold-btn').forEach((btn) => {
    applyFold(btn, !!folded[btn.dataset.target]);
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-expanded') === 'true';
      folded[btn.dataset.target] = next;
      applyFold(btn, next);
      // 記住上次的開關狀態（存不了也沒關係）
      try { localStorage.setItem(FOLD_KEY, JSON.stringify(folded)); } catch (e) { /* 忽略 */ }
    });
  });

  // ---------- 啟動 ----------
  const d = new Date();
  $('today').textContent = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  renderSettings();
  renderPlayers();
})();
