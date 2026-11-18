# 멘헤라 대전

2인 온라인 카드 대전 게임입니다. 외부 패키지 없이 Node.js만으로 돌아갑니다.

## 내 컴퓨터에서 실행
```
node server.js
```
브라우저에서 http://localhost:3000 을 엽니다. 창 두 개를 띄우면 혼자서도 테스트할 수 있어요.

## Render 배포 (dashboard.render.com)
1. 이 폴더를 GitHub 저장소에 올립니다.
2. Render → New → **Web Service** → 저장소 선택
3. 설정
   - Runtime: **Node**
   - Build Command: `npm install` (설치할 패키지는 없지만 그대로 둬도 됩니다)
   - Start Command: `node server.js`
   - Health Check Path: `/healthz` (선택)
4. Deploy 하면 끝. WebSocket은 Render에서 따로 설정할 필요가 없습니다.

## 수치 / 범위 수정
`public/js/data.js` 하나만 고치면 됩니다. 파일 맨 위에 설명이 있어요.
- `dn` 데미지, `en` 필요 기력, `range` 공격 범위 그림(`#` 공격칸, `@` 내 칸+공격, `C` 내 칸)
- `GAME.SELECT_TIME` 카드 고르는 시간, `GAME.HP` 체력 등 전체 규칙
- 고친 뒤에는 서버를 다시 시작(또는 Render 재배포)하세요.

## 소리 넣기 (mp3 / mp4 / m4a)
1. 파일을 `public/assets/sound/` 에 넣어요.
2. `public/js/data.js` 의 `SOUND` 에 경로를 적어요. 예) `hit: 'assets/sound/hit.mp3'`
3. 스킬별 소리는 스킬 안의 `sound`(사용할 때), `hitSound`(맞았을 때) 칸에 적어요.
   - 모바일은 화면을 한 번 터치한 뒤부터 소리가 나요(브라우저 규칙).

## 필살기 컷인 연출
스킬에 `cutin: [이미지 4장]` 을 넣으면 오라 + 범위 표시 + 컷인(0.5초에 한 컷)이 나와요.
지금은 탄지로 '물레방아'에만 들어가 있어요. 이미지는 `public/assets/cutin/` 에 있어요.

## 혼자 테스트
로비에서 **혼자 테스트 (CPU 대전)** → 내 캐릭터 고르고 결정 → CPU 캐릭터 클릭.
스킬 선택 화면 왼쪽 TEST MODE 버튼:
- CPU 행동: 랜덤 / 가만히(샌드백) / 방어만
- 기력 무한: 매 라운드 EN 100으로 채움
- 시간 제한: 기본 OFF (켜면 30초)
- HP 둘 다 100 회복

## 모바일
휴대폰을 세로로 들어도 화면이 자동으로 가로로 돌아가요.
안드로이드 크롬은 첫 터치 때 전체화면 + 가로 고정도 시도해요.

## 전투 규칙
- 매 라운드 30초 동안 카드 3장을 고르고 준비완료 → 자동 전투
- 1번 카드 → 2번 → 3번 순서로, 두 사람이 번갈아 사용 (선공은 라운드마다 바뀜)
- 방어 카드는 그 순서의 시작에 먼저 발동해서, 그 순서에 받는 데미지를 DN만큼 줄여줌
- 기력이 모자라면 그 카드는 실패
- 시간 초과 시 빈 칸은 기력 회복 카드로 채워짐
- 오른쪽 플레이어는 공격 범위가 좌우 반전됨 (상대 쪽이 '앞')

## 파일 구조
```
server.js            서버 (방, 캐릭터 선택, 전투 계산)
public/index.html    화면
public/css/style.css
public/js/data.js    ★ 캐릭터/스킬 수치·범위
public/js/game.js    화면 전환·네트워크
public/js/battle.js  2.5D 전투 화면
public/js/fx.js      스킬 이펙트
public/assets/       이미지
```
