// === Tower Defense Main — Stable Functional Version ===
// Размер сцены: 720x1280
// Враги идут по маршрутам, волны бесконечны, пауза/рестарт внизу

const config = {
  type: Phaser.AUTO,
  width: 720,
  height: 1280,
  backgroundColor: '#222222',
  physics: { default: 'arcade' },
  scene: { preload, create, update }
};

let game = new Phaser.Game(config);

let towers = [];
let enemies = [];
let projectiles = [];
let gold = 100;
let wave = 0;
let WAVE_BONUS = 25;
let isPaused = false;
let base;

const enemyPaths = [
  [[377,50],[429,138],[410,189],[346,224],[311,257],[290,305],[331,354],[400,463],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[81,335],[189,359],[331,354],[400,463],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[636,490],[544,498],[413,491],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[52,667],[168,691],[289,700],[347,736],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[646,963],[565,1029],[441,1069],[312,1082],[226,1059]]
];

function preload() {
  this.load.image('tower', 'assets/tower.png');
  this.load.image('tower_attack', 'assets/tower_attack.png');
  this.load.image('enemy', 'assets/enemy.png');
  this.load.image('enemy_attack', 'assets/enemy_attack.png');
  this.load.image('projectile', 'assets/projectile.png');
  this.load.image('pauseBtn', 'assets/pause.png');
  this.load.image('restartBtn', 'assets/restart.png');
  this.load.image('up', 'assets/up.png');
  this.load.image('noup', 'assets/noup.png');
}

function create() {
  base = this.add.rectangle(160,1005,153,93,0x0033aa);
  base.setStrokeStyle(2, 0x00aaff);

  this.input.on('pointerdown', (p) => onPointerDown(this, p));

  createUIButton(this, 'pauseBtn', 100, 1220, () => togglePause(this));
  createUIButton(this, 'restartBtn', 200, 1220, () => restartGame(this));

  startNextWave(this);
}

function createUIButton(scene, texture, x, y, onClick) {
  let btn = scene.add.image(x, y, texture).setScale(0.8).setInteractive();
  btn.on('pointerdown', onClick);
}

function restartGame(scene) {
  scene.scene.restart();
  gold = 100;
  wave = 0;
  isPaused = false;
}

function togglePause(scene) {
  isPaused = !isPaused;
  scene.physics.world.isPaused = isPaused;
}

function onPointerDown(scene, pointer) {
  let clickedTower = towers.find(t => Phaser.Math.Distance.Between(pointer.x, pointer.y, t.x, t.y) < 50);
  
  if (clickedTower) {
    // Улучшение башни
    if (gold >= 50) {
      gold -= 50;
      clickedTower.damage += 10;
      clickedTower.range += 20;
      clickedTower.indicator.setTexture('up');
    } else {
      clickedTower.indicator.setTexture('noup');
    }
  } else {
    // Создание новой башни
    let tower = scene.add.sprite(pointer.x, pointer.y, 'tower').setInteractive();
    tower.damage = 20;
    tower.range = 150;
    tower.nextShot = 0;
    tower.side = tower.x < config.width / 2 ? 'left' : 'right';
    if (tower.side === 'right') tower.flipX = true;

    tower.indicator = scene.add.image(tower.x, tower.y - 40, 'up').setScale(0.6);
    towers.push(tower);
  }
}

function spawnEnemy(scene) {
  let path = Phaser.Utils.Array.GetRandom(enemyPaths);
  let e = scene.physics.add.sprite(path[0][0], path[0][1], 'enemy');
  e.setScale(0.5);
  e.path = path;
  e.hp = 100 + wave * 10;
  e.speed = 0.8;
  e.targetIndex = 1;
  e.attacking = false;
  e.originalPath = path;
  e.attackCooldown = 0;
  enemies.push(e);
}

function moveEnemy(e) {
  if (!e.path || e.targetIndex >= e.path.length) return;

  let target = e.path[e.targetIndex];
  let dx = target[0] - e.x;
  let dy = target[1] - e.y;
  let dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 3) {
    e.targetIndex++;
  } else {
    e.x += (dx / dist) * e.speed;
    e.y += (dy / dist) * e.speed;
  }
}

function startNextWave(scene) {
  wave++;
  let count = 8 + Math.floor(wave * 1.5);

  for (let i = 0; i < count; i++) {
    scene.time.addEvent({
      delay: i * 1000,
      callback: () => spawnEnemy(scene)
    });
  }

  // Следующая волна через паузу
  scene.time.addEvent({
    delay: (count + 6) * 1000,
    callback: () => startNextWave(scene)
  });
}

function update(time, delta) {
  if (isPaused) return;

  // === Враги ===
  enemies.forEach((e) => {
    if (e.hp <= 0) {
      e.destroy();
      enemies = enemies.filter(en => en !== e);
      gold += 5;
      return;
    }

    // Радиус обзора
    let nearestTower = towers.find(t => Phaser.Math.Distance.Between(e.x, e.y, t.x, t.y) < 100);

    if (nearestTower) {
      e.setTexture('enemy_attack');
      if (e.attackCooldown < time) {
        e.attackCooldown = time + 800;
        nearestTower.hp = (nearestTower.hp || 100) - 5;
      }
    } else {
      e.setTexture('enemy');
      moveEnemy(e);
    }
  });

  // === Башни ===
  towers.forEach((t) => {
    let target = enemies.find(e => Phaser.Math.Distance.Between(t.x, t.y, e.x, e.y) < t.range);
    if (target && time > t.nextShot) {
      t.nextShot = time + 800;
      let p = game.scene.scenes[0].physics.add.image(t.x, t.y, 'projectile');
      projectiles.push({ sprite: p, target });
      t.setTexture('tower_attack');
    } else if (!target) {
      t.setTexture('tower');
    }
  });

  // === Снаряды ===
  projectiles.forEach((p, i) => {
    if (!p.target || !enemies.includes(p.target)) {
      p.sprite.destroy();
      projectiles.splice(i, 1);
      return;
    }
    let dx = p.target.x - p.sprite.x;
    let dy = p.target.y - p.sprite.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 8) {
      p.target.hp -= 10;
      p.sprite.destroy();
      projectiles.splice(i, 1);
    } else {
      p.sprite.x += dx / dist * 6;
      p.sprite.y += dy / dist * 6;
    }
  });
}
