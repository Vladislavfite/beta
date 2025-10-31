// === Tower Defense — Improved Mechanics (Death, Idle, Scaling Upgrades) ===

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

const START_GOLD = 500, KILL_REWARD = 10, WAVE_BONUS = 50, TOWER_COST = 100;
let UPGRADE_COST = 150;
const ENEMY_AGGRO = 150, TOWER_RANGE = 200;

let enemies, towers, bullets, buildSprites, ui;
let gold = START_GOLD;
let wave = 0;
let isPaused = false;

// ---------------- PRELOAD ----------------
function create_preload() {
  this.load.image('map', 'assets/map.png');
  this.load.image('molot', 'assets/elements/moloticon.png');
  this.load.image('up_icon', 'assets/elements/up.png');
  this.load.image('noup_icon', 'assets/elements/noup.png');

  // tower idle + attack
  for (let i = 1; i <= 12; i++) {
    for (let j = 0; j < 5; j++) {
      this.load.image('tower' + i + '_idle_' + j, 'assets/attacktower/idle/tower' + i + '/idletower' + (j+1) + '.png');
      this.load.image('tower' + i + '_atk_' + j, 'assets/attacktower/attack/tower' + i + '/aatcktower' + (j+1) + '.png');
    }
  }

  // enemy frames
  for (let i = 0; i < 7; i++) {
    this.load.image('e_walk_' + i, 'assets/enemy/walk/walk' + (i+1) + '.png');
    this.load.image('e_atk_' + i, 'assets/enemy/atack_enemy/atackenemy' + (i+1) + '.png');
    this.load.image('e_die_' + i, 'assets/enemy/die_enemy/dead' + (i+1) + '.png');
  }

  try { this.load.audio('s_shoot', 'assets/sounds/shoot.mp3'); } catch(e){}
  try { this.load.audio('s_death', 'assets/sounds/death.mp3'); } catch(e){}
}

// ---------------- CREATE ----------------
function create() {
  this.add.image(360, 640, 'map').setDisplaySize(720, 1280);

  enemies = this.add.group();
  bullets = this.add.group();
  towers = [];
  buildSprites = [];
  ui = {};

  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    const p = BUILD_SPOTS[i];
    const s = this.add.image(p[0], p[1], 'molot').setInteractive().setScale(0.6);
    s.setData('i', i);
    s.on('pointerdown', () => buildTower(this, i));
    buildSprites.push(s);
  }

  ui.goldText = this.add.text(12, 12, 'Gold:' + gold, { font: '22px Arial', fill: '#fff' });
  ui.waveText = this.add.text(12, 44, 'Wave:' + wave, { font: '18px Arial', fill: '#fff' });
  ui.pauseBtn = this.add.text(200, 1220, '⏸️ Пауза', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive();
  ui.restartBtn = this.add.text(400, 1220, '🔁 Рестарт', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive();

  ui.pauseBtn.on('pointerdown', () => togglePause(this));
  ui.restartBtn.on('pointerdown', () => restartGame(this));

  this.time.addEvent({ delay: 1000, callback: () => startNextWave(this) });
}

// ---------------- UPDATE ----------------
function update() {
  if (isPaused) return;
  enemies.getChildren().forEach(e => updateEnemy(e));
  bullets.getChildren().forEach(b => updateBullet(b));
}

// ---------------- WAVES ----------------
function startNextWave(scene) {
  wave++;
  gold += WAVE_BONUS;
  ui.waveText.setText('Wave:' + wave);
  ui.goldText.setText('Gold:' + gold);

  let count = 8 + Math.floor(wave * 1.5);
  for (let i = 0; i < count; i++) {
    scene.time.addEvent({ delay: i * 1000, callback: () => spawnEnemy(scene) });
  }
  scene.time.addEvent({ delay: (count + 5) * 1000, callback: () => startNextWave(scene) });
}

// ---------------- SPAWN ----------------
function spawnEnemy(scene) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const spawn = path[0];
  let e = scene.physics.add.sprite(spawn[0], spawn[1], 'e_walk_0');
  e.setScale(0.35);
  e.maxHp = 100;
  e.hp = 100;
  e.speed = 0.25; // медленнее
  e.path = path;
  e.pathIndex = 1;
  e.state = 'walk';
  enemies.add(e);

  e._walkFrame = 0;
  e._atkFrame = 0;
  e._dieFrame = 0;
  e._animTimer = scene.time.addEvent({
    delay: 150,
    loop: true,
    callback: () => {
      if (!e.active) return;
      if (e.state === 'walk') {
        e._walkFrame = (e._walkFrame + 1) % 7;
        e.setTexture('e_walk_' + e._walkFrame);
      } else if (e.state === 'attack') {
        e._atkFrame = (e._atkFrame + 1) % 7;
        e.setTexture('e_atk_' + e._atkFrame);
      } else if (e.state === 'dead') {
        e._dieFrame++;
        if (e._dieFrame < 7) e.setTexture('e_die_' + e._dieFrame);
        else e.destroy();
      }
    }
  });
}

// ---------------- ENEMY UPDATE ----------------
function updateEnemy(e) {
  if (!e || !e.active) return;
  if (e.state === 'dead') return;

  if (e.pathIndex >= e.path.length) {
    moveTowards(e, BASE_POS.x, BASE_POS.y, e.speed);
    return;
  }

  const waypoint = e.path[e.pathIndex];
  moveTowards(e, waypoint[0], waypoint[1], e.speed);
  if (Phaser.Math.Distance.Between(e.x, e.y, waypoint[0], waypoint[1]) < 6)
    e.pathIndex++;
}

// ---------------- MOVE ----------------
function moveTowards(obj, tx, ty, speed) {
  let dx = tx - obj.x, dy = ty - obj.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.1) return;
  obj.x += (dx / dist) * speed * 2;
  obj.y += (dy / dist) * speed * 2;
}

// ---------------- BUILD TOWER ----------------
function buildTower(scene, index) {
  if (gold < TOWER_COST) return alert('Not enough gold');
  let pos = BUILD_SPOTS[index];
  buildSprites[index].destroy();
  gold -= TOWER_COST; ui.goldText.setText('Gold:' + gold);

  let ts = scene.add.sprite(pos[0], pos[1], 'tower1_idle_0');
  ts.hp = 200;
  ts.level = 1;
  ts._shootRate = 900;
  ts._range = TOWER_RANGE;
  ts._lastShot = 0;
  ts._typeKey = 'tower1';
  ts._isAttacking = false;
  ts._animFrame = 0;

  ts.setInteractive();
  ts.on('pointerdown', () => upgradeTower(scene, ts));

  ts._animTimer = scene.time.addEvent({
    delay: 90,
    loop: true,
    callback: () => {
      if (!ts.active) return;
      ts._animFrame = (ts._animFrame + 1) % 5;
      const key = ts._isAttacking
        ? ts._typeKey + '_atk_' + ts._animFrame
        : ts._typeKey + '_idle_' + ts._animFrame;
      if (scene.textures.exists(key)) ts.setTexture(key);
    }
  });

  ts.setFlipX(ts.x > 360);
  towers.push({ sprite: ts });
}

// ---------------- UPGRADE ----------------
function upgradeTower(scene, ts) {
  let cur = ts._typeKey;
  let num = parseInt(cur.replace(/[^0-9]/g, '')) || 1;
  if (num >= 12) return alert('Максимальный уровень');
  let next = 'tower' + (num + 1);
  if (gold < UPGRADE_COST) return alert('Need ' + UPGRADE_COST + ' gold');
  gold -= UPGRADE_COST; ui.goldText.setText('Gold:' + gold);
  ts._typeKey = next;
  ts.level++;
  ts.hp += 100;
  ts._shootRate = Math.max(400, ts._shootRate - 100);
  ts._range = Math.min(300, ts._range + 30);
  UPGRADE_COST += 100; // увеличиваем цену апгрейда
}

// ---------------- BULLETS ----------------
function updateBullet(b) {
  if (!b.active || !b.target || !b.target.active) return b.destroy();
  let dx = b.target.x - b.x, dy = b.target.y - b.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 8) {
    b.target.hp -= 3;
    if (b.target.hp <= 0 && b.target.state !== 'dead') {
      b.target.state = 'dead';
      gold += KILL_REWARD;
      ui.goldText.setText('Gold:' + gold);
      try { b.target._animTimer.delay = 120; } catch(e){}
      try { b.target._animTimer.callback(); } catch(e){}
    }
    b.destroy();
    return;
  }
  b.x += (dx / dist) * b.speed;
  b.y += (dy / dist) * b.speed;
}

// ---------------- SHOOT LOOP ----------------
setInterval(() => {
  if (isPaused) return;
  let sc = game.scene.scenes[0];
  if (!sc) return;
  for (let t of towers) {
    let ts = t.sprite;
    if (!ts || !ts.active) continue;
    ts._lastShot += 200;
    if (ts._lastShot < ts._shootRate) { ts._isAttacking = false; continue; }
    ts._lastShot = 0;
    let target = null, dmin = 1e9;
    enemies.getChildren().forEach(e => {
      if (!e.active || e.state === 'dead') return;
      let d = Phaser.Math.Distance.Between(ts.x, ts.y, e.x, e.y);
      if (d < ts._range && d < dmin) { dmin = d; target = e; }
    });
    if (target) {
      let b = sc.add.circle(ts.x, ts.y, 6, 0xffdd00);
      sc.physics.add.existing(b);
      b.target = target;
      b.speed = 8;
      bullets.add(b);
      ts._isAttacking = true;
    } else ts._isAttacking = false;
  }
}, 200);

// ---------------- PAUSE / RESTART ----------------
function togglePause(scene) {
  isPaused = !isPaused;
  ui.pauseBtn.setText(isPaused ? '▶️ Продолжить' : '⏸️ Пауза');
}
function restartGame(scene) { scene.scene.restart(); gold = START_GOLD; wave = 0; isPaused = false; }

// ---------------- PHASER CONFIG ----------------
const config2 = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  scene: { preload: create_preload, create: create, update: update },
  physics: { default: 'arcade' }
};
const game = new Phaser.Game(config2);
