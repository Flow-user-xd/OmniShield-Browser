/**
 * OmniShield Interactive Cursor Companion: White Rabbit Runner (Browser Page Content Script)
 * - Perfectly compact (~32px width)
 * - Trails comfortably 50px away from the cursor pointer so it never covers buttons or text
 * - Real bounding forward leap: airborne parabolic flight arc, mid-air surge, landing squash & dust
 * - Detached ground shadow stays on the ground for authentic 3D leap perspective
 * - 3x boosted speed with responsive distance acceleration
 * - Gentle breathing, ear twitches, and nose twitches when stationary
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
        width: 38px;
        height: 32px;
        will-change: transform;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        transform-origin: 19px 28px;
      }
      .rabbit-sprite {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        transform-origin: 19px 26px;
        will-change: transform;
        pointer-events: none !important;
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.4));
      }
      .rabbit-shadow {
        position: absolute;
        left: 5px;
        bottom: -2px;
        width: 28px;
        height: 8px;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0) 72%);
        border-radius: 50%;
        transform-origin: center center;
        pointer-events: none;
        will-change: transform, opacity;
      }
      .rabbit-svg {
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
      }
      .rabbit-dust {
        position: fixed;
        width: 5px;
        height: 5px;
        background: rgba(255, 255, 255, 0.88);
        border-radius: 50%;
        pointer-events: none;
        box-shadow: 0 0 6px rgba(0, 242, 254, 0.7);
        animation: rabbitDustFade 0.4s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
        z-index: 2147483645;
      }
      @keyframes rabbitDustFade {
        0% { transform: scale(1) translate(0, 0); opacity: 0.88; }
        100% { transform: scale(0.2) translate(var(--dust-vx, -8px), var(--dust-vy, -6px)); opacity: 0; }
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

    const shadow = document.createElement('div');
    shadow.className = 'rabbit-shadow';
    shadow.id = 'rabbit-shadow';

    const sprite = document.createElement('div');
    sprite.className = 'rabbit-sprite rabbit-idle-breathe';

    sprite.innerHTML = `
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

    tracker.appendChild(shadow);
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
    let hasMovedCursor = false;
    let hasCollided = false;
    let currentSpeed = 0;
    let lastFrameTime = performance.now();

    tracker.style.transform = `translate3d(${rabbitX}px, ${rabbitY}px, 0) scaleX(${facing})`;

    function onPointerMove(e) {
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveTime);
      const moveDist = Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY);
      mouseSpeed = Math.min(2.5, moveDist / dt);
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

      const heart = document.createElement('div');
      heart.className = 'rabbit-boop-heart';
      heart.innerText = Math.random() > 0.4 ? '✨' : '💖';
      heart.style.left = `${mouseX - 8}px`;
      heart.style.top = `${mouseY - 20}px`;
      container.appendChild(heart);
      setTimeout(() => heart.remove(), 650);
    }

    function spawnDust(x, y, dir) {
      const numPuffs = 2;
      for (let i = 0; i < numPuffs; i++) {
        const dust = document.createElement('div');
        dust.className = 'rabbit-dust';
        dust.style.left = `${x + (i * 4 - 2)}px`;
        dust.style.top = `${y}px`;
        const vx = (dir === 1 ? -1 : 1) * (5 + Math.random() * 5);
        const vy = -(2 + Math.random() * 4);
        dust.style.setProperty('--dust-vx', `${vx}px`);
        dust.style.setProperty('--dust-vy', `${vy}px`);
        container.appendChild(dust);
        setTimeout(() => dust.remove(), 400);
      }
    }

    const frontEar = sprite.querySelector('#rabbit-front-ear');
    const backEar = sprite.querySelector('#rabbit-back-ear');
    const frontLeg = sprite.querySelector('#rabbit-front-leg');
    const backLeg = sprite.querySelector('#rabbit-back-leg');

    // 3x boosted real leap configuration
    const maxSpeedBase = 4.2;
    const minSpeedBase = 1.4;
    const jumpCadence = 0.125;
    const jumpHeight = 18;

    function loop() {
      const now = performance.now();
      const dtMs = Math.min(64, Math.max(4, now - lastFrameTime));
      lastFrameTime = now;
      const dtFactor = dtMs / 16.667;

      if (hasMovedCursor) {
        const timeSinceMove = now - lastMoveTime;
        const cursorStopped = timeSinceMove > 130;

        let targetX, targetY;
        if (cursorStopped) {
          const targetFacing = mouseX >= rabbitX ? 1 : -1;
          targetX = mouseX - (targetFacing === 1 ? 24 : 10);
          targetY = mouseY - 14;
        } else {
          const trailDist = Math.min(48, Math.max(26, mouseSpeed * 6 + 26));
          const dirX = mouseX >= rabbitX ? -1 : 1;
          targetX = mouseX + (dirX * trailDist);
          targetY = mouseY + 14;
        }

        const dx = targetX - rabbitX;
        const dy = targetY - rabbitY;
        const dist = Math.hypot(dx, dy);

        if (dist > 4) {
          isRunning = true;
          sprite.classList.remove('rabbit-idle-breathe');

          const maxSpeed = cursorStopped ? maxSpeedBase * 1.15 : maxSpeedBase;
          const minSpeed = minSpeedBase;

          let desiredSpeed = minSpeed + Math.min(maxSpeed - minSpeed, Math.sqrt(dist) * 0.28);
          desiredSpeed = Math.min(maxSpeed, Math.max(minSpeed, desiredSpeed));

          const smoothing = Math.min(1, 0.12 * dtFactor);
          currentSpeed += (desiredSpeed - currentSpeed) * smoothing;
          currentSpeed = Math.min(maxSpeed, Math.max(minSpeed, currentSpeed));

          const speedRatio = currentSpeed / maxSpeed;
          const cadence = jumpCadence * (0.85 + speedRatio * 0.35) * dtFactor;
          const prevHopAngle = hopAngle;
          hopAngle = (hopAngle + cadence) % (Math.PI * 2);

          const isAirborne = hopAngle < Math.PI;
          let hopY = 0;
          let forwardSurge = 1.0;
          let bodyScaleX = 1.0;
          let bodyScaleY = 1.0;
          let bodyTilt = 0;
          let earAngle = 0;
          let shadowScale = 1.0;
          let shadowOpacity = 0.6;
          let squashProgress = 0;

          if (isAirborne) {
            const flightProgress = hopAngle / Math.PI;
            const arcSin = Math.sin(hopAngle);
            const peakHeight = jumpHeight * (0.8 + speedRatio * 0.35);
            hopY = -arcSin * peakHeight;

            forwardSurge = 1.0 + (arcSin * 0.7);
            bodyScaleX = 1.0 + (arcSin * 0.22);
            bodyScaleY = 1.0 - (arcSin * 0.16);
            earAngle = -16 - (arcSin * 10);
            bodyTilt = (0.5 - flightProgress) * 16;
            shadowScale = Math.max(0.42, 1.0 - (arcSin * 0.52));
            shadowOpacity = Math.max(0.2, 0.6 - (arcSin * 0.38));
          } else {
            const contactProgress = (hopAngle - Math.PI) / Math.PI;
            squashProgress = Math.sin(contactProgress * Math.PI);

            hopY = 0;
            forwardSurge = Math.max(0.35, 1.0 - (squashProgress * 0.65));
            bodyScaleX = 1.0 + (squashProgress * 0.22);
            bodyScaleY = 1.0 - (squashProgress * 0.18);
            earAngle = squashProgress * 6;
            bodyTilt = 0;
            shadowScale = 1.0 + (squashProgress * 0.24);
            shadowOpacity = 0.65;

            if (prevHopAngle < Math.PI && hopAngle >= Math.PI) {
              const dustX = rabbitX + (facing === 1 ? 4 : 28);
              const dustY = rabbitY + 26;
              spawnDust(dustX, dustY, facing);
            }
          }

          const effectiveSpeed = currentSpeed * forwardSurge;
          const step = Math.min(dist, effectiveSpeed * dtFactor);
          const ratio = step / dist;

          rabbitX += dx * ratio;
          rabbitY += dy * ratio;

          if (Math.abs(dx) > 1.8) {
            facing = dx > 0 ? 1 : -1;
          }

          const legCycle = Math.sin(hopAngle);
          if (frontLeg) {
            frontLeg.style.transform = isAirborne
              ? `rotate(${legCycle * 26}deg) translate(${legCycle * 2}px, -1px)`
              : `rotate(${-squashProgress * 12}deg)`;
          }
          if (backLeg) {
            backLeg.style.transform = isAirborne
              ? `rotate(${-legCycle * 30}deg) translate(${-legCycle * 2.5}px, 1px)`
              : `rotate(${squashProgress * 15}deg)`;
          }

          if (frontEar) frontEar.style.transform = `rotate(${earAngle}deg)`;
          if (backEar) backEar.style.transform = `rotate(${earAngle - 3}deg)`;

          if (shadow) {
            shadow.style.transform = `scale(${shadowScale})`;
            shadow.style.opacity = shadowOpacity;
          }

          tracker.style.transform = `translate3d(${rabbitX}px, ${rabbitY}px, 0) scaleX(${facing})`;
          sprite.style.transform = `translate3d(0, ${hopY}px, 0) rotate(${bodyTilt}deg) scale(${bodyScaleX}, ${bodyScaleY})`;

        } else {
          currentSpeed = 0;
          hopAngle = 0;
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
            if (shadow) {
              shadow.style.transform = 'scale(1)';
              shadow.style.opacity = '0.6';
            }
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
