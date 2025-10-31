const GAME_WIDTH = 720;
const GAME_HEIGHT = 1280;
const START_GOLD = 150;
const BUILD_SPOTS = [
  [120, 680],
  [260, 720],
  [400, 680],
  [540, 720]
];
const ENEMY_PATH = [
  [720, 200],
  [540, 320],
  [460, 560],
  [340, 800],
  [260, 1080],
  [180, 1280]
];

let towers = [];
let enemies = null;
let bullets = null;
let gold = START_GOLD;
let wave = 0;
let baseHp = 1000;
let isPaused = false;
let ui = {};
let buildSprites = [];
let shootLoop;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game",
  physics: { default: "arcade" },
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);

// === PRELOAD ===
function preload() {
  this.load.image("bg", "assets/bg.png");
  this.load.image("molot", "assets/molot.png");
  this.load.image("tower1", "assets/tower1.png");
  this.load.image("bullet", "assets/bullet.png");
  this.load.spritesheet("enemy", "assets/enemy.png", { frameWidth: 64, frameHeight: 64 });
  this.load.audio("shoot", "assets/sounds/shoot.mp3");
  this.load.audio("death", "assets/sounds/death.mp3");
}

// === CREATE ===
function create() {
  this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "bg").setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

  enemies = this.physics.add.group();
  bullets = this.physics.add.group();

  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    const p = BUILD_SPOTS[i];
    const molot = this.add.image(p[0], p[1], "molot").setInteractive().setScale(0.6);
    molot.on("pointerdown", () => buildTower(this, i));
    buildSprites.push(molot);
  }

  ui.gold = this.add.text(16, 16, `💰 ${gold}`, { fontSize: "28px", color: "#ff0" });
  ui.wave = this.add.text(16, 56, `🌊 ${wave}`, { fontSize: "28px", color: "#0f0" });
  ui.hp = this.add.text(16, 96, `❤️ ${baseHp}`, { fontSize: "28px", color: "#f44" });

  this.anims.create({
    key: "enemy_walk",
    frames: this.anims.generateFrameNumbers("enemy", { start: 0, end: 3 }),
    frameRate: 6,
    repeat: -1
  });

  this.input.keyboard.on("keydown-P", () => (isPaused = !isPaused));
  this.input.keyboard.on("keydown-R", () => restartGame(this));

  // Запуск стрельбы
  shootLoop = setInterval(() => towerShootLoop(this), 200);

  spawnWave(this);
}

// === UPDATE ===
function update() {
  if (isPaused) return;

  enemies.children.each(e => updateEnemy(e));
  bullets.children.each(b => updateBullet(b));

  ui.gold.setText(`💰 ${gold}`);
  ui.wave.setText(`🌊 ${wave}`);
  ui.hp.setText(`❤️ ${baseHp}`);
}

// === ЛОГИКА ===
function buildTower(scene, i) {
  const cost = 100;
  if (gold < cost) return;

  gold -= cost;
  const p = BUILD_SPOTS[i];
  const tower = scene.add.image(p[0], p[1], "tower1").setScale(0.8);
  tower.level = 1;
  tower.damage = 10;
  tower.range = 220;
  tower.nextUpgradeCost = 150;

  tower.setInteractive();
  tower.on("pointerdown", () => upgradeTower(tower));

  towers.push(tower);
  buildSprites[i].destroy();
  buildSprites[i] = null;
}

function upgradeTower(tower) {
  if (gold < tower.nextUpgradeCost) {
    console.log("Недостаточно золота!");
    return;
  }

  gold -= tower.nextUpgradeCost;
  tower.level++;
  tower.damage += 10;
  tower.range += 10;
  tower.nextUpgradeCost = Math.floor(tower.nextUpgradeCost * 1.5);
  tower.setScale(tower.scale + 0.1);
}

function towerShootLoop(scene) {
  if (isPaused) return;

  towers.forEach(t => {
    if (!t.active) return;
    const target = enemies.children.entries.find(
      e => e.active && Phaser.Math.Distance.Between(e.x, e.y, t.x, t.y) < t.range
    );
    if (target) shoot(scene, t, target);
  });
}

function shoot(scene, tower, target) {
  const bullet = bullets.create(tower.x, tower.y - 10, "bullet");
  bullet.target = target;
  bullet.damage = tower.damage;
  bullet.speed = 350;
  scene.sound.play("shoot", { volume: 0.1 });
}

function updateBullet(bullet) {
  if (!bullet.active || !bullet.target?.active) {
    bullet.destroy();
    return;
  }

  const dx = bullet.target.x - bullet.x;
  const dy = bullet.target.y - bullet.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 10) {
    bullet.target.hp -= bullet.damage;
    if (bullet.target.hp <= 0) killEnemy(bullet.target);
    bullet.destroy();
    return;
  }

  bullet.x += (dx / dist) * (bullet.speed / 60);
  bullet.y += (dy / dist) * (bullet.speed / 60);
}

function spawnWave(scene) {
  wave++;
  ui.wave.setText(`🌊 ${wave}`);
  for (let i = 0; i < 5 + wave * 2; i++) {
    setTimeout(() => spawnEnemy(scene), i * 700);
  }
}

function spawnEnemy(scene) {
  const e = enemies.create(ENEMY_PATH[0][0], ENEMY_PATH[0][1], "enemy");
  e.hp = 50 + wave * 15;
  e.speed = 40 + wave * 5;
  e.pathIndex = 0;
  e.play("enemy_walk");
  e.setFlipX(true);
}

function updateEnemy(e) {
  if (!e.active) return;

  const wp = ENEMY_PATH[e.pathIndex + 1];
  if (!wp) {
    e.destroy();
    baseHp -= 20;
    if (baseHp <= 0) alert("GAME OVER");
    return;
  }

  const dx = wp[0] - e.x;
  const dy = wp[1] - e.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 5) {
    e.pathIndex++;
  } else {
    e.x += (dx / dist) * (e.speed / 60);
    e.y += (dy / dist) * (e.speed / 60);
    e.setFlipX(dx < 0);
  }
}

function killEnemy(e) {
  gold += 10;
  e.destroy();
  game.sound.play("death", { volume: 0.1 });
}

function restartGame(scene) {
  clearInterval(shootLoop);
  towers = [];
  enemies = null;
  bullets = null;
  buildSprites = [];
  ui = {};
  gold = START_GOLD;
  wave = 0;
  baseHp = 1000;
  isPaused = false;
  scene.scene.restart();
}
