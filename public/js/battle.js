// 멘헤라 대전 - 2.5D 전투 화면 (캔버스 렌더링 + 전투 재생)
(function () {
  const W = 1280, H = 720;
  const imgCache = {};
  function img(src) { if (!imgCache[src]) { const i = new Image(); i.src = src; imgCache[src] = i; } return imgCache[src]; }
  const BG = img('assets/battle_bg.jpg');
  // 스프라이트를 한 가지 색으로 칠한 실루엣 (피격 깜빡임 / 오라 테두리용)
  function tinted(im, color) {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function tint(u, color) { u.tints = u.tints || {}; if (!u.tints[color] && u.img.complete && u.img.naturalWidth) u.tints[color] = tinted(u.img, color); return u.tints[color]; }

  // ---- 2.5D 원근 투영: 판 좌표(gx 0~4, gy 0~3) → 화면 좌표 ----
  const Z_BACK = 1.55, Z_FRONT = 1.0, Y_A = -324, Y_B = 1014, X_UNIT = 300, CX = 640;
  function proj(gx, gy) {
    const t = gy / 3, z = Z_BACK + (Z_FRONT - Z_BACK) * t, s = 1 / z;
    return { x: CX + (gx - 2) * X_UNIT * s, y: Y_A + Y_B * s, s };
  }
  const cellC = (x, y) => proj(x + 0.5, y + 0.5);

  const B = {
    running: false, units: [], texts: [], tiles: [], tweens: [], ghosts: [],
    shake: 0, slow: 1, hitStop: 0, t: 0, cv: null, ctx: null,
    start(room, you, init) {
      this.cv = document.getElementById('cv'); this.ctx = this.cv.getContext('2d');
      this.room = room; this.you = you;
      this.units = room.players.map((p, i) => {
        const st = init[i];
        return { pid: i, ch: MH.CHAR_MAP[p.char], img: img(`assets/chars/${p.char}/battle.png`), gx: st.x, gy: st.y,
          lunge: 0, flash: 0, shield: 0, shieldA: 0, aura: 0, dead: 0, alpha: 1, hop: 0, hurt: 0, hpk: st.hp / MH.GAME.HP, hpGhost: st.hp / MH.GAME.HP, ghostDelay: 0, power: null };
      });
      this.texts = []; this.tiles = []; this.tweens = []; this.ghosts = []; FX.clear();
      this.camY = 0; this.zoom = 1; this.focus = { x: 640, y: 450 }; this.slow = 1; this.hitStop = 0;
      const g = this.gen = (this.gen || 0) + 1; this.running = true; this.last = performance.now(); requestAnimationFrame(t => this.frame(t, g));
    },
    stop() { this.running = false; },
    frame(now, g) {
      if (!this.running || g !== this.gen) return;
      let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.08; }
      dt *= this.slow;
      this.update(dt); this.render();
      requestAnimationFrame(t => this.frame(t, g));
    },
    update(dt) {
      this.t += dt;
      FX.update(dt);
      this.tweens.forEach(tw => {
        tw.t += dt; const k = Math.min(1, tw.t / tw.dur), e = tw.ease ? tw.ease(k) : k;
        tw.obj[tw.key] = tw.from + (tw.to - tw.from) * e;
        if (k >= 1 && tw.done) { const d = tw.done; tw.done = null; d(); }
      });
      this.tweens = this.tweens.filter(tw => tw.t < tw.dur);
      this.texts.forEach(x => { x.t += dt; x.y += x.vy * dt; x.vy *= 0.92; });
      this.texts = this.texts.filter(x => x.t < x.life);
      this.tiles.forEach(x => x.t += dt); this.tiles = this.tiles.filter(x => x.t < x.life);
      this.ghosts.forEach(g => g.t += dt); this.ghosts = this.ghosts.filter(g => g.t < g.life);
      this.units.forEach(u => {
        u.flash = Math.max(0, u.flash - dt * 4);
        u.shieldA += (u.shield - u.shieldA) * Math.min(1, dt * 10);
        u.aura = Math.max(0, u.aura - dt * 0.9);
        u.hurt = Math.max(0, u.hurt - dt * 1.5);
        // 머리 위 HP바: 실제 값(hpk)을 흰/노란 잔상(hpGhost)이 천천히 따라감
        if (u.ghostDelay > 0) u.ghostDelay -= dt; else u.hpGhost += (u.hpk - u.hpGhost) * Math.min(1, dt * 3.5);
        if (u.hpGhost < u.hpk) u.hpGhost = u.hpk;
        // 필살기 오라: 몸 주위로 기운이 피어오름
        if (u.power) {
          u.power.t += dt;
          if (u.power.t > u.power.dur) u.power = null;
          else {
            const p = cellC(u.gx, u.gy), h = 180 * p.s, n = Math.floor(dt * 90 + Math.random());
            for (let i = 0; i < n; i++) {
              const a = Math.random() * Math.PI * 2, r = (0.35 + Math.random() * 0.25) * h * 0.55;
              FX.add({ x: p.x + Math.cos(a) * r, y: p.y - 10 * p.s - Math.random() * h * 0.9, vx: -Math.cos(a) * 20, vy: -(120 + Math.random() * 160) * p.s,
                life: 0.45 + Math.random() * 0.4, size: (10 + Math.random() * 16) * p.s, size2: 2, color: Math.random() < 0.3 ? '#ffffff' : u.power.color, add: true, layer: 'top', drag: 0.98 });
            }
            if (Math.random() < dt * 14) FX.ring(p.x, p.y + 4 * p.s, { color: u.power.color, r: 110 * p.s, r0: 30 * p.s, w: 6, life: 0.6 });
          }
        }
      });
      this.shake = Math.max(0, this.shake - dt * 40);
    },
    tween(obj, key, to, dur, ease, done) { this.tweens.push({ obj, key, from: obj[key], to, dur, t: 0, ease, done }); },

    // ---------------- 그리기 ----------------
    render() {
      const c = this.ctx;
      c.save();
      c.clearRect(0, 0, W, H);
      if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      // 카메라 (필살기 때 아래로 이동 / 타격 때 줌 펀치)
      c.translate(0, this.camY);
      if (this.zoom !== 1) { c.translate(this.focus.x, this.focus.y); c.scale(this.zoom, this.zoom); c.translate(-this.focus.x, -this.focus.y); }
      // 배경 + 카메라 살짝 흔들림(숨쉬기)
      const sway = Math.sin(this.t * 0.4) * 4;
      if (BG.complete) c.drawImage(BG, -10 + sway, -6 - this.camY - 20, W + 20, H + 12 + this.camY + 40);
      // 위쪽 어둡게 (HUD 가독성)
      const g = c.createLinearGradient(0, 0, 0, 250); g.addColorStop(0, 'rgba(5,3,15,.75)'); g.addColorStop(1, 'rgba(5,3,15,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, 250);
      this.drawBoard(c);
      FX.draw(c, 'floor');
      // 유닛 (뒤쪽 줄부터)
      const list = [...this.units].sort((a, b) => a.gy - b.gy);
      this.ghosts.forEach(gh => this.drawUnit(c, gh.u, gh));
      list.forEach(u => this.drawUnit(c, u));
      FX.draw(c, 'top');
      this.drawTexts(c);
      c.restore();
      FX.draw(c, 'screen');
    },
    quad(x, y) { return [proj(x, y), proj(x + 1, y), proj(x + 1, y + 1), proj(x, y + 1)]; },
    drawBoard(c) {
      // 판 바닥 (은은한 발광)
      const q = [proj(0, 0), proj(4, 0), proj(4, 3), proj(0, 3)];
      c.save();
      c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
      c.fillStyle = 'rgba(20,30,80,0.22)'; c.fill();
      // 하이라이트 칸
      this.tiles.forEach(tl => {
        const k = tl.t / tl.life, fin = Math.min(1, tl.t / 0.15), fout = Math.min(1, (tl.life - tl.t) / (tl.steady ? 0.35 : tl.life * 0.85));
        const a = fin * fout * (0.55 + 0.25 * Math.sin(tl.t * (tl.steady ? 12 : 30)));
        tl.cells.forEach(cl => {
          const qq = this.quad(cl.x, cl.y);
          c.beginPath(); qq.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
          c.fillStyle = FX.col(tl.color, Math.max(0, a * 0.55)); c.fill();
          c.strokeStyle = FX.col('#ffffff', Math.max(0, a)); c.lineWidth = 3; c.stroke();
        });
      });
      // 격자선
      c.shadowColor = 'rgba(140,200,255,.9)'; c.shadowBlur = 10;
      c.strokeStyle = 'rgba(200,230,255,.65)'; c.lineWidth = 2;
      for (let x = 0; x <= 4; x++) { const a = proj(x, 0), b = proj(x, 3); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      for (let y = 0; y <= 3; y++) { const a = proj(0, y), b = proj(4, y); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      c.restore();
    },
    facing(u) {
      const o = this.units[1 - u.pid];
      if (!o || Math.abs(o.gx - u.gx) < 0.01) return u.pid === 0 ? 1 : -1;
      return o.gx > u.gx ? 1 : -1;
    },
    drawUnit(c, u, ghost) {
      if (!u.img.complete || !u.img.naturalWidth) return;
      const p = cellC(u.gx, u.gy);
      const f = ghost ? ghost.face : this.facing(u);
      const sc = 1.12 * p.s;
      const w = u.img.naturalWidth * sc, h = u.img.naturalHeight * sc;
      const breathe = ghost ? 1 : 1 + Math.sin(this.t * 3 + u.pid * 2) * 0.012;
      const jit = u.hurt > 0 && !ghost ? Math.sin(this.t * 95) * 9 * u.hurt * p.s : 0;
      const x = (ghost ? ghost.x : p.x) + u.lunge * f * 60 * p.s + jit, y = (ghost ? ghost.y : p.y) - u.hop;
      c.save();
      if (!ghost && u.power) { // 발밑 기운
        c.save(); c.globalCompositeOperation = 'lighter';
        const gr = c.createRadialGradient(x, p.y - h * 0.4, 10, x, p.y - h * 0.4, h * 0.9);
        gr.addColorStop(0, FX.col(u.power.color, 0.55)); gr.addColorStop(1, FX.col(u.power.color, 0));
        c.fillStyle = gr; c.fillRect(x - h, p.y - h * 1.4, h * 2, h * 1.6); c.restore();
      }
      if (!ghost) {
        // 그림자
        c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(x, p.y + 4 * p.s, w * 0.38, 12 * p.s, 0, 0, Math.PI * 2); c.fill();
        // 발밑 진영 표시
        c.strokeStyle = u.pid === 0 ? 'rgba(80,170,255,.8)' : 'rgba(255,80,80,.8)'; c.lineWidth = 3;
        c.beginPath(); c.ellipse(x, p.y + 4 * p.s, w * 0.42, 15 * p.s, 0, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = ghost ? 0.35 * (1 - ghost.t / ghost.life) : u.alpha;
      c.translate(x, y + 6 * p.s);
      if (u.dead) c.rotate(u.dead * 1.3 * -f);
      if (u.hurt > 0 && !ghost) c.rotate(-0.22 * u.hurt * f); // 맞으면 뒤로 젖혀짐
      c.scale(f, breathe * (1 - (ghost ? 0 : u.hurt) * 0.06));
      c.imageSmoothingEnabled = false;
      if (u.power && !ghost) { // 오라 테두리
        const gl = tint(u, u.power.color);
        if (gl) { c.save(); c.globalCompositeOperation = 'lighter'; const pulse = 0.55 + 0.35 * Math.sin(this.t * 18);
          for (const [ox, oy] of [[-4, 0], [4, 0], [0, -4], [0, 3]]) { c.globalAlpha = pulse; c.drawImage(gl, -w / 2 + ox, -h + oy, w, h); }
          c.globalAlpha = pulse * 0.5; c.drawImage(gl, -w * 0.56, -h * 1.08, w * 1.12, h * 1.08); c.restore(); }
      }
      c.drawImage(u.img, -w / 2, -h, w, h);
      if (u.hurt > 0.15 && !ghost) { // 피격 깜빡임 (흰색/빨강 번갈아)
        const sil = tint(u, Math.floor(this.t * 16) % 2 ? '#ffffff' : '#ff2020');
        if (sil) { c.globalAlpha = Math.min(1, u.hurt * 1.2) * 0.85; c.drawImage(sil, -w / 2, -h, w, h); }
      }
      if (ghost) { c.globalCompositeOperation = 'lighter'; c.globalAlpha *= 0.8; c.drawImage(u.img, -w / 2, -h, w, h); }
      if (u.flash > 0 && !ghost) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = u.flash; c.drawImage(u.img, -w / 2, -h, w, h); c.drawImage(u.img, -w / 2, -h, w, h); }
      c.restore();
      if (ghost) return;
      // 오라 (기력 회복)
      if (u.aura > 0) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const gr = c.createRadialGradient(x, p.y - h * 0.45, 5, x, p.y - h * 0.45, h * 0.75);
        gr.addColorStop(0, `rgba(80,255,120,${0.45 * u.aura})`); gr.addColorStop(1, 'rgba(80,255,120,0)');
        c.fillStyle = gr; c.fillRect(x - h, p.y - h * 1.3, h * 2, h * 1.5); c.restore();
      }
      // 방어막
      if (u.shieldA > 0.02) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = u.shieldA;
        const r = h * 0.62, cy = p.y - h * 0.45;
        const gr = c.createRadialGradient(x, cy, r * 0.5, x, cy, r);
        gr.addColorStop(0, 'rgba(120,190,255,0.05)'); gr.addColorStop(0.85, 'rgba(120,200,255,0.35)'); gr.addColorStop(1, 'rgba(200,240,255,0.9)');
        c.fillStyle = gr; c.beginPath(); c.ellipse(x, cy, r * 0.8, r, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(220,245,255,.8)'; c.lineWidth = 2; c.beginPath();
        c.ellipse(x, cy, r * 0.8, r, 0, this.t * 2, this.t * 2 + 1.2); c.stroke();
        c.restore();
      }
      // 머리 위 HP 미니바
      if (u.hpk != null) {
        const bw = 96 * p.s, bh = 11 * p.s, bx = x - bw / 2, by = p.y - h - 26 * p.s;
        c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
        c.fillStyle = '#ffe066'; c.fillRect(bx, by, bw * u.hpGhost, bh);           // 줄어드는 잔상
        c.fillStyle = u.pid === 0 ? '#3aa0ff' : '#ff3a3a'; c.fillRect(bx, by, bw * u.hpk, bh);
        if (u.hurt > 0.4) { c.fillStyle = `rgba(255,255,255,${(u.hurt - 0.4) * 1.4})`; c.fillRect(bx, by, bw * u.hpGhost, bh); }
        c.font = `${Math.round(13 * p.s + 4)}px 'Black Han Sans', sans-serif`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#000';
        const ht = 'HP ' + Math.round(u.hpk * MH.GAME.HP); c.strokeText(ht, x, by - 5); c.fillStyle = '#fff'; c.fillText(ht, x, by - 5);
      }
    },
    drawTexts(c) {
      this.texts.forEach(x => {
        const k = x.t / x.life;
        let sc = k < 0.12 ? 1.6 - k / 0.12 * 0.6 : 1;
        if (x.dmg) { const tt = x.t; sc = tt < 0.08 ? 2.6 - tt / 0.08 * 1.8 : 0.8 + 0.2 * (1 - Math.exp(-(tt - 0.08) * 9) * Math.cos((tt - 0.08) * 30)); }
        c.save(); c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        c.translate(x.x, x.y); c.scale(sc, sc);
        c.font = `${x.size}px 'Black Han Sans', 'Do Hyeon', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        if (x.dmg) {
          if (x.t < 0.3) c.translate(Math.sin(x.t * 120) * 5, 0);
          c.lineWidth = 12; c.strokeStyle = '#2a0000'; c.strokeText(x.text, 0, 0);
          c.lineWidth = 5; c.strokeStyle = '#ffffff'; c.strokeText(x.text, 0, 0);
          const g = c.createLinearGradient(0, -x.size / 2, 0, x.size / 2); g.addColorStop(0, '#fff07a'); g.addColorStop(0.45, '#ff6a20'); g.addColorStop(1, '#c80010');
          c.fillStyle = g; c.fillText(x.text, 0, 0);
        } else {
          c.lineWidth = 7; c.strokeStyle = '#000'; c.strokeText(x.text, 0, 0);
          c.fillStyle = x.color; c.fillText(x.text, 0, 0);
        }
        c.restore();
      });
    },
    text(u, str, color, size, dy, dmg) {
      const p = cellC(u.gx, u.gy);
      this.texts.push({ text: str, x: p.x + (Math.random() - 0.5) * 20, y: p.y - 150 * p.s + (dy || 0), vy: dmg ? -40 : -90, color, size: size || 40, life: dmg ? 1.6 : 1.2, t: 0, dmg });
    },
    chest(u) { const p = cellC(u.gx, u.gy); return { x: p.x, y: p.y - 70 * p.s, s: p.s }; },

    // ---------------- 전투 재생 ----------------
    async play(events, hooks) {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const U = this.units;
      let cur = events[0].s;
      const setState = s => { cur = s; s.forEach((q, i) => { const k = q.hp / MH.GAME.HP; if (k < U[i].hpk) U[i].ghostDelay = 0.45; U[i].hpk = k; }); hooks.bars(s); };
      setState(events[0].s);
      const P = this.room.players;
      for (const ev of events) {
        const u = ev.pid != null ? U[ev.pid] : null;
        const card = ev.card && u ? MH.getCard(P[ev.pid].char, ev.card) : null;
        switch (ev.type) {
          case 'round':
            hooks.banner(`ROUND ${ev.round}`, `선공 : ${P[ev.first].nick}`); Sound.play('roundStart');
            await wait(1400); break;
          case 'slot':
            U.forEach(x => x.shield = 0);
            hooks.cutin(ev.slot, ev.cards);
            await wait(650); break;
          case 'guard':
            hooks.act(ev.pid);
            Sound.play('guard'); u.shield = 1; this.text(u, ev.amount ? `방어 ${ev.amount}` : '방어', '#9ad8ff', 34);
            FX.ring(cellC(u.gx, u.gy).x, cellC(u.gx, u.gy).y, { color: '#8ad0ff', r: 80, w: 8 });
            setState(ev.s); await wait(650); break;
          case 'fail':
            hooks.act(ev.pid);
            this.text(u, '기력 부족!', '#b0b0b0', 36); await wait(800); break;
          case 'move': {
            hooks.act(ev.pid);
            if (ev.blocked) {
              this.tween(u, 'hop', 14, 0.12, null, () => this.tween(u, 'hop', 0, 0.15));
              this.text(u, '이동 불가', '#d0d0d0', 30);
            } else {
              Sound.play('move');
              const face = this.facing(u);
              for (let i = 0; i < 4; i++) setTimeout(() => { const p = cellC(u.gx, u.gy); this.ghosts.push({ u, x: p.x, y: p.y - u.hop, face, t: 0, life: 0.35 }); }, i * 60);
              this.tween(u, 'hop', 22, 0.17, k => Math.sin(k * Math.PI / 2), () => this.tween(u, 'hop', 0, 0.17));
              this.tween(u, 'gx', ev.to.x, 0.34, easeOut); this.tween(u, 'gy', ev.to.y, 0.34, easeOut);
              const p = cellC(ev.from.x, ev.from.y);
              FX.burst(p.x, p.y, { n: 10, speed: [40, 120], angle: -Math.PI / 2, spread: 1.2, life: [0.3, 0.6], size: [8, 16], color: 'rgba(180,200,255,0.4)', add: false, extra: { size2: 24, drag: 0.92 } });
            }
            setState(ev.s); await wait(520); break;
          }
          case 'rest': {
            hooks.act(ev.pid);
            u.aura = 1; Sound.play('rest');
            const p = cellC(u.gx, u.gy);
            FX.burst(p.x, p.y, { n: 30, speed: [30, 90], angle: -Math.PI / 2, spread: 0.5, life: [0.6, 1.1], size: [4, 9], jx: 40 * p.s, color: ['#aaffbb', '#4aff7a', '#ffffff'], extra: { ay: -120, size2: 1 } });
            FX.ring(p.x, p.y, { color: '#4aff7a', r: 70, w: 6 });
            this.text(u, `EN +${ev.amount}`, '#6aff8a', 36);
            setState(ev.s); await wait(850); break;
          }
          case 'attack': {
            hooks.act(ev.pid);
            const tgt = U[1 - ev.pid];
            const ccol = card.color || u.ch.color;
            const special = Array.isArray(card.cutin) && card.cutin.length > 0;
            Sound.play(card.sound || 'attack');
            hooks.bars(cur.map((q, i) => i === ev.pid ? Object.assign({}, q, { en: ev.s[i].en }) : q)); // 기력은 바로 깎임
            if (special) {
              // ===== 필살기 연출: 오라 + 범위 표시(약 2초) + 컷인 이미지 한 컷씩 =====
              const cutT = (card.cutinTime || 0.5) * 1000, total = cutT * card.cutin.length;
              u.power = { color: card.aura || u.ch.color, t: 0, dur: total / 1000 + 1.6 };
              u.aura = 1;
              const p0 = cellC(u.gx, u.gy);
              FX.ring(p0.x, p0.y, { color: u.power.color, r: 160 * p0.s, w: 14, life: 0.6 });
              FX.flash(u.power.color, 0.3, 0.3);
              this.tiles.push({ cells: ev.cells, color: card.aura || u.ch.color, life: total / 1000 + 2.2, t: 0, steady: true });
              await wait(800);                      // 오라 + 범위를 먼저 보여주고
              await hooks.special(u.ch, card, cutT); // 컷인이 맵 전체를 덮음
              u.power.t = Math.max(0, u.power.dur - 0.6);
              FX.flash('#ffffff', 0.85, 0.3);
              this.shake = 18;
            } else {
              hooks.skill(u.ch, card);
              this.tiles.push({ cells: ev.cells, color: u.ch.color, life: 1.15, t: 0 });
              await wait(260);
            }
            this.tween(u, 'lunge', 1, 0.12, easeOut, () => this.tween(u, 'lunge', 0, 0.3));
            const src = this.chest(u), dir = this.facing(u);
            const cells = ev.cells.map(cl => { const p = cellC(cl.x, cl.y); return { cx: p.x, cy: p.y - 60 * p.s, fy: p.y, s: p.s }; });
            FX.skill(card.fx, ccol, src, cells, dir);
            if (special) FX.skill(card.fx, ccol, src, cells, dir); // 필살기는 이펙트 두 배
            await wait(special ? 300 : 360);
            if (ev.hit) {
              // ===== 피격 =====
              const tc = this.chest(tgt);
              Sound.play(card.hitSound || 'hit');
              FX.hit(tc.x, tc.y, u.ch.color);
              FX.burst(tc.x, tc.y, { n: 1, speed: [0, 0], life: [0.25, 0.25], size: [140, 140], color: '#ffffff', extra: { size2: 20, hard: 0.1 } });
              FX.vignette('#ff1a1a', 0.45, 0.45);
              tgt.flash = 1; tgt.hurt = 1;
              this.hitStop = special ? 0.22 : 0.12;
              this.shake = Math.min(32, 12 + ev.dmg * 0.4);
              this.focus = { x: tc.x, y: tc.y }; this.zoom = special ? 1.16 : 1.09; this.tween(this, 'zoom', 1, 0.45, easeOut);
              tgt.lunge = 0; this.tween(tgt, 'lunge', -0.75, 0.09, easeOut, () => this.tween(tgt, 'lunge', 0, 0.45, easeOut));
              this.tween(tgt, 'hop', 16, 0.1, easeOut, () => this.tween(tgt, 'hop', 0, 0.25));
              if (ev.dmg > 0) this.text(tgt, `-${ev.dmg}`, '#ff4a3a', 64 + Math.min(36, ev.dmg * 0.5), -10, true);
              else this.text(tgt, '0', '#ffffff', 44);
              if (ev.blocked > 0) this.text(tgt, `BLOCK ${ev.blocked}`, '#9ad8ff', 30, -60);
              hooks.hurt(tgt.pid, ev.dmg);
              setState(ev.s);
            } else {
              Sound.play('miss');
              this.text(tgt, 'MISS', '#e0e0e0', 34);
              setState(ev.s);
            }
            if (ev.to && (ev.to.x !== ev.from.x || ev.to.y !== ev.from.y)) {
              await wait(250);
              const face = this.facing(u);
              for (let i = 0; i < 4; i++) setTimeout(() => { const p = cellC(u.gx, u.gy); this.ghosts.push({ u, x: p.x, y: p.y, face, t: 0, life: 0.3 }); }, i * 40);
              this.tween(u, 'gx', ev.to.x, 0.18, easeOut); this.tween(u, 'gy', ev.to.y, 0.18, easeOut);
              await wait(250);
            }
            await wait(special ? 1100 : 800); break;
          }
          case 'ko': {
            const d = U[ev.pid];
            this.slow = 0.35; FX.flash('#ffffff', 0.7, 0.4); Sound.play('ko');
            hooks.banner('K.O.', '');
            this.tween(d, 'dead', 1, 0.9, easeOut); this.tween(d, 'alpha', 0.35, 1.2);
            await wait(1100); this.slow = 1; await wait(900); break;
          }
          case 'end':
            U.forEach(x => x.shield = 0);
            hooks.cutin(null);
            await wait(300);
            break;
        }
      }
    },
  };
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }

  B.proj = proj;
  window.Battle = B;
})();
