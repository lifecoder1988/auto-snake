const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let GRID = 20; // 网格大小（建议偶数）
let PIX = canvas.width / GRID;
let SPEED = 10; // 每步间隔(ms)
let snake = [];
let apple = { x: 0, y: 0 };
let hamiltonian = [];
let indexMap = [];
let score = 0;
let running = true;
const SMART_MODE_LEN = GRID; // 短蛇阈值：长度小于网格宽度时走曼哈顿贪心
let loopTimer = null; // 定时器句柄
// 计划器状态：当前到苹果的计划路径（逐步执行），为空表示使用环或贪心
let plan = [];
let plannedForAppleIndex = -1;
/**
 * 初始化游戏
 */
function init() {
    hamiltonian = buildHamiltonianCycle(GRID);
    indexMap = buildIndexMap(hamiltonian, GRID);
    snake = [hamiltonian[0]];
    apple = randomApple();
    score = 0;
    running = true;
    draw();
    loop();
}
function setTick(ms) {
    const n = Math.max(1, Math.floor(ms));
    SPEED = n;
}
function restartWithGrid(n) {
    if (n % 2 !== 0) return; // 仅支持偶数网格
    GRID = n;
    PIX = canvas.width / GRID;
    // 清理老循环
    if (loopTimer) {
        clearTimeout(loopTimer);
        loopTimer = null;
    }
    // 重新初始化
    plan = [];
    plannedForAppleIndex = -1;
    init();
}
let controlsInitialized = false;
function setupHUDControls() {
    if (controlsInitialized) return;
    const gridSel = document.getElementById("gridSelect");
    const tickSel = document.getElementById("tickSelect");
    if (gridSel) {
        gridSel.value = String(GRID);
        gridSel.addEventListener("change", (e) => {
            const val = parseInt(e.target.value, 10);
            restartWithGrid(val);
        });
    }
    if (tickSel) {
        tickSel.value = String(SPEED);
        tickSel.addEventListener("change", (e) => {
            const val = parseInt(e.target.value, 10);
            setTick(val);
        });
    }
    controlsInitialized = true;
}
/**
 * 构建 Hamiltonian Cycle（闭环）
 * 思路：蛇形扫描 + 最后连回起点
 * 适用于偶数网格（如 20×20）
 */
function buildHamiltonianCycle(n) {
    if (n % 2 !== 0) {
        throw new Error("GRID 必须为偶数以构造有效哈密顿闭环");
    }
    const path = [];
    // 顶行：x=0..n-1
    for (let x = 0; x < n; x++) {
        path.push({ x, y: 0 });
    }
    // 行 1..n-1：仅遍历 x=1..n-1，奇偶行交替方向，保证与上一行相邻
    for (let y = 1; y < n; y++) {
        if (y % 2 === 1) {
            for (let x = n - 1; x >= 1; x--) {
                path.push({ x, y });
            }
        }
        else {
            for (let x = 1; x < n; x++) {
                path.push({ x, y });
            }
        }
    }
    // 最后补列 x=0：从底到上 y=n-1..1，使尾部在 (0,1)
    for (let y = n - 1; y >= 1; y--) {
        path.push({ x: 0, y });
    }
    return path;
}
/**
 * 构建坐标索引映射
 */
function buildIndexMap(path, n) {
    const map = Array.from({ length: n }, () => Array(n).fill(-1));
    path.forEach((p, i) => (map[p.y][p.x] = i));
    return map;
}
/**
 * 随机生成苹果（不能在蛇身上）
 */
function randomApple() {
    let p;
    do {
        p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (snake.some(s => s.x === p.x && s.y === p.y));
    // 新苹果生成时清空计划
    plan = [];
    plannedForAppleIndex = -1;
    return p;
}
/**
 * 绘制游戏画面
 */
function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 画苹果
    ctx.fillStyle = "#ff3b3b";
    ctx.fillRect(apple.x * PIX, apple.y * PIX, PIX - 1, PIX - 1);
    // 画蛇
    for (let i = 0; i < snake.length; i++) {
        ctx.fillStyle = i === 0 ? "#00ff88" : "#00cc66";
        const s = snake[i];
        ctx.fillRect(s.x * PIX, s.y * PIX, PIX - 1, PIX - 1);
    }
    const scoreEl = document.getElementById("score");
    const lenEl = document.getElementById("len");
    const speedEl = document.getElementById("speed");
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (lenEl) lenEl.textContent = `Len: ${snake.length}`;
    if (speedEl) speedEl.textContent = `Tick: ${SPEED}ms`;
    setupHUDControls();
}
/**
 * 获取某格在环上的索引
 */
function indexOf(p) {
    return indexMap[p.y][p.x];
}
/**
 * 获取环上的下一个点
 */
function nextOnCycle(p) {
    const i = indexOf(p);
    return hamiltonian[(i + 1) % hamiltonian.length];
}
// 环上的前向距离
function cycleDistance(aIdx, bIdx) {
    const L = hamiltonian.length;
    return (bIdx - aIdx + L) % L;
}
// 苹果是否在“前方”：头->苹果 的环距小于 头->尾 的环距
function isAheadOnCycle(headIdx, appleIdx, tailIdx) {
    return cycleDistance(headIdx, appleIdx) < cycleDistance(headIdx, tailIdx);
}

// 曼哈顿距离
function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
// 选择朝苹果迈出的第一步（优先缩小曼哈顿距离），避开占用，允许贴尾
function firstStepTowardsApple(head) {
    const occ = buildOccupied(true);
    const dx = apple.x - head.x;
    const dy = apple.y - head.y;
    const horizFirst = Math.abs(dx) >= Math.abs(dy);
    const candidates = [];
    if (horizFirst) {
        if (dx !== 0) candidates.push({ x: head.x + Math.sign(dx), y: head.y });
        if (dy !== 0) candidates.push({ x: head.x, y: head.y + Math.sign(dy) });
    } else {
        if (dy !== 0) candidates.push({ x: head.x, y: head.y + Math.sign(dy) });
        if (dx !== 0) candidates.push({ x: head.x + Math.sign(dx), y: head.y });
    }
    // 限制捷径只进入环的“前方空段”（head→apple 之间的环索引区间）
    const headIdx = indexOf(head);
    const appleIdx = indexOf(apple);
    const dCycleHA = cycleDistance(headIdx, appleIdx);
    const cycleNext = nextOnCycle(head);
    for (const c of candidates) {
        if (c.x < 0 || c.x >= GRID || c.y < 0 || c.y >= GRID) continue;
        if (occ[c.y][c.x]) continue;
        const ci = indexOf(c);
        // 仅允许前方区间内的候选，避免跨到已占用段导致自循环
        if (cycleDistance(headIdx, ci) === 0) continue; // 自己
        if (cycleDistance(headIdx, ci) > dCycleHA) continue; // 超出前方区间
        // 强化安全性：若不是沿环的常规下一格，则要求新头至少仍有一个自由邻居
        const isCycleNext = (c.x === cycleNext.x && c.y === cycleNext.y);
        if (isCycleNext || hasFreeNeighborAfter(c)) return c;
    }
    return null;
}
// 基于当前状态为本苹果生成一条曼哈顿路径（不使用 BFS），逐步模拟并确保每步不撞击；
// 仅在环的 head→apple 前方区间内行走；若失败返回 null
function planManhattanPath() {
    const target = apple;
    // 只在苹果位于前方时考虑曼哈顿计划
    const head = snake[0];
    const tail = snake[snake.length - 1];
    const headIdx = indexOf(head);
    const tailIdx = indexOf(tail);
    const appleIdx = indexOf(target);
    if (!isAheadOnCycle(headIdx, appleIdx, tailIdx)) return null;
    const dMan = manhattan(head, target);
    const dCycleHA = cycleDistance(headIdx, appleIdx);
    if (dMan > dCycleHA) return null;
    // 模拟序列
    let sim = snake.map(p => ({ x: p.x, y: p.y }));
    const seq = [];
    let cur = { x: head.x, y: head.y };
    // 最多尝试 dMan 步达到苹果
    for (let step = 0; step < dMan; step++) {
        // 在模拟空间内选第一步（使用当前 firstStepTowardsApple 策略但基于 sim 状态）
        // 构造占用（允许贴尾）：根据 sim 生成 occ
        const occ = Array.from({ length: GRID }, () => Array(GRID).fill(false));
        for (let i = 0; i < sim.length; i++) {
            if (i === sim.length - 1) continue; // 尾将移动
            const s = sim[i];
            occ[s.y][s.x] = true;
        }
        const dx = target.x - cur.x;
        const dy = target.y - cur.y;
        const horizFirst = Math.abs(dx) >= Math.abs(dy);
        const candidates = [];
        if (horizFirst) {
            if (dx !== 0) candidates.push({ x: cur.x + Math.sign(dx), y: cur.y });
            if (dy !== 0) candidates.push({ x: cur.x, y: cur.y + Math.sign(dy) });
        } else {
            if (dy !== 0) candidates.push({ x: cur.x, y: cur.y + Math.sign(dy) });
            if (dx !== 0) candidates.push({ x: cur.x + Math.sign(dx), y: cur.y });
        }
        const headIdxLocal = indexOf(cur);
        const dCycleHALocal = cycleDistance(headIdxLocal, appleIdx);
        let chosen = null;
        for (const c of candidates) {
            if (c.x < 0 || c.x >= GRID || c.y < 0 || c.y >= GRID) continue;
            if (occ[c.y][c.x]) continue;
            const ci = indexOf(c);
            if (cycleDistance(headIdxLocal, ci) === 0) continue;
            if (cycleDistance(headIdxLocal, ci) > dCycleHALocal) continue;
            chosen = c;
            break;
        }
        if (!chosen) return null;
        // 推进模拟：若此步吃到苹果则不移尾，否则移尾
        const ate = chosen.x === target.x && chosen.y === target.y;
        sim.unshift(chosen);
        if (!ate) sim.pop();
        seq.push(chosen);
        cur = chosen;
        if (ate) break;
    }
    // 若未到达目标，失败
    if (!(cur.x === target.x && cur.y === target.y)) return null;
    // 环可恢复性：到达苹果后的新头 nextOnCycle 不应被占用（新蛇态）
    const newHead = sim[0];
    const nextCycle = nextOnCycle(newHead);
    if (sim.some(p => p.x === nextCycle.x && p.y === nextCycle.y)) return null;
    return seq;
}

// ---- BFS 最短路工具 ----
function neighbors(p) {
    const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
    ];
    const res = [];
    for (const d of dirs) {
        const nx = p.x + d.x, ny = p.y + d.y;
        if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) res.push({ x: nx, y: ny });
    }
    return res;
}

function buildOccupied(excludeTail) {
    const occ = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    const tailIndex = snake.length - 1;
    for (let i = 0; i < snake.length; i++) {
        if (excludeTail && i === tailIndex) continue;
        const s = snake[i];
        occ[s.y][s.x] = true;
    }
    return occ;
}

// 不使用 BFS（按需保留邻居与占用构造供贪心与安全性近似判断）

function simulateStep(next) {
    const grew = next.x === apple.x && next.y === apple.y;
    const newSnake = [next, ...snake];
    if (!grew) newSnake.pop();
    return newSnake;
}

// 近似安全性：模拟一步后，新头至少拥有一个可用邻居（不致立刻被自体封死）
function hasFreeNeighborAfter(next) {
    const sim = simulateStep(next);
    const grew = next.x === apple.x && next.y === apple.y;
    const newHead = sim[0];
    const occ = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    for (let i = 0; i < sim.length; i++) {
        // 若未吃到苹果，尾巴将移动，排除尾格以更宽松评估可用空间
        if (!grew && i === sim.length - 1) continue;
        const s = sim[i];
        occ[s.y][s.x] = true;
    }
    for (const nb of neighbors(newHead)) {
        if (!occ[nb.y][nb.x]) return true;
    }
    return false;
}

// 基于曼哈顿距离的贪心：从头部可达邻居中选择距离苹果最近且近似安全的下一步
function chooseGreedyMove(head) {
    const occ = buildOccupied(true); // 允许踩到当前尾格（若不吃，尾会移开）
    const options = neighbors(head).filter(nb => !occ[nb.y][nb.x]);
    options.sort((a, b) => manhattan(a, apple) - manhattan(b, apple));
    for (const candidate of options) {
        if (hasFreeNeighborAfter(candidate)) return candidate;
    }
    return null;
}
/**
 * 每一步逻辑：沿固定哈密顿环前进
 */
function step() {
    const head = snake[0];
    let next = null;
    // 若当前没有计划或苹果变化，尝试为该苹果生成安全的曼哈顿计划
    const currentAppleIdx = indexOf(apple);
    if (plan.length === 0 || plannedForAppleIndex !== currentAppleIdx) {
        const seq = planManhattanPath();
        if (seq) {
            plan = seq.slice();
            plannedForAppleIndex = currentAppleIdx;
        } else {
            plan = [];
            plannedForAppleIndex = -1;
        }
    }
    // 优先执行计划中的下一步
    if (plan.length > 0) {
        next = plan.shift();
    }
    // 若无计划，备用策略：短蛇阶段用贪心靠近苹果
    if (!next && snake.length < SMART_MODE_LEN) {
        next = chooseGreedyMove(head);
    }

    // 兜底：无合适贪心步则沿哈密顿环
    if (!next) {
        next = nextOnCycle(head);
    }

    // 执行动作
    snake.unshift(next);
    const ate = next.x === apple.x && next.y === apple.y;
    if (ate) {
        score++;
        apple = randomApple();
        // 新苹果出现后清空旧计划
        plan = [];
        plannedForAppleIndex = -1;
    } else {
        snake.pop();
    }
}
/**
 * 主循环
 */
function loop() {
    if (!running)
        return;
    step();
    draw();
    loopTimer = setTimeout(loop, SPEED);
}
init();
