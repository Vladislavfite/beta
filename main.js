// Tower Defense — враги отражаются только по горизонтали, молот появляется после разрушения башни

// =====================
// 1. Константы и настройки игры
// =====================
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
const START_GOLD = 50000, KILL_REWARD = 10, WAVE_BONUS = 50, TOWER_COST = 100;
let UPGRADE_COST_BASE = 150;
const ENEMY_AGGRO = 150, TOWER_RANGE = 200;

// =====================
// 2. Глобальные переменные
// =====================
// единственная декларация towers — избегаем дублирования
let enemies, towers = [], bullets, buildSprites, ui;
let gold = START_GOLD;
let wave = 0;
let canWatchAd = true;
let isPaused = false;
let baseHp = 1000;

// =====================
// 3. Preload — загрузка ассетов
// =====================
function create_preload() {
  this.load.image('map', 'assets/map.png');
  this.load.image('molot', 'assets/elements/moloticon.png');
  this.load.image('up_icon', 'assets/elements/up.png');
  this.load.image('noup_icon', 'assets/elements/noup.png');

  for (let i = 1; i <= 12; i++) {
    for (let j = 1; j <= 4; j++) this.load.image(`tower${i}_idle_${j}`, `assets/attacktower/statik/tower${i}/stower${j}.png`);
    for (let j = 1; j <= 5; j++) this.load.image(`tower${i}_atk_${j-1}`, `assets/attacktower/attack/tower${i}/aatcktower${j}.png`);
  }
  for (let i = 0; i < 7; i++) {
    this.load.image('e_walk_' + i, `assets/enemy/walk/walk${i+1}.png`);
    this.load.image('e_atk_' + i, `assets/enemy/atack_enemy/atackenemy${i+1}.png`);
    this.load.image('e_die_' + i, `assets/enemy/die_enemy/dead${i+1}.png`);
  }
  try { this.load.audio('s_shoot', 'assets/sounds/shoot.mp3'); } catch(e){}
  try { this.load.audio('s_death', 'assets/sounds/death.mp3'); } catch(e){}
}

// =====================
// 4. Create — создание сцены
// =====================
function create() {
  this.add.image(360, 640, 'map').setDisplaySize(720, 1280);
  enemies = this.add.group();
  bullets = this.add.group();
  towers = []; // explicitly reset to array
  buildSprites = [];
  ui = {};

  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    const p = BUILD_SPOTS[i];
    const s = this.add.image(p[0], p[1], 'molot').setInteractive().setScale(0.6);
    s.setData('i', i);
    s.on('pointerdown', () => buildTower(this, i));
    buildSprites.push(s);
  }

  ui.goldText = this.add.text(12, 12, 'Gold:' + gold, { font: '22px Arial', fill: '#fff' }).setDepth(50);
  ui.waveText = this.add.text(12, 44, 'Wave:' + wave, { font: '18px Arial', fill: '#fff' }).setDepth(50);
  ui.baseBarBg = this.add.rectangle(360, 22, 320, 18, 0x222222).setOrigin(0.5, 0).setDepth(50);
  ui.baseBar = this.add.rectangle(360 - 160, 22, 320, 18, 0x00cc00).setOrigin(0,0).setDepth(51);
  ui.baseText = this.add.text(360, 6, 'BASE HP', { font: '14px Arial', fill: '#fff' }).setOrigin(0.5,0).setDepth(52);
  ui.pauseBtn = this.add.text(200, 1220, '⏸️ Пауза', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive().setDepth(50);
  ui.restartBtn = this.add.text(400, 1220, '🔁 Рестарт', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive().setDepth(50);
  ui.pauseBtn.on('pointerdown', () => togglePause(this));
  ui.restartBtn.on('pointerdown', () => restartGame(this));
  createAnimations(this);
  this.time.addEvent({ delay: 1000, callback: () => startNextWave(this) });
}

// =====================
// 5. Update — обновление сцены каждый кадр
// =====================
function update() {
  if (isPaused) return;
  enemies.getChildren().forEach(e => updateEnemy(e));
  bullets.getChildren().forEach(b => updateBullet(b));

  ui.baseBar.width = Math.max(0, 320 * (baseHp / 1000));
  ui.baseBar.fillColor = baseHp > 600 ? 0x00cc00 : (baseHp > 300 ? 0xcccc00 : 0xcc0000);

  // иконка апгрейда: используем ts._upgradeCost (стоимость следующего уровня)
  for (let tObj of towers) {
    const ts = tObj.sprite;
    if (!ts) continue;
    if (ts.upIcon) {
      // если башня не активна — спрятать иконку
      if (!ts.active || ts.level >= 12) {
        ts.upIcon.setVisible(false);
      } else {
        // next cost is stored in ts._upgradeCost
        const key = (gold >= (ts._upgradeCost || UPGRADE_COST_BASE)) ? 'up_icon' : 'noup_icon';
        if (ts.upIcon.texture.key !== key) ts.upIcon.setTexture(key);
        ts.upIcon.setVisible(true);
        ts.upIcon.x = ts.x - 28; ts.upIcon.y = ts.y + 40;
      }
    }
  }
}

// =====================
// 6. Анимации
// =====================
function createAnimations(scene) {
  for (let i = 1; i <= 12; i++) {
    const idleFrames = []; const atkFrames = [];
    for (let j = 1; j <= 4; j++) idleFrames.push({ key: `tower${i}_idle_${j}` });
    for (let j = 0; j < 5; j++) atkFrames.push({ key: `tower${i}_atk_${j}` });
    scene.anims.create({ key: `tower${i}_idle_anim`, frames: idleFrames, frameRate: 8, repeat: -1 });
    scene.anims.create({ key: `tower${i}_atk_anim`, frames: atkFrames, frameRate: 12, repeat: -1 });
  }
  const eWalk = [], eAtk = [], eDie = [];
  for (let i = 0; i < 7; i++) { eWalk.push({ key: `e_walk_${i}` }); eAtk.push({ key: `e_atk_${i}` }); eDie.push({ key: `e_die_${i}` }); }
  scene.anims.create({ key: 'e_walk_anim', frames: eWalk, frameRate: 8, repeat: -1 });
  scene.anims.create({ key: 'e_atk_anim', frames: eAtk, frameRate: 8, repeat: -1 });
  scene.anims.create({ key: 'e_die_anim', frames: eDie, frameRate: 10, repeat: 0 });
}

// =====================
// 7. Волны и спавн врагов
// =====================
function startNextWave(scene) {
  wave++; gold += WAVE_BONUS; ui.waveText.setText('Wave:' + wave); ui.goldText.setText('Gold:' + gold); canWatchAd = true;
  let count = 8 + Math.floor(wave * 1.5);
  for (let i = 0; i < count; i++) scene.time.addEvent({ delay: i * 1000, callback: () => spawnEnemy(scene) });
  scene.time.addEvent({ delay: (count + 6) * 1000, callback: () => startNextWave(scene) });
}

function spawnEnemy(scene) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)]; if (!path || path.length === 0) return;
  const spawn = path[0];
  let e = scene.physics.add.sprite(spawn[0], spawn[1], 'e_walk_0').setScale(0.35);
  e.maxHp = 100; e.hp = e.maxHp; e.speed = 0.2; e.path = path; e.pathIndex = 1; e.state = 'walk'; e._savedPathIndex = null; e._lastAttack = 0;
  e.play('e_walk_anim');
  e.on('animationcomplete-e_die_anim', () => { if (e.active) { try { scene.sound.play('s_death'); } catch(err){} e.destroy(); } });
  enemies.add(e);
}

// =====================
// 8. Логика врагов
// =====================
function updateEnemy(e) {
  if (!e || !e.active || e.state === 'die') return;

  if (e.targetTower && e.targetTower.active) {
    e.state = 'attack';
    moveTowards(e, e.targetTower.x, e.targetTower.y, e.speed);
    // горизонтальное отражение при атаке
    e.setFlipX(e.targetTower.x < e.x);

    let d = Phaser.Math.Distance.Between(e.x, e.y, e.targetTower.x, e.targetTower.y);
    if (d < 26 && (!e._lastAttack || Date.now() - e._lastAttack > 800)) {
      e._lastAttack = Date.now();
      if (e.targetTower.hp != null) {
        e.targetTower.hp -= 10;
        try {
          // защищаемся от возможного удаления цели внутри таймаута
          const tgt = e.targetTower;
          if (tgt && tgt.setTint) tgt.setTint(0xff9999);
setTimeout(()=>{
  if (tgt && tgt.active && typeof tgt.clearTint === 'function') tgt.clearTint();
}, 80);
        } catch(err){}
        if (e.targetTower.hp <= 0) {
          // когда башня уничтожена — вернуть молот на первое пустое место
          let idx = buildSprites.findIndex(s=>s==null);
          if (idx >= 0) {
            const p = BUILD_SPOTS[idx];
            buildSprites[idx] = e.scene.add.image(p[0], p[1], 'molot').setInteractive().setScale(0.6).on('pointerdown', ()=>buildTower(e.scene, idx));
          }
          // если у башни была иконка — удалить её перед уничтожением
          try {
            const deadTs = e.targetTower;
            if (deadTs && deadTs.upIcon && deadTs.upIcon.destroy) deadTs.upIcon.destroy();
          } catch(err){}
          // удаляем спрайт башни
          try { e.targetTower.destroy(); } catch(err){}
          // отфильтруем массив towers — оставим только активные
          towers = towers.filter(tObj => tObj && tObj.sprite && tObj.sprite.active);
          e.targetTower = null;
          e.state = 'returning';
          if (e._savedPathIndex != null) e.pathIndex = e._savedPathIndex;
        }
      } else { e.targetTower = null; e.state = 'returning'; }
    }
    if (e.anims && e.anims.currentAnim && e.anims.currentAnim.key !== 'e_atk_anim') e.play('e_atk_anim');
    return;
  }

  // проверка агро на ближайшую башню
  let nearest = null, nd = 1e9;
  for (let tObj of towers) {
    const ts = tObj.sprite;
    if (!ts || !ts.active) continue;
    const d = Phaser.Math.Distance.Between(e.x, e.y, ts.x, ts.y);
    if (d < ENEMY_AGGRO && d < nd) { nd = d; nearest = ts; }
  }
  if (nearest) { e.targetTower = nearest; e._savedPathIndex = e.pathIndex; if (e.anims && e.anims.currentAnim && e.anims.currentAnim.key !== 'e_atk_anim') e.play('e_atk_anim'); return; }

  // движение по пути
  if (e.state === 'returning') {
    const target = e.path[e.pathIndex] || e.path[e.path.length - 1];
    moveTowards(e, target[0], target[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, target[0], target[1]) < 8) {
      e.state = 'walk';
      if (e.anims && (!e.anims.currentAnim || e.anims.currentAnim.key !== 'e_walk_anim')) e.play('e_walk_anim');
    }
    return;
  }
  if (e.pathIndex >= e.path.length) {
    e.state = 'attack';
    if (!e._lastAttack || Date.now() - e._lastAttack > 800) {
      e._lastAttack = Date.now();
      baseHp -= 10;
      ui.baseText.setText(`BASE HP ${Math.max(0, baseHp)}`);
      if (baseHp <= 0) { baseHp = 0; alert('База уничтожена!'); restartGame(e.scene); }
    }
    if (e.anims && e.anims.currentAnim && e.anims.currentAnim.key !== 'e_atk_anim') e.play('e_atk_anim');
    return;
  }

  e.state = 'walk';
  const wp = e.path[e.pathIndex];
  if (wp) {
    moveTowards(e, wp[0], wp[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, wp[0], wp[1]) < 6) e.pathIndex++;
  }
  // горизонтальное отражение: смотрим только по X
  if (wp) e.setFlipX(wp[0] < e.x);
  if (e.anims && (!e.anims.currentAnim || e.anims.currentAnim.key !== 'e_walk_anim')) e.play('e_walk_anim');
}

// =====================
// 9. Движение объектов
// =====================
function moveTowards(obj, tx, ty, speed) {
  let dx = tx - obj.x, dy = ty - obj.y, dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 0.1) return;
  obj.x += (dx / dist) * speed * 2;
  obj.y += (dy / dist) * speed * 2;
}

// 10. Башни — строительство и улучшение
// =====================
function buildTower(scene, index) {
  if (!scene || !scene.add) {
    console.error("Ошибка: scene не определена при вызове buildTower()");
    return;
  }

  if (index < 0 || index >= BUILD_SPOTS.length) return;
  if (!buildSprites[index]) return;

  if (gold < TOWER_COST) {
    alert("Not enough gold");
    return;
  }

  const pos = BUILD_SPOTS[index];
  // убираем молот
  buildSprites[index].destroy();
  buildSprites[index] = null;

  gold -= TOWER_COST;
  ui.goldText.setText("Gold:" + gold);

  const ts = scene.add.sprite(pos[0], pos[1], `tower1_idle_1`).setInteractive();
  ts.setDepth(5);
  ts.hp = 50;
  ts.level = 1;
  ts._typeKey = "tower1";
  ts._isAttacking = false;
  ts._lastShot = 0;
  ts._shootRate = 450;
  ts._range = TOWER_RANGE;
  ts._damage = 10 * ts.level;
  ts._upgradeCost = UPGRADE_COST_BASE * (ts.level + 1);

  // индикатор улучшения
  if (scene.textures.exists("up_icon") && scene.textures.exists("noup_icon")) {
    ts.upIcon = scene.add
      .image(pos[0] - 28, pos[1] + 40, "noup_icon")
      .setScale(0.6)
      .setDepth(6)
      .setVisible(true);
  }

  const idleAnimKey = `${ts._typeKey}_idle_anim`;
  if (scene.anims.exists(idleAnimKey)) ts.play(idleAnimKey);

  const upgradeHandler = () => upgradeTower(scene, ts);
  ts.on("pointerdown", upgradeHandler);

  towers.push({ sprite: ts, upgradeHandler });
  ts.setFlipX(ts.x > 360);

  // если башню уничтожили — вернуть молоток
  ts.on("destroy", () => {
    createHammerAt(scene, pos, index);
  });
}

// создание молотка (иконки строительства)
function createHammerAt(scene, pos, index) {
  if (!scene || !scene.add) {
    console.error("Ошибка: scene не определена при создании молотка");
    return;
  }

  // защита от дублей
  if (buildSprites[index]) {
    buildSprites[index].destroy();
    buildSprites[index] = null;
  }

  // проверяем, загружена ли текстура
  if (!scene.textures.exists("moloticon")) {
    console.error("Текстура moloticon не найдена! Убедись, что загружена в preload().");
    return;
  }

  // создаём иконку молотка
  const hammer = scene.add.image(pos[0], pos[1], "moloticon").setInteractive();
  hammer.setScale(0.8);
  hammer.setDepth(4);
  buildSprites[index] = hammer;

  hammer.on("pointerdown", () => {
    buildTower(scene, index);
  });
}

// улучшение башни
function upgradeTower(scene, ts) {
  if (!ts || !ts._typeKey) return;

  const cost = Math.floor(ts._upgradeCost || (UPGRADE_COST_BASE * (ts.level + 1)));
  if (ts.level >= 12) return;

  if (gold < cost) {
    alert("Need " + cost + " gold");
    return;
  }

  gold -= cost;
  ui.goldText.setText("Gold:" + gold);

  const nextLevel = ts.level + 1;
  ts._typeKey = "tower" + nextLevel;
  ts.level = nextLevel;
  ts._range = Math.min(300, ts._range + 30);
  ts._shootRate = Math.max(200, ts._shootRate - 100);
  ts._damage = 10 * ts.level;
  ts.hp += 50;
  ts._upgradeCost = UPGRADE_COST_BASE * (ts.level + 1);

  const idleAnim = `${ts._typeKey}_idle_anim`;
  if (scene.anims.exists(idleAnim)) ts.play(idleAnim);

  if (nextLevel >= 12) {
    if (ts.upIcon) ts.upIcon.setVisible(false);
    ts.removeAllListeners("pointerdown");
  }
}
// =====================
// 11. Пули
// =====================
function updateBullet(b) {
  if (!b.active) return;
  if (!b.target || !b.target.active || b.target.state === 'die') { try { b.destroy(); } catch(e){} return; }
  const dx = b.target.x - b.x, dy = b.target.y - b.y, dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 8) {
    b.target.hp -= b.damage;
    try {
      const tgt = b.target;
      if (tgt && tgt.setTint) tgt.setTint(0xffcccc);
setTimeout(()=>{
  if (tgt && tgt.active && typeof tgt.clearTint === 'function') tgt.clearTint();
}, 60);
    } catch(err){}
    if (b.target.hp <= 0 && b.target.state !== 'die') {
      b.target.state = 'die'; b.target.play && b.target.play('e_die_anim');
      gold += KILL_REWARD; ui.goldText.setText('Gold:' + gold);
    }
    try { b.destroy(); } catch(e) {}
    return;
  }
  b.x += (dx / dist) * b.speed; b.y += (dy / dist) * b.speed;
}

// =====================
// 12. Логика стрельбы башен (интервал)
// =====================
// используем один setInterval — он оперирует массивом towers (всегда массив)
setInterval(()=> {
  if (isPaused) return;
  try {
    let sc = game.scene.scenes[0]; if (!sc) return;
    // проходим по копии массива (чтобы безопаснее фильтровать внутри)
    for (let tObj of Array.from(towers)) {
      let ts = tObj.sprite; if (!ts || !ts.active) continue;
      ts._lastShot += 200;

      // обновление иконки — один элемент, два состояния
      if (ts.upIcon) {
        if (!ts.active || ts.level >= 12) {
          ts.upIcon.setVisible(false);
        } else {
          const nextCost = Math.floor(ts._upgradeCost || (UPGRADE_COST_BASE * (ts.level + 1)));
          const key = gold >= nextCost ? 'up_icon' : 'noup_icon';
          if (ts.upIcon.texture.key !== key) ts.upIcon.setTexture(key);
          ts.upIcon.setVisible(true);
          ts.upIcon.x = ts.x - 28; ts.upIcon.y = ts.y + 40;
        }
      }

      if (ts._lastShot < ts._shootRate) {
        const idleKey = `${ts._typeKey}_idle_anim`;
        if (sc.anims.exists(idleKey) && (!ts.anims.currentAnim || ts.anims.currentAnim.key.indexOf('_idle_anim') === -1)) {
          if (sc.anims.exists(idleKey)) ts.play(idleKey, true);
        }
        ts._isAttacking = false; continue;
      }

      ts._lastShot = 0;
      let target = null, dmin = 1e9;
      enemies.getChildren().forEach(e => {
        if (!e.active || e.state === 'die') return;
        const d = Phaser.Math.Distance.Between(ts.x, ts.y, e.x, e.y);
        if (d < ts._range && d < dmin) { dmin = d; target = e; }
      });

      if (target) {
        let b = sc.add.circle(ts.x, ts.y, 6, 0xffdd00);
        sc.physics.add.existing(b);
        b.target = target; b.speed = 10; b.damage = ts._damage || (10 * ts.level);
        bullets.add(b);
        ts._isAttacking = true;
        const atkKey = `${ts._typeKey}_atk_anim`;
        if (sc.anims.exists(atkKey) && (!ts.anims.currentAnim || ts.anims.currentAnim.key !== atkKey)) ts.play(atkKey, true);
        try { sc.sound.play('s_shoot'); } catch(e){}
        ts.setFlipX(ts.x > 360);
      } else {
        ts._isAttacking = false;
        const idleKey = `${ts._typeKey}_idle_anim`;
        if (sc.anims.exists(idleKey) && (!ts.anims.currentAnim || ts.anims.currentAnim.key !== idleKey)) ts.play(idleKey, true);
      }
    }
  } catch(err) { console.warn(err); }
}, 200);

// =====================
// 13. Пауза и рестарт
// =====================
function togglePause(scene){ isPaused = !isPaused; ui.pauseBtn && ui.pauseBtn.setText(isPaused ? '▶️ Продолжить' : '⏸️ Пауза'); }
function restartGame(scene){
  // аккуратно удаляем все динамические объекты и массивы
  try {
    enemies && enemies.clear(true, true);
    bullets && bullets.clear(true, true);
    for (let tObj of towers) {
      try { if (tObj.sprite && tObj.sprite.upIcon) tObj.sprite.upIcon.destroy(); } catch(e){}
      try { if (tObj.sprite) tObj.sprite.destroy(); } catch(e){}
    }
  } catch(e){ console.warn(e); }
  towers = [];
  enemies = null; bullets = null;
  buildSprites = [];
  gold = START_GOLD; wave = 0; baseHp = 1000; isPaused = false;
  try { scene.scene.restart(); } catch(e){ window.location.reload(); }
}

// =====================
// 14. Конфиг Phaser и запуск игры
// =====================
const config2 = { type: Phaser.AUTO, parent: 'game', width: 720, height: 1280, scene:{ preload:create_preload, create:create, update:update }, physics:{ default:'arcade' } };
const game = new Phaser.Game(config2);
