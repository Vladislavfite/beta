// === Tower Defense — Core Main File ===

const GAME_WIDTH = 720;
const GAME_HEIGHT = 1280;
const TOWER_COST = 100;
const UPGRADE_COST_BASE = 150;
const ENEMY_SPEED = 0.45;
const TOWER_RANGE = 210;
const KILL_REWARD = 15;
let gold = 300;
let baseHP = 1000;
let enemies = [];
let bullets = [];
let towers = [];
let buildSprites = [];
let ui = {};

const BUILD_SPOTS = [
  [200, 800],
  [300, 700],
  [400, 900],
  [500, 1000],
  [600, 750],
];

const SPAWNS = [
  [[377,50],[429,138],[410,189],[346,224],[311,257],[290,305],[331,354],[400,463],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[81,335],[189,359],[331,354],[400,463],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[636,490],[544,498],[413,491],[425,542],[397,608],[349,663],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[52,667],[168,691],[289,700],[347,736],[365,808],[375,901],[446,1024],[441,1069],[312,1082],[226,1059]],
  [[646,963],[565,1029],[441,1069],[312,1082],[226,1059]]
];

const BASE_AREA = { x:160, y:1005, w:153, h:93 };

// ========================
// Phaser config
// ========================
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game",
  backgroundColor: "#222",
  scene: { preload, create, update },
};
new Phaser.Game(config);

// ========================
// Preload
// ========================
function preload() {
  this.load.image('noup_icon','assets/ui/noup.png');
  this.load.image('up_icon','assets/ui/up.png');
  this.load.image('bullet','assets/bullet.png');
  this.load.image('hammer','assets/ui/hammer.png');
  this.load.spritesheet('enemy','assets/enemy/enemy_walk.png',{ frameWidth:64, frameHeight:64 });
  this.load.spritesheet('enemy_attack','assets/enemy/enemy_attack.png',{ frameWidth:64, frameHeight:64 });
  this.load.spritesheet('enemy_die','assets/enemy/die_enemy/dead1.png',{ frameWidth:64, frameHeight:64 });
  for(let i=1;i<=12;i++){
    this.load.spritesheet(`tower${i}_idle_1`,`assets/attacktower/statik/tower${i}/stower1.png`,{frameWidth:64,frameHeight:64});
    this.load.spritesheet(`tower${i}_atk_1`,`assets/attacktower/attack/tower${i}/tower1.png`,{frameWidth:64,frameHeight:64});
  }
}

// ========================
// Create
// ========================
function create() {
  ui.goldText = this.add.text(20, 20, 'Gold:' + gold, { fontSize: '24px', fill: '#fff' });
  ui.baseHP = this.add.text(20, 50, 'Base HP:' + baseHP, { fontSize: '24px', fill: '#ff8080' });

  // Build spots
  BUILD_SPOTS.forEach((p,i)=>{
    const s = this.add.sprite(p[0],p[1],'hammer').setInteractive().setScale(0.8);
    s.on('pointerdown',()=>buildTower(this,i));
    buildSprites[i]=s;
  });

  // Enemy spawn loop
  this.time.addEvent({ delay:1000, loop:true, callback:()=>{
    const sp = Phaser.Math.Between(0,SPAWNS.length-1);
    spawnEnemy(this, sp);
  }});
}

// ========================
// Update
// ========================
function update() {
  enemies.forEach(e => updateEnemy(this,e));
  bullets.forEach(b => updateBullet(this,b));
}

// ========================
// Enemies
// ========================
function spawnEnemy(scene, spawnIndex){
  const path = SPAWNS[spawnIndex];
  const e = scene.add.sprite(path[0][0], path[0][1], 'enemy').setScale(0.5);
  e.hp = 100;
  e.pathIndex = 0;
  e.path = path;
  e.target = null;
  e.speed = ENEMY_SPEED;
  enemies.push(e);
}

function updateEnemy(scene,e){
  if(!e.active)return;
  if(e.hp<=0){
    if (e && e.clearTint) e.clearTint();
    e.destroy();
    enemies = enemies.filter(en=>en!==e);
    gold+=KILL_REWARD;
    ui.goldText.setText('Gold:'+gold);
    return;
  }

  if(e.target && e.target.active){
    const dx=e.target.x-e.x, dy=e.target.y-e.y, dist=Math.hypot(dx,dy);
    if(dist<30){
      if(e && e.setTint) e.setTint(0xff0000);
      setTimeout(()=>{
        if (e && e.active && typeof e.clearTint==='function') e.clearTint();
      },80);
      e.target.hp-=10;
      if(e.target.hp<=0){
        e.target.destroy();
        if(e.target.upIcon)e.target.upIcon.destroy();
        e.target=null;
      }
    }else{
      e.x+=dx/dist*e.speed;
      e.y+=dy/dist*e.speed;
    }
    return;
  }

  const nearTower=towers.find(t=>Phaser.Math.Distance.Between(e.x,e.y,t.sprite.x,t.sprite.y)<100);
  if(nearTower)e.target=nearTower.sprite;
  else{
    const p=e.path[e.pathIndex+1];
    if(p){
      const dx=p[0]-e.x, dy=p[1]-e.y, dist=Math.hypot(dx,dy);
      if(dist<3)e.pathIndex++;
      else{ e.x+=dx/dist*e.speed; e.y+=dy/dist*e.speed; }
    }else{
      const bx=BASE_AREA.x, by=BASE_AREA.y;
      const dist=Phaser.Math.Distance.Between(e.x,e.y,bx,by);
      if(dist<50){
        if(e && e.setTint) e.setTint(0xff4444);
        setTimeout(()=>{
          if (e && e.active && typeof e.clearTint==='function') e.clearTint();
        },80);
        baseHP-=10;
        ui.baseHP.setText('Base HP:'+baseHP);
        if(baseHP<=0){ alert('Base destroyed!'); scene.scene.restart(); }
      }else{
        const dx=bx-e.x, dy=by-e.y;
        e.x+=dx/dist*e.speed; e.y+=dy/dist*e.speed;
      }
    }
  }
}

// ========================
// Bullets
// ========================
function updateBullet(scene,b){
  if(!b.active)return;
  const tgt=b.target;
  if(!tgt||!tgt.active){ b.destroy(); return; }
  const dx=tgt.x-b.x, dy=tgt.y-b.y, dist=Math.hypot(dx,dy);
  if(dist<8){
    tgt.hp-=b.damage;
    if (tgt && tgt.setTint) tgt.setTint(0xffcccc);
    setTimeout(()=>{
      if (tgt && tgt.active && typeof tgt.clearTint==='function') tgt.clearTint();
    },60);
    b.destroy();
    return;
  }
  b.x+=dx/dist*6; b.y+=dy/dist*6;
}

// ========================
// Towers — build & upgrade
// ========================
function buildTower(scene,index){
  if(index<0||index>=BUILD_SPOTS.length)return;
  if(!buildSprites[index])return;
  if(gold<TOWER_COST){ alert('Not enough gold'); return; }
  const pos=BUILD_SPOTS[index];
  buildSprites[index].destroy(); buildSprites[index]=null;
  gold-=TOWER_COST; ui.goldText.setText('Gold:'+gold);

  const ts=scene.add.sprite(pos[0],pos[1],`tower1_idle_1`).setInteractive();
  ts.setDepth(5);
  ts.hp=50; ts.level=1; ts._typeKey='tower1'; ts._isAttacking=false; ts._lastShot=0;
  ts._shootRate=450; ts._range=TOWER_RANGE; ts._damage=3*ts.level;

  if(scene.textures.exists('up_icon')&&scene.textures.exists('noup_icon'))
    ts.upIcon=scene.add.image(pos[0]-28,pos[1]+40,'noup_icon').setScale(0.6).setDepth(6);

  const idleAnimKey=`${ts._typeKey}_idle_anim`;
  if(scene.anims.exists(idleAnimKey))ts.play(idleAnimKey);

  const upgradeHandler=()=>upgradeTower(scene,ts);
  ts.on('pointerdown',upgradeHandler);
  towers.push({sprite:ts,upgradeHandler});
  ts.setFlipX(ts.x>360);
}

function upgradeTower(scene,ts){
  if(!ts||!ts._typeKey)return;
  let curNum=parseInt(ts._typeKey.replace(/[^0-9]/g,''))||1;
  if(curNum>=12)return;
  const nextLevel=curNum+1;
  const cost=UPGRADE_COST_BASE*nextLevel;
  if(gold<cost){ alert('Need '+cost+' gold'); return; }
  gold-=cost; ui.goldText.setText('Gold:'+gold);
  ts._typeKey='tower'+nextLevel; ts.level=nextLevel;
  ts._range=Math.min(300,ts._range+30); ts._shootRate=Math.max(200,ts._shootRate-100);
  ts._damage=3*ts.level; ts.hp+=50;

  const idleAnim=`${ts._typeKey}_idle_anim`;
  if(scene.anims.exists(idleAnim)) ts.play(idleAnim);
  if(nextLevel>=12){
    if(ts.upIcon) ts.upIcon.setVisible(false);
    ts.removeAllListeners('pointerdown');
  }
}
