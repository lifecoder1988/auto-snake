'use strict';

document.addEventListener('DOMContentLoaded', () => {
  /** ========= 可调参数 ========= */
  let stepMs = 150;           // 步进间隔（可调）
  const SHOW_PATH = true;     // 显示哈密顿路径

  /** ========= 变量 ========= */
  const sizeEl = document.getElementById('size');
  const speedEl = document.getElementById('speed');
  const speedValEl = document.getElementById('speedVal');
  const elapsedEl = document.getElementById('elapsed');
  let WORLD_SIZE = parseInt(sizeEl?.value || '6', 10);
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let CELL_SIZE = 0;

  const North = 'North';
  const South = 'South';
  const West  = 'West';
  const East  = 'East';

  const DIRECTION = [
    [0, 1, North],
    [0,-1, South],
    [-1,0, West],
    [1, 0, East]
  ];

  let mapGrid = [];     // map[x][y] = {next:[dx,dy,name], optional:[], id:number}
  let snake = [];       // [[x,y], ...] 头在前
  let apple = null;     // [ax,ay]
  let x = 0, y = 0;     // 蛇头坐标
  let timer = null;     // 定时器
  let running = false;
  const stepsEl = document.getElementById('steps');
  let steps = 0;        // 累计步数
  let elapsedMs = 0;    // 本次运行累计毫秒
  let lastTickAt = null; // 上次计时刻

  function updateElapsedUI(){
    if(elapsedEl) elapsedEl.textContent = (elapsedMs/1000).toFixed(1);
  }

  /** ========= 画布自适应 ========= */
  function resizeCanvas(){
    const dpr = window.devicePixelRatio || 1;
    // 优先使用 CSS 实际宽度；回退为视口宽度的估计值
    const fallback = Math.min(600, Math.max(240, document.documentElement.clientWidth - 32));
    const cssWidth = canvas.clientWidth || fallback;
    canvas.width  = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssWidth * dpr);
    CELL_SIZE = canvas.width / WORLD_SIZE;
  }

  /** ========= 工具 ========= */
  function gridToCanvas(gx, gy){
    const cx = gx * CELL_SIZE + CELL_SIZE/2;
    const cy = (WORLD_SIZE - 1 - gy) * CELL_SIZE + CELL_SIZE/2;
    return [cx, cy];
  }
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

  /** ========= 视觉绘制 ========= */
  function drawGrid(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = '#e6e6e6';
    for(let i=0;i<=WORLD_SIZE;i++){
      ctx.beginPath();
      ctx.moveTo(i*CELL_SIZE,0);
      ctx.lineTo(i*CELL_SIZE,WORLD_SIZE*CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0,i*CELL_SIZE);
      ctx.lineTo(WORLD_SIZE*CELL_SIZE,i*CELL_SIZE);
      ctx.stroke();
    }
  }
  function drawHamiltonianPath(){
    if(!SHOW_PATH) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,140,255,0.35)';
    ctx.beginPath();
    for(let ix=0; ix<WORLD_SIZE; ix++){
      for(let iy=0; iy<WORLD_SIZE; iy++){
        const cell = mapGrid[ix][iy];
        const [cx,cy] = gridToCanvas(ix,iy);
        const nx = ix + cell.next[0];
        const ny = iy + cell.next[1];
        const [nxC, nyC] = gridToCanvas(nx,ny);
        ctx.moveTo(cx,cy);
        ctx.lineTo(nxC,nyC);
      }
    }
    ctx.stroke();
  }
  function drawApple(){
    if(!apple) return;
    const [ax,ay] = apple;
    const [cx,cy] = gridToCanvas(ax,ay);
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(6, CELL_SIZE/6), 0, Math.PI*2);
    ctx.fill();
  }
  function drawSnake(){
    ctx.fillStyle = '#34c759';
    for(const [sx,sy] of snake){
      const xPx = sx*CELL_SIZE + 4;
      const yPx = (WORLD_SIZE-1-sy)*CELL_SIZE + 4;
      ctx.fillRect(xPx, yPx, CELL_SIZE-8, CELL_SIZE-8);
    }
    if(snake.length){
      const [hx,hy] = snake[0];
      ctx.fillStyle = '#0b8f34';
      const xPx = hx*CELL_SIZE + 6;
      const yPx = (WORLD_SIZE-1-hy)*CELL_SIZE + 6;
      ctx.fillRect(xPx, yPx, CELL_SIZE-12, CELL_SIZE-12);
    }
  }
  function render(){
    drawGrid();
    drawHamiltonianPath();
    drawApple();
    drawSnake();
  }

  /** ========= 贪吃蛇核心逻辑 ========= */
  function nextStep(px,py){
    if (px===0 && py===0) return [px,py+1,DIRECTION[0]];
    if (px===0 && py===WORLD_SIZE-1) return [px+1,py,DIRECTION[3]];
    if (px===WORLD_SIZE-1 && py===WORLD_SIZE-1) return [px,py-1,DIRECTION[1]];
    if (px===0) return [px,py+1,DIRECTION[0]];
    if (py===0) return [px-1,py,DIRECTION[2]];
    if (py%2===1){
      if (px!==WORLD_SIZE-1) return [px+1,py,DIRECTION[3]];
      else return [px,py-1,DIRECTION[1]];
    } else {
      if (px!==1) return [px-1,py,DIRECTION[2]];
      else return [px,py-1,DIRECTION[1]];
    }
  }
  function get_option_dirs(px,py,nx,ny,next_dir){
    const ans = [];
    for(const dir of DIRECTION){
      if (px+dir[0]===nx && py+dir[1]===ny) continue;
      if (dir===next_dir) continue;
      ans.push(dir);
    }
    return ans;
  }
  function init_map(){
    const m = Array.from({length: WORLD_SIZE},()=>Array.from({length: WORLD_SIZE},()=>({next:null,optional:[],id:0})));
    let cx=0, cy=0, i=0;
    while(i < WORLD_SIZE*WORLD_SIZE){
      const [nx,ny,dir] = nextStep(cx,cy);
      m[cx][cy].id = i;
      m[cx][cy].next = dir;
      m[cx][cy].optional = get_option_dirs(cx,cy,nx,ny,dir);
      i++;
      cx = nx; cy = ny;
    }
    return m;
  }
  function apple_distance(pid,aid){
    const total = WORLD_SIZE*WORLD_SIZE;
    return aid>=pid ? (aid-pid) : (aid+total-pid);
  }
  function find_position(px,py){
    for(let i=0;i<snake.length;i++){
      if(snake[i][0]===px && snake[i][1]===py) return snake.length - i - 1;
    }
    return -1;
  }
  function has_safe_route(px,py){
    const l = snake.length;
    let i = 0;
    while(i < l){
      const pos = find_position(px,py);
      if(pos===-1 || pos<=i){
        const nx = px + mapGrid[px][py].next[0];
        const ny = py + mapGrid[px][py].next[1];
        px = nx; py = ny;
        i++;
      }else{
        return false;
      }
    }
    return true;
  }
  function plan(px,py,ax,ay){
    const dis = apple_distance(mapGrid[px][py].id, mapGrid[ax][ay].id);
    for(const dir of mapGrid[px][py].optional){
      const nx = px + dir[0], ny = py + dir[1];
      if(nx<0||nx>=WORLD_SIZE||ny<0||ny>=WORLD_SIZE) continue;
      const dis2 = apple_distance(mapGrid[nx][ny].id, mapGrid[ax][ay].id);
      if(dis2 < dis && has_safe_route(nx,ny)){
        return [nx,ny];
      }
    }
    const nx = px + mapGrid[px][py].next[0];
    const ny = py + mapGrid[px][py].next[1];
    return [nx,ny];
  }

  /** ========= 苹果生成（不落蛇身） ========= */
  function generateApple(){
    const free = [];
    for(let i=0;i<WORLD_SIZE;i++){
      for(let j=0;j<WORLD_SIZE;j++){
        const onSnake = snake.some(([sx,sy])=>sx===i && sy===j);
        if(!onSnake) free.push([i,j]);
      }
    }
    if(!free.length) return null;
    return free[Math.floor(Math.random()*free.length)];
  }

  /** ========= 游戏状态控制 ========= */
  function resetGame(keepSize=false){
    if(!keepSize){
      WORLD_SIZE = parseInt(sizeEl.value,10);
    }
    resizeCanvas();
    x = 0; y = 0;
    snake = [[x,y]];
    mapGrid = init_map();
    apple = generateApple();
    steps = 0;
    if(stepsEl) stepsEl.textContent = '0';
    elapsedMs = 0;
    lastTickAt = null;
    updateElapsedUI();
    render();
  }
  function step(){
    if(lastTickAt !== null){
      const now = performance.now();
      elapsedMs += (now - lastTickAt);
      lastTickAt = now;
      updateElapsedUI();
    }
    if(!apple) { render(); return; }
    const [nx,ny] = plan(x,y, apple[0],apple[1]);
    x = clamp(nx, 0, WORLD_SIZE-1);
    y = clamp(ny, 0, WORLD_SIZE-1);

    if(x===apple[0] && y===apple[1]){
      snake.unshift([x,y]);
      apple = generateApple();
    }else{
      snake.unshift([x,y]);
      snake.pop();
    }
    steps += 1;
    if(stepsEl) stepsEl.textContent = String(steps);
    render();
    if(snake.length === WORLD_SIZE*WORLD_SIZE){
      running = false;
      clearInterval(timer);
      document.getElementById('pause').disabled = true;
      lastTickAt = null;
      alert('🍎 全部吃完！');
    }
  }

  /** ========= 事件绑定 ========= */
  document.getElementById('start').addEventListener('click', ()=>{
    if(running) return;
    running = true;
    document.getElementById('pause').disabled = false;
    lastTickAt = performance.now();
    timer = setInterval(step, stepMs);
  });
  document.getElementById('pause').addEventListener('click', ()=>{
    if(!running) return;
    running = false;
    document.getElementById('pause').disabled = true;
    clearInterval(timer);
    lastTickAt = null;
  });
  document.getElementById('reset').addEventListener('click', ()=>{
    running = false;
    clearInterval(timer);
    document.getElementById('pause').disabled = true;
    resetGame(false);
  });
  sizeEl.addEventListener('change', ()=>{
    running = false;
    clearInterval(timer);
    document.getElementById('pause').disabled = true;
    resetGame(false);
  });

  // 速度滑杆：更新间隔与显示；运行中动态生效
  const initSpeed = parseInt(speedEl?.value || '150', 10);
  if(!Number.isNaN(initSpeed)) {
    stepMs = initSpeed;
    if(speedValEl) speedValEl.textContent = String(stepMs);
  }
  speedEl?.addEventListener('input', ()=>{
    const val = parseInt(speedEl.value, 10);
    if(Number.isNaN(val)) return;
    stepMs = val;
    if(speedValEl) speedValEl.textContent = String(stepMs);
    if(running){
      clearInterval(timer);
      lastTickAt = performance.now();
      timer = setInterval(step, stepMs);
    }
  });

  window.addEventListener('resize', ()=>{
    resizeCanvas();
    render();
  });

  /** ========= 初始化 ========= */
  resetGame(false);
});