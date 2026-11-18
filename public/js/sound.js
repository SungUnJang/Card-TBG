// 멘헤라 대전 - 소리 재생
// 소리 파일 경로는 data.js 의 SOUND 와 각 스킬의 sound / hitSound 에 적어요.
(function () {
  const S = MH.SOUND;
  const cache = {};
  let unlocked = false, bgm = null, bgmSrc = '';

  function src(keyOrPath) {
    if (!keyOrPath) return '';
    return S[keyOrPath] !== undefined && typeof S[keyOrPath] === 'string' ? S[keyOrPath] : keyOrPath;
  }
  const Sound = {
    // 효과음: Sound.play('hit') 또는 Sound.play('assets/sound/xxx.mp3')
    play(keyOrPath, vol) {
      const f = src(keyOrPath); if (!f || !/\.(mp3|mp4|m4a|ogg|wav|aac)(\?|$)/i.test(f)) return;
      try {
        if (!cache[f]) { cache[f] = new Audio(f); cache[f].preload = 'auto'; }
        const a = cache[f].cloneNode();
        a.volume = Math.max(0, Math.min(1, (vol != null ? vol : 1) * S.volume));
        const p = a.play(); if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    },
    // 배경음악: Sound.bgm('bgmBattle') / Sound.bgm('') 로 끄기
    bgm(key) {
      const f = src(key);
      if (f === bgmSrc) return;
      bgmSrc = f;
      if (bgm) { const old = bgm; let v = old.volume; const iv = setInterval(() => { v -= 0.05; if (v <= 0) { old.pause(); clearInterval(iv); } else old.volume = v; }, 40); }
      bgm = null;
      if (!f) return;
      try {
        bgm = new Audio(f); bgm.loop = true; bgm.volume = S.bgmVolume;
        if (unlocked) { const p = bgm.play(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) {}
    },
    // 모바일은 화면을 한 번 터치해야 소리가 나요
    unlock() {
      if (unlocked) return; unlocked = true;
      if (bgm) { const p = bgm.play(); if (p && p.catch) p.catch(() => {}); }
    },
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => Sound.unlock(), { once: true, capture: true }));
  window.Sound = Sound;
})();
