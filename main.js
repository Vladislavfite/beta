// main.js — исправленный рабочий файл
// Положи рядом menu.html и gameover.html и папку assets как в проекте.

// --- Constants ---
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

// --- Globals ---
let enemies, towers = [], bullets, buildSprites, ui;
let gold = START_GOLD;
let wave = 0;
let canWatchAd = true;
let isPaused = false;
let baseHp = 1000;

// --- Preload ---
function create_preload() {
  this.load.image('map', 'assets/map.png');
  this.load.image('molot', 'assets/elements/moloticon.png');
  this.load.image('up_icon', 'assets/elements/up.png');
  this.load.image('noup_icon', 'assets/elements/noup.png');

  // towers
  for (let i = 1; i <= 12; i++) {
    for (let j = 1; j <= 4; j++) this.load.image(`tower${i}_idle_${j}`, `assets/attacktower/statik/tower${i}/stower${j}.png`);
    for (let j = 1; j <= 5; j++) this.load.image(`tower${i}_atk_${j-1}`, `assets/attacktower/attack/tower${i}/aatcktower${j}.png`);
  }
  // enemies
  for (let i = 0; i < 7; i++) {
    this.load.image('e_walk_' + i, `assets/enemy/walk/walk${i+1}.png`);
    this.load.image('e_atk_' + i, `assets/enemy/atack_enemy/atackenemy${i+1}.png`);
    this.load.image('e_die_' + i, `assets/enemy/die_enemy/dead${i+1}.png`);
  }

  // UI elements
  this.load.image('play_btn', 'assets/elements/play.png');
  this.load.image('menu_icon', 'assets/elements/menu.png');
  this.load.image('play2', 'assets/elements/play2.png');
  this.load.image('pause_icon', 'assets/elements/pause.png');
  this.load.image('reload_icon', 'assets/elements/reload.png');
  this.load.image('sound_on', 'assets/elements/sound.png');
  this.load.image('sound_off', 'assets/elements/soundoff.png');
  this.load.image('reklama', 'assets/elements/reklama.png');
  this.load.image('arrow', 'assets/elements/arrow.png');

  for (let i=0;i<12;i++){
    this.load.image('money_'+i, `assets/money/m${i+1}.png`);
  }

  this.load.video('menu_vid', 'assets/menu.webm', 'loadeddata', false, true);
  this.load.video('gameover_vid', 'assets/gameover.webm', 'loadeddata', false, true);

  // sounds (try/catch in case files missing)
  try { this.load.audio('arrow_s', 'assets/sound/arrow.mp3'); } catch(e){}
  try { this.load.audio('battle', 'assets/sound/battle.mp3'); } catch(e){}
  try { this.load.audio('lobby', 'assets/sound/lobby.mp3'); } catch(e){}
  try { this.load.audio('gameover_s', 'assets/sound/gameover.mp3'); } catch(e){}
  try { this.load.audio('klick', 'assets/sound/klick.ogg'); } catch(e){}
  try { this.load.audio('money_s', 'assets/sound/money.mp3'); } catch(e){}
  try { this.load.audio('towerrush', 'assets/sound/towerrush.mp3'); } catch(e){}
  try { this.load.audio('s_shoot', 'assets/sounds/shoot.mp3'); } catch(e){}
  try { this.load.audio('s_death', 'assets/sounds/death.mp3'); } catch(e){}
}

// --- Create ---
function create() {
  // background
  this.add.image(360, 640, 'map').setDisplaySize(720, 1280);

  // groups
  enemies = this.add.group();
  bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 300, runChildUpdate: true });

  towers = [];
  buildSprites = [];

  // create hammers (build spots)
  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    createHammerAt(this, BUILD_SPOTS[i], i);
  }

  // UI: gold / wave / base HP
  ui = {};
  ui.goldText = this.add.text(520, 1200, 'Gold:' + gold, { font: '22px Arial', fill: '#fff' }).setDepth(50);
  ui.waveText = this.add.text(12, 44, 'Wave:' + wave, { font: '18px Arial', fill: '#fff' }).setDepth(50);

  ui.baseBarBg = this.add.rectangle(360, 1200, 320, 18, 0x222222).setOrigin(0.5, 0).setDepth(50);
  ui.baseBar = this.add.rectangle(360 - 160, 1200, 320, 18, 0x00cc00).setOrigin(0,0).setDepth(51);
  ui.baseText = this.add.text(360, 1184, 'BASE HP', { font: '14px Arial', fill: '#fff' }).setOrigin(0.5,0).setDepth(52);

  // pause / restart
  ui.pauseBtn = this.add.text(200, 1220, '⏸️ Пауза', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive().setDepth(50);
  ui.restartBtn = this.add.text(400, 1220, '🔁 Рестарт', { font: '20px Arial', fill: '#fff', backgroundColor: '#333' }).setInteractive().setDepth(50);
  ui.pauseBtn.on('pointerdown', () => togglePause(this));
  ui.restartBtn.on('pointerdown', () => restartGame(this));

  // control icons (wrapped in try to avoid crash if textures missing)
  try {
    ui.reklamaBtn = this.add.image(126,1127,'reklama').setInteractive().setDepth(60);
    ui.reklamaBtn.on('pointerdown', ()=> { try{ this.sound.play('klick'); }catch(e){} console.log('Ad placeholder'); });

    ui.menuIcon = this.add.image(575,700,'menu_icon').setInteractive().setDepth(60);
    ui.menuIcon.on('pointerdown', ()=> { try{ this.sound.play('klick'); }catch(e){} window.location.href = 'menu.html'; });

    ui.play2 = this.add.image(657,700,'play2').setInteractive().setDepth(60);
    ui.play2.on('pointerdown', ()=> { try{ this.sound.play('klick'); }catch(e){} if(isPaused) togglePause(this); });

    ui.pauseIcon = this.add.image(506,700,'pause_icon').setInteractive().setDepth(60);
    ui.pauseIcon.on('pointerdown', ()=> { try{ this.sound.play('klick'); }catch(e){} togglePause(this); });

    ui.reloadIcon = this.add.image(576,629,'reload_icon').setInteractive().setDepth(60);
    ui.reloadIcon.on('pointerdown', ()=> { try{ this.sound.play('klick'); }catch(e){} restartGame(this); });

    ui.soundIcon = this.add.image(576,770,'sound_on').setInteractive().setDepth(60);
    ui.soundIcon.on('pointerdown', ()=> { this.sound.mute = !this.sound.mute; ui.soundIcon.setTexture(this.sound.mute ? 'sound_off' : 'sound_on'); });
  } catch(e){ console.warn('UI icons missing', e); }

  // animations
  createAnimations(this);

  // battle music (safe)
  try{
    if (this.cache.audio && this.cache.audio.exists && this.cache.audio.exists('battle')) {
      this._battleMusic = this.sound.add('battle', { loop:true, volume:0.5 });
      this._battleMusic.play();
    }
  } catch(e){ console.warn('battle music missing or blocked', e); }

  // shared shooting sound monitor
  setupSharedShootingSound(this);

  // firing loop (safe sc retrieval)
  setInterval(()=> {
    if (isPaused) return;
    try {
      let sc = (game && game.scene && game.scene.scenes && game.scene.scenes[0]) ? game.scene.scenes[0] : null;
      if (!sc) return;
      for (let tObj of Array.from(towers)) {
        let ts = tObj.sprite; if (!ts || !ts.active) continue;
        ts._lastShot = (ts._lastShot || 0) + 200;

        // upgrade icon
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
          if (sc.anims.exists(idleKey) && (!ts.anims.currentAnim || ts.anims.currentAnim.key.indexOf('_idle_anim') === -1)) ts.play(idleKey, true);
          ts._isAttacking = false; continue;
        }

        ts._lastShot = 0;
        let target = null, dmin = 1e9;
        (enemies && enemies.getChildren() || []).forEach(e => {
          if (!e.active || e.state === 'die') return;
          const d = Phaser.Math.Distance.Between(ts.x, ts.y, e.x, e.y);
          if (d < ts._range && d < dmin) { dmin = d; target = e; }
        });

        if (target) {
          let b = bullets.get();
          if (!b) {
            b = sc.physics.add.image(ts.x, ts.y - (ts.displayHeight ? Math.round(ts.displayHeight/2) : 40), 'arrow');
            bullets.add(b);
          } else {
            b.setTexture('arrow');
            b.setActive(true).setVisible(true);
            if (b.body) b.body.enable = true;
            const spawnY = ts.y - (ts.displayHeight ? Math.round(ts.displayHeight * 0.9) : 40);
            b.setPosition(ts.x, spawnY);
          }
          b.target = target; b.speed = ts._bulletSpeed || 10; b.damage = ts._damage || (10 * ts.level);
          try { b.setDepth(30); b.setOrigin(0.5,0.5); } catch(e){}
          ts._isAttacking = true;
          const atkKey = `${ts._typeKey}_atk_anim`;
          if (sc.anims.exists(atkKey) && (!ts.anims.currentAnim || ts.anims.currentAnim.key !== atkKey)) ts.play(atkKey, true);
          sc._isAnyShooting = true;
          ts.setFlipX(ts.x > 360);
        } else {
          ts._isAttacking = false;
          const idleKey = `${ts._typeKey}_idle_anim`;
          if (sc.anims.exists(idleKey) && (!ts.anims.currentAnim || ts.anims.currentAnim.key !== idleKey)) ts.play(idleKey, true);
        }
      }
    } catch(err) { console.warn(err); }
  }, 200);

  // bullets vs enemies overlap
  try {
    this.physics.add.overlap(bullets, enemies, (b,e) => {
      if (!b.active || !e.active) return;
      e.hp -= (b.damage || 10);
      try {
        const tgt = e;
        if (tgt && tgt.setTint) tgt.setTint(0xffcccc);
        setTimeout(()=>{ if (tgt && tgt.active && typeof tgt.clearTint === 'function') tgt.clearTint(); }, 60);
      } catch(err){}
      if (e.hp <= 0 && e.state !== 'die') {
        e.state = 'die'; e.play && e.play('e_die_anim');
        gold += KILL_REWARD; ui.goldText.setText('Gold:' + gold);
      }
      try {
        b.setActive(false); b.setVisible(false);
        if (b.body) { b.body.enable = false; b.body.setVelocity(0,0); }
      } catch(er){}
    });
  } catch(e){ console.warn('overlap setup failed', e); }

  // start waves
  this.time.addEvent({ delay: 1000, callback: ()=> startNextWave(this) });
}

// --- Update ---
function update() {
  if (isPaused) return;

  try {
    enemies && enemies.getChildren().forEach(e => updateEnemy(e));
  } catch(e) {}

  try {
    bullets && bullets.getChildren().forEach(b => updateBullet(b));
  } catch(e){}

  if (ui && ui.baseBar) {
    ui.baseBar.width = Math.max(0, 320 * (baseHp / 1000));
    ui.baseBar.fillColor = baseHp > 600 ? 0x00cc00 : (baseHp > 300 ? 0xcccc00 : 0xcc0000);
  }

  for (let tObj of towers) {
    const ts = tObj.sprite;
    if (!ts) continue;
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
  }
}

// --- Helpers & fixes ---
// updateBullet (safe, added)
function updateBullet(b) {
  if (!b || !b.active) return;
  if (!b.target || !b.target.active || b.target.state === 'die') {
    try { b.setActive(false); b.setVisible(false); if (b.body) { b.body.enable = false; b.body.setVelocity(0,0); } } catch(e){}
    return;
  }

  const angle = Phaser.Math.Angle.Between(b.x, b.y, b.target.x, b.target.y);
  b.rotation = angle;
  const speed = b.speed || 8;
  b.x += Math.cos(angle) * speed;
  b.y += Math.sin(angle) * speed;

  // hit check (redundant with overlap but keeps movement tidy)
  const dx = b.target.x - b.x, dy = b.target.y - b.y;
  if (Math.sqrt(dx*dx + dy*dy) < 10) {
    try {
      if (b.target && b.target.active) {
        b.target.hp -= (b.damage || 10);
        if (b.target.setTint) b.target.setTint(0xffcccc);
        setTimeout(()=>{ if (b.target && b.target.active && typeof b.target.clearTint === 'function') b.target.clearTint(); }, 60);
        if (b.target.hp <= 0 && b.target.state !== 'die') {
          b.target.state = 'die';
          b.target.play && b.target.play('e_die_anim');
          gold += KILL_REWARD; ui.goldText.setText('Gold:' + gold);
        }
      }
    } catch(e){}
    try { b.setActive(false); b.setVisible(false); if (b.body) { b.body.enable = false; b.body.setVelocity(0,0); } } catch(e){}
    return;
  }

  // offscreen recycle
  if (b.x < -50 || b.x > 770 || b.y < -50 || b.y > 1330) {
    try { b.setActive(false); b.setVisible(false); if (b.body) b.body.enable = false; } catch(e){}
  }
}

// createHammerAt (minimal safe)
function createHammerAt(scene, pos, index) {
  try {
    if (!scene || !scene.add) return;
    if (buildSprites[index]) {
      try { buildSprites[index].destroy(); } catch(e){}
      buildSprites[index] = null;
    }
    const hammer = scene.add.image(pos[0], pos[1], 'molot').setInteractive({ useHandCursor: true });
    hammer.setScale(0.6); hammer.setDepth(10);
    hammer.setData('buildIndex', index);
    buildSprites[index] = hammer;
    hammer.on('pointerdown', function () {
      const idx = this.getData('buildIndex');
      if (idx == null) return;
      buildTower(scene, idx);
    });
  } catch(e){ console.warn('createHammerAt failed', e); }
}

// buildTower (robust)
function buildTower(scene, index) {
  try {
    if (!scene) return;
    if (index < 0 || index >= BUILD_SPOTS.length) return;
    if (!buildSprites[index]) return;
    if (gold < TOWER_COST) { alert('Not enough gold'); return; }
    const pos = BUILD_SPOTS[index];
    try { buildSprites[index] && buildSprites[index].destroy(); } catch(e){}
    buildSprites[index] = null;
    gold -= TOWER_COST;
    ui.goldText.setText('Gold:' + gold);

    const ts = scene.add.sprite(pos[0], pos[1], `tower1_idle_1`).setInteractive();
    ts.setDepth(5); ts.hp = 50; ts.level = 1; ts._typeKey = 'tower1';
    ts._isAttacking = false; ts._lastShot = 0; ts._shootRate = 450; ts._range = TOWER_RANGE;
    ts._damage = 10 * ts.level; ts._upgradeCost = UPGRADE_COST_BASE * (ts.level + 1);
    ts._bulletSpeed = 10;

    if (scene.textures.exists('up_icon') && scene.textures.exists('noup_icon')) {
      ts.upIcon = scene.add.image(pos[0] - 28, pos[1] + 40, 'noup_icon').setScale(0.6).setDepth(6).setVisible(true);
    }

    const idleAnimKey = `${ts._typeKey}_idle_anim`;
    if (scene.anims.exists(idleAnimKey)) ts.play(idleAnimKey);

    const upgradeHandler = () => upgradeTower(scene, ts);
    ts.on('pointerdown', upgradeHandler);
    towers.push({ sprite: ts, upgradeHandler });
    ts.setFlipX(ts.x > 360);

    ts.on('destroy', () => createHammerAt(scene, pos, index));
  } catch(e){ console.warn('buildTower failed', e); }
}

function upgradeTower(scene, ts) {
  if (!ts) return;
  const cost = Math.floor(ts._upgradeCost || (UPGRADE_COST_BASE * (ts.level + 1)));
  if (ts.level >= 12) return;
  if (gold < cost) { alert('Need ' + cost + ' gold'); return; }
  gold -= cost; ui.goldText.setText('Gold:' + gold);
  const nextLevel = ts.level + 1; ts._typeKey = 'tower' + nextLevel; ts.level = nextLevel;
  ts._range = Math.min(300, ts._range + 30); ts._shootRate = Math.max(200, ts._shootRate - 100);
  ts._damage = 10 * ts.level; ts.hp += 50; ts._upgradeCost = UPGRADE_COST_BASE * (ts.level + 1);
  const idleAnim = `${ts._typeKey}_idle_anim`; if (scene.anims.exists(idleAnim)) ts.play(idleAnim);
  if (nextLevel >= 12) { if (ts.upIcon) ts.upIcon.setVisible(false); ts.removeAllListeners && ts.removeAllListeners('pointerdown'); }
}

// --- Waves & enemies ---
function startNextWave(scene) {
  wave++;
  gold += WAVE_BONUS;
  ui.waveText.setText('Wave:' + wave);
  ui.goldText.setText('Gold:' + gold);
  canWatchAd = true;

  const enemyHp = 100 + wave;
  const maxEnemiesPerSpawn = 20;
  const baseEnemies = 1;
  const enemiesPerSpawn = Math.min(maxEnemiesPerSpawn, baseEnemies + wave);
  const totalSpawns = PATHS.length;

  for (let i = 0; i < totalSpawns; i++) {
    const path = PATHS[i];
    for (let j = 0; j < enemiesPerSpawn; j++) {
      scene.time.addEvent({
        delay: j * 800 + i * 300,
        callback: () => spawnEnemy(scene, path, enemyHp)
      });
    }
  }
  const nextDelay = (enemiesPerSpawn * 800) + 3000;
  scene.time.addEvent({ delay: nextDelay, callback: () => startNextWave(scene) });
}

function spawnEnemy(scene, path = null, customHp = 100) {
  if (!path) path = PATHS[Math.floor(Math.random() * PATHS.length)];
  if (!path || path.length === 0) return;
  const spawn = path[0];

  let e = scene.physics.add.sprite(spawn[0], spawn[1], 'e_walk_0').setScale(0.35);
  e.maxHp = customHp;
  e.hp = e.maxHp;
  e.speed = 0.2 + Math.min(0.05 * wave, 0.5);
  e.path = path;
  e.pathIndex = 1;
  e.state = 'walk';
  e._savedPathIndex = null;
  e._lastAttack = 0;
  e.play('e_walk_anim');
  e.on('animationcomplete-e_die_anim', () => {
    if (e.active) {
      try { scene.sound.play('s_death'); } catch(err){}
      e.destroy();
    }
  });
  enemies.add(e);
}

function updateEnemy(e) {
  if (!e || !e.active || e.state === 'die') return;
  const scene = e.scene;

  // attack tower if targeted
  if (e.targetTower && e.targetTower.active) {
    e.state = 'attack';
    moveTowards(e, e.targetTower.x, e.targetTower.y, e.speed);
    e.setFlipX(e.targetTower.x < e.x);

    let d = Phaser.Math.Distance.Between(e.x, e.y, e.targetTower.x, e.targetTower.y);
    if (d < 26 && (!e._lastAttack || Date.now() - e._lastAttack > 800)) {
      e._lastAttack = Date.now();
      if (e.targetTower.hp != null) {
        e.targetTower.hp -= 10;
        try {
          const tgt = e.targetTower;
          if (tgt && tgt.setTint) tgt.setTint(0xff9999);
          setTimeout(()=>{
            if (tgt && tgt.active && typeof tgt.clearTint === 'function') tgt.clearTint();
          }, 80);
        } catch(err){}
        if (e.targetTower.hp <= 0) {
          let idx = buildSprites.findIndex(s=>s==null);
          if (idx >= 0) {
            const p = BUILD_SPOTS[idx];
            buildSprites[idx] = e.scene.add.image(p[0], p[1], 'molot').setInteractive().setScale(0.6).on('pointerdown', ()=>buildTower(e.scene, idx));
          }
          try { const deadTs = e.targetTower; if (deadTs && deadTs.upIcon && deadTs.upIcon.destroy) deadTs.upIcon.destroy(); } catch(err){}
          try { e.targetTower.destroy(); } catch(err){}
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

  // search for nearest tower within aggro
  let nearest = null, nd = 1e9;
  for (let tObj of towers) {
    const ts = tObj.sprite;
    if (!ts || !ts.active) continue;
    const d = Phaser.Math.Distance.Between(e.x, e.y, ts.x, ts.y);
    if (d < ENEMY_AGGRO && d < nd) { nd = d; nearest = ts; }
  }
  if (nearest) { e.targetTower = nearest; e._savedPathIndex = e.pathIndex; if (e.anims && e.anims.currentAnim && e.anims.currentAnim.key !== 'e_atk_anim') e.play('e_atk_anim'); return; }

  // returning to path
  if (e.state === 'returning') {
    const target = e.path[e.pathIndex] || e.path[e.path.length - 1];
    moveTowards(e, target[0], target[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, target[0], target[1]) < 8) {
      e.state = 'walk';
      if (e.anims && (!e.anims.currentAnim || e.anims.currentAnim.key !== 'e_walk_anim')) e.play('e_walk_anim');
    }
    return;
  }

  // reached end -> damage base
  if (e.pathIndex >= e.path.length) {
    e.state = 'attack';
    if (!e._lastAttack || Date.now() - e._lastAttack > 800) {
      e._lastAttack = Date.now();
      baseHp -= 10;
      ui.baseText.setText(`BASE HP ${Math.max(0, baseHp)}`);
      if (baseHp <= 0) {
        baseHp = 0;
        try { scene.sound.stopAll(); } catch(err){}
        window.location.href = 'gameover.html';
      }
    }
    if (e.anims && e.anims.currentAnim && e.anims.currentAnim.key !== 'e_atk_anim') e.play('e_atk_anim');
    return;
  }

  // normal path walking
  e.state = 'walk';
  const wp = e.path[e.pathIndex];
  if (wp) {
    moveTowards(e, wp[0], wp[1], e.speed);
    if (Phaser.Math.Distance.Between(e.x, e.y, wp[0], wp[1]) < 6) e.pathIndex++;
  }
  if (wp) e.setFlipX(wp[0] < e.x);
  if (e.anims && (!e.anims.currentAnim || e.anims.currentAnim.key !== 'e_walk_anim')) e.play('e_walk_anim');
}

// moveTowards
function moveTowards(obj, tx, ty, speed) {
  let dx = tx - obj.x, dy = ty - obj.y, dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 0.1) return;
  obj.x += (dx / dist) * speed * 2;
  obj.y += (dy / dist) * speed * 2;
}

// setupSharedShootingSound
function setupSharedShootingSound(scene){
  try{
    scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: ()=>{
        try{
          const activeBullets = bullets ? bullets.getChildren().filter(b=>b && b.active).length : 0;
          if(activeBullets > 0){
            if(!scene._arrowSound || !scene._arrowSound.isPlaying){
              try{ scene._arrowSound = scene.sound.add('arrow_s', { loop:true, volume: 0.5 }); scene._arrowSound.play(); } catch(e){}
            }
          } else {
            if(scene._arrowSound && scene._arrowSound.isPlaying){
              try{ scene._arrowSound.stop(); } catch(e){}
            }
          }
        } catch(e){}
      }
    });
  } catch(e){}
}

// pause & restart
function togglePause(scene){ isPaused = !isPaused; ui.pauseBtn && ui.pauseBtn.setText(isPaused ? '▶️ Продолжить' : '⏸️ Пауза'); }
function restartGame(scene){
  try{
    enemies && enemies.clear(true, true);
    bullets && bullets.clear(true, true);
    for (let tObj of towers) {
      try { if (tObj.sprite && tObj.sprite.upIcon) tObj.sprite.upIcon.destroy(); } catch(e){}
      try { if (tObj.sprite) tObj.sprite.destroy(); } catch(e){}
    }
  } catch(e){ console.warn(e); }
  towers = []; enemies = null; bullets = null; buildSprites = []; gold = START_GOLD; wave = 0; baseHp = 1000; isPaused = false;
  try { game.scene.scenes[0].scene.restart(); } catch(e){ window.location.reload(); }
}

// createAnimations
function createAnimations(scene) {
  for (let i = 1; i <= 12; i++) {
    const idleFrames = []; const atkFrames = [];
    for (let j = 1; j <= 4; j++) idleFrames.push({ key: `tower${i}_idle_${j}` });
    for (let j = 0; j < 5; j++) atkFrames.push({ key: `tower${i}_atk_${j}` });
    if (!scene.anims.exists(`tower${i}_idle_anim`)) scene.anims.create({ key: `tower${i}_idle_anim`, frames: idleFrames, frameRate: 8, repeat: -1 });
    if (!scene.anims.exists(`tower${i}_atk_anim`)) scene.anims.create({ key: `tower${i}_atk_anim`, frames: atkFrames, frameRate: 12, repeat: -1 });
  }
  const eWalk = [], eAtk = [], eDie = [];
  for (let i = 0; i < 7; i++) { eWalk.push({ key: `e_walk_${i}` }); eAtk.push({ key: `e_atk_${i}` }); eDie.push({ key: `e_die_${i}` }); }
  if (!scene.anims.exists('e_walk_anim')) scene.anims.create({ key: 'e_walk_anim', frames: eWalk, frameRate: 8, repeat: -1 });
  if (!scene.anims.exists('e_atk_anim')) scene.anims.create({ key: 'e_atk_anim', frames: eAtk, frameRate: 8, repeat: -1 });
  if (!scene.anims.exists('e_die_anim')) scene.anims.create({ key: 'e_die_anim', frames: eDie, frameRate: 10, repeat: 0 });
}

// --- Phaser config & start ---
const config = { type: Phaser.AUTO, width: 720, height: 1280, parent: 'game', physics: { default: 'arcade', arcade: { debug: false } }, scene: { preload: create_preload, create: create, update: update } };
const game = new Phaser.Game(config);
