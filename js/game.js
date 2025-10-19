
// js/game.js — Cambrussi Gear v10 (top-down lanes) — Cambrussi Games Inc.
(() => {
  'use strict';

  // Canvas & HUD
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d', { alpha:false });
  const HUD = {
    lives: document.getElementById('hudLives'),
    speed: document.getElementById('hudSpeed'),
    score: document.getElementById('hudScore'),
    time:  document.getElementById('hudTime'),
  };

  // Overlays
  const O = {
    menu: document.getElementById('overlayMenu'),
    pause: document.getElementById('overlayPause'),
    gameover: document.getElementById('overlayGameOver'),
    boardList: document.getElementById('boardList'),
    diffLabel: document.getElementById('diffLabel'),
    soundLabel: document.getElementById('soundLabel'),
    ctlLabel: document.getElementById('ctlLabel'),
    finalScore: document.getElementById('finalScore'),
    initials: document.getElementById('initials'),
  };

  // Simple audio manager using <audio> tags (mobile friendly)
  const Sound = {
    enabled: true,
    a: {},
    load(){
      const files = {
        start:'assets/sounds/start.wav',
        hit:'assets/sounds/hit.wav',
        coin:'assets/sounds/coin.wav',
        power:'assets/sounds/power.wav',
        pause:'assets/sounds/pause.wav',
        over:'assets/sounds/over.wav',
        lane:'assets/sounds/lane.wav',
        engine:'assets/sounds/engine.wav',
      };
      for(const k in files){
        const el = new Audio(files[k]);
        el.preload = 'auto';
        if(k==='engine'){ el.loop = true; el.volume = 0.18; }
        else el.volume = 0.35;
        this.a[k] = el;
      }
    },
    play(name){
      if(!this.enabled) return;
      const base = this.a[name]; if(!base) return;
      if(name==='engine'){
        if(base.paused) { try{ base.currentTime = 0; base.play(); }catch(e){} }
        return;
      }
      // clone to allow overlap
      const el = base.cloneNode();
      el.volume = base.volume;
      try{ el.play(); }catch(e){}
    },
    stop(name){
      const el=this.a[name]; if(el){ try{ el.pause(); }catch(e){} }
    },
    setEnabled(v){
      this.enabled = v;
      if(!v) this.stop('engine');
    },
    engineRate(r){
      const el=this.a.engine; if(!el) return;
      el.playbackRate = Math.min(2.0, Math.max(0.5, r));
    }
  };

  // Storage (leaderboard)
  const LS_KEY = 'cg_board_v2';
  const LS_BEST = 'cg_best_v2';
  function loadBoard(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch(e){ return []; } }
  function saveBoard(board){ try{ localStorage.setItem(LS_KEY, JSON.stringify(board.slice(0,10))); }catch(e){} }
  function updateBoardUI(){
    const board = loadBoard();
    O.boardList.innerHTML = '';
    board.slice(0,10).forEach((it,i)=>{
      const li = document.createElement('li');
      li.textContent = `${i+1}. ${it.name || '---'} — ${it.score}`;
      O.boardList.appendChild(li);
    });
  }

  // Canvas sizing
  let W=0,H=0,ratio=1;
  function resize(){
    ratio = window.devicePixelRatio||1;
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = Math.max(1, Math.floor(W*ratio));
    cvs.height = Math.max(1, Math.floor(H*ratio));
    cvs.style.width = W+'px'; cvs.style.height = H+'px';
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.imageSmoothingEnabled=false;
  }
  addEventListener('resize', resize, {passive:true});

  // Assets
  const A = {};
  const loadImage = (p)=> new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=p; });

  // Track
  const TRACK = {
    width:   0.74,
    lanes:   3,
    lineGap: 18,
    lineLen: 18,
    shoulder: 12,
  };
  function roadRect(){ const roadW=W*TRACK.width; const roadX=(W-roadW)/2; return {x:roadX,w:roadW}; }
  function laneCenterPx(l){ const r=roadRect(); const laneW=r.w/TRACK.lanes; return r.x + laneW*(l+0.5); }

  // Game state
  const STATE = { MENU:0, PLAY:1, PAUSE:2, OVER:3 };
  let state = STATE.MENU;
  let difficulty = 1; // 0 easy, 1 normal, 2 hard
  let lives = 3, score = 0, best = 0;
  let tStart=0;
  let shieldT=0, slowT=0;
  const traffic = []; // {lane, y, v, sprite, passed}
  const pickups = []; // {lane, y, type, sprite}
  const rnd = (a,b)=> a + Math.random()*(b-a);

  // Player
  const player = {
    lane: 1,
    x: 0,
    speed: 0,
    maxSpeed: 360,
    accel: 230,
    brake: 420,
    friction: 110,
    y: 0.82,
    sprite: 'carRed',
    targetLane: 1
  };

  // Controls mode
  // 0 = Swipe (recomendado p/ celular) | 1 = Botões (setas na tela)
  let controlsMode = 0;

  // Input
  const input = { left:false, right:false, accel:false, brake:false };
  function bindTouchButtons(btn){
    const act = btn.dataset.act; let pressing=false;
    const set=v=>{ input[act]=v; pressing=v; };
    const on = e=>{ set(true); e.preventDefault(); if(act==='left') laneLeft(); if(act==='right') laneRight(); };
    const off= e=>{ set(false); e.preventDefault(); };
    btn.addEventListener('touchstart',on,{passive:false});
    btn.addEventListener('touchend',off,{passive:false});
    btn.addEventListener('touchcancel',off,{passive:false});
    btn.addEventListener('mousedown',on);
    btn.addEventListener('mouseup',off);
    btn.addEventListener('mouseleave',()=>pressing&&off(new Event('mouseleave')));
  }
  function bindKeys(){
    const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'accel',KeyW:'accel',Space:'accel',ArrowDown:'brake',KeyS:'brake',KeyP:'pause',Escape:'pause'};
    addEventListener('keydown',e=>{
      const k=keyMap[e.code];
      if(k){
        if(k==='left') laneLeft();
        else if(k==='right') laneRight();
        else if(k==='pause') togglePause();
        else input[k]=true;
        e.preventDefault();
      }
    });
    addEventListener('keyup',e=>{ const k=keyMap[e.code]; if(k && k!=='pause'){ input[k]=false; e.preventDefault(); }});
  }
  // Swipe controls
  let swipeX=null, swipeY=null;
  addEventListener('touchstart', e=>{
    if(controlsMode!==0) return;
    if(!e.touches || !e.touches[0]) return;
    swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY;
  }, {passive:true});
  addEventListener('touchend', e=>{
    if(controlsMode!==0) return;
    const t = e.changedTouches && e.changedTouches[0]; if(!t) return;
    const dx = t.clientX - (swipeX||t.clientX);
    const dy = t.clientY - (swipeY||t.clientY);
    if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)){
      if(dx<0) laneLeft(); else laneRight();
    }
    // bottom right accel, bottom left brake (zones)
    const zoneY = window.innerHeight*0.65;
    if(t.clientY > zoneY){
      if(t.clientX > window.innerWidth*0.5) input.accel=true;
      else input.brake=true;
      setTimeout(()=>{ input.accel=false; input.brake=false; }, 120);
    }
  }, {passive:true});

  function laneLeft(){ player.targetLane = Math.max(0, player.targetLane-1); Sound.play('lane'); }
  function laneRight(){ player.targetLane = Math.min(TRACK.lanes-1, player.targetLane+1); Sound.play('lane'); }

  // Draw helpers
  function drawBackground(){
    const tile=A.bg;
    if(tile){
      const scale = Math.ceil( Math.max(W,H)/tile.width );
      for(let y=0;y<H;y+=tile.height*scale){
        for(let x=0;x<W;x+=tile.width*scale){
          ctx.drawImage(tile, x, y, tile.width*scale, tile.height*scale);
        }
      }
    } else {
      ctx.fillStyle='#0a1226'; ctx.fillRect(0,0,W,H);
    }
  }
  function drawTrack(){
    const r=roadRect();
    const shoulder=TRACK.shoulder;
    // Grass
    ctx.fillStyle='#0b3a29'; ctx.fillRect(0,0,W,H);
    // Shoulders
    ctx.fillStyle='#a22'; ctx.fillRect(r.x-shoulder,0,shoulder,H); ctx.fillRect(r.x+r.w,0,shoulder,H);
    // Road
    ctx.fillStyle='#2a2f3a'; ctx.fillRect(r.x,0,r.w,H);
    // Lanes
    ctx.strokeStyle='#f2f5ff'; ctx.lineWidth=3; ctx.setLineDash([TRACK.lineLen,TRACK.lineGap]);
    const laneW=r.w/TRACK.lanes;
    for(let i=1;i<TRACK.lanes;i++){ const x=r.x+laneW*i; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  function drawCar(key, cx, cy, scale){
    const img=A[key]; if(!img) return;
    const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
    const x=Math.round(cx - w/2), y=Math.round(cy - h/2);
    ctx.drawImage(img, x, y, w, h);
  }
  function drawSpriteImg(imgKey, cx, cy, scale){
    const img=A[imgKey]; if(!img) return;
    const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
    const x=Math.round(cx - w/2), y=Math.round(cy - h/2);
    ctx.drawImage(img, x, y, w, h);
  }
  // Title
  let fontReady=false; document.fonts && document.fonts.ready.then(()=>{fontReady=true;});
  function drawTitle(){
    ctx.save();
    ctx.textAlign='center'; ctx.fillStyle='#ff2d2d';
    ctx.shadowColor='#000'; ctx.shadowBlur=8; ctx.shadowOffsetY=2;
    const size=Math.max(18, Math.min(26, Math.floor(W*0.028)));
    ctx.font=`900 ${size}px "${fontReady?'Press Start 2P':'system-ui'}", system-ui, sans-serif`;
    ctx.fillText('Cambrussi Gear', W/2, 34);
    ctx.restore();
  }

  function drawShieldEffect(cx, cy, r){
    if(shieldT<=0) return;
    ctx.save();
    ctx.strokeStyle='rgba(120,200,255,0.7)';
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // Update loop
  function spawnTraffic(dt){
    const rel = player.speed/300;
    const base = 0.9 - difficulty*0.18;
    const interval = Math.max(0.25, base / Math.max(0.6, rel+0.4));
    spawnTraffic.acc = (spawnTraffic.acc||0) + dt;
    if(spawnTraffic.acc>=interval){
      spawnTraffic.acc=0;
      const lane = (Math.random()*TRACK.lanes)|0;
      const sprites=['carYellow','carPurple','carGreen'];
      traffic.push({ lane, y: -0.2, v: 0.08 + Math.random()*0.16 + difficulty*0.03, sprite: sprites[(Math.random()*sprites.length)|0], passed:false });
    }
  }
  function spawnPickup(dt){
    const p = 0.35 - difficulty*0.08;
    if(Math.random() < (p*dt)){
      const lane = (Math.random()*TRACK.lanes)|0;
      const types = [
        {t:'coin', sprite:'pu_coin'},
        {t:'shield', sprite:'pu_shield'},
        {t:'slow', sprite:'pu_slow'},
        {t:'life', sprite:'pu_life'},
      ];
      const it = types[(Math.random()*types.length)|0];
      pickups.push({ lane, y: -0.2, type: it.t, sprite: it.sprite });
    }
  }

  function collideCars(){
    const py = H*player.y;
    const carH = Math.max(24, W*0.06);
    for(const c of traffic){
      if(c.lane!==player.lane) continue;
      const cy=H*c.y;
      if(Math.abs(cy - py) < carH*0.5){
        if(shieldT>0){
          c.y = 2;
          Sound.play('hit');
          score += 150;
        }else{
          player.speed *= 0.55;
          lives -= 1;
          Sound.play('hit');
          shieldT = 0;
          if(lives<=0){ gameOver(); return; }
        }
      }
    }
  }

  function pickupItems(){
    const py = H*player.y;
    const carH = Math.max(24, W*0.06);
    for(let i=pickups.length-1;i>=0;i--){
      const p = pickups[i];
      if(p.lane!==player.lane) continue;
      const cy = H*p.y;
      if(Math.abs(cy - py) < carH*0.5){
        if(p.type==='coin'){ score += 50; Sound.play('coin'); }
        else if(p.type==='shield'){ shieldT = 5.0; Sound.play('power'); }
        else if(p.type==='slow'){ slowT = 3.5; Sound.play('power'); }
        else if(p.type==='life'){ lives = Math.min(5, lives+1); Sound.play('power'); }
        pickups.splice(i,1);
      }
    }
  }

  function gameOver(){
    state = STATE.OVER;
    O.finalScore.textContent = String(score|0);
    showOverlay('gameover');
    Sound.play('over');
    Sound.stop('engine');
  }

  function update(dt){
    if(state!==STATE.PLAY) return;

    // timers
    if(shieldT>0) shieldT-=dt;
    if(slowT>0)   slowT-=dt;

    // speed control
    const accelBoost = input.accel? 1.3 : 1.0;
    const slowMul = slowT>0? 0.6 : 1.0;
    const effAccel = player.accel*accelBoost*slowMul;
    const effBrake = player.brake;
    const effFric  = player.friction*(slowT>0? 1.25:1.0);

    if(input.accel) player.speed += effAccel*dt; else player.speed -= effFric*dt;
    if(input.brake) player.speed -= effBrake*dt;

    const diffCap = [320, 360, 400][difficulty] || 360;
    player.speed = Math.max(0, Math.min(player.speed, diffCap));

    // lane change with no overshoot (fix jitter) + snap when close
    {
      const delta = player.targetLane - player.lane;
      const step = 10 * dt; // lane change speed
      if (Math.abs(delta) <= step) player.lane = player.targetLane;
      else player.lane += Math.sign(delta) * step;
      // clamp + final snap
      if (Math.abs(player.lane - player.targetLane) < 1e-3) player.lane = player.targetLane;
      player.lane = Math.max(0, Math.min(TRACK.lanes-1, player.lane));
    }
    // fine offset back to center
    player.x = (Math.abs(player.x)<0.02)?0: (player.x*0.85);

    // spawn & move traffic
    spawnTraffic(dt);
    spawnPickup(dt);
    const worldScroll = (player.speed/320) * (slowT>0?0.7:1);
    for(const c of traffic){
      c.y += (worldScroll + c.v) * dt;
      if(!c.passed && c.y > player.y){ c.passed=true; score += 20; }
    }
    for(let i=traffic.length-1;i>=0;i--){ if(traffic[i].y > 1.2) traffic.splice(i,1); }
    for(const p of pickups){ p.y += (worldScroll+0.12)*dt; }
    for(let i=pickups.length-1;i>=0;i--){ if(pickups[i].y > 1.2) pickups.splice(i,1); }

    // collisions
    collideCars();
    pickupItems();

    // score by distance
    score += (player.speed*dt*0.4)|0;

    // engine sound rate
    Sound.engineRate(0.6 + player.speed/300);
  }

  function drawHUD(){
    HUD.lives.textContent = '♥'.repeat(lives);
    HUD.speed.textContent = `SPD ${String(player.speed | 0).padStart(3, '0')}`;
    HUD.score.textContent = `SCORE ${String(score | 0).padStart(6, '0')}`;
    HUD.time.textContent = ( ()=>{
      const ms=performance.now()-tStart; const t=ms|0, m=((t/60000)|0), s=((t/1000)%60)|0, ms3=t%1000;
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms3).padStart(3,'0')}`;
    })();
  }

  // Title
  function drawTitle(){
    ctx.save();
    ctx.textAlign='center'; ctx.fillStyle='#ff2d2d';
    ctx.shadowColor='#000'; ctx.shadowBlur=8; ctx.shadowOffsetY=2;
    const size=Math.max(18, Math.min(26, Math.floor(W*0.028)));
    ctx.font=`900 ${size}px "${document.fonts?'Press Start 2P':'system-ui'}", system-ui, sans-serif`;
    ctx.fillText('Cambrussi Gear', W/2, 34);
    ctx.restore();
  }

  function render(){
    ctx.clearRect(0,0,W,H);
    // bg & track
    drawBackground();
    drawTrack();
    // pickups
    const scale = Math.max(1, Math.floor(W*0.05/16));
    for(const p of pickups){
      const cx = laneCenterPx(p.lane);
      const cy = H*p.y;
      drawSpriteImg(p.sprite, cx, cy, scale);
    }
    // traffic
    const sCar = Math.max(1, Math.floor(W*0.06/16));
    for(const c of traffic){
      const cx = laneCenterPx(c.lane);
      const cy = H*c.y;
      drawCar(c.sprite, cx, cy, sCar);
    }
    // player
    const playerCX = laneCenterPx(player.lane);
    const playerCY = H*player.y;
    // pixel snapping already inside drawCar, values can be float here
    drawCar(player.sprite, playerCX, playerCY, sCar);
    drawShieldEffect(playerCX, playerCY, sCar*12);

    drawTitle();
    drawHUD();
  }

  function loop(ts){
    const now = ts;
    const dt = Math.min(0.033, (now - loop.last) / 1000);
    loop.last = now;
    if(state===STATE.PLAY) update(dt);
    render();
    requestAnimationFrame(loop);
  }
  loop.last = performance.now();

  // UI helpers
  function showOverlay(name){
    O.menu.classList.add('hidden');
    O.pause.classList.add('hidden');
    O.gameover.classList.add('hidden');
    if(name==='menu') O.menu.classList.remove('hidden');
    if(name==='pause') O.pause.classList.remove('hidden');
    if(name==='gameover') O.gameover.classList.remove('hidden');
  }
  function toMenu(){
    state = STATE.MENU;
    showOverlay('menu');
    updateBoardUI();
    O.ctlLabel.textContent = controlsMode===0? 'Swipe':'Botões';
  }
  function startGame(){
    lives = 3; score = 0; player.speed = 0; shieldT=0; slowT=0;
    player.lane = 1; player.targetLane = 1; traffic.length=0; pickups.length=0;
    best = parseInt(localStorage.getItem('cg_best_v2')||'0',10);
    tStart = performance.now();
    state = STATE.PLAY;
    showOverlay('');
    Sound.play('start');
    Sound.play('engine');
  }
  function togglePause(){
    if(state===STATE.PLAY){ state=STATE.PAUSE; showOverlay('pause'); Sound.play('pause'); Sound.stop('engine'); }
    else if(state===STATE.PAUSE){ state=STATE.PLAY; showOverlay(''); Sound.play('pause'); Sound.play('engine'); }
  }
  function changeDifficulty(){
    difficulty = (difficulty+1)%3;
    O.diffLabel.textContent = ['Fácil','Normal','Difícil'][difficulty];
  }
  function toggleSound(){
    Sound.setEnabled(!Sound.enabled);
    O.soundLabel.textContent = Sound.enabled? 'On':'Off';
    if(Sound.enabled) Sound.play('start');
  }
  function toggleControls(){
    controlsMode = (controlsMode+1)%2;
    O.ctlLabel.textContent = controlsMode===0? 'Swipe':'Botões';
    document.querySelector('.controls').style.display = controlsMode===1? 'grid':'none';
  }
  function restart(){ startGame(); }
  function backToMenu(){ toMenu(); }

  // Overlay buttons
  addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-cmd]');
    if(!btn) return;
    const cmd = btn.dataset.cmd;
    if(cmd==='start') startGame();
    else if(cmd==='difficulty') changeDifficulty();
    else if(cmd==='sound') toggleSound();
    else if(cmd==='controls') toggleControls();
    else if(cmd==='credits') { alert('Cambrussi Gear — Cambrussi Games Inc.'); }
    else if(cmd==='resume') togglePause();
    else if(cmd==='restart') restart();
    else if(cmd==='menu') backToMenu();
    else if(cmd==='saveScore'){
      const name = (O.initials.value||'---').slice(0,8);
      const board = loadBoard();
      board.push({name, score: score|0});
      board.sort((a,b)=>b.score-a.score);
      saveBoard(board);
      localStorage.setItem('cg_best_v2', String(Math.max(best, score|0)));
      O.initials.value='';
      updateBoardUI();
      backToMenu();
    }
  });

  // Bind inputs
  document.querySelectorAll('.controls .btn').forEach(bindTouchButtons);
  bindKeys();

  // Public API
  async function load(){
    [A.bg, A.carRed, A.carYellow, A.carPurple, A.carGreen, A.pu_shield, A.pu_slow, A.pu_life, A.pu_coin] = await Promise.all([
      loadImage('assets/bg_tile.png'),
      loadImage('assets/car_red.png'),
      loadImage('assets/car_yellow.png'),
      loadImage('assets/car_purple.png'),
      loadImage('assets/car_green.png'),
      loadImage('assets/pu_shield.png'),
      loadImage('assets/pu_slow.png'),
      loadImage('assets/pu_life.png'),
      loadImage('assets/pu_coin.png'),
      (document.fonts? document.fonts.ready : Promise.resolve())
    ]);
    Sound.load();
  }

  window.__miniGame = {
    async start(){
      resize(); await load();
      toMenu();
      requestAnimationFrame(loop);
    }
  };
})();
