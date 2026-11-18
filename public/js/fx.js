// 멘헤라 대전 - 스킬 이펙트 (캔버스 파티클)
(function () {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  const FX = {
    list: [], timers: [], time: 0,
    clear() { this.list = []; this.timers = []; },
    add(e) { e.t = 0; this.list.push(e); return e; },
    later(ms, fn) { this.timers.push({ at: this.time + ms / 1000, fn }); },
    update(dt) {
      this.time += dt;
      for (let i = this.timers.length - 1; i >= 0; i--) if (this.time >= this.timers[i].at) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
      for (const e of this.list) {
        e.t += dt;
        if (e.vx != null) {
          e.vx += (e.ax || 0) * dt; e.vy += (e.ay || 0) * dt;
          if (e.drag) { const k = Math.pow(e.drag, dt * 60); e.vx *= k; e.vy *= k; }
          e.x += e.vx * dt; e.y += e.vy * dt;
        }
        if (e.vr) e.rot = (e.rot || 0) + e.vr * dt;
      }
      this.list = this.list.filter(e => e.t < e.life);
    },
    draw(ctx, layer) {
      for (const e of this.list) {
        if ((e.layer || 'top') !== layer) continue;
        const k = e.t / e.life;
        ctx.save();
        ctx.globalCompositeOperation = e.add ? 'lighter' : 'source-over';
        (e.draw || drawParticle)(ctx, e, k);
        ctx.restore();
      }
    },
  };

  function col(c, a) { // '#rrggbb' → rgba
    if (c.startsWith('rgba(')) return c.replace(/,[^,]*\)$/, ',' + a + ')');
    if (c[0] !== '#') return c;
    const n = parseInt(c.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  FX.col = col;

  function drawParticle(ctx, e, k) {
    const a = (e.alpha != null ? e.alpha : 1) * (e.fadeIn ? Math.min(1, k * 6) : 1) * (1 - Math.pow(k, e.fadePow || 1.6));
    const sz = e.size + ((e.size2 != null ? e.size2 : e.size * 0.2) - e.size) * k;
    const c = e.colors ? e.colors[Math.min(e.colors.length - 1, Math.floor(k * e.colors.length))] : e.color;
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(e.x, e.y); if (e.rot) ctx.rotate(e.rot);
    switch (e.shape) {
      case 'spark': {
        const sp = Math.hypot(e.vx, e.vy) || 1, L = Math.min(60, sp * 0.06) * (e.len || 1);
        ctx.rotate(Math.atan2(e.vy, e.vx) - (e.rot || 0));
        ctx.strokeStyle = c; ctx.lineWidth = sz; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke(); break;
      }
      case 'heart': {
        ctx.fillStyle = c; ctx.scale(sz / 10, sz / 10); ctx.beginPath();
        ctx.moveTo(0, 3); ctx.bezierCurveTo(-10, -4, -5, -11, 0, -5); ctx.bezierCurveTo(5, -11, 10, -4, 0, 3); ctx.fill(); break;
      }
      case 'butterfly': {
        const f = Math.abs(Math.sin(e.t * 22 + (e.ph || 0)));
        ctx.fillStyle = c; ctx.scale(sz / 10, sz / 10);
        ctx.beginPath(); ctx.ellipse(-4 * f, -3, 5 * f + 1, 6, -0.5, 0, TAU); ctx.ellipse(4 * f, -3, 5 * f + 1, 6, 0.5, 0, TAU);
        ctx.ellipse(-3 * f, 4, 3 * f + 1, 4, 0.4, 0, TAU); ctx.ellipse(3 * f, 4, 3 * f + 1, 4, -0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-0.6, -5, 1.2, 10); break;
      }
      case 'rock': {
        ctx.fillStyle = c; ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-sz, -sz * .4); ctx.lineTo(-sz * .3, -sz); ctx.lineTo(sz * .8, -sz * .6); ctx.lineTo(sz, sz * .4); ctx.lineTo(0, sz); ctx.lineTo(-sz * .8, sz * .6); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      }
      case 'leaf': {
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * .35, 0, 0, TAU); ctx.fill(); break;
      }
      case 'note': {
        ctx.fillStyle = c; ctx.font = `bold ${sz * 2}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(e.ch || '♪', 0, 0); break;
      }
      case 'square': { ctx.fillStyle = c; ctx.fillRect(-sz / 2, -sz / 2, sz, sz); break; }
      default: { // glow circle
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz);
        g.addColorStop(0, c); g.addColorStop(e.hard || 0.35, c); g.addColorStop(1, col(c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, sz, 0, TAU); ctx.fill();
      }
    }
  }

  // ---------- 기본 빌딩 블록 ----------
  FX.burst = function (x, y, o) {
    const n = o.n || 20;
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + rnd(-(o.spread || 0.5), o.spread || 0.5) : rnd(0, TAU);
      const sp = rnd(o.speed[0], o.speed[1]);
      FX.add(Object.assign({ x: x + rnd(-(o.jx || 0), o.jx || 0), y: y + rnd(-(o.jy || 0), o.jy || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (o.flat || 1),
        life: rnd(o.life[0], o.life[1]), size: rnd(o.size[0], o.size[1]), add: o.add !== false, rot: rnd(0, TAU) }, o.extra || {}, {
        color: Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : o.color }));
    }
  };
  // 초승달 베기
  FX.slash = function (x, y, o) {
    FX.add({ x, y, life: o.life || 0.42, add: true, layer: 'top', draw(ctx, e, k) {
      const r = (o.r || 70) * (0.6 + k * 0.6), a0 = o.rot || 0, sweep = (o.sweep || 2.4) * Math.min(1, k * 3);
      ctx.translate(x, y); ctx.scale(1, o.flat || 0.55); ctx.rotate(a0);
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = i === 2 ? '#ffffff' : col(o.color, i === 0 ? 0.35 : 0.8);
        ctx.lineWidth = (o.w || 14) * (i === 0 ? 2.2 : i === 1 ? 1 : 0.35) * (1 - k * 0.5);
        ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r, -sweep / 2, sweep / 2); ctx.stroke();
      }
    }});
  };
  // 바닥 충격파 고리
  FX.ring = function (x, y, o) {
    FX.add({ x, y, life: o.life || 0.5, add: true, layer: o.layer || 'floor', draw(ctx, e, k) {
      ctx.translate(x, y); ctx.scale(1, o.flat || 0.4);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = o.color; ctx.lineWidth = (o.w || 8) * (1 - k) + 1;
      ctx.shadowColor = o.color; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(0, 0, (o.r0 || 10) + ((o.r || 90) - (o.r0 || 10)) * Math.pow(k, 0.6), 0, TAU); ctx.stroke();
    }});
  };
  // 번개
  FX.bolt = function (x1, y1, x2, y2, o) {
    const pts = []; const segs = o.segs || 10;
    for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push([x1 + (x2 - x1) * t + (i && i < segs ? rnd(-1, 1) * (o.jag || 22) : 0), y1 + (y2 - y1) * t + (i && i < segs ? rnd(-1, 1) * (o.jag || 22) * 0.5 : 0)]); }
    FX.add({ life: o.life || 0.28, add: true, layer: 'top', draw(ctx, e, k) {
      ctx.globalAlpha = k < 0.5 ? 1 : (1 - k) * 2;
      [[o.w || 10, col(o.color, .35)], [(o.w || 10) * 0.45, o.color], [(o.w || 10) * 0.18, '#fff']].forEach(([w, c]) => {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      });
    }});
  };
  // 곡선 리본 (채찍/뱀/물결)
  FX.ribbon = function (x1, y1, x2, y2, o) {
    const amp = o.amp || 30, waves = o.waves || 2, ph = rnd(0, TAU);
    FX.add({ life: o.life || 0.55, add: true, layer: 'top', draw(ctx, e, k) {
      const grow = Math.min(1, k * 2.4), fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const P = t => { const w = Math.sin(t * Math.PI * waves * 2 + ph + k * 8) * amp * Math.sin(t * Math.PI); return [x1 + dx * t + nx * w, y1 + dy * t + ny * w]; };
      ctx.globalAlpha = fade; ctx.lineCap = 'round';
      [[o.w || 12, col(o.color, .3)], [(o.w || 12) * .5, o.color], [(o.w || 12) * .2, '#fff']].forEach(([w, c]) => {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const t = i / 40 * grow; const p = P(t); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
        ctx.stroke();
      });
      if (o.head) { const p = P(grow); ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(p[0], p[1], (o.w || 12) * .9, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0] + 3, p[1] - 3, 2.5, 0, TAU); ctx.fill(); }
    }});
  };
  // 화면 플래시
  FX.flash = function (color, a, life) {
    FX.add({ life: life || 0.25, add: true, layer: 'screen', draw(ctx, e, k) { ctx.globalAlpha = (a || 0.5) * (1 - k); ctx.fillStyle = color; ctx.fillRect(-50, -50, 1380, 820); } });
  };
  // 화면 가장자리 붉은 테두리 (피격)
  FX.vignette = function (color, a, life) {
    FX.add({ life: life || 0.4, add: false, layer: 'screen', draw(ctx, e, k) {
      const g = ctx.createRadialGradient(640, 360, 250, 640, 360, 800);
      g.addColorStop(0, col(color, 0)); g.addColorStop(1, col(color, (a || 0.5) * (1 - k)));
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
    }});
  };
  // 빛 기둥
  FX.pillar = function (x, y, o) {
    FX.add({ life: o.life || 0.6, add: true, layer: 'top', draw(ctx, e, k) {
      const w = (o.w || 50) * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8 * 0.7), h = o.h || 260;
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, col(o.color, 0)); g.addColorStop(0.4, col(o.color, .7)); g.addColorStop(0.5, 'rgba(255,255,255,.9)'); g.addColorStop(0.6, col(o.color, .7)); g.addColorStop(1, col(o.color, 0));
      ctx.globalAlpha = 1 - k * k; ctx.fillStyle = g; ctx.fillRect(x - w, y - h, w * 2, h);
    }});
  };
  // 찌르기 광선
  FX.beam = function (x1, y1, x2, y2, o) {
    FX.add({ life: o.life || 0.35, add: true, layer: 'top', draw(ctx, e, k) {
      const g = Math.min(1, k * 4);
      ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
      [[o.w || 14, col(o.color, .35)], [(o.w || 14) * .45, o.color], [(o.w || 14) * .15, '#fff']].forEach(([w, c]) => {
        ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * g, y1 + (y2 - y1) * g); ctx.stroke();
      });
    }});
  };

  // 물레방아: 세로로 도는 물의 바퀴
  FX.wheel = function (x, y, o) {
    const R = o.r || 110, life = o.life || 0.8;
    FX.add({ life, add: true, layer: 'top', draw(ctx, e, k) {
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1, rot = k * Math.PI * 3.2 * (o.dir || 1);
      ctx.translate(x, y); ctx.scale(o.sx || 0.62, 1); ctx.globalAlpha = a; ctx.lineCap = 'round';
      for (let j = 0; j < 3; j++) {
        const r = R * (1 - j * 0.16), st = rot + j * 0.9;
        [[22 - j * 5, 'rgba(40,140,255,0.35)'], [10 - j * 2, 'rgba(90,190,255,0.9)'], [3, '#ffffff']].forEach(([w, c]) => {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, st, st + 4.2); ctx.stroke();
        });
      }
    }});
    for (let i = 0; i < 8; i++) FX.later(i * 70, () => {
      const ang = (i / 8) * Math.PI * 2 * 1.6 * (o.dir || 1);
      const px = x + Math.cos(ang) * R * (o.sx || 0.62), py = y + Math.sin(ang) * R;
      FX.burst(px, py, { n: 6, speed: [80, 220], life: [0.35, 0.7], size: [3, 6], color: ['#ffffff', '#a8e4ff', '#4ab0ff'], extra: { ay: 700, size2: 1 } });
    });
  };

  // ---------- 캐릭터별 스킬 이펙트 ----------
  // src: 공격자 화면 좌표 {x,y}, cells: [{cx,cy,s}] 칸 중심 좌표(가슴 높이), dir: 1/-1
  FX.skill = function (type, color, src, cells, dir) {
    const C = color;
    const each = (fn, step) => cells.forEach((c, i) => FX.later(i * (step || 45), () => fn(c, i)));
    switch (type) {
      case 'fire': case 'sun': {
        const sun = type === 'sun';
        FX.ribbon(src.x, src.y, src.x + dir * 160, src.y - 10, { color: sun ? '#ffd040' : '#ff7a1a', amp: 40, waves: 1, w: 26, life: 0.5 });
        each(c => {
          FX.slash(c.cx, c.cy, { color: sun ? '#ffcf3a' : '#ff6a00', r: 64 * c.s, rot: rnd(-0.6, 0.6) + (dir < 0 ? Math.PI : 0), w: 18 * c.s, sweep: 3, life: 0.55 });
          FX.later(120, () => FX.slash(c.cx, c.cy, { color: '#ffd060', r: 80 * c.s, rot: rnd(2, 4), w: 12 * c.s, sweep: 2.6, life: 0.5 }));
          FX.burst(c.cx, c.fy, { n: 42, speed: [40, 180], angle: -Math.PI / 2, spread: 0.8, life: [0.5, 1.2], size: [14 * c.s, 30 * c.s], color: ['#fff2a0', '#ffb030', '#ff6a00', '#ff3010'], jx: 30 * c.s, extra: { ay: -220, size2: 2, drag: 0.97 } });
          FX.burst(c.cx, c.cy, { n: 14, speed: [150, 380], life: [0.3, 0.6], size: [2, 4], color: '#ffe080', extra: { shape: 'spark', ay: 300 } });
          FX.ring(c.cx, c.fy, { color: '#ff8a20', r: 70 * c.s });
          if (sun) FX.pillar(c.cx, c.fy, { color: '#ffb030', w: 40 * c.s, h: 240 * c.s });
        });
        if (sun) FX.flash('#ffb040', 0.35);
        break;
      }
      case 'water': {
        FX.ribbon(src.x, src.y, src.x + dir * 150, src.y, { color: '#3ab0ff', amp: 36, waves: 1.5, w: 22, life: 0.55 });
        { // 공격 범위 중앙에 큰 물의 바퀴
          const mx = cells.reduce((a, c) => a + c.cx, 0) / cells.length, my = cells.reduce((a, c) => a + c.cy, 0) / cells.length;
          const ms = cells.reduce((a, c) => a + c.s, 0) / cells.length;
          FX.wheel(mx, my - 10 * ms, { r: 120 * ms, dir, life: 0.85 });
          FX.flash('#6ac8ff', 0.18, 0.25);
        }
        each(c => {
          FX.slash(c.cx, c.cy, { color: '#40b8ff', r: 62 * c.s, rot: rnd(0, TAU), w: 16 * c.s, sweep: 4.2, life: 0.5 });
          FX.slash(c.cx, c.cy, { color: '#a0e8ff', r: 42 * c.s, rot: rnd(0, TAU), w: 9 * c.s, sweep: 3.5, life: 0.45 });
          FX.burst(c.cx, c.cy, { n: 22, speed: [80, 260], angle: -Math.PI / 2, spread: 1.4, life: [0.4, 0.8], size: [3, 7], color: ['#ffffff', '#9ae0ff', '#3aa0ff'], extra: { ay: 600, size2: 2 } });
          FX.ring(c.cx, c.fy, { color: '#5ac8ff', r: 80 * c.s, w: 10 });
        });
        break;
      }
      case 'wind': {
        each((c, i) => {
          for (let j = 0; j < 3; j++) FX.later(j * 70, () => FX.slash(c.cx + rnd(-10, 10), c.cy + rnd(-10, 10), { color: '#6affb0', r: 56 * c.s, rot: rnd(0, TAU), w: 12 * c.s, sweep: 2.2, life: 0.35, flat: 0.8 }));
          FX.burst(c.cx, c.cy, { n: 18, speed: [120, 260], life: [0.5, 0.9], size: [5, 10], color: ['#b0ffd0', '#4ad08a', '#2a7a4a'], add: false, extra: { shape: 'leaf', vr: 12, drag: 0.95, ay: -40 } });
          FX.ring(c.cx, c.fy, { color: '#7affc0', r: 75 * c.s, w: 6 });
        }, 60);
        break;
      }
      case 'thunder': {
        FX.flash('#fff6a0', 0.55, 0.2);
        each(c => {
          FX.bolt(c.cx + rnd(-30, 30), c.cy - 320, c.cx, c.fy, { color: '#ffe040', w: 12, jag: 26, life: 0.45 });
          FX.later(160, () => FX.bolt(c.cx + rnd(-40, 40), c.cy - 300, c.cx + rnd(-10, 10), c.fy, { color: '#fff6a0', w: 8, jag: 30, life: 0.35 }));
          FX.bolt(src.x, src.y, c.cx, c.cy, { color: '#fff07a', w: 8, jag: 18, life: 0.25 });
          FX.burst(c.cx, c.cy, { n: 24, speed: [200, 480], life: [0.2, 0.45], size: [2, 4], color: ['#ffffff', '#fff07a', '#ffc010'], extra: { shape: 'spark' } });
          FX.ring(c.cx, c.fy, { color: '#ffe040', r: 80 * c.s, w: 8, life: 0.35 });
        }, 30);
        break;
      }
      case 'love': {
        each(c => {
          FX.ribbon(src.x, src.y, c.cx, c.cy, { color: '#ff70c0', amp: 44, waves: 1.5, w: 14, life: 0.6 });
          FX.later(180, () => {
            FX.burst(c.cx, c.cy, { n: 14, speed: [60, 180], angle: -Math.PI / 2, spread: 1.6, life: [0.6, 1.1], size: [10, 18], color: ['#ff6fb5', '#ffb0d8', '#ff3d8b'], add: false, extra: { shape: 'heart', ay: -80, drag: 0.96, size2: 6 } });
            FX.slash(c.cx, c.cy, { color: '#ff8ad0', r: 58 * c.s, rot: rnd(0, TAU), w: 12 * c.s, sweep: 3.6 });
            FX.ring(c.cx, c.fy, { color: '#ff6fb5', r: 70 * c.s });
          });
        }, 50);
        break;
      }
      case 'rock': {
        each(c => {
          for (let j = 0; j < 5; j++) FX.later(j * 40, () => FX.add({ x: c.cx + rnd(-40, 40) * c.s, y: c.cy - 300, vx: rnd(-30, 30), vy: 700, ay: 900, life: 0.38, size: rnd(10, 20) * c.s, color: ['#7a5a3a', '#9a7a5a', '#5a4030'][j % 3], shape: 'rock', vr: rnd(-8, 8), fadePow: 8 }));
          FX.later(320, () => {
            FX.ring(c.cx, c.fy, { color: '#d0a060', r: 95 * c.s, w: 12 });
            FX.burst(c.cx, c.fy, { n: 18, speed: [60, 200], angle: -Math.PI / 2, spread: 1.3, life: [0.6, 1.0], size: [18 * c.s, 34 * c.s], color: 'rgba(160,130,100,0.55)', add: false, extra: { drag: 0.93, size2: 40 } });
            FX.burst(c.cx, c.fy, { n: 12, speed: [150, 350], angle: -Math.PI / 2, spread: 1, life: [0.4, 0.7], size: [4, 8], color: '#6a4a2a', add: false, extra: { shape: 'rock', ay: 900, vr: 10 } });
          });
        }, 40);
        break;
      }
      case 'sound': {
        each((c, i) => {
          for (let j = 0; j < 3; j++) FX.later(j * 90, () => {
            const x = c.cx + rnd(-25, 25) * c.s, y = c.cy + rnd(-25, 25) * c.s;
            FX.burst(x, y, { n: 1, speed: [0, 0], life: [0.35, 0.35], size: [60 * c.s, 60 * c.s], color: j % 2 ? '#c070ff' : '#ffcf3a', extra: { size2: 10, hard: 0.1 } });
            FX.ring(x, y, { color: j % 2 ? '#d090ff' : '#ffd040', r: 60 * c.s, w: 6, flat: 1, layer: 'top', life: 0.35 });
            FX.burst(x, y, { n: 10, speed: [200, 400], life: [0.2, 0.4], size: [2, 3], color: '#fff2b0', extra: { shape: 'spark' } });
          });
          FX.burst(c.cx, c.cy, { n: 4, speed: [40, 90], angle: -Math.PI / 2, spread: 1, life: [0.7, 1], size: [10, 13], color: '#ffe080', extra: { shape: 'note', ay: -60 } });
        }, 70);
        FX.flash('#ffffff', 0.2, 0.15);
        break;
      }
      case 'serpent': {
        each(c => {
          FX.ribbon(src.x, src.y, c.cx, c.cy, { color: '#b070ff', amp: 26, waves: 2.5, w: 16, life: 0.6, head: true });
          FX.later(260, () => {
            FX.slash(c.cx, c.cy, { color: '#c080ff', r: 54 * c.s, rot: rnd(0, TAU), w: 12 * c.s, sweep: 4.5, flat: 0.7 });
            FX.burst(c.cx, c.cy, { n: 18, speed: [80, 240], life: [0.3, 0.6], size: [3, 6], color: ['#e0c0ff', '#9a5aff', '#ffffff'], extra: { shape: 'spark' } });
          });
        }, 60);
        break;
      }
      case 'mist': {
        each(c => {
          FX.burst(c.cx, c.cy, { n: 12, speed: [10, 60], life: [0.8, 1.2], size: [30 * c.s, 50 * c.s], color: 'rgba(200,245,255,0.35)', add: false, jx: 40 * c.s, jy: 20 * c.s, extra: { size2: 70, fadeIn: true, fadePow: 2 } });
          for (let j = 0; j < 2; j++) FX.later(120 + j * 110, () => FX.slash(c.cx, c.cy, { color: '#9af0ff', r: 64 * c.s, rot: rnd(0, TAU), w: 9 * c.s, sweep: 2.8, life: 0.45, flat: 0.9 }));
        }, 40);
        break;
      }
      case 'insect': {
        each(c => {
          FX.beam(src.x, src.y, c.cx, c.cy, { color: '#c08aff', w: 10, life: 0.3 });
          FX.burst(c.cx, c.cy, { n: 9, speed: [40, 130], life: [0.8, 1.2], size: [9, 13], color: ['#d0a0ff', '#ff9ad8', '#a0d0ff'], extra: { shape: 'butterfly', ay: -60, drag: 0.96, ph: rnd(0, 6), size2: 8 } });
          FX.burst(c.cx, c.cy, { n: 12, speed: [150, 300], life: [0.2, 0.4], size: [2, 3], color: '#ffffff', extra: { shape: 'spark' } });
        }, 50);
        break;
      }
      case 'beast': {
        each(c => {
          FX.slash(c.cx - 10, c.cy, { color: '#7ac0ff', r: 70 * c.s, rot: 0.9, w: 12 * c.s, sweep: 1.4, flat: 1, life: 0.5 });
          FX.later(80, () => FX.slash(c.cx + 10, c.cy, { color: '#a0d8ff', r: 70 * c.s, rot: -0.9 + Math.PI, w: 12 * c.s, sweep: 1.4, flat: 1, life: 0.5 }));
          FX.burst(c.cx, c.cy, { n: 16, speed: [160, 360], life: [0.2, 0.45], size: [2, 4], color: ['#ffffff', '#9ad0ff'], extra: { shape: 'spark' } });
          FX.ring(c.cx, c.fy, { color: '#7ab8ff', r: 70 * c.s, w: 6 });
        }, 50);
        break;
      }
      case 'blood': {
        each(c => {
          FX.burst(c.cx, c.cy, { n: 1, speed: [0, 0], life: [0.4, 0.4], size: [80 * c.s, 80 * c.s], color: '#ff3d8b', extra: { size2: 20, hard: 0.15 } });
          FX.burst(c.cx, c.cy, { n: 40, speed: [80, 320], life: [0.5, 1.0], size: [10 * c.s, 22 * c.s], color: ['#ffb0d0', '#ff3d8b', '#d0105a', '#ff8a3a'], extra: { drag: 0.94, size2: 1, ay: -60 } });
          FX.ring(c.cx, c.fy, { color: '#ff3d8b', r: 90 * c.s, w: 10 });
        }, 60);
        FX.flash('#ff3d8b', 0.22, 0.2);
        break;
      }
      default: each(c => FX.slash(c.cx, c.cy, { color: C || '#ffffff', r: 60 * c.s, rot: rnd(0, TAU) }));
    }
  };

  // 피격 이펙트
  FX.hit = function (x, y, color) {
    FX.burst(x, y, { n: 1, speed: [0, 0], life: [0.18, 0.18], size: [70, 70], color: '#ffffff', extra: { size2: 10, hard: 0.2 } });
    FX.burst(x, y, { n: 18, speed: [200, 520], life: [0.18, 0.4], size: [2, 5], color: ['#ffffff', color || '#ffe080'], extra: { shape: 'spark', len: 1.4 } });
  };

  window.FX = FX;
})();
