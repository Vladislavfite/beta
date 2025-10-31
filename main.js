// === main.js — Tower Defense core (updated) ===
// Подставь вместо старого main.js — использует Phaser 3, same asset keys as before.

// ----------------- Config / constants -----------------
const BUILD_SPOTS = [[484,95],[359,155],[435,235],[373,288],[218,310],[113,394],[316,417],[444,432],[589,550],[484,527],[351,539],[286,631],[162,630],[127,728],[416,706],[285,781],[430,822],[301,867],[275,1016],[355,1015],[511,992],[581,946],[667,1016],[532,1083],[458,1127],[329,1149],[174,1116]];

// Явно описанные пути (каждый путь — массив точек). Взял координаты которые ты прислал,
// каждый блок начинается с точки спавна (он же первая точка пути).
const PATHS = [
  // path A (спавн 1)
  [
    [377,50],
    [429,138],[410,189],[346,224],[311,257],[290,305],[331,354],[400,463],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]
  ],
  // path B (спавн 2)
  [
    [81,335],
    [189,359],[331,354],[400,463],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]
  ],
  // path C (спавн 3)
  [
    [636,490],
    [544,498],[413,491],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]
  ],
  // path D (спавн 4)
  [
    [52,667],
    [168,691],[289,700],[347,736],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]
  ],
  // path E (спавн 5)
  [
    [646,963],
    [565,1029],[441,1069],[312,1082],[226,1059]
  ]
];

const BASE_POS = { x:160, y:1005 };
const BASE_RECT = { w:153, h:93 }; // область базы для попадания

// Economy / gameplay
const START_GOLD = 500, KILL_REWARD = 10, WAVE_BONUS = 50, TOWER_COST = 100;
const UPGRADE_COST = 150;

// Ranges / speeds
const DEFAULT_ENEMY_SPEED = 0.35; // базовая скорость — уменьшил (медленнее)
const ENEMY_AGGRO = 140; // радиус обнаружения башни (агро)
const TOWER_RANGE = 200;
const ENEMY_ATTACK_DAMAGE = 10; // урон по башне или базе
const ENEMY_ATTACK_COOLDOWN = 600; // мс между ударами врага

// ----------------- Preload (тот же, но небольшие проверки) -----------------
function create_preload() {
  // карта, иконки и др.
  this.load.image('map', 'assets/map.png');
  this.load.image('mappath', 'assets/mappath.png');
  this.load.image('molot', 'assets/elements/moloticon.png');
  this.load.image('up_icon', 'assets/elements/up.png');
  this.load.image('noup_icon', 'assets/elements/noup.png');

  // tower statics + attack frames (12 towers x up to 5 frames)
  for (let i = 1; i <= 12; i++) {
    const statPath = 'assets/attacktower/statik/tower' + i + '/stower1.png';
    this.load.image('tower' + i, statPath);
    for (let j = 0; j < 5; j++) {
      const atkPath = 'assets/attacktower/attack/tower' + i + '/aatcktower' + (j+1) + '.png';
      this.load.image('tower' + i + '_atk_' + j, atkPath);
    }
  }

  // enemy frames (walk / attack / die) — up to 7 each
  for (let i = 0; i < 7; i++) {
    this.load.image('e_walk_' + i, 'assets/enemy/walk/walk' + (i+1) + '.png');
    this.load.image('e_atk_' + i, 'assets/enemy/atack_enemy/atackenemy' + (i+1) + '.png');
    this.load.image('e_die_' + i, 'assets/enemy/die_enemy/dead' + (i+1) + '.png');
  }

  // optional sounds
  try { this.load.audio('s_shoot', 'assets/sounds/shoot.mp3'); } catch(e) {}
  try { this.load.audio('s_death', 'assets/sounds/death.mp3'); } catch(e) {}

  // debug callbacks for load
  this.load.on('filecomplete', key => console.log('✅ Loaded:', key));
  this.load.on('loaderror', file => console.error('❌ Error loading:', file && file.src ? file.src : file));
}

// ----------------- Globals -----------------
let enemies, towers, bullets, buildSprites, ui;
let gold = START_GOLD;
let wave = 0;
let canWatchAd = true;

// ----------------- Create scene -----------------
function create() {
  // draw main map first
  const mapImg = this.add.image(360, 640, 'map').setDisplaySize(720, 1280);

  enemies = this.add.group();
  bullets = this.add.group();
  towers = [];
  buildSprites = [];
  ui = {};

  // create build spots (кнопки молота)
  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    const p = BUILD_SPOTS[i];
    if (this.textures.exists('molot')) {
      const s = this.add.image(p[0], p[1], 'molot').setInteractive();
      s.setScale(0.6);
      s.setData('i', i);
      s.on('pointerdown', () => buildTower(this, i));
      buildSprites.push(s);
    } else {
      buildSprites.push(null);
    }
  }

  // UI
  ui.goldText = this.add.text(12, 12, 'Gold:' + gold, { font: '22px Arial', fill: '#fff' }).setDepth(50);
  ui.waveText = this.add.text(12, 44, 'Wave:' + wave, { font: '18px Arial', fill: '#fff' }).setDepth(50);
  ui.adBtn = this.add.text(540, 12, 'Watch Ad', { font: '16px Arial', fill: '#0f0', backgroundColor: '#222' }).setInteractive().setDepth(50);
  ui.adBtn.on('pointerdown', () => tryWatchAd(this));

  // Для отладки можно показывать зону базы:
  // this.add.rectangle(BASE_POS.x, BASE_POS.y, BASE_RECT.w, BASE_RECT.h, 0x0000ff, 0.15).setOrigin(0.5);

  // запускаем волны
  this.time.addEvent({ delay: 800, callback: () => startNextWave(this) });
}

// ----------------- Update loop -----------------
function update() {
  try {
    enemies.getChildren().forEach(e => updateEnemy(e));
    bullets.getChildren().forEach(b => updateBullet(b));
    // обновление индикаторов апгрейда над башнями
    for (let t of towers) {
      updateTowerUI(t);
    }
  } catch (err) {
    console.error('Update error:', err);
  }
}

// ----------------- Waves / spawn -----------------
function startNextWave(scene) {
  wave++;
  gold += WAVE_BONUS;
  ui.waveText.setText('Wave:' + wave);
  ui.goldText.setText('Gold:' + gold);
  canWatchAd = true;
  let count = 8 + Math.floor(wave * 1.5);
  for (let i = 0; i < count; i++) {
    // рандомим задержку спавна, чтобы не было ровной пачки
    const delay = i * 350 + Math.floor(Math.random() * 300);
    scene.time.addEvent({ delay: delay, callback: () => spawnEnemy(scene) });
  }
}

// Spawn enemy: выбираем случайный путь из PATHS
function spawnEnemy(scene) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  if (!path || path.length < 1) return;
  const spawn = path[0]; // стартовая точка
  let e = scene.physics.add.sprite(spawn[0], spawn[1], 'e_walk_0');
  e.maxHp = 10 + Math.floor(wave * 1.2);
  e.hp = e.maxHp;
  // скорость небольшая + рандомная вариация
  e.speed = DEFAULT_ENEMY_SPEED * (0.9 + Math.random() * 0.3);
  e.path = path;      // массив точек
  e.pathIndex = 1;    // следующая точка на пути
  e.targetTower = null;
  e._lastAttack = 0;
  e.state = 'walk';   // states: walk, attack, returning, dead
  enemies.add(e);

  // anim timers: переключение кадров для ходьбы и для атаки
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

// ----------------- Enemy update logic -----------------
function updateEnemy(e) {
  if (!e || !e.active) return;

  // если мёртв — ничего не делаем
  if (e.state === 'dead') return;

  const scene = e.scene;

  // 1) если есть цель-Башня и она активна => идти к ней и атаковать
  if (e.targetTower && e.targetTower.active) {
    e.state = 'attack';
    moveTowards(e, e.targetTower.x, e.targetTower.y, e.speed);
    // flip по направлению
    e.setFlipX(e.targetTower.x < e.x);
    let d = Phaser.Math.Distance.Between(e.x, e.y, e.targetTower.x, e.targetTower.y);
    if (d < 24) {
      // атака с кулдауном
      if (!e._lastAttack || Date.now() - e._lastAttack > ENEMY_ATTACK_COOLDOWN) {
        e._lastAttack = Date.now();
        // наносим урон башне
        if (e.targetTower.hp != null) {
          e.targetTower.hp -= ENEMY_ATTACK_DAMAGE;
          // небольшая визуальная "встряска" или эффект можно добавить
          if (e.targetTower.hp <= 0) {
            // башня уничтожена
            e.targetTower.destroy();
            towers = towers.filter(t => t.sprite && t.sprite.active);
            e.targetTower = null;
            // вернуть к траектории
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

  // 2) если нет цели: попытаться найти башню в радиусе агро
  let nearest = null, nd = 1e9;
  for (let t of towers) {
    if (!t.sprite || !t.sprite.active) continue;
    let d = Phaser.Math.Distance.Between(e.x, e.y, t.sprite.x, t.sprite.y);
    if (d < ENEMY_AGGRO && d < nd) { nd = d; nearest = t.sprite; }
  }
  if (nearest) {
    // сохраним где мы были (pathIndex) и атакуем
    e.targetTower = nearest;
    e._savedPathIndex = e.pathIndex;
    return;
  }

  // 3) если возвращаемся после атаки — возвращаемся к saved path point
  if (e.state === 'returning') {
    // цель — следующая точка пути
    const target = e.path[e.pathIndex] || e.path[e.path.length - 1];
    moveTowards(e, target[0], target[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, target[0], target[1]) < 8) {
      e.state = 'walk';
    }
    return;
  }

  // 4) иначе — следуем по пути к базе
  e.state = 'walk';
  if (e.pathIndex >= e.path.length) {
    // дошли до конца пути — идём к базе центр
    moveTowards(e, BASE_POS.x, BASE_POS.y, e.speed);
    // flip
    e.setFlipX(BASE_POS.x < e.x);
    // если в зоне базы — атакуем базу
    let dbx = Math.abs(e.x - BASE_POS.x), dby = Math.abs(e.y - BASE_POS.y);
    if (dbx < BASE_RECT.w/2 && dby < BASE_RECT.h/2) {
      // атака базы
      if (!e._lastAttack || Date.now() - e._lastAttack > ENEMY_ATTACK_COOLDOWN) {
        e._lastAttack = Date.now();
        gold = Math.max(0, gold - ENEMY_ATTACK_DAMAGE);
        ui.goldText.setText('Gold:' + gold);
        // проигрываем анимацию атаки (уже handled via state)
      }
    }
    return;
  }

  // движение по очередной точке пути
  const waypoint = e.path[e.pathIndex];
  if (waypoint) {
    moveTowards(e, waypoint[0], waypoint[1], e.speed);
    // если близко к точке — переключаемся на следующую
    if (Phaser.Math.Distance.Between(e.x, e.y, waypoint[0], waypoint[1]) < 6) {
      e.pathIndex++;
    }
  }
}

// ----------------- Movement helper -----------------
function moveTowards(obj, tx, ty, speed) {
  let dx = tx - obj.x, dy = ty - obj.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.1) return;
  // множитель 2 — чтобы скорость ощущалась адекватно (подстрой)
  obj.x += (dx / dist) * speed * 2;
  obj.y += (dy / dist) * speed * 2;
  // flip handled outside where нужно
}

// ----------------- Build / towers -----------------
function buildTower(scene, index) {
  if (index < 0 || index >= BUILD_SPOTS.length) return;
  if (!buildSprites[index]) return;
  if (gold < TOWER_COST) {
    // вместо alert — делаем быстрый индикатор (или можно alert)
    // но чтобы соблюсти твой предыдущий UI — оставлю alert
    alert('Not enough gold');
    return;
  }
  let pos = BUILD_SPOTS[index];
  buildSprites[index].destroy(); buildSprites[index] = null;
  gold -= TOWER_COST; ui.goldText.setText('Gold:' + gold);

  // создаём спрайт башни (type tower1 по умолчанию)
  let ts = scene.add.sprite(pos[0], pos[1], 'tower1');
  ts.hp = 200; ts.level = 1; ts._shootRate = 900; ts._range = TOWER_RANGE; ts._lastShot = 0; ts._typeKey = 'tower1';
  ts._atkFrame = 0; ts._isAttacking = false;

  // иконка up/noup — слева вверху башни (появится если есть ассет)
  if (scene.textures.exists('up_icon') && scene.textures.exists('noup_icon')) {
    ts.upIndicator = scene.add.image(pos[0] - 22, pos[1] - 28, 'noup_icon').setScale(0.6).setDepth(40).setScrollFactor(0);
    ts.upIndicator.setInteractive();
    ts.upIndicator.on('pointerdown', () => upgradeTower(scene, ts));
  }

  // orientation: если башня справа от центра (360) — отражаем
  ts.setFlipX(ts.x > 360);

  // добавим метаданные и помещаем в towers array
  towers.push({ sprite: ts, spriteRef: ts });

  // таймер анимации атаки для башни (если есть кадры attack)
  ts._animTimer = scene.time.addEvent({
    delay: 90,
    loop: true,
    callback: () => {
      if (!ts.active) return;
      if (ts._isAttacking) {
        let baseKey = ts._typeKey || 'tower1';
        ts._atkFrame = (ts._atkFrame + 1) % 5;
        const key = baseKey + '_atk_' + ts._atkFrame;
        if (scene.textures.exists(key)) ts.setTexture(key);
      } else {
        // статик
        if (scene.textures.exists(ts._typeKey)) ts.setTexture(ts._typeKey);
      }
    }
  });
}

// upgrade tower
function upgradeTower(scene, ts) {
  if (!ts || !ts._typeKey) return;
  let cur = ts._typeKey;
  let num = parseInt(cur.replace(/[^0-9]/g, '')) || 1;
  let next = 'tower' + (num + 1);
  if (!scene.textures.exists(next)) { alert('Max upgrade'); return; }
  if (gold < UPGRADE_COST) {
    alert('Need ' + UPGRADE_COST + ' gold to upgrade');
    return;
  }
  gold -= UPGRADE_COST; ui.goldText.setText('Gold:' + gold);
  ts.setTexture(next); ts._typeKey = next; ts.level += 1; ts.hp += 100; ts._shootRate = Math.max(400, ts._shootRate - 100);
  ts._range = Math.min(300, ts._range + 30);
}

// ----------------- Bullet logic -----------------
function updateBullet(b) {
  if (!b.active || !b.target || !b.target.active) { if (b.active) b.destroy(); return; }
  let dx = b.target.x - b.x, dy = b.target.y - b.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 8) {
    // попадание
    b.target.hp -= 20;
    if (b.target.hp <= 0) {
      // убит враг
      // проигрывать анимацию смерти можно тут
      // просто удалим
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

// ----------------- Tower firing loop -----------------
// В прошлой версии ты использовал setInterval. Оставил похожую логику, но чуть аккуратнее:
// В этом блоке мы каждые 200ms пробегаем по башням и выбираем цель — ближайший враг в range.
// Если цель есть — создаём bullet (круг) и отмечаем башню как атакующую (чтобы включить анимацию).
setInterval(() => {
  try {
    let sc = game.scene.scenes[0];
    if (!sc) return;
    for (let t of towers) {
      let ts = t.sprite;
      if (!ts || !ts.active) continue;
      // накапливаем время (fake) — используем _lastShot как счетчик в миллисекундах
      ts._lastShot += 200;
      if (ts._lastShot < ts._shootRate) {
        // если нет выстрела — снять флаг атаки (плавно)
        ts._isAttacking = false;
        continue;
      }
      ts._lastShot = 0;
      // поиск цели — ближайший враг в радиусе
      let target = null, dmin = 1e9;
      enemies.getChildren().forEach(e => {
        if (!e.active) return;
        let d = Phaser.Math.Distance.Between(ts.x, ts.y, e.x, e.y);
        if (d < ts._range && d < dmin) { dmin = d; target = e; }
      });
      if (target) {
        // добавить простую пулю (circle)
        let b = sc.add.circle(ts.x, ts.y, 6, 0xffdd00);
        sc.physics.add.existing(b);
        b.body.setAllowGravity(false);
        b.target = target;
        b.speed = 10; // скорость пули
        bullets.add(b);
        ts._isAttacking = true;
        // play shoot sound optionally
        try { sc.sound.play('s_shoot'); } catch(e){}

        // пометка: если башня слева/справа — ориентируем спрайт
        ts.setFlipX(ts.x > 360);
      } else {
        ts._isAttacking = false;
      }
    }
  } catch (e) { console.warn(e); }
}, 200);

// ----------------- Tower UI update (up/noup) -----------------
function updateTowerUI(t) {
  if (!t || !t.sprite) return;
  const ts = t.sprite;
  // Если есть индикатор — обновляем картинку в зависимости от денег
  if (ts.upIndicator && ts.upIndicator.active) {
    if (gold >= UPGRADE_COST) {
      if (ts.upIndicator.texture.key !== 'up_icon') ts.upIndicator.setTexture('up_icon');
    } else {
      if (ts.upIndicator.texture.key !== 'noup_icon') ts.upIndicator.setTexture('noup_icon');
    }
    // держим индикатор в левой верхней части башни даже если она двигается
    ts.upIndicator.x = ts.x - 22;
    ts.upIndicator.y = ts.y - 28;
    // также невидим, если башня не активна
    ts.upIndicator.setVisible(ts.active);
  }
}

// ----------------- Watch ad (same logic) -----------------
function tryWatchAd(scene) {
  if (!canWatchAd) return;
  if (wave % 3 !== 0) { alert('Ad available every 3 waves'); return; }
  canWatchAd = false;
  alert('Simulated ad playing...');
  setTimeout(() => {
    gold += 100;
    ui.goldText.setText('Gold:' + gold);
    alert('Ad finished: +100 gold');
  }, 1000);
}

// ----------------- Phaser config and start -----------------
const config2 = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  scene: { preload: create_preload, create: create, update: update },
  physics: { default: 'arcade' }
};
const game = new Phaser.Game(config2);

// ----------------- Comments и объяснения (коротко) -----------------
/*
ВАЖНОЕ:
- PATHS: массив путей — каждый враг получает свой path при спавне (рандомный выбор).
  Враги идут по точкам path[pathIndex], когда точка достигнута -> pathIndex++.
  Если закончил путь — идут к BASE_POS и атакуют область базы (BASE_RECT).

- Агро врага: враг постоянно сканирует ближайшие башни. Если одна попала в ENEMY_AGGRO,
  враг запоминает её как targetTower, идёт к ней и атакует. После уничтожения/потери цели
  враг переходит в состояние 'returning' и возвращается к маршруту.

- Анимации: враг имеет 2 состояния анимации: walk и attack. Для башен — статичная текстура и
  набор кадрoв атаки (towerX_atk_Y). Переключение кадров выполняется internal timers.

- Скорость: DEFAULT_ENEMY_SPEED можно менять, сейчас уменьшена (медленнее).
  Если хочешь ещё медленнее — снижай DEFAULT_ENEMY_SPEED до 0.2 или 0.15.

- Up/Noup индикатор: иконка над башней меняется динамически и кликабельна.
  Если денег нет — показывает 'noup' и при нажатии ничего не происходит (можно заменить на эффект).

- Ориентация башни: ts.setFlipX(ts.x > 360) — если правее центра — отражаем по горизонтали.

- Пули: временно круги, летят к цели и наносят фиксированный дамаг.
  Заменим на полноценный спрайт, когда будешь готов.

Если хочешь — могу:
- Добавить поведение "если башня внутри пути (на дороге), враг блокируется" (сейчас враг идёт прямо к объекту),
- Сделать ленивую подгрузку текстур или оптимизацию большого количества врагов,
- Или вынести всё в отдельные модули (enemy.js, tower.js) чтобы код стал чище.
*/

