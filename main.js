// === Tower Defense — Fixed Graphics + Continuous Waves ===
// Для Влада — восстановлены оригинальные asset keys и логика путей.
// Сцена 720x1280, Phaser 3

const BUILD_SPOTS = [[484,95],[359,155],[435,235],[373,288],[218,310],[113,394],[316,417],[444,432],[589,550],[484,527],[351,539],[286,631],[162,630],[127,728],[416,706],[285,781],[430,822],[301,867],[275,1016],[355,1015],[511,992],[581,946],[667,1016],[532,1083],[458,1127],[329,1149],[174,1116]];
// Пути (точки) — использованы координаты которые ты присылал
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
const UPGRADE_COST = 150;
const ENEMY_AGGRO = 150, TOWER_RANGE = 200;

let enemies, towers, bullets, buildSprites, ui;
let gold = START_GOLD;
let wave = 0;
let canWatchAd = true;
let isPaused = false;

// ---------------- PRELOAD ----------------
function create_preload() {
  // карта и элементы интерфейса (оригинальные ключи)
  this.load.image('map', 'assets/map.png');
  this.load.image('mappath', 'assets/mappath.png');
  this.load.image('molot', 'assets/elements/moloticon.png');
  this.load.image('up_icon', 'assets/elements/up.png');
  this.load.image('noup_icon', 'assets/elements/noup.png');

  // tower statics + attack frames (1..12) — как в проекте
  for (let i = 1; i <= 12; i++) {
    this.load.image('tower' + i, 'assets/attacktower/statik/tower' + i + '/stower1.png');
    for (let j = 0; j < 5; j++) {
      this.load.image('tower' + i + '_atk_' + j, 'assets/attacktower/attack/tower' + i + '/aatcktower' + (j+1) + '.png');
    }
  }

  // enemy frames (walk / attack / die)
  for (let i = 0; i < 7; i++) {
    this.load.image('e_walk_' + i, 'assets/enemy/walk/walk' + (i+1) + '.png');
    this.load.image('e_atk_' + i, 'assets/enemy/atack_enemy/atackenemy' + (i+1) + '.png');
    this.load.image('e_die_' + i, 'assets/enemy/die_enemy/dead' + (i+1) + '.png');
  }

  // sounds optional
  try { this.load.audio('s_shoot', 'assets/sounds/shoot.mp3'); } catch(e) {}
  try { this.load.audio('s_death', 'assets/sounds/death.mp3'); } catch(e) {}

  this.load.on('filecomplete', key => console.log('✅ Loaded:', key));
  this.load.on('loaderror', file => console.error('❌ Error loading:', file && file.src ? file.src : file));
}

// ---------------- CREATE ----------------
function create() {
  // отрисовка карты с нужным размером (вернул сюда)
  const mapImg = this.add.image(360, 640, 'map').setDisplaySize(720, 1280);

  enemies = this.add.group();
  bullets = this.add.group();
  towers = [];
  buildSprites = [];
  ui = {};

  // создаём кнопки постройки (молотки)
  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    const p = BUILD_SPOTS[i];
    const s = this.add.image(p[0], p[1], 'molot').setInteractive().setScale(0.6);
    s.setData('i', i);
    s.on('pointerdown', () => buildTower(this, i));
    buildSprites.push(s);
  }

  // UI: золото и волна
  ui.goldText = this.add.text(12, 12, 'Gold:' + gold, { font: '22px Arial', fill: '#fff' }).setDepth(50);
  ui.waveText = this.add.text(12, 44, 'Wave:' + wave, { font: '18px Arial', fill: '#fff' }).setDepth(50);

  // pause / restart
  ui.pauseBtn = this.add.text(200, 1220, '⏸️ Пауза', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive().setDepth(50);
  ui.restartBtn = this.add.text(400, 1220, '🔁 Рестарт', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive().setDepth(50);
  ui.pauseBtn.on('pointerdown', () => togglePause(this));
  ui.restartBtn.on('pointerdown', () => restartGame(this));

  // (опционально показать зону базы для отладки)
  // this.add.rectangle(BASE_POS.x, BASE_POS.y, BASE_RECT.w, BASE_RECT.h, 0x0000ff, 0.15).setOrigin(0.5);

  // старт следующей волны через 1s
  this.time.addEvent({ delay: 1000, callback: () => startNextWave(this) });
}

// ---------------- UPDATE ----------------
function update() {
  if (isPaused) return;
  try {
    enemies.getChildren().forEach(e => updateEnemy(e));
    bullets.getChildren().forEach(b => updateBullet(b));
    // обновляем up/noup индикаторы у башен, если есть
    for (let t of towers) {
      if (t.sprite && t.sprite.upIcon) {
        const imgKey = gold >= UPGRADE_COST ? 'up_icon' : 'noup_icon';
        if (t.sprite.upIcon.texture.key !== imgKey) t.sprite.upIcon.setTexture(imgKey);
        // держим индикатор над башней
        t.sprite.upIcon.x = t.sprite.x - 28;
        t.sprite.upIcon.y = t.sprite.y + 40;
        t.sprite.upIcon.setVisible(t.sprite.active);
      }
    }
  } catch (err) {
    console.error('Update error:', err);
  }
}

// ---------------- WAVES ----------------
function startNextWave(scene) {
  wave++;
  gold += WAVE_BONUS;
  ui.waveText.setText('Wave:' + wave);
  ui.goldText.setText('Gold:' + gold);
  canWatchAd = true;

  let count = 8 + Math.floor(wave * 1.5);

  // враги по 1 сек между спавнами
  for (let i = 0; i < count; i++) {
    scene.time.addEvent({ delay: i * 1000, callback: () => spawnEnemy(scene) });
  }

  // планируем следующую волну через (count+5) секунд
  scene.time.addEvent({ delay: (count + 5) * 1000, callback: () => startNextWave(scene) });
}

// ---------------- SPAWN ----------------
function spawnEnemy(scene) {
  // выбираем случайный путь (PATHS), стартовая точка — path[0]
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  if (!path || path.length === 0) return;

  const spawn = path[0];
  let e = scene.physics.add.sprite(spawn[0], spawn[1], 'e_walk_0');
  e.setScale(0.5); // уменьшить в 2 раза
  e.maxHp = 10 + Math.floor(wave * 1.2);
  e.hp = e.maxHp;
  e.speed = 0.4 + wave * 0.03; // слегка медленнее
  e.path = path;       // запоминаем путь
  e.pathIndex = 1;     // следующая точка пути
  e.targetTower = null;
  e._lastAttack = 0;
  e.state = 'walk';
  enemies.add(e);

  // анимация ходьбы / атаки
  e._walkFrame = 0;
  e._atkFrame = 0;
  e._animTimer = scene.time.addEvent({
    delay: 140,
    loop: true,
    callback: () => {
      if (!e.active) return;
      if (e.state === 'walk') {
        e._walkFrame = (e._walkFrame + 1) % 7;
        if (scene.textures.exists('e_walk_' + e._walkFrame)) e.setTexture('e_walk_' + e._walkFrame);
      } else if (e.state === 'attack') {
        e._atkFrame = (e._atkFrame + 1) % 7;
        if (scene.textures.exists('e_atk_' + e._atkFrame)) e.setTexture('e_atk_' + e._atkFrame);
      }
    }
  });
}

// ---------------- ENEMY UPDATE ----------------
function updateEnemy(e) {
  if (!e || !e.active) return;
  if (e.state === 'dead') return;

  // если цель — башня
  if (e.targetTower && e.targetTower.active) {
    e.state = 'attack';
    moveTowards(e, e.targetTower.x, e.targetTower.y, e.speed);
    e.setFlipX(e.targetTower.x < e.x);
    let d = Phaser.Math.Distance.Between(e.x, e.y, e.targetTower.x, e.targetTower.y);
    if (d < 24) {
      if (!e._lastAttack || Date.now() - e._lastAttack > 600) {
        e._lastAttack = Date.now();
        if (e.targetTower.hp != null) {
          e.targetTower.hp -= 10;
          if (e.targetTower.hp <= 0) {
            e.targetTower.destroy();
            towers = towers.filter(t => t.sprite && t.sprite.active);
            e.targetTower = null;
            e.state = 'returning';
          }
        } else {
          e.targetTower = null;
          e.state = 'returning';
        }
      }
    }
    return;
  }

  // поиск ближайшей башни в радиусе агро
  let nearest = null, nd = 1e9;
  for (let t of towers) {
    if (!t.sprite || !t.sprite.active) continue;
    let d = Phaser.Math.Distance.Between(e.x, e.y, t.sprite.x, t.sprite.y);
    if (d < ENEMY_AGGRO && d < nd) { nd = d; nearest = t.sprite; }
  }
  if (nearest) {
    e.targetTower = nearest;
    e._savedPathIndex = e.pathIndex;
    return;
  }

  // если возвращаемся после атаки — идём к сохранённой точке
  if (e.state === 'returning') {
    const target = e.path[e.pathIndex] || e.path[e.path.length - 1];
    moveTowards(e, target[0], target[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, target[0], target[1]) < 8) {
      e.state = 'walk';
    }
    return;
  }

  // движение по пути
  if (e.pathIndex >= e.path.length) {
    // дошли до конца пути — идём к базе
    moveTowards(e, BASE_POS.x, BASE_POS.y, e.speed);
    e.setFlipX(BASE_POS.x < e.x);
    let dbx = Math.abs(e.x - BASE_POS.x), dby = Math.abs(e.y - BASE_POS.y);
    if (dbx < BASE_RECT.w/2 && dby < BASE_RECT.h/2) {
      if (!e._lastAttack || Date.now() - e._lastAttack > 600) {
        e._lastAttack = Date.now();
        gold = Math.max(0, gold - 10);
        ui.goldText.setText('Gold:' + gold);
        // можно проиграть анимацию атаки базы
      }
    }
    return;
  }

  const waypoint = e.path[e.pathIndex];
  if (waypoint) {
    moveTowards(e, waypoint[0], waypoint[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, waypoint[0], waypoint[1]) < 6) {
      e.pathIndex++;
    }
  }
}

// ---------------- MOVE HELPER ----------------
function moveTowards(obj, tx, ty, speed) {
  let dx = tx - obj.x, dy = ty - obj.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.1) return;
  obj.x += (dx / dist) * speed * 2;
  obj.y += (dy / dist) * speed * 2;
  // flip handled where needed
}

// ---------------- BUILD TOWER ----------------
function buildTower(scene, index) {
  if (index < 0 || index >= BUILD_SPOTS.length) return;
  if (!buildSprites[index]) return;
  if (gold < TOWER_COST) { alert('Not enough gold'); return; }
  let pos = BUILD_SPOTS[index];
  buildSprites[index].destroy(); buildSprites[index] = null;
  gold -= TOWER_COST; ui.goldText.setText('Gold:' + gold);

  let ts = scene.add.sprite(pos[0], pos[1], 'tower1');
  ts.hp = 200; ts.level = 1; ts._shootRate = 900; ts._range = TOWER_RANGE; ts._lastShot = 0; ts._typeKey = 'tower1';
  ts.setInteractive();
  // улучшение по нажатию на саму башню (как просил)
  ts.on('pointerdown', () => upgradeTower(scene, ts));

  // индикатор только для наглядности, не кликабельный
  if (scene.textures.exists('up_icon') && scene.textures.exists('noup_icon')) {
    ts.upIcon = scene.add.image(pos[0] - 28, pos[1] + 40, gold >= UPGRADE_COST ? 'up_icon' : 'noup_icon').setScale(0.6);
  }
  // ориентация по центру
  ts.setFlipX(ts.x > 360);

  towers.push({ sprite: ts });
}

// ---------------- UPGRADE ----------------
function upgradeTower(scene, ts) {
  if (!ts._typeKey) return;
  let cur = ts._typeKey;
  let num = parseInt(cur.replace(/[^0-9]/g, '')) || 1;
  let next = 'tower' + (num + 1);
  if (!scene.textures.exists(next)) { alert('Max upgrade'); return; }
  if (gold < UPGRADE_COST) { alert('Need ' + UPGRADE_COST + ' gold to upgrade'); return; }
  gold -= UPGRADE_COST; ui.goldText.setText('Gold:' + gold);
  ts.setTexture(next); ts._typeKey = next; ts.level += 1; ts.hp += 100; ts._shootRate = Math.max(400, ts._shootRate - 100);
  ts._range = Math.min(300, ts._range + 30);
}

// ---------------- BULLETS ----------------
function updateBullet(b) {
  if (!b.active || !b.target || !b.target.active) { if (b.active) b.destroy(); return; }
  let dx = b.target.x - b.x, dy = b.target.y - b.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 8) {
    b.target.hp -= 20;
    if (b.target.hp <= 0) {
      try { b.target._animTimer.remove(); } catch(e){}
      b.target.destroy();
      gold += KILL_REWARD;
      ui.goldText.setText('Gold:' + gold);
    }
    b.destroy(); return;
  }
  b.x += (dx / dist) * b.speed;
  b.y += (dy / dist) * b.speed;
  b.rotation = Math.atan2(dy, dx);
}

// ---------------- TOWER SHOOT LOOP ----------------
setInterval(() => {
  if (isPaused) return;
  try {
    let sc = game.scene.scenes[0];
    if (!sc) return;
    for (let t of towers) {
      let ts = t.sprite;
      if (!ts || !ts.active) continue;
      ts._lastShot += 200;
      if (ts.upIcon && ts.upIcon.active) {
        const key = gold >= UPGRADE_COST ? 'up_icon' : 'noup_icon';
        if (ts.upIcon.texture.key !== key) ts.upIcon.setTexture(key);
      }
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
        b.speed = 10;
        bullets.add(b);
        ts._isAttacking = true;
        try { sc.sound.play('s_shoot'); } catch(e){}
        ts.setFlipX(ts.x > 360);
      } else {
        ts._isAttacking = false;
      }
    }
  } catch (e) { console.warn(e); }
}, 200);

// ---------------- PAUSE / RESTART ----------------
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

/* 
Кратко о правках:
- Важно: использую оригинальные ключи ассетов, поэтому графика не сломается.
- Враги идут по PATHS (каждый спавн — случайный путь), pathIndex++ логика сохранена.
- Задержка 1s между врагами и уменьшенный scale 0.5.
- Волны бесконечны — стартуют рекурсивно.
- Индикатор up/noup только визуален, улучшение — по клику на башню.
- Кнопки Пауза/Рестарт сохранены.
*/
