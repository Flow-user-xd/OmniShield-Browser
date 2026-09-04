// OmniShield Interactive Tactical Dot Matrix Background
// Option 3 with cursor physics, elastic spring repulsion, and glowing laser filaments
(function() {
  if (document.getElementById('bg-matrix-canvas')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'bg-matrix-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '0';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d', { alpha: true });
  let width = 0;
  let height = 0;
  let dpr = window.devicePixelRatio || 1;

  const GRID_STEP = 28; // Elegant grid spacing
  const MOUSE_RADIUS = 65; // Tight, subtle reaction radius (only directly around cursor)
  const PUSH_FORCE = 3.2; // Gentle, smooth micro-nudge (not huge flying movement)
  const SPRING_K = 0.09; // Snappy elastic return
  const DAMPING = 0.82; // Natural friction

  let dots = [];
  let mouse = { x: -9999, y: -9999, active: false };
  let isMoving = true;
  let lastMoveTime = Date.now();

  class Dot {
    constructor(ox, oy) {
      this.ox = ox;
      this.oy = oy;
      this.x = ox;
      this.y = oy;
      this.vx = 0;
      this.vy = 0;
      this.baseRadius = 1.1; // Crisp micro-dot
      this.radius = 1.1;
      this.baseAlpha = 0.12; // Very subtle resting dot
      this.alpha = 0.12;
      this.glow = 0;
    }

    update() {
      // 1. Subtle cursor repulsion
      if (mouse.active) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS && dist > 0.1) {
          const norm = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          const force = Math.pow(norm, 1.6) * PUSH_FORCE;
          const angle = Math.atan2(dy, dx);

          this.vx += Math.cos(angle) * force;
          this.vy += Math.sin(angle) * force;
          this.glow = Math.min(1.0, this.glow + norm * 0.35);
        }
      }

      // 2. Elastic spring return to origin anchor
      const ax = (this.ox - this.x) * SPRING_K;
      const ay = (this.oy - this.y) * SPRING_K;
      this.vx = (this.vx + ax) * DAMPING;
      this.vy = (this.vy + ay) * DAMPING;

      this.x += this.vx;
      this.y += this.vy;

      // 3. Subtle glow & alpha decay (muted, dark colors)
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > 0.03) {
        this.glow = Math.min(1.0, this.glow + speed * 0.08);
      } else {
        this.glow *= 0.92;
      }

      this.radius = this.baseRadius + this.glow * 0.4;
      this.alpha = this.baseAlpha + this.glow * 0.28;

      return Math.abs(this.vx) > 0.008 || Math.abs(this.vy) > 0.008 || this.glow > 0.01;
    }

    draw(context) {
      context.beginPath();
      context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

      if (this.glow > 0.1) {
        // Muted stealth cyan/slate - soft and dark, never blinding
        context.fillStyle = `rgba(56, 189, 248, ${this.alpha})`;
        context.shadowColor = 'rgba(56, 189, 248, 0.3)';
        context.shadowBlur = this.glow * 3;
      } else {
        // Deep subtle slate/zinc resting dot
        context.fillStyle = `rgba(148, 163, 184, ${this.alpha})`;
        context.shadowBlur = 0;
      }
      context.fill();
    }
  }

  function initDots() {
    dots = [];
    const cols = Math.ceil(width / GRID_STEP) + 2;
    const rows = Math.ceil(height / GRID_STEP) + 2;
    const startX = (width - (cols - 1) * GRID_STEP) / 2;
    const startY = (height - (rows - 1) * GRID_STEP) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push(new Dot(startX + c * GRID_STEP, startY + r * GRID_STEP));
      }
    }
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    initDots();
  }

  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
    lastMoveTime = Date.now();
    isMoving = true;
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
      lastMoveTime = Date.now();
      isMoving = true;
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    mouse.active = false;
  });

  function renderFrame() {
    ctx.clearRect(0, 0, width, height);

    let hasMotion = false;

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      const moving = dot.update();
      if (moving) hasMotion = true;
      dot.draw(ctx);
    }

    // Reset shadow state
    ctx.shadowBlur = 0;

    // Check idle sleep to conserve battery & GPU
    if (!mouse.active && !hasMotion && Date.now() - lastMoveTime > 1200) {
      isMoving = false;
    }

    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);
})();
