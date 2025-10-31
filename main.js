// === Tower Defense — Continuous Waves Final Base ===
// Авторская версия для Влада, с улучшениями логики башен, спавна и управления

const BUILD_SPOTS = [
  [484,95],[359,155],[435,235],[373,288],[218,310],[113,394],[316,417],[444,432],
  [589,550],[484,527],[351,539],[286,631],[162,630],[127,728],[416,706],[285,781],
  [430,822],[301,867],[275,1016],[355,1015],[511,992],[581,946],[667,1016],
  [532,1083],[458,1127],[329,1149],[174,1116]
];

const SPAWNS = [
  [377,50],[81,335],[636,490],[52,667],[646,963],[160,1005]
];

const BASE_POS = { x:160, y:1005 };

const START_GOLD = 500, KILL_REWARD = 10, WAVE_BONUS = 50, TOWER_COST = 100;
const ENEMY_AGGRO = 150, TOWER_RANGE = 200;

let enemies, towers, bullets, buildSprites, ui;
let gold = START_GOLD;
let wave = 0;
let canWatchAd = true;
let isPaused = false;

// === PRELOAD ===
function create_preload() {
  this.load.image('map', 'assets/map.png');
  this.load.image('molot', 'assets/elements/moloticon.png');
  this.load.image('up_icon', 'assets/elements/up.png');
  this.load.image('noup_icon', 'assets/elements/noup.png');

  // towers
  for (let i = 1; i <= 12; i++) {
    this.load.image('tower' + i, 'assets/attacktower/statik/tower' + i + '/stower1.png');
    for (let j = 0; j < 5; j++) {
      this.load.image('tower' + i + '_atk_' + j, 'assets/attacktower/attack/tower' + i + '/aatcktower' + (j+1) + '.png');
    }
  }

  // enemies
  for (let i = 0; i < 7; i++) {
    this.load.image('e_walk_' + i, 'assets/enemy/walk/walk' + (i+1) + '.png');
    this.load.image('e_atk_' + i, 'assets/enemy/atack_enemy/atackenemy' + (i+1) + '.png');
    this.load.image('e_die_' + i, 'assets/enemy/die_enemy/dead' + (i+1) + '.png');
  }
}

// === CREATE ===
function create() {
  const mapImg = this.add.image(360, 640, 'map').setDisplaySize(720, 1280);

  enemies = this.add.group();
  bullets = this.add.group();
  towers = [];
  buildSprites = [];
  ui = {};

  // build spots
  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    const p = BUILD_SPOTS[i];
    const s = this.add.image(p[0], p[1], 'molot').setInteractive().setScale(0.6);
    s.setData('i', i);
    s.on('pointerdown', () => buildTower(this, i));
    buildSprites.push(s);
  }

  // UI
  ui.goldText = this.add.text(12, 12, 'Gold:' + gold, { font: '22px Arial', fill: '#fff' }).setDepth(50);
  ui.waveText = this.add.text(12, 44, 'Wave:' + wave, { font: '18px Arial', fill: '#fff' }).setDepth(50);

  // Пауза / Рестарт
  ui.pauseBtn = this.add.text(200, 1220, '⏸️ Пауза', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' })
    .setInteractive().setDepth(50);
  ui.restartBtn = this.add.text(400, 1220, '🔁 Рестарт', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' })
    .setInteractive().setDepth(50);

  ui.pauseBtn.on('pointerdown', () => togglePause(this));
  ui.restartBtn.on('pointerdown', () => restartGame(this));

  // старт волн
  this.time.addEvent({ delay: 1000, callback: () => startNextWave(this) });
}

// === UPDATE ===
function update() {
  if (isPaused) return;
  try {
    enemies.getChildren().forEach(e => updateEnemy(e));
    bullets.getChildren().forEach(b => updateBullet(b));
  } catch (err) { console.error('Update error:', err); }
}

// === WAVES ===
function startNextWave(scene) {
  wave++;
  gold += WAVE_BONUS;
  ui.waveText.setText('Wave:' + wave);
  ui.goldText.setText('Gold:' + gold);
  canWatchAd = true;

  // количество врагов
  let count = 8 + Math.floor(wave * 1.5);

  // враги появляются каждые 1 сек
  for (let i = 0; i < count; i++) {
    scene.time.addEvent({
      delay: i * 1000,
      callback: () => spawnEnemy(scene)
    });
  }

  // следующая волна через 5 сек после последнего врага
  scene.time.addEvent({
    delay: (count + 5) * 1000,
    callback: () => startNextWave(scene)
  });
}

// === ENEMY SPAWN ===
function spawnEnemy(scene) {
  const spawn = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
  let e = scene.physics.add.sprite(spawn[0], spawn[1], 'e_walk_0');
  e.setScale(0.5); // уменьшаем врага в 2 раза
  e.maxHp = 10 + Math.floor(wave * 1.2);
  e.hp = e.maxHp;
  e.speed = 0.5 + wave * 0.03;
  e.targetTower = null;
  enemies.add(e);

  // анимация движения
  let idx = 0;
  e.animTimer = scene.time.addEvent({
    delay: 120,
    loop: true,
    callback: () => {
      idx = (idx + 1) % 7;
      if (e.active && scene.textures.exists('e_walk_' + idx)) e.setTexture('e_walk_' + idx);
    }
  });
}

// === ENEMY UPDATE ===
function updateEnemy(e) {
  if (!e || !e.active) return;

  // агро на ближайшую башню
  if (e.targetTower && e.targetTower.active) {
    moveTowards(e, e.targetTower.x, e.targetTower.y, e.speed);
    let d = Phaser.Math.Distance.Between(e.x, e.y, e.targetTower.x, e.targetTower.y);
    if (d < 25) {
      // атака башни
      if (!e._atkT || Date.now() - e._atkT > 600) {
        e._atkT = Date.now();
        e.setTexture('e_atk_' + (Math.floor(Math.random() * 7))); // имитация атаки
        e.targetTower.hp -= 10;
        if (e.targetTower.hp <= 0) {
          e.targetTower.destroy();
          towers = towers.filter(t => t.sprite && t.sprite.active);
          e.targetTower = null;
        }
      }
    }
    return;
  }

  // поиск новой цели
  let nearest = null, nd = 1e9;
  for (let t of towers) {
    if (!t.sprite || !t.sprite.active) continue;
    let d = Phaser.Math.Distance.Between(e.x, e.y, t.sprite.x, t.sprite.y);
    if (d < ENEMY_AGGRO && d < nd) { nd = d; nearest = t.sprite; }
  }
  if (nearest) { e.targetTower = nearest; return; }

  // движение к базе
  moveTowards(e, BASE_POS.x, BASE_POS.y, e.speed);
  let db = Phaser.Math.Distance.Between(e.x, e.y, BASE_POS.x, BASE_POS.y);
  if (db < 26) {
    e.destroy();
    gold = Math.max(0, gold - 10);
    ui.goldText.setText('Gold:' + gold);
  }
}

// === MOVE TOWARDS ===
function moveTowards(obj, tx, ty, speed) {
  let dx = tx - obj.x, dy = ty - obj.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;
  obj.x += (dx / dist) * speed * 2;
  obj.y += (dy / dist) * speed * 2;
  obj.setFlipX(dx < 0);
}

// === BUILD TOWER ===
function buildTower(scene, index) {
  if (gold < TOWER_COST) { alert('Not enough gold'); return; }
  let pos = BUILD_SPOTS[index];
  buildSprites[index].destroy();
  buildSprites[index] = null;
  gold -= TOWER_COST; ui.goldText.setText('Gold:' + gold);

  let ts = scene.add.sprite(pos[0], pos[1], 'tower1');
  ts.hp = 200; ts.level = 1; ts._shootRate = 900; ts._range = TOWER_RANGE; ts._lastShot = 0; ts._typeKey = 'tower1';
  ts.setInteractive();
  ts.on('pointerdown', () => upgradeTower(scene, ts)); // улучшение при клике на башню

  // индикатор апгрейда
  ts.upIcon = scene.add.image(pos[0] - 28, pos[1] + 40, gold >= 150 ? 'up_icon' : 'noup_icon').setScale(0.6);
  towers.push({ sprite: ts });
}

// === UPGRADE ===
function upgradeTower(scene, ts) {
  if (gold < 150) return; // просто не апгрейдит, если не хватает
  let cur = ts._typeKey;
  let num = parseInt(cur.replace(/[^0-9]/g, '')) || 1;
  let next = 'tower' + (num + 1);
  if (!scene.textures.exists(next)) return;
  gold -= 150; ui.goldText.setText('Gold:' + gold);
  ts.setTexture(next);
  ts._typeKey = next;
  ts.level += 1;
  ts.hp += 100;
  ts._shootRate = Math.max(400, ts._shootRate - 100);
}

// === BULLET ===
function updateBullet(b) {
  if (!b.active || !b.target || !b.target.active) { if (b.active) b.destroy(); return; }
  let dx = b.target.x - b.x, dy = b.target.y - b.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 8) {
    b.target.hp -= 20;
    if (b.target.hp <= 0) {
      b.target.destroy();
      gold += KILL_REWARD;
      ui.goldText.setText('Gold:' + gold);
    }
    b.destroy(); return;
  }
  b.x += (dx / dist) * 10;
  b.y += (dy / dist) * 10;
}

// === SHOOT LOOP ===
setInterval(() => {
  if (isPaused) return;
  try {
    let sc = game.scene.scenes[0];
    if (!sc) return;
    for (let t of towers) {
      let ts = t.sprite;
      if (!ts || !ts.active) continue;
      ts._lastShot += 200;
      ts.upIcon.setTexture(gold >= 150 ? 'up_icon' : 'noup_icon');
      if (ts._lastShot < ts._shootRate) continue;
      ts._lastShot = 0;
      let target = null, dmin = 1e9;
      enemies.getChildren().forEach(e => {
        if (!e.active) return;
        let d = Phaser.Math.Distance.Between(ts.x, ts.y, e.x, e.y);
        if (d < ts._range && d < dmin) { dmin = d; target = e; }
      });
      if (target) {
        let b = sc.add.circle(ts.x, ts.y, 6, 0xffdd00);
        sc.physics.add.existing(b);
        b.target = target;
        bullets.add(b);
      }
    }
  } catch (e) {}
}, 200);

// === PAUSE & RESTART ===
function togglePause(scene) {
  isPaused = !isPaused;
  ui.pauseBtn.setText(isPaused ? '▶️ Продолжить' : '⏸️ Пауза');
}

function restartGame(scene) {
  scene.scene.restart();
  gold = START_GOLD;
  wave = 0;
  isPaused = false;
}

// === PHASER CONFIG ===
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  scene: { preload: create_preload, create: create, update: update },
  physics: { default: 'arcade' }
};
const game = new Phaser.Game(config);
