// === Tower Defense — Advanced Combat Update ===
// Для Влада — статичная и атакующая анимации башен, смерть врагов, атака базы, баланс и стабильная частота кадров.

const BUILD_SPOTS = [[484,95],[359,155],[435,235],[373,288],[218,310],[113,394],[316,417],[444,432],[589,550],[484,527],[351,539],[286,631],[162,630],[127,728],[416,706],[285,781],[430,822],[301,867],[275,1016],[355,1015],[511,992],[581,946],[667,1016],[532,1083],[458,1127],[329,1149],[174,1116]];
const PATHS = [
  [[377,50],[429,138],[410,189],[346,224],[311,257],[290,305],[331,354],[400,463],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[81,335],[189,359],[331,354],[400,463],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[636,490],[544,498],[413,491],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[52,667],[168,691],[289,700],[347,736],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[646,963],[565,1029],[441,1069],[312,1082],[226,1059]]
];

const BASE_POS = { x:160, y:1005 };
const BASE_RECT = { w:153, h:93 };
const START_GOLD = 500, KILL_REWARD = 10, WAVE_BONUS = 50, TOWER_COST = 100, UPGRADE_COST = 150;

let enemies, towers, bullets, ui;
let gold = START_GOLD;
let wave = 0;
let baseHp = 1000;
let isPaused = false;

// === PRELOAD ===
function create_preload() {
  this.load.image('map', 'assets/map.png');
  this.load.image('molot', 'assets/elements/moloticon.png');
  this.load.image('up_icon', 'assets/elements/up.png');
  this.load.image('noup_icon', 'assets/elements/noup.png');

  // башни (статик + атакующие кадры)
  for (let i = 1; i <= 12; i++) {
    for (let j = 1; j <= 4; j++) this.load.image(`tower${i}_idle_${j}`, `assets/attacktower/statik/tower${i}/stower${j}.png`);
    for (let j = 0; j < 5; j++) this.load.image(`tower${i}_atk_${j}`, `assets/attacktower/attack/tower${i}/aatcktower${j+1}.png`);
  }

  // враги
  for (let i = 0; i < 7; i++) {
    this.load.image('e_walk_' + i, 'assets/enemy/walk/walk' + (i+1) + '.png');
    this.load.image('e_atk_' + i, 'assets/enemy/atack_enemy/atackenemy' + (i+1) + '.png');
    this.load.image('e_die_' + i, 'assets/enemy/die_enemy/dead' + (i+1) + '.png');
  }
}

// === CREATE ===
function create() {
  this.add.image(360, 640, 'map').setDisplaySize(720, 1280);
  enemies = this.add.group(); bullets = this.add.group(); towers = []; ui = {};

  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    const p = BUILD_SPOTS[i];
    const s = this.add.image(p[0], p[1], 'molot').setInteractive().setScale(0.6);
    s.setData('i', i);
    s.on('pointerdown', () => buildTower(this, i));
  }

  ui.goldText = this.add.text(12, 12, 'Gold:' + gold, { font: '22px Arial', fill: '#fff' });
  ui.waveText = this.add.text(12, 40, 'Wave:' + wave, { font: '18px Arial', fill: '#fff' });
  ui.baseBar = this.add.rectangle(360, 20, 300, 20, 0x00ff00).setOrigin(0.5,0);
  ui.pauseBtn = this.add.text(200, 1220, '⏸️ Пауза', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive();
  ui.restartBtn = this.add.text(400, 1220, '🔁 Рестарт', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive();
  ui.pauseBtn.on('pointerdown', () => togglePause(this));
  ui.restartBtn.on('pointerdown', () => restartGame(this));

  this.time.addEvent({ delay: 1000, callback: () => startNextWave(this) });
}

// === UPDATE ===
function update() {
  if (isPaused) return;
  enemies.getChildren().forEach(e => updateEnemy(e));
  bullets.getChildren().forEach(b => updateBullet(b));
  ui.baseBar.width = 300 * (baseHp / 1000);
  ui.baseBar.fillColor = baseHp > 600 ? 0x00ff00 : baseHp > 300 ? 0xffff00 : 0xff0000;
}

// === WAVES ===
function startNextWave(scene) {
  wave++; gold += WAVE_BONUS; ui.waveText.setText('Wave:' + wave); ui.goldText.setText('Gold:' + gold);
  const count = 8 + Math.floor(wave * 1.5);
  for (let i = 0; i < count; i++) scene.time.addEvent({ delay: i * 1000, callback: () => spawnEnemy(scene) });
  scene.time.addEvent({ delay: (count + 6) * 1000, callback: () => startNextWave(scene) });
}

// === SPAWN ===
function spawnEnemy(scene) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const e = scene.physics.add.sprite(path[0][0], path[0][1], 'e_walk_0').setScale(0.35);
  e.maxHp = 100; e.hp = e.maxHp; e.speed = 0.25; e.path = path; e.pathIndex = 1; e.state = 'walk';
  e._walkFrame = 0; e._atkFrame = 0; e._dieFrame = 0;
  e._animTimer = scene.time.addEvent({ delay: 140, loop: true, callback: () => animateEnemy(e, scene) });
  enemies.add(e);
}

// === ENEMY ANIMATION ===
function animateEnemy(e, scene) {
  if (!e.active) return;
  if (e.state === 'walk') {
    e._walkFrame = (e._walkFrame + 1) % 7;
    e.setTexture('e_walk_' + e._walkFrame);
  } else if (e.state === 'attack') {
    e._atkFrame = (e._atkFrame + 1) % 7;
    e.setTexture('e_atk_' + e._atkFrame);
  } else if (e.state === 'die') {
    if (e._dieFrame < 7) e.setTexture('e_die_' + e._dieFrame++);
    else e.destroy();
  }
}

// === ENEMY UPDATE ===
function updateEnemy(e) {
  if (!e.active || e.state === 'die') return;
  if (e.pathIndex >= e.path.length) {
    e.state = 'attack';
    if (!e._lastAttack || Date.now() - e._lastAttack > 800) {
      e._lastAttack = Date.now();
      baseHp -= 10;
      if (baseHp <= 0) alert("Базу уничтожили!");
    }
    return;
  }

  const wp = e.path[e.pathIndex];
  const dx = wp[0] - e.x, dy = wp[1] - e.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 6) e.pathIndex++;
  else { e.x += (dx / dist) * e.speed * 2; e.y += (dy / dist) * e.speed * 2; }

  // ищем ближайшую башню
  let nearest = null, nd = 9999;
  for (let t of towers) {
    const ts = t.sprite;
    if (!ts.active) continue;
    const d = Phaser.Math.Distance.Between(e.x, e.y, ts.x, ts.y);
    if (d < 40 && d < nd) { nearest = ts; nd = d; }
  }
  if (nearest) {
    e.state = 'attack';
    if (!e._lastAttack || Date.now() - e._lastAttack > 800) {
      e._lastAttack = Date.now();
      nearest.hp -= 10;
      if (nearest.hp <= 0) nearest.destroy();
    }
  } else e.state = 'walk';
}

// === BUILD TOWER ===
function buildTower(scene, index) {
  if (gold < TOWER_COST) { alert('Нет золота'); return; }
  const pos = BUILD_SPOTS[index]; gold -= TOWER_COST; ui.goldText.setText('Gold:' + gold);
  const ts = scene.add.sprite(pos[0], pos[1], 'tower1_idle_1'); ts.setInteractive();
  ts.level = 1; ts.hp = 50; ts._range = 200; ts._shootRate = 450; ts._lastShot = 0; ts._isAttacking = false; ts._atkFrame = 0; ts._idleFrame = 0; ts._typeKey = 'tower1';

  ts.on('pointerdown', () => upgradeTower(scene, ts));
  ts._animTimer = scene.time.addEvent({ delay: 80, loop: true, callback: () => {
    if (!ts.active) return;
    if (ts._isAttacking) {
      ts._atkFrame = (ts._atkFrame + 1) % 5;
      ts.setTexture(`${ts._typeKey}_atk_${ts._atkFrame}`);
    } else {
      ts._idleFrame = (ts._idleFrame + 1) % 4;
      ts.setTexture(`${ts._typeKey}_idle_${ts._idleFrame}`);
    }
  }});
  towers.push({ sprite: ts });
}

// === UPGRADE ===
function upgradeTower(scene, ts) {
  let n = parseInt(ts._typeKey.replace('tower','')) + 1;
  if (n > 12) return; // максимум
  if (gold < UPGRADE_COST * n) { alert('Нужно золота: ' + UPGRADE_COST * n); return; }
  gold -= UPGRADE_COST * n; ui.goldText.setText('Gold:' + gold);
  ts._typeKey = 'tower' + n; ts.level = n; ts._range += 20; ts._shootRate = Math.max(200, ts._shootRate - 50);
}

// === BULLETS ===
function updateBullet(b) {
  if (!b.active || !b.target.active) return b.destroy();
  const dx = b.target.x - b.x, dy = b.target.y - b.y, dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 8) {
    b.target.hp -= 3;
    if (b.target.hp <= 0 && b.target.state !== 'die') {
      b.target.state = 'die';
      b.target._dieFrame = 0;
      gold += KILL_REWARD; ui.goldText.setText('Gold:' + gold);
    }
    b.destroy(); return;
  }
  b.x += (dx / dist) * b.speed; b.y += (dy / dist) * b.speed;
}

// === SHOOT LOOP ===
setInterval(() => {
  if (isPaused) return;
  const sc = game.scene.scenes[0];
  for (let t of towers) {
    const ts = t.sprite;
    if (!ts.active) continue;
    ts._lastShot += 200;
    if (ts._lastShot < ts._shootRate) { ts._isAttacking = false; continue; }
    ts._lastShot = 0;
    let target = null, dmin = 9999;
    enemies.getChildren().forEach(e => {
      if (e.active && e.state !== 'die') {
        const d = Phaser.Math.Distance.Between(ts.x, ts.y, e.x, e.y);
        if (d < ts._range && d < dmin) { dmin = d; target = e; }
      }
    });
    if (target) {
      const b = sc.add.circle(ts.x, ts.y, 5, 0xffdd00);
      sc.physics.add.existing(b);
      b.target = target; b.speed = 10;
      bullets.add(b);
      ts._isAttacking = true;
    } else ts._isAttacking = false;
  }
}, 200);

// === CONTROL ===
function togglePause(scene) {
  isPaused = !isPaused;
  ui.pauseBtn.setText(isPaused ? '▶️ Продолжить' : '⏸️ Пауза');
}
function restartGame(scene) {
  scene.scene.restart();
  gold = START_GOLD; baseHp = 1000; wave = 0; isPaused = false;
}

// === PHASER CONFIG ===
const config2 = { type: Phaser.AUTO, parent: 'game', width: 720, height: 1280, scene: { preload: create_preload, create: create, update: update }, physics: { default: 'arcade' } };
const game = new Phaser.Game(config2);
