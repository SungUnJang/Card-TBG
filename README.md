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
