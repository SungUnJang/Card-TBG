// 멘헤라 대전 - 화면 / 네트워크
(function () {
  const $ = s => document.querySelector(s);
  const G = MH.GAME;
  let ws = null, myId = null, myNick = localStorage.getItem('mh_nick') || '', room = null, timeOffset = 0;
  let picks = [], picksRound = -1, readySent = false, inBattle = false, timerIv = null, hoverCard = null;

  // ---------------- 화면 크기 맞추기 ----------------
  function fit() { const s = Math.min(innerWidth / 1280, innerHeight / 720); $('#stage').style.transform = `scale(${s})`; }
  addEventListener('resize', fit); fit();

  function show(id) {
    ['#scr-lobby', '#scr-room', '#scr-char', '#scr-skill', '#scr-battle'].forEach(s => $(s).classList.toggle('hidden', s !== id));
    if (id !== '#scr-battle') { $('#scr-result').classList.add('hidden'); Battle.stop(); }
  }
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const art = (chId, n) => `assets/chars/${chId}/card${n}.jpg`;

  // ---------------- 네트워크 ----------------
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    $('#connState').textContent = '서버 연결 중…';
    ws.onopen = () => { $('#connState').textContent = '연결됨'; if (myNick && !$('#roomBox').classList.contains('hidden')) send({ t: 'hello', nick: myNick }); };
    ws.onmessage = e => onMsg(JSON.parse(e.data));
    ws.onclose = () => {
      $('#connState').textContent = '연결이 끊겼어요. 다시 연결 중…';
      if (room) { room = null; toast('서버와 연결이 끊겼어요.'); goLobby(); }
      setTimeout(connect, 1500);
    };
  }
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

  function onMsg(m) {
    switch (m.t) {
      case 'welcome': myId = m.id; break;
      case 'hello': myNick = m.nick; $('#meNick').textContent = m.nick; renderRooms(m.rooms); break;
      case 'rooms': renderRooms(m.rooms); break;
      case 'error': toast(m.msg); break;
      case 'notice': toast(m.msg); break;
      case 'left': room = null; goLobby(); renderRooms(m.rooms); break;
      case 'room': onRoom(m.room); break;
      case 'battle': onBattle(m); break;
    }
  }

  // ---------------- 로비 ----------------
  $('#nickInput').value = myNick;
  function enterLobby() {
    const n = $('#nickInput').value.trim();
    if (!n) return toast('닉네임을 입력해주세요.');
    myNick = n; localStorage.setItem('mh_nick', n);
    send({ t: 'hello', nick: n });
    $('#nickBox').classList.add('hidden'); $('#roomBox').classList.remove('hidden');
  }
  $('#nickOk').onclick = enterLobby;
  $('#nickInput').onkeydown = e => { if (e.key === 'Enter') enterLobby(); };
  $('#btnCreate').onclick = () => send({ t: 'create' });
  $('#btnJoin').onclick = () => { const c = $('#codeInput').value.trim(); if (c) send({ t: 'join', code: c }); };
  $('#codeInput').onkeydown = e => { if (e.key === 'Enter') $('#btnJoin').click(); };
  $('#btnRefresh').onclick = () => send({ t: 'rooms' });
  function renderRooms(list) {
    const el = $('#roomList');
    if (!list || !list.length) { el.innerHTML = '<div class="empty">열린 방이 없어요. 방을 만들어 보세요!</div>'; return; }
    el.innerHTML = list.map(r => `<div class="room-item" data-code="${r.code}"><span><b>${r.code}</b> · ${esc(r.host || '')}의 방</span><span>참가 ▶</span></div>`).join('');
    el.querySelectorAll('.room-item').forEach(it => it.onclick = () => send({ t: 'join', code: it.dataset.code }));
  }
  function goLobby() { inBattle = false; show('#scr-lobby'); clearInterval(timerIv); }

  // ---------------- 대기실 ----------------
  $('#btnStart').onclick = () => send({ t: 'start' });
  $('#btnLeave').onclick = () => send({ t: 'leave' });
  function renderWaiting() {
    show('#scr-room');
    $('#roomCode').textContent = room.code;
    [0, 1].forEach(i => {
      const p = room.players[i], el = $('#wp' + i);
      el.className = 'wp' + (p ? ' on' : '');
      el.innerHTML = p ? `${esc(p.nick)}${i === 0 ? '<span class="host">방장</span>' : ''}${p.id === myId ? ' <span class="host" style="color:#4ad0ff">(나)</span>' : ''}` : '빈 자리';
    });
    const isHost = room.host === myId, full = room.players.length === 2;
    $('#btnStart').disabled = !(isHost && full);
    $('#btnStart').style.display = isHost ? '' : 'none';
    $('#waitHint').textContent = !full ? '상대를 기다리는 중… 방 번호를 알려주세요!' : isHost ? '상대가 들어왔어요! 게임 시작을 눌러주세요.' : '방장이 게임을 시작하길 기다리는 중…';
  }

  function me() { return room.players.find(p => p.id === myId); }
  function mySide() { return room.players.findIndex(p => p.id === myId); }

  function onRoom(r) {
    room = r; timeOffset = r.now - Date.now();
    if (r.phase === 'waiting') { inBattle = false; renderWaiting(); }
    else if (r.phase === 'charselect') { inBattle = false; renderChar(); }
    else if (r.phase === 'skillselect') { if (!inBattle) renderSkill(); }
    else if (r.phase === 'result') { if (!inBattle) showResult(); }
  }

  // ---------------- 캐릭터 선택 ----------------
  $('#btnCharOk').onclick = () => send({ t: 'confirmChar' });
  function renderChar() {
    show('#scr-char');
    const grid = $('#csGrid'), mine = me();
    let html = '';
    for (let i = 0; i < MH.SELECT_SLOTS; i++) {
      const ch = MH.CHARACTERS[i];
      if (!ch) { html += `<div class="cs-tile lock"><div class="q">?</div><div class="nm">(?) 미구현</div></div>`; continue; }
      const owner = room.players.find(p => p.char === ch.id);
      const cls = owner ? (owner.id === myId ? ' mine' : ' taken') : '';
      const tag = owner ? `<div class="tag${owner.id === myId ? ' me' : ''}">${owner.id === myId ? '나' : esc(owner.nick)}</div>` : '';
      html += `<div class="cs-tile${cls}" data-id="${ch.id}"><img src="assets/chars/${ch.id}/portrait.png" alt=""><div class="nm">${esc(ch.name)}</div>${tag}</div>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.cs-tile[data-id]').forEach(t => t.onclick = () => { if (!mine.charConfirmed) send({ t: 'pickChar', char: t.dataset.id }); });
    [0, 1].forEach(i => {
      const p = room.players[i], el = $('#csSide' + i);
      if (!p) { el.innerHTML = ''; return; }
      const ch = p.char && MH.CHAR_MAP[p.char];
      el.innerHTML = (ch ? `<img class="big" src="assets/chars/${ch.id}/battle.png">` : `<div class="placeholder">?</div>`) +
        `<div class="ped"></div><div class="who">${esc(p.nick)}${p.id === myId ? ' (나)' : ''}</div><div class="cname">${ch ? esc(ch.name) : '선택 중…'}</div>` +
        `<div class="st${p.charConfirmed ? ' ok' : ''}">${p.charConfirmed ? '결정 완료' : '고르는 중'}</div>`;
    });
    $('#btnCharOk').disabled = !mine.char || mine.charConfirmed;
    $('#csHint').textContent = mine.charConfirmed ? '상대가 결정하길 기다리는 중…' : '캐릭터를 고르고 결정을 눌러주세요 (같은 캐릭터는 고를 수 없어요)';
  }

  // ---------------- HUD ----------------
  function hudHtml(r, readyMarks) {
    const ps = r.players;
    const side = i => {
      const p = ps[i], ch = MH.CHAR_MAP[p.char], L = i === 0 ? 'l' : 'r';
      const gray = readyMarks && !p.ready && p.id !== myId ? ' gray' : '';
      return `<div class="por ${L}${gray}"><img src="assets/chars/${ch.id}/portrait.png"></div>
        <div class="nick ${L}">${i === 1 ? `<small>${esc(ch.name)}</small>` : ''}${esc(p.nick)}${p.id === myId ? ' <small>(나)</small>' : ''}${i === 0 ? `<small>${esc(ch.name)}</small>` : ''}</div>
        <div class="bar hp ${L}" data-k="hp${i}"><div class="ghost"></div><div class="fill"></div><div class="txt"></div></div>
        <div class="bar en ${L}" data-k="en${i}"><div class="fill"></div><div class="txt"></div></div>
        ${readyMarks && p.ready ? `<div class="ready-stamp ${L}">READY</div>` : ''}`;
    };
    return side(0) + side(1) + `<div class="emblem"><div class="r1">ROUND</div><div class="r2">${r.round}</div><div class="r3"></div></div>`;
  }
  function setBars(el, s) {
    s.forEach((q, i) => {
      const hp = el.querySelector(`[data-k=hp${i}]`), en = el.querySelector(`[data-k=en${i}]`);
      if (!hp) return;
      hp.querySelector('.fill').style.width = (q.hp / G.HP * 100) + '%';
      hp.querySelector('.ghost').style.width = (q.hp / G.HP * 100) + '%';
      hp.querySelector('.txt').textContent = 'HP ' + q.hp;
      en.querySelector('.fill').style.width = (q.en / G.EN_MAX * 100) + '%';
      en.querySelector('.txt').textContent = 'EN ' + q.en;
    });
  }

  // ---------------- 카드 ----------------
  function rangeGrid(card, side) {
    let w = 3, h = 3, cells = {}, cx = 1, cy = 1, self = 'c';
    if (card.type === 'attack') {
      const pr = card.parsed; w = pr.w; h = pr.h; cx = pr.cx; cy = pr.cy;
      const flip = G.MIRROR_FOR_RIGHT && side === 1 && !card.noMirror;
      pr.cells.forEach(([dx, dy]) => { cells[(flip ? -dx : dx) + ',' + dy] = 'h'; });
      if (flip) cx = w - 1 - cx;
    } else if (card.type === 'move') cells[card.dir[0] + ',' + card.dir[1]] = 'mv';
    else if (card.type === 'guard') cells['0,0'] = 'sh';
    else if (card.type === 'rest') cells['0,0'] = 'g';
    let html = `<div class="rg" style="grid-template-columns:repeat(${w},14px)">`;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (x - cx) + ',' + (y - cy);
      const isSelf = x === cx && y === cy;
      html += `<i class="${cells[k] || ''}${isSelf && card.type === 'attack' ? ' c' : ''}"></i>`;
    }
    return html + '</div>';
  }
  function statHtml(card) {
    const dn = String(card.dn).padStart(2, '0'), en = String(card.en).padStart(2, '0');
    if (card.type === 'rest') return `DN 00<br>EN <span class="plus">+${card.gain}</span>`;
    return `DN ${dn}<br>EN ${en}`;
  }

  // ---------------- 스킬 선택 ----------------
  function enChain(st, deck) {
    const out = []; let en = st.en;
    picks.forEach(id => { const c = deck.find(d => d.id === id); if (en >= c.en) en -= c.en; if (c.type === 'rest') en = Math.min(G.EN_MAX, en + c.gain); out.push(en); });
    return { list: out, now: en };
  }
  function sendPicks(ready) { send({ t: 'picks', picks, ready: !!ready }); }

  $('#btnReady').onclick = () => {
    if (readySent) return;
    readySent = true; sendPicks(true); renderSkill();
  };
  $('#btnReset').onclick = () => { if (readySent) return; picks = []; sendPicks(false); renderSkill(); };

  function renderSkill() {
    show('#scr-skill');
    if (picksRound !== room.round) { picksRound = room.round; picks = []; readySent = false; }
    const side = mySide(), p = me(), ch = MH.CHAR_MAP[p.char], st = room.state.p[side];
    if (p.ready) readySent = true;
    const hud = $('#hudSkill'); hud.innerHTML = hudHtml(room, true); setBars(hud, room.state.p);
    const chain = enChain(st, ch.deck), full = picks.length >= G.SLOTS;
    // 카드
    const grid = $('#cardGrid');
    grid.classList.toggle('locked', readySent);
    grid.innerHTML = ch.deck.map(c => {
      const dis = readySent || full || chain.now < c.en;
      const cnt = picks.filter(x => x === c.id).length;
      return `<div class="card t-${c.type}${dis ? ' dis' : ''}${cnt ? ' used' : ''}" data-id="${c.id}" style="--cc:${ch.color}">
        <img class="art" src="${art(ch.id, c.card)}" alt=""><div class="ttl">${esc(c.name)}</div>
        <div class="stat">${statHtml(c)}</div>${rangeGrid(c, side)}<div class="cnt">${cnt}</div></div>`;
    }).join('');
    grid.querySelectorAll('.card').forEach(el => {
      el.onclick = () => { if (el.classList.contains('dis')) { if (!readySent && !full) toast('기력(EN)이 부족해요!'); return; } picks.push(el.dataset.id); sendPicks(false); renderSkill(); };
      el.onmouseenter = () => { hoverCard = el.dataset.id; renderMini(); };
      el.onmouseleave = () => { hoverCard = null; renderMini(); };
    });
    // 슬롯
    const slots = $('#slots'); let sh = '';
    for (let i = 0; i < G.SLOTS; i++) {
      const id = picks[i];
      if (id) { const c = ch.deck.find(d => d.id === id); sh += `<div class="slot filled" data-i="${i}"><img src="${art(ch.id, c.card)}"><div class="no">0${i + 1}</div>${readySent ? '' : '<div class="x">✕</div>'}<div class="sn">${esc(c.name)}</div></div>`; }
      else sh += `<div class="slot${i === picks.length && !readySent ? ' next' : ''}">0${i + 1}${i === picks.length ? '<small>0' + (i + 1) + '카드 선택</small>' : ''}</div>`;
    }
    slots.innerHTML = sh;
    slots.querySelectorAll('.slot.filled').forEach(el => el.onclick = () => { if (readySent) return; picks.splice(+el.dataset.i, 1); sendPicks(false); renderSkill(); });
    $('#btnReady').textContent = readySent ? '대기 중…' : '준비완료';
    $('#btnReady').classList.toggle('on', readySent);
    $('#btnReady').disabled = readySent;
    $('#btnReset').disabled = readySent;
    $('#enPreview').textContent = `예상 기력: ${st.en}${chain.list.map(v => ' → ' + v).join('')}`;
    renderMini();
    startTimer();
  }

  function renderMini() {
    if (!room || room.phase !== 'skillselect') return;
    const side = mySide(), ch = MH.CHAR_MAP[me().char], st = room.state.p[side], foe = room.state.p[1 - side];
    const foeCh = room.players[1 - side].char;
    const cells = {}; const mark = (x, y, k, v) => { const key = x + ',' + y; cells[key] = cells[key] || {}; (cells[key][k] = cells[key][k] || []).push(v); };
    let pos = { x: st.x, y: st.y };
    picks.forEach((id, i) => {
      const c = ch.deck.find(d => d.id === id);
      if (c.type === 'move') { const nx = pos.x + c.dir[0], ny = pos.y + c.dir[1]; if (nx >= 0 && nx < G.COLS && ny >= 0 && ny < G.ROWS) pos = { x: nx, y: ny }; mark(pos.x, pos.y, 'step', i + 1); }
      if (c.type === 'attack') {
        MH.attackCells(c, pos, side).forEach(cl => mark(cl.x, cl.y, 'hit', i + 1));
        if (c.move) { const flip = G.MIRROR_FOR_RIGHT && side === 1 && !c.noMirror; const nx = pos.x + (flip ? -c.move[0] : c.move[0]), ny = pos.y + c.move[1]; if (nx >= 0 && nx < G.COLS && ny >= 0 && ny < G.ROWS) pos = { x: nx, y: ny }; mark(pos.x, pos.y, 'step', i + 1); }
      }
    });
    const hv = {};
    if (hoverCard) { const c = ch.deck.find(d => d.id === hoverCard); if (c && c.type === 'attack') MH.attackCells(c, pos, side).forEach(cl => hv[cl.x + ',' + cl.y] = 1); }
    let html = '';
    for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) {
      const k = x + ',' + y, m = cells[k] || {};
      let inner = '';
      if (m.hit) inner += `<span class="nums">${m.hit.join(',')}</span>`;
      if (m.step) inner += `<span class="stepno">▶${m.step.join(',')}</span>`;
      if (foe.x === x && foe.y === y) inner += `<img class="u foe" src="assets/chars/${foeCh}/sprite.png">`;
      if (st.x === x && st.y === y && (pos.x !== x || pos.y !== y)) inner += `<img class="u ghost${side === 1 ? ' foe' : ''}" style="opacity:.35" src="assets/chars/${ch.id}/sprite.png">`;
      if (pos.x === x && pos.y === y) inner += `<img class="u" style="${side === 1 ? 'transform:scaleX(-1)' : ''}" src="assets/chars/${ch.id}/sprite.png">`;
      html += `<div class="mb-cell${m.hit ? ' hl' : ''}${hv[k] ? ' hv' : ''}">${inner}</div>`;
    }
    $('#miniBoard').innerHTML = html;
  }

  function startTimer() {
    clearInterval(timerIv);
    const tick = () => {
      const el = document.querySelector('#hudSkill .r3'); if (!el || !room) return;
      const left = Math.max(0, Math.ceil((room.deadline - (Date.now() + timeOffset)) / 1000));
      el.textContent = `⏱ ${left}초`; el.classList.toggle('warn', left <= 5);
    };
    tick(); timerIv = setInterval(tick, 250);
  }

  // ---------------- 전투 ----------------
  function onBattle(m) {
    clearInterval(timerIv);
    room = m.room; inBattle = true;
    show('#scr-battle');
    const hud = $('#hudBattle'); hud.innerHTML = hudHtml(room, false);
    hud.querySelector('.r3').textContent = '';
    const init = m.events[0].s;
    setBars(hud, init);
    Battle.start(room, myId, init);
    const ci = [$('#ci0'), $('#ci1')];
    let curCards = null;
    const hooks = {
      bars: s => setBars(hud, s),
      banner: (big, small) => { const b = $('#centerBanner'); b.innerHTML = esc(big) + (small ? `<small>${esc(small)}</small>` : ''); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); },
      cutin: (slot, cards) => {
        const box = $('#cutin');
        if (slot == null) { box.classList.remove('show'); return; }
        curCards = cards;
        cards.forEach((id, i) => {
          const chId = room.players[i].char, c = MH.getCard(chId, id);
          ci[i].style.backgroundImage = `url(${art(chId, c.card)})`;
          ci[i].style.setProperty('--cc', MH.CHAR_MAP[chId].color);
          ci[i].innerHTML = `<div class="n">${esc(c.name)}</div>`;
          ci[i].classList.remove('act');
        });
        $('#ciSlot').textContent = `${slot + 1}번째 카드`;
        box.classList.add('show');
      },
      act: pid => ci.forEach((el, i) => el.classList.toggle('act', i === pid)),
      skill: (ch, card) => { const b = $('#skillBanner'); b.style.setProperty('--cc', ch.color); b.querySelector('span').textContent = card.name; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); },
    };
    Battle.play(m.events, hooks).then(() => {
      const end = m.events[m.events.length - 1];
      if (end.winner != null) { room.winner = end.winner; showResult(); }
      inBattle = false;
      send({ t: 'animDone' });
    });
  }

  // ---------------- 결과 ----------------
  $('#btnRematch').onclick = () => { send({ t: 'rematch' }); $('#btnRematch').disabled = true; $('#rematchHint').textContent = '상대의 응답을 기다리는 중…'; };
  $('#btnExit').onclick = () => send({ t: 'leave' });
  function showResult() {
    const w = room.players[room.winner]; if (!w) return;
    if ($('#scr-battle').classList.contains('hidden')) show('#scr-battle');
    const r = $('#scr-result'); const wasHidden = r.classList.contains('hidden');
    r.classList.remove('hidden');
    $('#vicNick').textContent = w.nick;
    $('#vicChar').textContent = MH.CHAR_MAP[w.char].name + (w.id === myId ? ' · 승리했어요!' : '');
    $('#vicSprite').src = `assets/chars/${w.char}/battle.png`;
    const mine = me();
    if (wasHidden) { $('#btnRematch').disabled = false; $('#rematchHint').textContent = ''; }
    const other = room.players.find(p => p.id !== myId);
    if (mine && mine.wantsRematch) { $('#btnRematch').disabled = true; $('#rematchHint').textContent = '상대의 응답을 기다리는 중…'; }
    else if (other && other.wantsRematch) $('#rematchHint').textContent = `${other.nick} 님이 다시 하기를 원해요!`;
  }

  connect();
})();
