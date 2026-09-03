/**
 * OmniShield Interactive Cursor Companion: White Rabbit Runner
 * A charming, cute white bunny that chases and follows the user's cursor across the screen.
 * Two-tier architecture:
 * - Outer tracker: manages absolute translation (X, Y) and facing direction without CSS animation conflict.
 * - Inner sprite: manages breathing, hopping arcs, squash & stretch, ear wiggles, and paw bounding.
 */
(function() {
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
        z-index: 99999999 !important;
        overflow: visible;
        user-select: none;
      }
      .rabbit-tracker {
        position: fixed;
        top: 0;
        left: 0;
        width: 60px;
        height: 52px;
        will-change: transform;
        pointer-events: none !important;
        z-index: 99999999 !important;
      }
      .rabbit-sprite {
        position: relative;
        width: 100%;
        height: 100%;
        transform-origin: 30px 42px;
        will-change: transform;
        pointer-events: none !important;
        filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55));
      }
      .rabbit-shadow {
        position: absolute;
        left: 12px;
        bottom: -4px;
        width: 36px;
        height: 10px;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 70%);
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
        width: 7px;
        height: 7px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        pointer-events: none;
        box-shadow: 0 0 8px rgba(0, 242, 254, 0.7);
        animation: rabbitDustFade 0.45s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      }
      @keyframes rabbitDustFade {
        0% { transform: scale(1) translate(0, 0); opacity: 0.9; }
        100% { transform: scale(0.2) translate(-14px, -8px); opacity: 0; }
      }
      @keyframes rabbitBreathe {
        0%, 100% { transform: scale(1, 1); }
        50% { transform: scale(1.05, 0.95) translateY(1px); }
      }
      .rabbit-idle-breathe {
        animation: rabbitBreathe 2.2s ease-in-out infinite;
      }
      @keyframes noseTwitch {
        0%, 75%, 100% { transform: scale(1); }
        80% { transform: scale(1.35, 0.8); }
        85% { transform: scale(0.85, 1.25); }
        90% { transform: scale(1.2, 0.9); }
      }
      .rabbit-nose-twitch {
        animation: noseTwitch 2s ease-in-out infinite;
        transform-origin: 40px 25px;
      }
      @keyframes earTwitch {
        0%, 80%, 100% { transform: rotate(0deg); }
        84% { transform: rotate(-10deg); }
        88% { transform: rotate(8deg); }
        92% { transform: rotate(-5deg); }
      }
      .rabbit-ear-twitch {
        animation: earTwitch 3.2s ease-in-out infinite;
        transform-origin: 24px 16px;
      }
    `;

    // Main Container
    const container = document.createElement('div');
    container.id = 'omni-rabbit-cursor-companion';

    // Tracker Wrap (Handles translation X, Y and facing)
    const tracker = document.createElement('div');
    tracker.className = 'rabbit-tracker';

    // Sprite (Handles physics, squash & stretch, breathing)
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

        <!-- Back Ear -->
        <g id="rabbit-back-ear" class="rabbit-ear-twitch">
          <path d="M19 16 C17 2, 20 -3, 23 0 C26 3, 24 11, 22 17 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>
          <path d="M20 14 C18.5 4, 20.5 0.5, 22.5 1.5 C24 2.5, 23 9, 21.5 14 Z" fill="url(#earPink)"/>
        </g>

        <!-- Fluffy Cotton Tail -->
        <circle id="rabbit-tail" cx="7" cy="27" r="5.5" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.9"/>

        <!-- Back Leg -->
        <path id="rabbit-back-leg" d="M12 28 C9 26, 8 34, 14 37 C19 39, 22 37, 21 34 C19 32, 16 30, 12 28 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>

        <!-- Bunny Body -->
        <path id="rabbit-body" d="M11 26 C11 17, 22 17, 29 19 C36 21, 38 27, 36 34 C33 39, 15 39, 11 26 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>

        <!-- Front Leg -->
        <path id="rabbit-front-leg" d="M28 32 C29 37, 31 39, 34 38 C36 37, 35 32, 32 30 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.8"/>

        <!-- Head -->
        <circle id="rabbit-head" cx="32" cy="22" r="9.5" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>

        <!-- Muzzle / Cheeks -->
        <ellipse cx="37" cy="25.5" rx="3.8" ry="3" fill="#FFFFFF"/>
        <ellipse cx="33.5" cy="26.5" rx="3.4" ry="2.7" fill="#FFFFFF"/>

        <!-- Front Ear -->
        <g id="rabbit-front-ear" class="rabbit-ear-twitch">
          <path d="M24 17 C23 2, 28 -4, 32 0 C34 3.5, 31 12, 27 19 Z" fill="url(#bunnyFur)" stroke="#CBD5E1" stroke-width="0.9"/>
          <path d="M25 15 C24.5 3, 28 0, 30.5 2 C32 4, 29 10, 27 16 Z" fill="url(#earPink)"/>
        </g>

        <!-- Eye with Sparkle Reflection -->
        <circle cx="34.5" cy="19" r="2.2" fill="url(#eyeGleam)"/>
        <circle cx="35.2" cy="18.3" r="0.8" fill="#FFFFFF"/>

        <!-- Pink Nose -->
        <path id="rabbit-nose" class="rabbit-nose-twitch" d="M38.5 23.5 C39.2 23.5, 39.7 24, 39.2 24.6 C38.7 25.2, 38.3 25.2, 37.8 24.6 C37.4 24, 37.8 23.5, 38.5 23.5 Z" fill="#F43F5E"/>

        <!-- Mouth & Whiskers -->
        <path d="M38.5 25.2 L38.5 26.5 M38.5 26.5 C37.5 27.5, 36.5 27, 36 26.5 M38.5 26.5 C39.5 27.5, 40.5 27, 41 26.5" stroke="#94A3B8" stroke-width="0.7" stroke-linecap="round"/>
        <path d="M39 24.5 L46 22.5 M39 25.5 L47 25.5 M39 26.5 L45 28.5" stroke="#94A3B8" stroke-width="0.6" stroke-linecap="round"/>
      </svg>
    `;

    tracker.appendChild(sprite);
    container.appendChild(tracker);
    document.body.appendChild(container);

    // Initial position: clearly visible on the screen
    let rabbitX = Math.min(window.innerWidth - 140, 280);
    let rabbitY = Math.min(window.innerHeight - 140, 180);
    let targetX = rabbitX;
    let targetY = rabbitY;

    let facing = 1;
    let isRunning = false;
    let hopAngle = 0;
    let dustCounter = 0;
    let hasMovedCursor = false;

    // Apply initial position directly
    tracker.style.transform = `translate3d(${rabbitX}px, ${rabbitY}px, 0) scaleX(${facing})`;

    function onPointerMove(e) {
      hasMovedCursor = true;
      targetX = e.clientX - 28;
      targetY = e.clientY - 38;
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true, capture: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    document.addEventListener('mousemove', onPointerMove, { passive: true, capture: true });

    function spawnDust(x, y) {
      if (++dustCounter % 3 !== 0) return;
      const dust = document.createElement('div');
      dust.className = 'rabbit-dust';
      dust.style.left = `${x}px`;
      dust.style.top = `${y}px`;
      container.appendChild(dust);
      setTimeout(() => dust.remove(), 450);
    }

    const frontEar = sprite.querySelector('#rabbit-front-ear');
    const backEar = sprite.querySelector('#rabbit-back-ear');
    const frontLeg = sprite.querySelector('#rabbit-front-leg');
    const backLeg = sprite.querySelector('#rabbit-back-leg');
    const shadow = sprite.querySelector('#rabbit-shadow');

    function loop() {
      if (hasMovedCursor) {
        const dx = targetX - rabbitX;
        const dy = targetY - rabbitY;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
          isRunning = true;
          sprite.classList.remove('rabbit-idle-breathe');

          // Dynamic pursuit speed
          const speed = Math.min(26, Math.max(3.5, dist * 0.16));
          const ratio = Math.min(1, speed / dist);

          rabbitX += dx * ratio;
          rabbitY += dy * ratio;

          if (dx > 2) facing = 1;
          else if (dx < -2) facing = -1;

          // Hopping Arc
          hopAngle += 0.25;
          const hopHeight = Math.min(15, dist * 0.22);
          const hopY = -Math.abs(Math.sin(hopAngle)) * hopHeight;

          // Squash & Stretch
          const hopStretch = 1 + (Math.sin(hopAngle) * 0.12);
          const hopSquash = 1 - (Math.sin(hopAngle) * 0.09);
          const tilt = Math.max(-15, Math.min(15, (dy / (Math.abs(dx) + 1)) * 14));

          // Leg bounding
          const legCycle = Math.sin(hopAngle * 2);
          if (frontLeg) frontLeg.style.transform = `rotate(${legCycle * 28}deg) translate(${legCycle * 2}px, 0)`;
          if (backLeg) backLeg.style.transform = `rotate(${-legCycle * 32}deg) translate(${-legCycle * 3}px, 0)`;

          // Flopping ears in wind
          const earFlap = -18 - Math.sin(hopAngle) * 9;
          if (frontEar) frontEar.style.transform = `rotate(${earFlap}deg)`;
          if (backEar) backEar.style.transform = `rotate(${earFlap - 4}deg)`;

          // Ground shadow
          const shadowScale = 1 - (Math.abs(hopY) / hopHeight) * 0.45;
          if (shadow) shadow.style.transform = `scale(${shadowScale})`;

          // Outer tracker handles translation and facing
          tracker.style.transform = `translate3d(${rabbitX}px, ${rabbitY}px, 0) scaleX(${facing})`;

          // Inner sprite handles hopping Y, stretch, tilt
          sprite.style.transform = `translate3d(0, ${hopY}px, 0) rotate(${tilt * facing}deg) scale(${hopStretch}, ${hopSquash})`;

          // Dust puffs on paw landing
          if (Math.abs(hopY) < 3.5) {
            spawnDust(rabbitX + (facing === 1 ? 10 : 48), rabbitY + 44);
          }
        } else {
          // Reached cursor! Stop right on cursor and enter idle
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
