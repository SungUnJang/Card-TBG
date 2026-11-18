// 멘헤라 대전 - 서버 (외부 패키지 없이 Node.js 만으로 동작)
// 실행: node server.js   (Render: Start Command = node server.js)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MH = require('./public/js/data.js');
const { GAME } = MH;

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };

// ---------------- 정적 파일 ----------------
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  const fp = path.normalize(path.join(PUB, p));
  if (!fp.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': p.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache' });
    res.end(data);
  });
});

// ---------------- 최소 WebSocket 구현 ----------------
let nextId = 1;
const clients = new Map(); // id -> client

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = { id: 'p' + (nextId++), socket, buf: Buffer.alloc(0), frags: [], nick: '', room: null, alive: true };
  clients.set(c.id, c);
  socket.on('data', d => { c.buf = Buffer.concat([c.buf, d]); parseFrames(c); });
  socket.on('close', () => onClose(c));
  socket.on('error', () => onClose(c));
  send(c, { t: 'welcome', id: c.id });
});

function parseFrames(c) {
  while (c.buf.length >= 2) {
    const b0 = c.buf[0], b1 = c.buf[1];
    const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, off = 2;
    if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
    if (len > 1e6) return c.socket.destroy();
    const need = off + (masked ? 4 : 0) + len;
    if (c.buf.length < need) return;
    let payload = c.buf.slice(off + (masked ? 4 : 0), need);
    if (masked) { const m = c.buf.slice(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
    c.buf = c.buf.slice(need);
    if (op === 0x8) { try { c.socket.end(Buffer.from([0x88, 0])); } catch (e) {} return onClose(c); }
    if (op === 0x9) { rawSend(c, payload, 0xA); continue; }
    if (op === 0xA) { c.alive = true; continue; }
    if (op === 0x1 || op === 0x0) {
      c.frags.push(payload);
      if (fin) { const txt = Buffer.concat(c.frags).toString('utf8'); c.frags = []; let msg; try { msg = JSON.parse(txt); } catch (e) { continue; } c.alive = true; try { handle(c, msg); } catch (e) { console.error(e); } }
    }
  }
}
function rawSend(c, payload, op = 0x1) {
  if (!c.socket || c.socket.destroyed) return;
  const len = payload.length; let h;
  if (len < 126) h = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
  try { c.socket.write(Buffer.concat([h, payload])); } catch (e) {}
}
function send(c, obj) { if (c) rawSend(c, Buffer.from(JSON.stringify(obj), 'utf8')); }
// 연결 유지 (Render 유휴 끊김 방지)
setInterval(() => { for (const c of clients.values()) rawSend(c, Buffer.alloc(0), 0x9); }, 25000);

// ---------------- 방 / 게임 ----------------
const rooms = new Map(); // code -> room

function makeCode() { let s; do { s = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(s)); return s; }
function roomList() {
  return [...rooms.values()].filter(r => r.phase === 'waiting' && r.players.length < 2)
    .map(r => ({ code: r.code, host: r.players[0] && r.players[0].nick }));
}
function broadcastLobby() { for (const c of clients.values()) if (!c.room) send(c, { t: 'rooms', rooms: roomList() }); }

function roomView(r) {
  return {
    code: r.code, phase: r.phase, round: r.round, host: r.players[0] && r.players[0].id,
    players: r.players.map((p, i) => ({ id: p.id, nick: p.nick, side: i, char: p.char, charConfirmed: p.charConfirmed, ready: p.ready, wantsRematch: p.wantsRematch })),
    deadline: r.deadline || 0, now: Date.now(), state: r.state || null, winner: r.winner != null ? r.winner : null,
    test: r.test ? { botMode: r.botMode, infEn: r.infEn, noTimer: r.noTimer } : null,
  };
}
function sync(r) { r.players.forEach(p => send(clients.get(p.id), { t: 'room', room: roomView(r), you: p.id })); }

function playerOf(r, c) { return r.players.find(p => p.id === c.id); }

function leaveRoom(c) {
  const r = c.room && rooms.get(c.room); c.room = null;
  if (!r) return;
  r.players = r.players.filter(p => p.id !== c.id);
  clearTimeout(r.timer); clearTimeout(r.animTimer);
  if (r.players.every(p => p.bot)) rooms.delete(r.code); // 사람이 없으면 방 삭제 (테스트 방 포함)
  else {
    // 남은 사람은 대기실로 (방장이 됨)
    r.phase = 'waiting'; r.state = null; r.winner = null; r.round = 0;
    r.players.forEach(p => { p.char = null; p.charConfirmed = false; p.ready = false; p.picks = []; p.wantsRematch = false; });
    r.players.forEach(p => send(clients.get(p.id), { t: 'notice', msg: '상대가 나갔습니다. 새 상대를 기다립니다.' }));
    sync(r);
  }
  broadcastLobby();
}
function onClose(c) {
  if (!clients.has(c.id)) return;
  clients.delete(c.id);
  leaveRoom(c);
}

function newPlayer(c) { return { id: c.id, nick: c.nick, char: null, charConfirmed: false, ready: false, picks: [], wantsRematch: false }; }

function startCharSelect(r) {
  r.phase = 'charselect'; r.round = 0; r.winner = null; r.state = null;
  r.players.forEach(p => { p.char = null; p.charConfirmed = false; p.ready = false; p.picks = []; p.wantsRematch = !!p.bot; });
  sync(r);
}

function startBattleSetup(r) {
  r.state = { p: r.players.map((p, i) => ({ hp: GAME.HP, en: GAME.EN, x: GAME.START[i].x, y: GAME.START[i].y })) };
  r.round = 0;
  startSkillSelect(r);
}
function startSkillSelect(r) {
  r.round++;
  r.phase = 'skillselect';
  r.players.forEach(p => { p.ready = false; p.picks = []; });
  if (r.test && r.infEn) r.state.p.forEach(q => { q.en = GAME.EN_MAX; }); // 테스트: 기력 무한
  clearTimeout(r.timer);
  if (r.test && r.noTimer) r.deadline = 0;
  else {
    r.deadline = Date.now() + GAME.SELECT_TIME * 1000;
    r.timer = setTimeout(() => runBattle(r), GAME.SELECT_TIME * 1000 + 600); // 약간의 여유
  }
  r.players.forEach(p => { if (p.bot) botPick(r, p); });
  sync(r);
}

// ---------------- 테스트용 CPU ----------------
function botPick(r, p) {
  const side = r.players.indexOf(p), ch = MH.CHAR_MAP[p.char];
  let en = r.state.p[side].en; const picks = [];
  for (let i = 0; i < GAME.SLOTS; i++) {
    let card;
    if (r.botMode === 'idle') card = ch.deck.find(c => c.id === 'rest');          // 가만히 (샌드백)
    else if (r.botMode === 'guard') card = ch.deck.find(c => c.id === 'guard');   // 방어만
    else {                                                                         // 랜덤
      const ok = ch.deck.filter(c => c.en <= en);
      const atk = ok.filter(c => c.type === 'attack');
      card = (atk.length && Math.random() < 0.5) ? atk[Math.floor(Math.random() * atk.length)] : ok[Math.floor(Math.random() * ok.length)];
    }
    if (en >= card.en) en -= card.en;
    if (card.type === 'rest') en = Math.min(GAME.EN_MAX, en + card.gain);
    picks.push(card.id);
  }
  p.picks = picks; p.ready = true;
}

function validPicks(charId, picks) {
  const ch = MH.CHAR_MAP[charId];
  return (Array.isArray(picks) ? picks : []).slice(0, GAME.SLOTS).filter(id => ch.deck.some(c => c.id === id));
}

// ---------------- 전투 시뮬레이션 (서버가 계산 → 결과를 화면이 재생) ----------------
function simulate(r) {
  const S = r.state;
  const ev = [];
  const snap = () => S.p.map(q => ({ hp: q.hp, en: q.en, x: q.x, y: q.y }));
  const first = (r.round - 1) % 2; // 라운드마다 선공 교대
  const order = [first, 1 - first];
  const decks = r.players.map(p => {
    const picks = p.picks.slice();
    while (picks.length < GAME.SLOTS) picks.push(GAME.AUTO_FILL);
    return picks;
  });
  ev.push({ type: 'round', round: r.round, first, picks: decks, s: snap() });
  let winner = null;
  for (let slot = 0; slot < GAME.SLOTS && winner == null; slot++) {
    const shield = [0, 0];
    ev.push({ type: 'slot', slot, cards: decks.map(d => d[slot]), s: snap() });
    // 1) 방어는 그 순서(슬롯)의 시작에 먼저 발동
    for (const pid of order) {
      const card = MH.getCard(r.players[pid].char, decks[pid][slot]);
      if (card.type !== 'guard') continue;
      const P = S.p[pid];
      if (P.en < card.en) { ev.push({ type: 'fail', pid, card: card.id, s: snap() }); continue; }
      P.en -= card.en; shield[pid] = card.dn;
      ev.push({ type: 'guard', pid, card: card.id, amount: card.dn, s: snap() });
    }
    // 2) 번갈아가며 사용
    for (const pid of order) {
      if (winner != null) break;
      const card = MH.getCard(r.players[pid].char, decks[pid][slot]);
      if (card.type === 'guard') continue;
      const P = S.p[pid], E = S.p[1 - pid];
      if (P.en < card.en) { ev.push({ type: 'fail', pid, card: card.id, s: snap() }); continue; }
      P.en -= card.en;
      if (card.type === 'move') {
        const from = { x: P.x, y: P.y };
        const nx = P.x + card.dir[0], ny = P.y + card.dir[1];
        const blocked = nx < 0 || nx >= GAME.COLS || ny < 0 || ny >= GAME.ROWS;
        if (!blocked) { P.x = nx; P.y = ny; }
        ev.push({ type: 'move', pid, card: card.id, from, to: { x: P.x, y: P.y }, blocked, s: snap() });
      } else if (card.type === 'rest') {
        const before = P.en; P.en = Math.min(GAME.EN_MAX, P.en + (card.gain || 0));
        ev.push({ type: 'rest', pid, card: card.id, amount: P.en - before, s: snap() });
      } else if (card.type === 'attack') {
        const from = { x: P.x, y: P.y };
        const cells = MH.attackCells(card, P, pid);
        const hit = cells.some(c => c.x === E.x && c.y === E.y);
        let dmg = 0, blocked = 0;
        if (hit) { blocked = Math.min(card.dn, shield[1 - pid]); dmg = Math.max(0, card.dn - shield[1 - pid]); E.hp = Math.max(0, E.hp - dmg); }
        let to = null;
        if (card.move) {
          const flip = GAME.MIRROR_FOR_RIGHT && pid === 1 && !card.noMirror;
          const nx = P.x + (flip ? -card.move[0] : card.move[0]), ny = P.y + card.move[1];
          if (nx >= 0 && nx < GAME.COLS && ny >= 0 && ny < GAME.ROWS) { P.x = nx; P.y = ny; }
          to = { x: P.x, y: P.y };
        }
        ev.push({ type: 'attack', pid, card: card.id, from, cells, hit, dmg, blocked, to, s: snap() });
        if (E.hp <= 0) { winner = pid; ev.push({ type: 'ko', pid: 1 - pid, winner: pid, s: snap() }); }
      }
    }
  }
  ev.push({ type: 'end', winner, s: snap() });
  return { events: ev, winner };
}

function runBattle(r) {
  if (r.phase !== 'skillselect') return;
  clearTimeout(r.timer);
  r.players.forEach(p => { p.picks = validPicks(p.char, p.picks); });
  const { events, winner } = simulate(r);
  r.phase = 'battle'; r.winner = winner; r.animDone = new Set(r.players.filter(p => p.bot).map(p => p.id));
  r.players.forEach(p => send(clients.get(p.id), { t: 'battle', events, room: roomView(r), you: p.id }));
  // 두 화면의 재생이 끝나면 다음 라운드 (최대 60초 대기)
  clearTimeout(r.animTimer);
  r.animTimer = setTimeout(() => afterBattle(r), 60000);
}
function afterBattle(r) {
  if (r.phase !== 'battle') return;
  clearTimeout(r.animTimer);
  if (r.winner != null) { r.phase = 'result'; sync(r); }
  else startSkillSelect(r);
}

// ---------------- 메시지 처리 ----------------
function handle(c, m) {
  const r = c.room ? rooms.get(c.room) : null;
  switch (m.t) {
    case 'hello':
      c.nick = String(m.nick || '').trim().slice(0, 10) || ('무사' + c.id.slice(1));
      send(c, { t: 'hello', nick: c.nick, rooms: roomList() });
      break;
    case 'rooms': send(c, { t: 'rooms', rooms: roomList() }); break;
    case 'create': {
      if (c.room) leaveRoom(c);
      const code = makeCode();
      const room = { code, phase: 'waiting', round: 0, players: [newPlayer(c)] };
      rooms.set(code, room); c.room = code; sync(room); broadcastLobby();
      break;
    }
    case 'join': {
      const room = rooms.get(String(m.code || '').trim());
      if (!room) return send(c, { t: 'error', msg: '방을 찾을 수 없어요.' });
      if (room.players.length >= 2 || room.phase !== 'waiting') return send(c, { t: 'error', msg: '이미 가득 찬 방이에요.' });
      if (c.room) leaveRoom(c);
      room.players.push(newPlayer(c)); c.room = room.code;
      sync(room); broadcastLobby();
      break;
    }
    case 'leave': leaveRoom(c); send(c, { t: 'left', rooms: roomList() }); break;
    case 'solo': { // 혼자 테스트: CPU 와 대전
      if (c.room) leaveRoom(c);
      const code = 'T' + makeCode();
      const bot = { id: 'bot-' + c.id, nick: 'CPU', bot: true, char: null, charConfirmed: false, ready: false, picks: [], wantsRematch: true };
      const room = { code, test: true, botMode: 'random', infEn: false, noTimer: true, phase: 'waiting', round: 0, players: [newPlayer(c), bot] };
      rooms.set(code, room); c.room = code;
      startCharSelect(room); bot.wantsRematch = true;
      break;
    }
    case 'pickBot': { // 테스트 방: CPU 캐릭터 고르기
      if (!r || !r.test || r.phase !== 'charselect') return;
      const me = playerOf(r, c), bot = r.players.find(p => p.bot);
      if (!me.charConfirmed || !MH.CHAR_MAP[m.char] || m.char === me.char) return;
      bot.char = m.char; bot.charConfirmed = true;
      startBattleSetup(r);
      break;
    }
    case 'testOpt': { // 테스트 방 옵션
      if (!r || !r.test) return;
      if (m.key === 'botMode') r.botMode = ({ random: 'idle', idle: 'guard', guard: 'random' })[r.botMode];
      if (m.key === 'infEn') { r.infEn = !r.infEn; if (r.infEn && r.state) r.state.p.forEach(q => { q.en = GAME.EN_MAX; }); }
      if (m.key === 'noTimer') {
        r.noTimer = !r.noTimer;
        if (r.phase === 'skillselect') {
          clearTimeout(r.timer);
          if (r.noTimer) r.deadline = 0;
          else { r.deadline = Date.now() + GAME.SELECT_TIME * 1000; r.timer = setTimeout(() => runBattle(r), GAME.SELECT_TIME * 1000 + 600); }
        }
      }
      if (m.key === 'heal' && r.state) r.state.p.forEach(q => { q.hp = GAME.HP; });
      if (r.phase === 'skillselect') r.players.forEach(p => { if (p.bot) botPick(r, p); });
      sync(r);
      break;
    }
    case 'start':
      if (r && r.phase === 'waiting' && r.players.length === 2 && r.players[0].id === c.id) { startCharSelect(r); broadcastLobby(); }
      break;
    case 'pickChar': {
      if (!r || r.phase !== 'charselect') return;
      const p = playerOf(r, c); if (!p || p.charConfirmed) return;
      if (!MH.CHAR_MAP[m.char]) return;
      if (r.players.some(q => q !== p && q.char === m.char)) return send(c, { t: 'error', msg: '상대가 이미 고른 캐릭터예요.' });
      p.char = m.char; sync(r);
      break;
    }
    case 'confirmChar': {
      if (!r || r.phase !== 'charselect') return;
      const p = playerOf(r, c); if (!p || !p.char) return;
      p.charConfirmed = true;
      if (r.players.length === 2 && r.players.every(q => q.charConfirmed)) startBattleSetup(r); else sync(r);
      break;
    }
    case 'picks': {
      if (!r || r.phase !== 'skillselect') return;
      const p = playerOf(r, c); if (!p || p.ready) return;
      p.picks = validPicks(p.char, m.picks);
      if (m.ready) {
        p.ready = true;
        if (r.players.every(q => q.ready)) { sync(r); setTimeout(() => runBattle(r), 700); }
        else sync(r);
      }
      break;
    }
    case 'animDone':
      if (!r || r.phase !== 'battle') return;
      r.animDone.add(c.id);
      if (r.players.every(p => r.animDone.has(p.id))) afterBattle(r);
      break;
    case 'rematch': {
      if (!r || r.phase !== 'result') return;
      const p = playerOf(r, c); p.wantsRematch = true;
      if (r.players.length === 2 && r.players.every(q => q.wantsRematch)) startCharSelect(r); else sync(r);
      break;
    }
  }
}

server.listen(PORT, () => console.log('멘헤라 대전 서버 실행 중: http://localhost:' + PORT));
