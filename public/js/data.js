/* =====================================================================
 *  멘헤라 대전 - 게임 데이터 (서버와 클라이언트가 같이 사용하는 파일)
 *  ---------------------------------------------------------------------
 *  ※ 이 파일만 고치면 서버/화면 모두 바뀝니다. 고친 뒤 서버를 재시작하세요.
 *
 *  [스킬 수치]
 *    dn : 데미지 (DN). 방어 카드에서는 "막아주는 데미지 양"
 *    en : 사용에 필요한 기력 (EN). 기력 회복 카드는 gain 으로 회복량 지정
 *
 *  [스킬 범위 range] 캐릭터 위치를 기준으로 그린 그림입니다. (크기 자유: 3x3, 5x3, 4x3 ...)
 *    C : 캐릭터 위치 (공격 안 됨)
 *    @ : 캐릭터 위치 + 그 칸도 공격
 *    # : 공격되는 칸
 *    . : 공격 안 되는 칸
 *    예) 십자 공격     [".#.",
 *                       "#@#",
 *                       ".#."]
 *        앞으로 2칸    ["....",
 *                       ".@##",
 *                       "...."]
 *    오른쪽이 "앞(상대 쪽)" 기준입니다. 오른쪽에서 시작한 플레이어는
 *    GAME.MIRROR_FOR_RIGHT 가 true 면 자동으로 좌우 반전됩니다.
 *    noMirror: true 를 넣으면 그 스킬은 반전하지 않습니다.
 *
 *  [공격 후 이동 move] 예) move: [-1, 0]  → 공격 후 왼쪽으로 1칸 (젠이츠 벽력일섬)
 *  [이펙트 fx] fire, water, wind, thunder, love, rock, sound, serpent,
 *              mist, insect, beast, blood, sun
 * ===================================================================== */
(function (root) {

  // ---------------- 전체 규칙 ----------------
  const GAME = {
    HP: 100,               // 모든 캐릭터 시작 HP
    EN: 100,               // 시작 기력
    EN_MAX: 100,           // 기력 최대치
    SELECT_TIME: 30,       // 스킬 카드 고르는 시간(초)
    SLOTS: 3,              // 한 라운드에 고르는 카드 수
    COLS: 4, ROWS: 3,      // 전투판 4x3
    START: [{ x: 0, y: 1 }, { x: 3, y: 1 }], // 시작 위치 [방장, 참가자]
    MIRROR_FOR_RIGHT: true,// 오른쪽 플레이어 공격범위 좌우 반전
    AUTO_FILL: 'rest',     // 시간 초과 시 빈 칸을 채울 카드 (rest=기력회복, guard=방어)
  };

  // ---------------- 공통 카드 (이동 / 방어 / 기력회복) ----------------
  // 모든 캐릭터가 같이 씁니다. 캐릭터별 방어 수치는 아래 캐릭터의 guardDn 으로 따로 정해요.
  const COMMON = {
    up:    { name: '위로 이동',    type: 'move',  dir: [0, -1], dn: 0, en: 0, card: 0 },
    down:  { name: '아래 이동',    type: 'move',  dir: [0, 1],  dn: 0, en: 0, card: 1 },
    right: { name: '오른쪽 이동',  type: 'move',  dir: [1, 0],  dn: 0, en: 0, card: 2 },
    left:  { name: '왼쪽 이동',    type: 'move',  dir: [-1, 0], dn: 0, en: 0, card: 3 },
    guard: { name: '방어',         type: 'guard', dn: 15, en: 0, card: 4 },           // dn = 막아주는 양
    rest:  { name: '기력 회복',    type: 'rest',  dn: 0, en: 0, gain: 15, card: 9 },  // gain = 회복량
  };

  // ---------------- 캐릭터 ----------------
  // skills 4개 = 카드 화면 아랫줄 왼쪽부터 4장 (card 번호는 이미지 파일 번호, 고치지 마세요)
  const CHARACTERS = [
    { id: 'tanjiro', name: '카마도 탄지로', color: '#2fb07a', guardDn: 15, skills: [
      { name: '수면 베기',       dn: 0,  en: 0,  fx: 'water', card: 5, range: [".#.", "#@#", "###"] },
      { name: '물레방아',        dn: 35, en: 35, fx: 'water', card: 6, range: [".#.", "#@#", ".#."] },
      { name: '히노카미 카구라', dn: 50, en: 50, fx: 'sun',   card: 7, range: ["###", "#C#", "###"] },
      { name: '원무',            dn: 40, en: 40, fx: 'water', card: 8, range: [".#.", "#C#", ".#."] },
    ]},
    { id: 'gyomei', name: '히메지마 교메이', color: '#b07a3a', guardDn: 15, skills: [
      { name: '사문쌍극',  dn: 25, en: 35, fx: 'rock', card: 5, range: [".#.", "#@#", ".#."] },
      { name: '상부 공격', dn: 30, en: 40, fx: 'rock', card: 6, range: [".#.", ".C.", ".#."] },
      { name: '암각 분쇄', dn: 35, en: 45, fx: 'rock', card: 7, range: [".#.", ".@.", ".#."] },
      { name: '연쇄 분쇄', dn: 50, en: 60, fx: 'rock', card: 8, range: [".#.", ".@.", "###"] },
    ]},
    { id: 'mitsuri', name: '칸로지 미츠리', color: '#ff6fb5', guardDn: 15, skills: [
      { name: '첫사랑의 떨림', dn: 25, en: 35, fx: 'love', card: 5, range: [".#.", ".@.", ".#."] },
      { name: '사랑의 물결',   dn: 30, en: 40, fx: 'love', card: 6, range: ["...", ".@.", ".#."] },
      { name: '고양이 소나기', dn: 35, en: 45, fx: 'love', card: 7, range: ["...", ".@.", "#.."] },
      { name: '흔들리는 사랑', dn: 50, en: 60, fx: 'love', card: 8, range: [".#.", "#@#", "###"] },
    ]},
    { id: 'rengoku', name: '렌고쿠 쿄쥬로', color: '#ff7a1a', guardDn: 15, skills: [
      { name: '부지화',   dn: 25, en: 35, fx: 'fire', card: 5, range: [".#.", ".@.", "##."] },
      { name: '상승염천', dn: 35, en: 40, fx: 'fire', card: 6, range: ["....", ".@##", "...."] },
      { name: '염호',     dn: 50, en: 50, fx: 'fire', card: 7, range: ["....", ".@##", ".#.."] },
      { name: '연옥',     dn: 75, en: 70, fx: 'fire', card: 8, range: [".#..", "#@##", "##.."] },
    ]},
    { id: 'sanemi', name: '시나즈가와 사네미', color: '#5fe09a', guardDn: 15, skills: [
      { name: '풍인 베기',   dn: 25, en: 35, fx: 'wind', card: 5, range: [".#.", "#@#", ".#."] },
      { name: '진선풍수',    dn: 40, en: 35, fx: 'wind', card: 6, range: [".#.", "#@#", ".#."] },
      { name: '승상사선풍',  dn: 35, en: 30, fx: 'wind', card: 7, range: ["...", ".@.", "..."] },
      { name: '흑풍연람',    dn: 50, en: 50, fx: 'wind', card: 8, range: [".#.", ".@.", ".#."] },
    ]},
    { id: 'tengen', name: '우즈이 텐겐', color: '#ffcf3a', guardDn: 15, skills: [
      { name: '음의 호흡',   dn: 5,  en: 30, fx: 'sound', card: 5, range: [".#.", "#@#", ".#."] },
      { name: '울림 베기',   dn: 40, en: 35, fx: 'sound', card: 6, range: [".#.", "#@.", ".#."] },
      { name: '폭음 연격',   dn: 35, en: 30, fx: 'sound', card: 7, range: [".#.", ".@.", ".#."] },
      { name: '화려한 난무', dn: 50, en: 50, fx: 'sound', card: 8, range: [".#.", ".@.", ".#."] },
    ]},
    { id: 'obanai', name: '이구로 오바나이', color: '#b07aff', guardDn: 15, skills: [
      { name: '구불 베기',   dn: 30, en: 25, fx: 'serpent', card: 5, range: [".##", ".@#", "..."] },
      { name: '독아 찌르기', dn: 40, en: 30, fx: 'serpent', card: 6, range: ["...", ".@.", "..."] },
      { name: '뱀 휘감기',   dn: 35, en: 30, fx: 'serpent', card: 7, range: [".#.", "#@.", ".#."] },
      { name: '쌍두 베기',   dn: 50, en: 50, fx: 'serpent', card: 8, range: [".#.", ".@#", "##."] },
    ]},
    { id: 'muichiro', name: '토키토 무이치로', color: '#6fe6e6', guardDn: 15, skills: [
      { name: '안개의 호흡', dn: 0,  en: 35, fx: 'mist', card: 5, range: ["###", "#@#", "..."] },
      { name: '수천원하',    dn: 35, en: 30, fx: 'mist', card: 6, range: ["...", "#@#", "..."] },
      { name: '이류 베기',   dn: 40, en: 40, fx: 'mist', card: 7, range: [".#.", "#@#", ".#."] },
      { name: '몽롱',        dn: 30, en: 25, fx: 'mist', card: 8, range: ["..#", ".@.", ".#."] },
    ]},
    { id: 'shinobu', name: '코쵸우 시노부', color: '#c58cff', guardDn: 15, skills: [
      { name: '나비의 춤',   dn: 30, en: 25, fx: 'insect', card: 5, range: [".#.", "#@#", ".#."] },
      { name: '벌침의 춤',   dn: 35, en: 30, fx: 'insect', card: 6, range: ["...", ".@.", "..."] },
      { name: '잠자리의 춤', dn: 45, en: 40, fx: 'insect', card: 7, range: [".#.", "#@#", ".#."] },
      { name: '지네의 춤',   dn: 40, en: 35, fx: 'insect', card: 8, range: [".#.", "#@#", ".#."] },
    ]},
    { id: 'giyu', name: '토미오카 기유', color: '#3aa0ff', guardDn: 15, skills: [
      { name: '물의 호흡',   dn: 30, en: 25, fx: 'water', card: 5, range: [".#.", "#@#", ".#."] },
      { name: '물레방아',    dn: 45, en: 35, fx: 'water', card: 6, range: [".#.", ".@.", ".#."] },
      { name: '호로-춤',     dn: 35, en: 30, fx: 'water', card: 7, range: ["...", "#@#", "..."] },
      { name: '잔잔한 물결', dn: 20, en: 25, fx: 'water', card: 8, range: [".#.", "#@#", ".#."] },
    ]},
    { id: 'inosuke', name: '하시비라 이노스케', color: '#7ab8ff', guardDn: 15, skills: [
      { name: '엄니 꿰뚫기', dn: 25, en: 35, fx: 'beast', card: 5, range: [".#.", "#@#", ".#."] },
      { name: '엄니 찢기',   dn: 30, en: 25, fx: 'beast', card: 6, range: [".#.", "#@#", ".#."] },
      { name: '공간식각',    dn: 40, en: 45, fx: 'beast', card: 7, range: [".#.", "#@#", ".#."] },
      { name: '원형아단',    dn: 50, en: 50, fx: 'beast', card: 8, range: [".#.", "#@#", ".#."] },
    ]},
    { id: 'zenitsu', name: '아가츠마 젠이츠', color: '#ffd21a', guardDn: 0, skills: [
      { name: '벽력일섬 왼쪽',   dn: 25, en: 35, fx: 'thunder', card: 5, range: ["...", "#@#", "..."], move: [-1, 0], noMirror: true },
      { name: '벽력일섬 오른쪽', dn: 25, en: 35, fx: 'thunder', card: 6, range: ["...", ".@#", "..."], move: [1, 0],  noMirror: true },
      { name: '벽력일섬 위',     dn: 40, en: 45, fx: 'thunder', card: 7, range: [".#.", ".@.", "..."], move: [0, -1], noMirror: true },
      { name: '벽력일섬 팔연',   dn: 50, en: 50, fx: 'thunder', card: 8, range: ["###", "#@#", "###"] },
    ]},
    { id: 'nezuko', name: '카마도 네즈코', color: '#ff3d8b', guardDn: 15, skills: [
      { name: '혈귀술 폭혈', dn: 25, en: 35, fx: 'blood', card: 5, range: [".#.", "#@#", ".#."] },
      { name: '폭혈화',      dn: 30, en: 25, fx: 'blood', card: 6, range: ["...", "#@#", "..."] },
      { name: '혈귀 돌진',   dn: 25, en: 25, fx: 'blood', card: 7, range: ["...", ".C#", "..."] },
      { name: '혈귀 각성',   dn: 50, en: 50, fx: 'blood', card: 8, range: [".#.", "#@#", ".#."] },
    ]},
  ];

  // 캐릭터 선택 화면 4x4 = 16칸. 13명 + 미구현 3칸
  const SELECT_SLOTS = 16;

  // ===================== 아래는 계산용 코드 (수정 불필요) =====================

  // 범위 그림 → [[dx,dy], ...]
  function parseRange(rows) {
    let cx = -1, cy = -1;
    rows.forEach((r, y) => { const i = r.search(/[C@]/); if (i >= 0) { cx = i; cy = y; } });
    if (cx < 0) { cy = Math.floor(rows.length / 2); cx = Math.floor(rows[cy].length / 2); }
    const out = [];
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#' || r[x] === '@') out.push([x - cx, y - cy]); });
    return { cells: out, cx, cy, w: Math.max(...rows.map(r => r.length)), h: rows.length };
  }

  // 캐릭터 한 명의 카드 10장 (화면 순서) 만들기
  function buildDeck(ch) {
    const mk = (key, base, extra) => Object.assign({ id: key }, base, extra || {});
    const deck = [
      mk('up', COMMON.up), mk('down', COMMON.down), mk('right', COMMON.right), mk('left', COMMON.left),
      mk('guard', COMMON.guard, { dn: ch.guardDn != null ? ch.guardDn : COMMON.guard.dn }),
    ];
    ch.skills.forEach((s, i) => deck.push(mk('s' + (i + 1), Object.assign({ type: 'attack' }, s))));
    deck.push(mk('rest', COMMON.rest));
    deck.forEach(c => { if (c.range) c.parsed = parseRange(c.range); });
    return deck;
  }

  const CHAR_MAP = {};
  CHARACTERS.forEach(c => { c.deck = buildDeck(c); CHAR_MAP[c.id] = c; });

  function getCard(charId, cardId) {
    const ch = CHAR_MAP[charId]; if (!ch) return null;
    return ch.deck.find(c => c.id === cardId) || null;
  }

  // 공격 칸 계산 (pid 1 = 오른쪽 플레이어 → 반전)
  function attackCells(card, pos, pid) {
    const flip = GAME.MIRROR_FOR_RIGHT && pid === 1 && !card.noMirror;
    const res = [];
    card.parsed.cells.forEach(([dx, dy]) => {
      const x = pos.x + (flip ? -dx : dx), y = pos.y + dy;
      if (x >= 0 && x < GAME.COLS && y >= 0 && y < GAME.ROWS) res.push({ x, y });
    });
    return res;
  }

  const API = { GAME, COMMON, CHARACTERS, CHAR_MAP, SELECT_SLOTS, getCard, attackCells, parseRange };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MH = API;
})(typeof window !== 'undefined' ? window : globalThis);
