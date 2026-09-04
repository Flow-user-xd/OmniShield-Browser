/**
 * OmniShield Interactive Cursor Companion: White Rabbit Runner
 * - Perfectly compact (~32px width)
 * - Trails comfortably 60px away from the cursor pointer so it never covers buttons or text
 * - Bounding hop animation as it runs eagerly towards the cursor
 * - Gentle breathing and ear twitches when stationary
 */
(function() {
  if (window.top !== window.self) return;
  if (window.__omniRabbitInitialized) return;
  window.__omniRabbitInitialized = true;

  function initRabbit() {
    const old = document.getElementById('omni-rabbit-cursor-companion');
    if (old) old.remove();

    const styleId = 'omni-rabbit-styles';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      #omni-rabbit-cursor-companion {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        overflow: visible;
        user-select: none;
      }
      .rabbit-tracker {
        position: fixed;
        top: 0;
        left: 0;
        width: 32px;
        height: 28px;
        will-change: transform;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        transform-origin: center bottom;
      }
      .rabbit-sprite {
        position: relative;
        width: 100%;
        height: 100%;
        transform-origin: 16px 22px;
        will-change: transform;
        pointer-events: none !important;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.45));
      }
      .rabbit-shadow {
        position: absolute;
        left: 5px;
        bottom: -2px;
        width: 22px;
        height: 6px;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 70%);
        border-radius: 50%;
        transform-origin: center center;
        pointer-events: none;
      }
      .rabbit-svg {
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
      }
      .rabbit-dust {
        position: fixed;
        width: 4px;
        height: 4px;
        background: rgba(255, 255, 255, 0.85);
        border-radius: 50%;
        pointer-events: none;
        box-shadow: 0 0 5px rgba(0, 242, 254, 0.6);
        animation: rabbitDustFade 0.38s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      }
      @keyframes rabbitDustFade {
        0% { transform: scale(1) translate(0, 0); opacity: 0.85; }
        100% { transform: scale(0.2) translate(-8px, -5px); opacity: 0; }
      }
      @keyframes rabbitBreathe {
        0%, 100% { transform: scale(1, 1); }
        50% { transform: scale(1.04, 0.96) translateY(1px); }
      }
      .rabbit-idle-breathe {
        animation: rabbitBreathe 2.2s ease-in-out infinite;
      }
      @keyframes noseTwitch {
        0%, 75%, 100% { transform: scale(1); }
        80% { transform: scale(1.25, 0.85); }
        85% { transform: scale(0.9, 1.15); }
        90% { transform: scale(1.1, 0.95); }
      }
      .rabbit-nose-twitch {
        animation: noseTwitch 2.4s ease-in-out infinite;
        transform-origin: 24px 14px;
      }
      @keyframes earTwitch {
        0%, 80%, 100% { transform: rotate(0deg); }
        84% { transform: rotate(-7deg); }
        88% { transform: rotate(5deg); }
        92% { transform: rotate(-3deg); }
      }
      .rabbit-ear-twitch {
        animation: earTwitch 3.6s ease-in-out infinite;
        transform-origin: 15px 10px;
      }
      @keyframes collideBoop {
        0% { transform: scale(1, 1); }
        25% { transform: scale(1.25, 0.75) translateY(2px); }
        50% { transform: scale(0.9, 1.18) translateY(-6px); }
        75% { transform: scale(1.06, 0.95) translateY(-1px); }
        100% { transform: scale(1, 1) translateY(0); }
      }
      .rabbit-collide-boop {
        animation: collideBoop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      @keyframes floatHeart {
        0% { opacity: 1; transform: translate3d(0, 0, 0) scale(0.6); }
        50% { opacity: 0.95; transform: translate3d(0, -18px, 0) scale(1.15); }
        100% { opacity: 0; transform: translate3d(0, -32px, 0) scale(0.7); }
      }
      .rabbit-boop-heart {
        position: fixed;
        font-size: 14px;
        pointer-events: none !important;
        animation: floatHeart 0.65s ease-out forwards;
        z-index: 1000000;
        user-select: none;
      }
    `;

    const container = document.createElement('div');
    container.id = 'omni-rabbit-cursor-companion';

    const tracker = document.createElement('div');
    tracker.className = 'rabbit-tracker';

    const sprite = document.createElement('div');
    sprite.className = 'rabbit-sprite rabbit-idle-breathe';

    sprite.innerHTML = `
      <div class="rabbit-shadow" id="rabbit-shadow"></div>
      <svg class="rabbit-svg" viewBox="0 0 54 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bunnyFur" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="75%" stop-color="#F1F5F9" />
            <stop offset="100%" stop-color="#CBD5E1" />
          </radialGradient>
          <linearGradient id="earPink" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FFA8BA" />
            <stop offset="100%" stop-color="#FF7597" />
          </linearGradient>
          <radialGradient id="eyeGleam" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#0F172A" />
            <stop offset="100%" stop-color="#020617" />
          </radialGradient>
        </defs>

        <g id="rabbit-back-ear" class="rabbit-ear-twitch">
          <path d="M19 16 C17 2, 20 -3, 23 0 C26 3, 24 11, 22 17 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>
          <path d="M20 14 C18.5 4, 20.5 0.5, 22.5 1.5 C24 2.5, 23 9, 21.5 14 Z" fill="url(#earPink)"/>
        </g>

        <circle id="rabbit-tail" cx="7" cy="27" r="5.5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.9"/>
        <path id="rabbit-back-leg" d="M12 28 C9 26, 8 34, 14 37 C19 39, 22 37, 21 34 C19 32, 16 30, 12 28 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>
        <path id="rabbit-body" d="M11 26 C11 17, 22 17, 29 19 C36 21, 38 27, 36 34 C33 39, 15 39, 11 26 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>
        <path id="rabbit-front-leg" d="M28 32 C29 37, 31 39, 34 38 C36 37, 35 32, 32 30 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.8"/>
        <circle id="rabbit-head" cx="32" cy="22" r="9.5" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>
        <ellipse cx="37" cy="25.5" rx="3.8" ry="3" fill="#FFFFFF"/>
        <ellipse cx="33.5" cy="26.5" rx="3.4" ry="2.7" fill="#FFFFFF"/>

        <g id="rabbit-front-ear" class="rabbit-ear-twitch">
          <path d="M24 17 C23 2, 28 -4, 32 0 C34 3.5, 31 12, 27 19 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>
          <path d="M25 15 C24.5 3, 28 0, 30.5 2 C32 4, 29 10, 27 16 Z" fill="url(#earPink)"/>
        </g>

        <circle cx="34.5" cy="19" r="2.2" fill="url(#eyeGleam)"/>
        <circle cx="35.2" cy="18.3" r="0.8" fill="#FFFFFF"/>
        <path id="rabbit-nose" class="rabbit-nose-twitch" d="M38.5 23.5 C39.2 23.5, 39.7 24, 39.2 24.6 C38.7 25.2, 38.3 25.2, 37.8 24.6 C37.4 24, 37.8 23.5, 38.5 23.5 Z" fill="#F43F5E"/>
        <path d="M38.5 25.2 L38.5 26.5 M38.5 26.5 C37.5 27.5, 36.5 27, 36 26.5 M38.5 26.5 C39.5 27.5, 40.5 27, 41 26.5" stroke="#94A3B8" stroke-width="0.7" stroke-linecap="round"/>
        <path d="M39 24.5 L46 22.5 M39 25.5 L47 25.5 M39 26.5 L45 28.5" stroke="#94A3B8" stroke-width="0.6" stroke-linecap="round"/>
      </svg>
    `;

    tracker.appendChild(sprite);
    container.appendChild(tracker);
    (document.body || document.documentElement).appendChild(container);

    let rabbitX = Math.min(window.innerWidth - 100, 220);
    let rabbitY = Math.min(window.innerHeight - 100, 140);
    let mouseX = rabbitX;
    let mouseY = rabbitY;
    let lastMouseX = mouseX;
    let lastMouseY = mouseY;
    let mouseSpeed = 0;
    let lastMoveTime = 0;
    let facing = 1;
    let isRunning = false;
    let hopAngle = 0;
    let dustCounter = 0;
    let hasMovedCursor = false;
    let hasCollided = false;

    tracker.style.transform = `translate3d(${rabbitX}px, ${rabbitY}px, 0) scaleX(${facing})`;

    function onPointerMove(e) {
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveTime);
      const moveDist = Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY);
      mouseSpeed = Math.min(3, moveDist / dt); // pixels per ms
      lastMouseX = mouseX;
      lastMouseY = mouseY;
      mouseX = e.clientX;
      mouseY = e.clientY;
      lastMoveTime = now;
      hasMovedCursor = true;
      hasCollided = false;
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true, capture: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    document.addEventListener('mousemove', onPointerMove, { passive: true, capture: true });

    function triggerCollisionBoop() {
      sprite.classList.add('rabbit-collide-boop');
      setTimeout(() => {
        sprite.classList.remove('rabbit-collide-boop');
      }, 430);

      // Spawn mini boop heart or sparkle at collision point
      const heart = document.createElement('div');
      heart.className = 'rabbit-boop-heart';
      heart.innerText = Math.random() > 0.4 ? '✨' : '💖';
      heart.style.left = `${mouseX - 8}px`;
      heart.style.top = `${mouseY - 20}px`;
      container.appendChild(heart);
      setTimeout(() => heart.remove(), 650);
    }

    function spawnDust(x, y) {
      if (++dustCounter % 3 !== 0) return;
      const dust = document.createElement('div');
      dust.className = 'rabbit-dust';
      dust.style.left = `${x}px`;
      dust.style.top = `${y}px`;
      container.appendChild(dust);
      setTimeout(() => dust.remove(), 380);
    }

    const frontEar = sprite.querySelector('#rabbit-front-ear');
    const backEar = sprite.querySelector('#rabbit-back-ear');
    const frontLeg = sprite.querySelector('#rabbit-front-leg');
    const backLeg = sprite.querySelector('#rabbit-back-leg');
    const shadow = sprite.querySelector('#rabbit-shadow');

    function loop() {
      if (hasMovedCursor) {
        const now = performance.now();
        const timeSinceMove = now - lastMoveTime;
        const cursorStopped = timeSinceMove > 110; // cursor resting / stopped

        let targetX, targetY;
        if (cursorStopped) {
          // Cursor has stopped: rabbit rushes in to catch and collide directly with cursor!
          const targetFacing = mouseX >= rabbitX ? 1 : -1;
          targetX = mouseX - (targetFacing === 1 ? 24 : 8);
          targetY = mouseY - 14;
        } else {
          // Cursor is moving: rabbit chases and trails behind cursor with a dynamic distance
          const trailDist = Math.min(55, Math.max(25, mouseSpeed * 28 + 25));
          const dirX = mouseX >= rabbitX ? -1 : 1;
          targetX = mouseX + (dirX * trailDist);
          targetY = mouseY + 18;
        }

        const dx = targetX - rabbitX;
        const dy = targetY - rabbitY;
        const dist = Math.hypot(dx, dy);

        if (dist > 3) {
          isRunning = true;
          sprite.classList.remove('rabbit-idle-breathe');

          // Rush faster when cursor has stopped to collide
          const maxSpeed = cursorStopped ? 26 : 20;
          const minSpeed = cursorStopped ? 4.5 : 3.0;
          const speedFactor = cursorStopped ? 0.24 : 0.14;
          const speed = Math.min(maxSpeed, Math.max(minSpeed, dist * speedFactor));
          const ratio = Math.min(1, speed / dist);

          rabbitX += dx * ratio;
          rabbitY += dy * ratio;

          if (Math.abs(dx) > 1.5) {
            facing = dx > 0 ? 1 : -1;
          }

          hopAngle += (cursorStopped ? 0.38 : 0.28);
          const hopHeight = Math.min(12, dist * 0.2);
          const hopY = -Math.abs(Math.sin(hopAngle)) * hopHeight;

          const hopStretch = 1 + (Math.sin(hopAngle) * 0.12);
          const hopSquash = 1 - (Math.sin(hopAngle) * 0.08);
          const tilt = Math.max(-12, Math.min(12, (dy / (Math.abs(dx) + 1)) * 12));

          const legCycle = Math.sin(hopAngle * 2);
          if (frontLeg) frontLeg.style.transform = `rotate(${legCycle * 26}deg) translate(${legCycle * 1.5}px, 0)`;
          if (backLeg) backLeg.style.transform = `rotate(${-legCycle * 28}deg) translate(${-legCycle * 1.5}px, 0)`;

          const earFlap = -14 - Math.sin(hopAngle) * 8;
          if (frontEar) frontEar.style.transform = `rotate(${earFlap}deg)`;
          if (backEar) backEar.style.transform = `rotate(${earFlap - 3}deg)`;

          const shadowScale = 1 - (Math.abs(hopY) / hopHeight) * 0.35;
          if (shadow) shadow.style.transform = `scale(${shadowScale})`;

          tracker.style.transform = `translate3d(${rabbitX}px, ${rabbitY}px, 0) scaleX(${facing})`;
          sprite.style.transform = `translate3d(0, ${hopY}px, 0) rotate(${tilt * facing}deg) scale(${hopStretch}, ${hopSquash})`;

          if (Math.abs(hopY) < 2.0) {
            spawnDust(rabbitX + (facing === 1 ? 6 : 26), rabbitY + 24);
          }
        } else {
          // Arrived right at target!
          if (cursorStopped && !hasCollided) {
            hasCollided = true;
            triggerCollisionBoop();
          }

          if (isRunning) {
            isRunning = false;
            rabbitX = targetX;
            rabbitY = targetY;
            sprite.classList.add('rabbit-idle-breathe');

            if (frontLeg) frontLeg.style.transform = 'none';
            if (backLeg) backLeg.style.transform = 'none';
            if (frontEar) frontEar.style.transform = 'none';
            if (backEar) backEar.style.transform = 'none';
            if (shadow) shadow.style.transform = 'scale(1)';
            sprite.style.transform = 'none';
          }

          rabbitX = targetX;
          rabbitY = targetY;
          tracker.style.transform = `translate3d(${rabbitX}px, ${rabbitY}px, 0) scaleX(${facing})`;
        }
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRabbit);
  } else {
    initRabbit();
  }
})();
