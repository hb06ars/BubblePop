(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const restartBtn = document.getElementById('restart-btn');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const hint = document.getElementById('hint');

  const COLORS = ['#ff5c9a', '#48d8e8', '#ffd166', '#a47aff', '#69dfa7', '#ff9b76'];
  const GAME_WIDTH = 324, GAME_HEIGHT = 445;
  const ROWS = 14, COLS = 9, R = 16, STEP_X = 34, STEP_Y = 27.7, LAUNCHER_LENGTH = 31;
  const IDLE_SHOT_SECONDS = 15, SHOT_SPEED = 420, SHOTS_PER_ROW = 20, GAME_DURATION_SECONDS = 300;
  let grid = [], score = 0, best = Number(localStorage.getItem('bubblePopBest') || 0);
  let currentColor = 0, nextColor = 0, aim = -Math.PI / 2, moving = null;
  let bursts = [], aimDotOffset = 0;
  let running = false, paused = false, ended = false, shots = 0, lastTime = 0;
  let idleTimer = IDLE_SHOT_SECONDS, countdownValue = null;
  let remainingTime = GAME_DURATION_SECONDS;
  let aimingPointerId = null;
  let visualTime = 0;
  let width = GAME_WIDTH, height = GAME_HEIGHT, scale = 1, dpr = 1, animationId = 0;
  bestEl.textContent = best;

  function randColor() { return Math.floor(Math.random() * COLORS.length); }
  function cellX(row, col) { return R + col * STEP_X + (row % 2 ? STEP_X / 2 : 0); }
  function cellY(row) { return R + row * STEP_Y; }
  function center(row, col) { return { x: cellX(row, col), y: cellY(row) }; }
  function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || 324;
    const cssHeight = cssWidth * GAME_HEIGHT / GAME_WIDTH;
    canvas.style.height = `${cssHeight}px`;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    width = cssWidth; height = cssHeight;
    scale = width / GAME_WIDTH;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    draw();
  }

  function initGrid() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    bursts = [];
    aimingPointerId = null;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < COLS; c++) {
        // A few gaps make the starting formation less uniform.
        if (r > 2 && Math.random() < 0.10) continue;
        grid[r][c] = randColor();
      }
    }
    score = 0; shots = 0; moving = null; aim = -Math.PI / 2;
    currentColor = randColor(); nextColor = randColor();
    running = true; paused = false; ended = false;
    idleTimer = IDLE_SHOT_SECONDS; countdownValue = null;
    remainingTime = GAME_DURATION_SECONDS;
    overlay.classList.add('hidden');
    pauseBtn.disabled = false; pauseBtn.textContent = 'Ⅱ Pausar';
    scoreEl.textContent = '0';
    updateIdleHint();
    draw();
  }

  function shooter() { return { x: 162, y: 405 }; }
  function muzzle(angle) {
    const s = shooter();
    return {
      x: s.x + Math.cos(angle) * LAUNCHER_LENGTH,
      y: s.y + Math.sin(angle) * LAUNCHER_LENGTH
    };
  }

  function drawLauncher(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(aim + Math.PI / 2);

    const gold = ctx.createLinearGradient(-30, -30, 30, 30);
    gold.addColorStop(0, '#fff2b0');
    gold.addColorStop(0.35, '#e5aa37');
    gold.addColorStop(0.65, '#bd7d20');
    gold.addColorStop(1, '#ffe9a0');
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.fillStyle = '#8e5b25aa';
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffe7a0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (let spoke = 0; spoke < 8; spoke++) {
      const angle = spoke * Math.PI / 4;
      const innerX = Math.cos(angle) * 12;
      const innerY = Math.sin(angle) * 12;
      const outerX = Math.cos(angle) * 24;
      const outerY = Math.sin(angle) * 24;
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = spoke % 2 === 0 ? '#fff0b3' : '#d69a32';
      ctx.lineWidth = spoke % 2 === 0 ? 3 : 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(outerX, outerY, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe6a0';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, -39);
    ctx.strokeStyle = '#fff0b3';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -43);
    ctx.lineTo(-5, -34);
    ctx.lineTo(5, -34);
    ctx.closePath();
    ctx.fillStyle = '#fff0b3';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#d49a35';
    ctx.fill();
    ctx.strokeStyle = '#fff0b3';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3c4';
    ctx.fill();
    ctx.restore();
  }

  function formatTime(seconds) {
    const totalSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const remainder = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  }

  function drawStar(x, y, radius, rotation = 0) {
    ctx.beginPath();
    for (let point = 0; point < 8; point++) {
      const angle = rotation - Math.PI / 2 + point * Math.PI / 4;
      const pointRadius = point % 2 === 0 ? radius : radius * 0.42;
      const px = x + Math.cos(angle) * pointRadius;
      const py = y + Math.sin(angle) * pointRadius;
      if (point === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function neighbors(r, c) {
    const offsets = r % 2 === 0
      ? [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]]
      : [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]];
    return offsets.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) => inBounds(rr, cc));
  }

  function nearestEmpty(x, y) {
    let bestCell = null, bestDist = Infinity;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== null) continue;
      const p = center(r, c), d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) { bestDist = d; bestCell = [r, c]; }
    }
    return bestCell;
  }

  function shoot() {
    if (!running || paused || ended || moving) return;
    let a = aim;
    a = Math.max(-Math.PI + 0.15, Math.min(-0.15, a));
    const start = muzzle(a);
    moving = { x: start.x, y: start.y, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, color: currentColor };
    currentColor = nextColor; nextColor = randColor();
    hint.classList.remove('countdown');
    hint.textContent = 'Bolha lançada!';
  }

  function updateIdleHint() {
    const seconds = Math.max(1, Math.ceil(idleTimer));
    if (countdownValue === seconds) return;
    countdownValue = seconds;
    hint.classList.add('countdown');
    hint.textContent = `Disparo automático em ${seconds}s`;
  }

  function chooseAutomaticAim() {
    let bestAngle = -Math.PI / 2, bestValue = -Infinity;
    const minAngle = -Math.PI + 0.15, maxAngle = -0.15;
    for (let angle = minAngle; angle <= maxAngle; angle += 0.025) {
      const start = muzzle(angle);
      let x = start.x, y = start.y, vx = Math.cos(angle), vy = Math.sin(angle);
      let hitCell = null;
      for (let step = 0; step < 500; step++) {
        x += vx * 2; y += vy * 2;
        if (x < R) { x = R; vx = Math.abs(vx); }
        if (x > 324 - R) { x = 324 - R; vx = -Math.abs(vx); }
        if (y < R) { hitCell = nearestEmpty(x, y); break; }
        let collision = false;
        for (let r = 0; r < ROWS && !collision; r++) {
          for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === null) continue;
            const p = center(r, c);
            if (Math.hypot(p.x - x, p.y - y) < R * 2 - 2) {
              hitCell = nearestEmpty(x, y);
              collision = true;
              break;
            }
          }
        }
        if (collision) break;
      }
      if (!hitCell) continue;

      const [r, c] = hitCell;
      grid[r][c] = currentColor;
      const group = findGroup(r, c);
      let floatingCount = 0;
      if (group.length >= 3) {
        for (const [rr, cc] of group) grid[rr][cc] = null;
        floatingCount = findFloating().length;
        for (const [rr, cc] of group) grid[rr][cc] = currentColor;
      }
      grid[r][c] = null;

      const value = group.length >= 3
        ? 1000 + group.length * 20 + floatingCount * 50
        : group.length * 20 + (GAME_HEIGHT - cellY(r)) * 0.01;
      if (value > bestValue) {
        bestValue = value;
        bestAngle = angle;
      }
    }
    aim = bestAngle;
  }

  function attachBubble() {
    if (!moving) return;
    const cell = nearestEmpty(moving.x, moving.y);
    if (cell) {
      const [r, c] = cell;
      grid[r][c] = moving.color;
      const group = findGroup(r, c);
      if (group.length >= 3) {
        for (const [rr, cc] of group) removeBubble(rr, cc);
        score += group.length * 10;
        const floating = findFloating();
        score += floating.length * 20;
        for (const [rr, cc] of floating) removeBubble(rr, cc);
      }
      shots++;
      if (shots >= SHOTS_PER_ROW && !grid.every(row => row.every(v => v === null))) {
        const occupiedRows = grid.filter(row => row.some(v => v !== null)).length;
        const rowsToAdd = occupiedRows <= 2 ? 3 : 1;
        for (let i = 0; i < rowsToAdd; i++) addRow();
        shots = 0;
      }
      scoreEl.textContent = score;
      if (score > best) {
        best = score; bestEl.textContent = best;
        localStorage.setItem('bubblePopBest', String(best));
      }
    }
    moving = null;
    idleTimer = IDLE_SHOT_SECONDS;
    countdownValue = null;
    if (grid[ROWS - 2].some(v => v !== null) || grid[ROWS - 1].some(v => v !== null)) {
      finish(false);
    } else if (grid.every(row => row.every(v => v === null))) {
      finish(true);
    } else {
      updateIdleHint();
    }
    draw();
  }

  function removeBubble(r, c) {
    const color = grid[r][c];
    if (color === null) return;
    const p = center(r, c);
    const particles = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.25;
      const speed = 40 + Math.random() * 75;
      particles.push({
        x: p.x, y: p.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2
      });
    }
    bursts.push({ x: p.x, y: p.y, color, age: 0, duration: 0.38, particles });
    grid[r][c] = null;
  }

  function updateBursts(dt) {
    for (const burst of bursts) {
      burst.age += dt;
      for (const particle of burst.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 110 * dt;
      }
    }
    bursts = bursts.filter(burst => burst.age < burst.duration);
  }

  function findGroup(r, c) {
    const color = grid[r][c], stack = [[r,c]], seen = new Set([`${r},${c}`]), group = [];
    while (stack.length) {
      const [rr, cc] = stack.pop(); group.push([rr,cc]);
      for (const [nr,nc] of neighbors(rr,cc)) {
        const key = `${nr},${nc}`;
        if (!seen.has(key) && grid[nr][nc] === color) { seen.add(key); stack.push([nr,nc]); }
      }
    }
    return group;
  }

  function findFloating() {
    const seen = new Set(), stack = [];
    for (let c = 0; c < COLS; c++) if (grid[0][c] !== null) stack.push([0,c]);
    while (stack.length) {
      const [r,c] = stack.pop(), key = `${r},${c}`;
      if (seen.has(key) || grid[r][c] === null) continue;
      seen.add(key);
      neighbors(r,c).forEach(([nr,nc]) => stack.push([nr,nc]));
    }
    const floating = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      if (grid[r][c] !== null && !seen.has(`${r},${c}`)) floating.push([r,c]);
    return floating;
  }

  function addRow() {
    for (let r = ROWS - 1; r > 0; r--) grid[r] = grid[r - 1].slice();
    grid[0] = Array.from({ length: COLS }, () => Math.random() < 0.16 ? null : randColor());
  }

  function finish(won, reason = null) {
    running = false; ended = true; pauseBtn.disabled = true;
    hint.classList.remove('countdown');
    overlay.classList.remove('hidden');
    overlayTitle.textContent = reason === 'timeout' ? 'Tempo esgotado!' : won ? 'Você venceu!' : 'Fim de jogo';
    overlayText.textContent = reason === 'timeout'
      ? `O tempo acabou! Pontuação final: ${score}.`
      : won ? `Todas as bolhas eliminadas! Pontuação: ${score}.` : `Pontuação final: ${score}. Tente novamente!`;
    startBtn.textContent = 'Jogar novamente';
  }

  function drawBubble(x, y, color, radius = R) {
    const grad = ctx.createRadialGradient(x - radius * .35, y - radius * .4, radius * .08, x, y, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(.12, COLORS[color]);
    grad.addColorStop(1, shade(COLORS[color], -35));
    ctx.beginPath(); ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = '#ffffff85'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x - radius * .28, y - radius * .36, radius * .24, radius * .12, -.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffffa8'; ctx.fill();
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const bg = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    bg.addColorStop(0, '#542456'); bg.addColorStop(1, '#29183f');
    ctx.fillStyle = bg; ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
    // Subtle stars/dots
    ctx.fillStyle = '#ffffff12';
    for (let i=0;i<35;i++) { const x=(i*71+17)%GAME_WIDTH, y=(i*47+23)%(GAME_HEIGHT-15); ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill(); }
    // Soft twinkling stars mark the danger line.
    for (let i = 0; i < 22; i++) {
      const x = 7 + i * 14.3;
      ctx.globalAlpha = 0.38 + (Math.sin(visualTime * 2.2 + i * 0.8) + 1) * 0.12;
      ctx.fillStyle = '#ffc5ec';
      drawStar(x, 365, i % 3 === 0 ? 3.2 : 2.4, visualTime * 0.12 + i);
    }
    ctx.globalAlpha = 1;
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r] && grid[r][c] !== null) {
      const p = center(r,c);
      const pulse = 1 + Math.sin(visualTime * 2 + r * 0.7 + c * 0.45) * 0.018;
      drawBubble(p.x,p.y,grid[r][c],R * pulse);
    }
    for (const burst of bursts) {
      const progress = burst.age / burst.duration;
      const alpha = 1 - progress;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, 4 + progress * 23, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS[burst.color];
      ctx.lineWidth = 2.5 * alpha;
      ctx.stroke();
      for (const particle of burst.particles) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[burst.color];
        ctx.fill();
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * alpha * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const s = shooter();
    ctx.beginPath();
    ctx.roundRect(43, 379, 50, 52, 9);
    ctx.fillStyle = '#482052e8';
    ctx.fill();
    ctx.strokeStyle = '#e7b64f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffe7a0';
    ctx.font = 'bold 6px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('PRÓXIMA', 68, 391);
    drawBubble(68, 414, nextColor, 12);
    ctx.beginPath();
    ctx.roundRect(231, 379, 50, 52, 9);
    ctx.fillStyle = '#482052e8';
    ctx.fill();
    ctx.strokeStyle = '#e7b64f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffe7a0';
    ctx.font = 'bold 6px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('TEMPO', 256, 391);
    ctx.fillStyle = '#fff5d6';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.fillText(formatTime(remainingTime), 256, 414);
    ctx.fillStyle = '#75417e';
    ctx.beginPath();
    ctx.roundRect(s.x-27,s.y+12,54,18,9);
    ctx.fill();
    drawLauncher(s);
    // Animated dots follow the predicted trajectory, including wall bounces.
    if (running && !paused && !moving) {
      const start = muzzle(aim);
      const step = 2, spacing = 12, path = [{ x: start.x, y: start.y }];
      let x = start.x, y = start.y, vx = Math.cos(aim), vy = Math.sin(aim);
      for (let distance = step; distance <= 900; distance += step) {
        x += vx * step; y += vy * step;
        if (x < R) { x = R; vx = Math.abs(vx); }
        if (x > 324 - R) { x = 324 - R; vx = -Math.abs(vx); }
        path.push({ x, y });
        if (y < R || grid.some((row, rr) => row.some((v, cc) =>
          v !== null && Math.hypot(center(rr, cc).x - x, center(rr, cc).y - y) < R * 2 - 1
        ))) break;
      }
      ctx.fillStyle = '#e2e6f0';
      ctx.globalAlpha = 0.62;
      for (let distance = aimDotOffset; distance < (path.length - 1) * step; distance += spacing) {
        const index = Math.floor(distance / step);
        const fraction = (distance - index * step) / step;
        const from = path[index], to = path[index + 1];
        const dotX = from.x + (to.x - from.x) * fraction;
        const dotY = from.y + (to.y - from.y) * fraction;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawBubble(s.x,s.y,currentColor);
    if (moving) drawBubble(moving.x,moving.y,moving.color);
    // Pause overlay
    if (paused) {
      ctx.fillStyle='#210e2dcc'; ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
      ctx.fillStyle='#fff4fb'; ctx.font='bold 25px system-ui'; ctx.textAlign='center'; ctx.fillText('PAUSADO',162,GAME_HEIGHT / 2 - 10);
      ctx.font='14px system-ui'; ctx.fillStyle='#e8b9df'; ctx.fillText('Toque em Continuar',162,GAME_HEIGHT / 2 + 17);
    }
  }

  function tick(time) {
    const dt = Math.min((time - (lastTime || time)) / 1000, .035);
    lastTime = time;
    visualTime += dt;
    if (!paused) updateBursts(dt);
    if (running && !paused && !moving) aimDotOffset = (aimDotOffset + dt * 30) % 12;
    if (running && !paused && moving) {
      moving.x += moving.vx * dt; moving.y += moving.vy * dt;
      if (moving.x < R) { moving.x = R; moving.vx = Math.abs(moving.vx); }
      if (moving.x > 324-R) { moving.x = 324-R; moving.vx = -Math.abs(moving.vx); }
      let hit = moving.y < R;
      if (!hit) {
        outer: for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r][c] !== null) {
          const p=center(r,c);
          if (Math.hypot(p.x-moving.x,p.y-moving.y) < R*2-2) { hit=true; break outer; }
        }
      }
      if (hit || moving.y < 20) attachBubble();
    }
    if (running && !paused) {
      remainingTime = Math.max(0, remainingTime - dt);
      if (remainingTime === 0) finish(false, 'timeout');
    }
    if (running && !paused && !moving && aimingPointerId === null) {
      idleTimer -= dt;
      if (idleTimer <= 0) {
        idleTimer = 0;
        chooseAutomaticAim();
        hint.textContent = 'Sem disparo? O jogo escolheu uma jogada!';
        shoot();
      } else {
        updateIdleHint();
      }
    }
    draw();
    animationId = requestAnimationFrame(tick);
  }

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return { x:(e.clientX-rect.left)/rect.width*GAME_WIDTH, y:(e.clientY-rect.top)/rect.height*GAME_HEIGHT };
  }
  function setAim(x,y) {
    const s=shooter();
    let a=Math.atan2(y-s.y,x-s.x);
    aim=Math.max(-Math.PI+0.15,Math.min(-0.15,a));
    draw();
  }
  canvas.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || !running || paused || ended || moving) return;
    e.preventDefault();
    aimingPointerId = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);
    const p=pointFromEvent(e); setAim(p.x,p.y);
  });
  canvas.addEventListener('pointermove', e => {
    if (aimingPointerId === e.pointerId && running && !paused && !moving) {
      const p=pointFromEvent(e); setAim(p.x,p.y);
    } else if (aimingPointerId === null && e.pointerType === 'mouse' && e.buttons === 0 && running && !paused) {
      const p=pointFromEvent(e); setAim(p.x,p.y);
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (aimingPointerId !== e.pointerId) return;
    aimingPointerId = null;
    if (running && !paused && !ended && !moving) {
      const p=pointFromEvent(e); setAim(p.x,p.y);
      shoot();
    }
  });
  canvas.addEventListener('pointercancel', e => {
    if (aimingPointerId === e.pointerId) aimingPointerId = null;
  });
  canvas.addEventListener('lostpointercapture', e => {
    if (aimingPointerId === e.pointerId) aimingPointerId = null;
  });
  startBtn.addEventListener('click', initGrid);
  restartBtn.addEventListener('click', initGrid);
  pauseBtn.addEventListener('click', () => {
    if (!running || ended) return;
    paused=!paused;
    if (paused) aimingPointerId = null;
    pauseBtn.textContent=paused ? '▶ Continuar' : 'Ⅱ Pausar';
    if (paused) {
      hint.classList.remove('countdown');
      hint.textContent='Jogo pausado.';
    }
    else { countdownValue = null; updateIdleHint(); }
    draw();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      aim += e.key === 'ArrowLeft' ? -0.08 : 0.08;
      aim=Math.max(-Math.PI+0.15,Math.min(-0.15,aim)); draw();
    }
    if (e.code === 'Space') { e.preventDefault(); shoot(); }
    if (e.key.toLowerCase() === 'p') pauseBtn.click();
  });
  window.addEventListener('resize', resize);
  resize();
  initGrid();
  // Show start screen on first load; start button begins a fresh game.
  running=false; pauseBtn.disabled=true;
  hint.textContent='';
  overlay.classList.remove('hidden');
  cancelAnimationFrame(animationId);
  animationId=requestAnimationFrame(tick);
})();