// === main.js ===
// Tower Defense — fixed tower idle/attack animations, enemy aggro, scaling damage, faster fire-rate,
// enemy death animation, base HP bar, towers hp and dying from enemy hits.
// Assumes Phaser 3 and the same assets layout you've been using.

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
let UPGRADE_COST_BASE = 150;
const ENEMY_AGGRO = 150, TOWER_RANGE = 200;

let enemies, towers, bullets, buildSprites, ui;
let gold = START_GOLD;
let wave = 0;
let canWatchAd = true;
let isPaused = false;

// Phaser scene functions
function create_preload() {
  // map + UI
  this.load.image('map', 'assets/map.png');
  this.load.image('molot', 'assets/elements/moloticon.png');
  this.load.image('up_icon', 'assets/elements/up.png');
  this.load.image('noup_icon', 'assets/elements/noup.png');

  // tower idle (stower1..4) and attack (aatcktower1..5)
  for (let i = 1; i <= 12; i++) {
    for (let j = 1; j <= 4; j++) {
      this.load.image(`tower${i}_idle_${j}`, `assets/attacktower/statik/tower${i}/stower${j}.png`);
    }
    for (let j = 1; j <= 5; j++) {
      this.load.image(`tower${i}_atk_${j-1}`, `assets/attacktower/attack/tower${i}/aatcktower${j}.png`);
    }
  }

  // enemies: walk, attack, die
  for (let i = 0; i < 7; i++) {
    this.load.image('e_walk_' + i, `assets/enemy/walk/walk${i+1}.png`);
    this.load.image('e_atk_' + i, `assets/enemy/atack_enemy/atackenemy${i+1}.png`);
    this.load.image('e_die_' + i, `assets/enemy/die_enemy/dead${i+1}.png`);
  }

  try { this.load.audio('s_shoot', 'assets/sounds/shoot.mp3'); } catch(e){}
  try { this.load.audio('s_death', 'assets/sounds/death.mp3'); } catch(e){}

  // small logger
  this.load.on('filecomplete', key => console.log('Loaded:', key));
  this.load.on('loaderror', f => console.warn('Load err', f && f.src));
}

function create() {
  // map
  this.add.image(360, 640, 'map').setDisplaySize(720, 1280);

  // groups
  enemies = this.add.group();
  bullets = this.add.group();
  towers = [];
  buildSprites = [];
  ui = {};

  // create build spots icons
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
  ui.baseBarBg = this.add.rectangle(360, 22, 320, 18, 0x222222).setOrigin(0.5, 0).setDepth(50);
  ui.baseBar = this.add.rectangle(360 - 160, 22, 320, 18, 0x00cc00).setOrigin(0,0).setDepth(51);
  ui.baseText = this.add.text(360, 6, 'BASE HP', { font: '14px Arial', fill: '#fff' }).setOrigin(0.5,0).setDepth(52);

  ui.pauseBtn = this.add.text(200, 1220, '⏸️ Пауза', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive().setDepth(50);
  ui.restartBtn = this.add.text(400, 1220, '🔁 Рестарт', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive().setDepth(50);

  ui.pauseBtn.on('pointerdown', () => togglePause(this));
  ui.restartBtn.on('pointerdown', () => restartGame(this));

  // create Phaser animations for towers and enemies to avoid texture flicker
  createAnimations(this);

  // start wave loop
  this.time.addEvent({ delay: 1000, callback: () => startNextWave(this) });
}

function update() {
  if (isPaused) return;

  // update enemy logic
  enemies.getChildren().forEach(e => updateEnemy(e));

  // update bullets
  bullets.getChildren().forEach(b => updateBullet(b));

  // update UI base bar (baseHp global)
  ui.baseBar.width = Math.max(0, 320 * (baseHp / 1000));
  ui.baseBar.fillColor = baseHp > 600 ? 0x00cc00 : (baseHp > 300 ? 0xcccc00 : 0xcc0000);

  // update up/noup indicators over towers (if exist)
  for (let t of towers) {
    const ts = t.sprite;
    if (ts && ts.upIcon) {
      const key = (t.level >= 12) ? null : (gold >= UPGRADE_COST_BASE * (t.level + 0) ? 'up_icon' : 'noup_icon');
      if (key) {
        if (ts.upIcon.texture.key !== key) ts.upIcon.setTexture(key);
        ts.upIcon.setVisible(true);
      } else {
        ts.upIcon.setVisible(false);
      }
      ts.upIcon.x = ts.x - 28; ts.upIcon.y = ts.y + 40;
    }
  }
}

/* -------------------------
   GAME STATE / BALANCE
   ------------------------- */
let baseHp = 1000;

/* -------------------------
   HELPERS: ANIMATIONS
   ------------------------- */
function createAnimations(scene) {
  // tower animations (idle 4 frames, atk 5 frames) for tower1..tower12
  for (let i = 1; i <= 12; i++) {
    const idleFrames = [];
    for (let j = 1; j <= 4; j++) idleFrames.push({ key: `tower${i}_idle_${j}` });
    const atkFrames = [];
    for (let j = 0; j < 5; j++) atkFrames.push({ key: `tower${i}_atk_${j}` });

    // create with unique keys per tower type
    scene.anims.create({ key: `tower${i}_idle_anim`, frames: idleFrames, frameRate: 8, repeat: -1 });
    scene.anims.create({ key: `tower${i}_atk_anim`, frames: atkFrames, frameRate: 12, repeat: -1 });
  }

  // enemy animations: walk / atk / die
  const eWalk = []; const eAtk = []; const eDie = [];
  for (let i = 0; i < 7; i++) {
    eWalk.push({ key: `e_walk_${i}` });
    eAtk.push({ key: `e_atk_${i}` });
    eDie.push({ key: `e_die_${i}` });
  }
  scene.anims.create({ key: 'e_walk_anim', frames: eWalk, frameRate: 8, repeat: -1 });
  scene.anims.create({ key: 'e_atk_anim', frames: eAtk, frameRate: 8, repeat: -1 });
  // die animation should not loop; on complete we destroy
  scene.anims.create({ key: 'e_die_anim', frames: eDie, frameRate: 10, repeat: 0 });
}

/* -------------------------
   WAVES / SPAWNING
   ------------------------- */
function startNextWave(scene) {
  wave++;
  gold += WAVE_BONUS;
  ui.waveText.setText('Wave:' + wave);
  ui.goldText.setText('Gold:' + gold);
  canWatchAd = true;

  let count = 8 + Math.floor(wave * 1.5);
  for (let i = 0; i < count; i++) {
    scene.time.addEvent({ delay: i * 1000, callback: () => spawnEnemy(scene) });
  }
  // schedule next wave
  scene.time.addEvent({ delay: (count + 6) * 1000, callback: () => startNextWave(scene) });
}

function spawnEnemy(scene) {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  if (!path || path.length === 0) return;

  const spawn = path[0];
  let e = scene.physics.add.sprite(spawn[0], spawn[1], 'e_walk_0').setScale(0.35);
  e.maxHp = 100;
  e.hp = e.maxHp;
  e.speed = 0.2; // slower movement
  e.path = path;
  e.pathIndex = 1;
  e.state = 'walk'; // walk / attack / returning / die
  e._savedPathIndex = null;
  e._lastAttack = 0;

  // play walk animation
  e.play('e_walk_anim');

  // when die animation completes -> destroy and reward
  e.on('animationcomplete-e_die_anim', () => {
    if (e.active) {
      try { scene.sound.play('s_death'); } catch(e){}
      e.destroy();
    }
  });

  enemies.add(e);
}

/* -------------------------
   ENEMY BEHAVIOR
   ------------------------- */
function updateEnemy(e) {
  if (!e || !e.active) return;
  if (e.state === 'die') return;

  // 1) If have a target tower -> move to it and attack if in range
  if (e.targetTower && e.targetTower.active) {
    e.state = 'attack';
    moveTowards(e, e.targetTower.x, e.targetTower.y, e.speed);
    e.setFlipX(e.targetTower.x < e.x);
    let d = Phaser.Math.Distance.Between(e.x, e.y, e.targetTower.x, e.targetTower.y);
    if (d < 26) {
      if (!e._lastAttack || Date.now() - e._lastAttack > 800) {
        e._lastAttack = Date.now();
        // deal 10 damage per hit
        if (e.targetTower.hp != null) {
          e.targetTower.hp -= 10;
          // small hit feedback: tint briefly
          try { e.targetTower.setTint(0xff9999); setTimeout(()=>e.targetTower.clearTint(), 80); } catch(e){}
          if (e.targetTower.hp <= 0) {
            // destroy tower and clear target
            e.targetTower.destroy();
            towers = towers.filter(t => t.sprite && t.sprite.active);
            e.targetTower = null;
            e.state = 'returning';
            // return to path
            if (e._savedPathIndex != null) e.pathIndex = e._savedPathIndex;
          }
        } else {
          e.targetTower = null;
          e.state = 'returning';
        }
      }
    }
    // ensure correct animation
    if (e.anims && e.anims.currentAnim && e.anims.currentAnim.key !== 'e_atk_anim') e.play('e_atk_anim');
    return;
  }

  // 2) find nearest tower within aggro radius
  let nearest = null, nd = 1e9;
  for (let t of towers) {
    const ts = t.sprite;
    if (!ts || !ts.active) continue;
    const d = Phaser.Math.Distance.Between(e.x, e.y, ts.x, ts.y);
    if (d < ENEMY_AGGRO && d < nd) { nd = d; nearest = ts; }
  }
  if (nearest) {
    // set as target, save path index to return later
    e.targetTower = nearest;
    e._savedPathIndex = e.pathIndex;
    // play attack anim
    if (e.anims && e.anims.currentAnim && e.anims.currentAnim.key !== 'e_atk_anim') e.play('e_atk_anim');
    return;
  }

  // 3) returning after attack
  if (e.state === 'returning') {
    const target = e.path[e.pathIndex] || e.path[e.path.length - 1];
    moveTowards(e, target[0], target[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, target[0], target[1]) < 8) {
      e.state = 'walk';
      // resume walk animation
      if (e.anims && (!e.anims.currentAnim || e.anims.currentAnim.key !== 'e_walk_anim')) e.play('e_walk_anim');
    }
    return;
  }

  // 4) follow path toward base
  if (e.pathIndex >= e.path.length) {
    // reached end -> attack base
    e.state = 'attack';
    if (!e._lastAttack || Date.now() - e._lastAttack > 800) {
      e._lastAttack = Date.now();
      baseHp -= 10;
      ui.baseText.setText(`BASE HP ${Math.max(0, baseHp)}`);
      if (baseHp <= 0) {
        baseHp = 0;
        // basic game-over notification (you can replace with proper UI)
        alert('База уничтожена!');
        restartGame(e.scene);
      }
    }
    if (e.anims && e.anims.currentAnim && e.anims.currentAnim.key !== 'e_atk_anim') e.play('e_atk_anim');
    return;
  }

  // 5) move to next waypoint
  e.state = 'walk';
  const waypoint = e.path[e.pathIndex];
  if (waypoint) {
    moveTowards(e, waypoint[0], waypoint[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, waypoint[0], waypoint[1]) < 6) e.pathIndex++;
  }
  if (e.anims && (!e.anims.currentAnim || e.anims.currentAnim.key !== 'e_walk_anim')) e.play('e_walk_anim');
}

/* -------------------------
   MOVEMENT HELPER
   ------------------------- */
function moveTowards(obj, tx, ty, speed) {
  let dx = tx - obj.x, dy = ty - obj.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.1) return;
  obj.x += (dx / dist) * speed * 2;
  obj.y += (dy / dist) * speed * 2;
}

/* -------------------------
   BUILD / TOWERS
   ------------------------- */
function buildTower(scene, index) {
  if (index < 0 || index >= BUILD_SPOTS.length) return;
  if (!buildSprites[index]) return;
  if (gold < TOWER_COST) { alert('Not enough gold'); return; }

  const pos = BUILD_SPOTS[index];
  buildSprites[index].destroy();
  buildSprites[index] = null;

  gold -= TOWER_COST; ui.goldText.setText('Gold:' + gold);

  // create sprite using idle anim key for initial type (tower1)
  const ts = scene.add.sprite(pos[0], pos[1], `tower1_idle_1`).setInteractive();
  ts.setDepth(5);

  // metadata
  ts.hp = 50;            // tower hp (50 -> dies in 5 hits of 10)
  ts.level = 1;
  ts._typeKey = 'tower1';
  ts._isAttacking = false;
  ts._lastShot = 0;
  ts._shootRate = 450;   // attack rate in ms (faster now; original was ~900)
  ts._range = TOWER_RANGE;
  ts._damage = 3 * ts.level; // damage scales with level

  // up/noup indicator (visual only)
  if (scene.textures.exists('up_icon') && scene.textures.exists('noup_icon')) {
    ts.upIcon = scene.add.image(pos[0] - 28, pos[1] + 40, 'noup_icon').setScale(0.6).setDepth(6);
  }

  // play idle animation for this tower type
  const idleAnimKey = `${ts._typeKey}_idle_anim`;
  if (scene.anims.exists(idleAnimKey)) ts.play(idleAnimKey);

  // make tower clickable for upgrade (but block when at max)
  const upgradeHandler = () => upgradeTower(scene, ts);
  ts.on('pointerdown', upgradeHandler);

  // save to towers array
  towers.push({ sprite: ts, upgradeHandler });

  // orientation flip if on right side
  ts.setFlipX(ts.x > 360);
}

/* -------------------------
   UPGRADE LOGIC
   ------------------------- */
function upgradeTower(scene, ts) {
  if (!ts || !ts._typeKey) return;
  let curNum = parseInt(ts._typeKey.replace(/[^0-9]/g, '')) || 1;
  if (curNum >= 12) return; // already max

  // cost scales with next level: base * nextLevel
  const nextLevel = curNum + 1;
  const cost = UPGRADE_COST_BASE * nextLevel;
  if (gold < cost) { alert('Need ' + cost + ' gold'); return; }

  gold -= cost; ui.goldText.setText('Gold:' + gold);

  // update type key and stats
  ts._typeKey = 'tower' + nextLevel;
  ts.level = nextLevel;
  ts._range = Math.min(300, ts._range + 30);
  ts._shootRate = Math.max(200, ts._shootRate - 100); // faster by reducing interval
  ts._damage = 3 * ts.level; // scale damage: 3 * level
  ts.hp += 50;

  // switch animations to new type without flicker
  const idleAnim = `${ts._typeKey}_idle_anim`;
  const atkAnim = `${ts._typeKey}_atk_anim`;
  if (scene.anims.exists(idleAnim)) ts.play(idleAnim);

  // if reached max (12) then hide upIcon and remove pointer for upgrades
  if (nextLevel >= 12) {
    if (ts.upIcon) ts.upIcon.setVisible(false);
    // disable further upgrading by removing listener
    ts.removeAllListeners('pointerdown');
  }
}

/* -------------------------
   BULLETS
   ------------------------- */
function updateBullet(b) {
  if (!b.active) return;
  if (!b.target || !b.target.active || b.target.state === 'die') {
    try { b.destroy(); } catch(e){}
    return;
  }
  const dx = b.target.x - b.x, dy = b.target.y - b.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 8) {
    // apply damage proportional to tower level stored on bullet
    b.target.hp -= b.damage;
    // flash target
    try { b.target.setTint(0xffcccc); setTimeout(()=>b.target.clearTint(), 60); } catch(e){}
    if (b.target.hp <= 0 && b.target.state !== 'die') {
      b.target.state = 'die';
      b.target.play('e_die_anim');
      gold += KILL_REWARD; ui.goldText.setText('Gold:' + gold);
    }
    try { b.destroy(); } catch(e){}
    return;
  }
  b.x += (dx / dist) * b.speed;
  b.y += (dy / dist) * b.speed;
}

/* -------------------------
   TOWER SHOOT LOOP (runs on interval)
   ------------------------- */
setInterval(() => {
  if (isPaused) return;
  try {
    let sc = game.scene.scenes[0];
    if (!sc) return;

    for (let t of towers) {
      let ts = t.sprite;
      if (!ts || !ts.active) continue;

      ts._lastShot += 200;

      // update up icon
      if (ts.upIcon && ts.upIcon.active) {
        if (ts.level >= 12) ts.upIcon.setVisible(false);
        else {
          const key = gold >= UPGRADE_COST_BASE * (parseInt(ts._typeKey.replace(/[^0-9]/g,'')) + 1) ? 'up_icon' : 'noup_icon';
          if (ts.upIcon.texture.key !== key) ts.upIcon.setTexture(key);
          ts.upIcon.setVisible(true);
        }
      }

      if (ts._lastShot < ts._shootRate) {
        // not ready -> ensure idle anim plays
        if (ts.anims && (!ts.anims.currentAnim || ts.anims.currentAnim.key.indexOf('_idle_anim')===-1)) {
          const idleKey = `${ts._typeKey}_idle_anim`;
          if (sc.anims.exists(idleKey)) ts.play(idleKey, true);
        }
        ts._isAttacking = false;
        continue;
      }

      // ready to shoot
      ts._lastShot = 0;

      // find nearest enemy in range
      let target = null, dmin = 1e9;
      enemies.getChildren().forEach(e => {
        if (!e.active || e.state === 'die') return;
        const d = Phaser.Math.Distance.Between(ts.x, ts.y, e.x, e.y);
        if (d < ts._range && d < dmin) { dmin = d; target = e; }
      });

      if (target) {
        // create projectile
        let b = sc.add.circle(ts.x, ts.y, 6, 0xffdd00);
        sc.physics.add.existing(b);
        b.target = target;
        b.speed = 10;
        b.damage = ts._damage || (3 * ts.level); // damage scaled with level
        bullets.add(b);

        // set tower to attack animation
        ts._isAttacking = true;
        const atkKey = `${ts._typeKey}_atk_anim`;
        if (sc.anims.exists(atkKey) && (!ts.anims.currentAnim || ts.anims.currentAnim.key !== atkKey)) {
          ts.play(atkKey, true);
        }
        try { sc.sound.play('s_shoot'); } catch(e){}
        ts.setFlipX(ts.x > 360);
      } else {
        ts._isAttacking = false;
        // ensure idle animation
        const idleKey = `${ts._typeKey}_idle_anim`;
        if (sc.anims.exists(idleKey) && (!ts.anims.currentAnim || ts.anims.currentAnim.key !== idleKey)) ts.play(idleKey, true);
      }
    }
  } catch (err) { console.warn(err); }
}, 200);

/* -------------------------
   PAUSE / RESTART
   ------------------------- */
function togglePause(scene) {
  isPaused = !isPaused;
  ui.pauseBtn.setText(isPaused ? '▶️ Продолжить' : '⏸️ Пауза');
}

function restartGame(scene) {
  scene.scene.restart();
  gold = START_GOLD;
  wave = 0;
  baseHp = 1000;
  isPaused = false;
}

/* -------------------------
   PHASER CONFIG
   ------------------------- */
const config2 = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  scene: { preload: create_preload, create: create, update: update },
  physics: { default: 'arcade' }
};
const game = new Phaser.Game(config2);

/* Notes:
 - Tower idle/attack use Phaser animations created once in createAnimations() — prevents single-frame
   texture fallback (green square) because we never set raw textures each frame.
 - Damage scaling: tower damage = 3 * level. Upgrade increases level and damage.
 - Tower shoot rate reduced (faster) and further reduced on upgrades.
 - Enemies look for nearest tower inside ENEMY_AGGRO and attack it; after tower destroyed they return to path.
 - Enemy death uses 'e_die_anim' animation; on complete the sprite is destroyed and reward given.
 - Towers have hp=50 and take 10 damage per enemy hit; they are destroyed when hp <= 0.
 - Base HP displayed as bar at top; enemies deal 10 damage to base.
*/
