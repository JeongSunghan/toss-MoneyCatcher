/**
 * render.js - 렌더링 시스템
 */
(function() {
  "use strict";

  window.Game = window.Game || {};

  let cachedGradient = null;
  let cachedGradientHeight = 0;

  Game.RenderSystem = {
    clear(ctx, cvs) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    },

    drawBackground(ctx, cvs) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;

      if (!cachedGradient || cachedGradientHeight !== canvasHeight) {
        cachedGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        cachedGradient.addColorStop(0, "#87CEEB");
        cachedGradient.addColorStop(0.5, "#5C94FC");
        cachedGradient.addColorStop(1, "#4A7BC8");
        cachedGradientHeight = canvasHeight;
      }

      ctx.fillStyle = cachedGradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    },

    drawImageOrCircle(ctx, cvs, world, img, x, y, r, fallbackColor, label, type) {
      const rect = cvs.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const s = world.scale,
        ox = (displayWidth - world.w * s) / 2,
        oy = (displayHeight - world.h * s) / 2;
      const cx = ox + x * s,
        cy = oy + y * s;

      if (img && img.complete && img.naturalWidth > 0) {
        const isCoin = type && (type === "cash10" || type === "cash50" ||
                                 type === "cash100" || type === "cash500");
        const isBill = type && (type === "cash1000" || type === "cash5000" ||
                                type === "cash10000" || type === "cash50000");

        if (isCoin) {
          ctx.save();
          const coinSize = r * 2 * s * 1.1;
          const coinRadius = coinSize / 2;

          ctx.beginPath();
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.arc(cx + 3, cy + 3, coinRadius * 0.95, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cx, cy, coinRadius, 0, Math.PI * 2);
          ctx.clip();

          ctx.drawImage(img, cx - coinSize / 2, cy - coinSize / 2, coinSize, coinSize);
          ctx.restore();
        } else if (isBill) {
          ctx.save();
          const billWidth = r * 2 * s * 1.6;
          const billHeight = r * 2 * s * 1.0;

          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.fillRect(cx - billWidth / 2 + 3, cy - billHeight / 2 + 3, billWidth, billHeight);

          ctx.drawImage(img, cx - billWidth / 2, cy - billHeight / 2, billWidth, billHeight);
          ctx.restore();
        } else {
          ctx.save();
          const sz = r * 2 * s * 1.2;

          ctx.beginPath();
          ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
          ctx.arc(cx + 2, cy + 2, sz / 2 * 0.95, 0, Math.PI * 2);
          ctx.fill();

          ctx.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz);
          ctx.restore();
        }
      } else {
        ctx.beginPath();
        ctx.fillStyle = fallbackColor;
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 4;
        ctx.arc(cx, cy, r * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.floor(r * s * 0.8)}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 2;
        ctx.fillText(label, cx, cy);
      }
    },

    drawDrop(ctx, cvs, world, d, IMG, COLOR, LABEL) {
      this.drawImageOrCircle(
        ctx, cvs, world,
        IMG[d.type], d.x, d.y, d.r,
        COLOR[d.type] || "#999",
        LABEL[d.type] || "?",
        d.type
      );
    },

    drawParticles(ctx, cvs, world, particles) {
      const rect = cvs.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const s = world.scale,
        ox = (displayWidth - world.w * s) / 2,
        oy = (displayHeight - world.h * s) / 2;

      const isMobile = window.innerWidth <= 768;

      ctx.save();
      for (const p of particles) {
        if (!p.active) continue;

        const px = ox + p.x * s,
          py = oy + p.y * s;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        if (!isMobile) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.arc(px, py, p.size * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    applyFeverTimeEffect(ctx) {
      ctx.shadowColor = "#FF0000";
      ctx.shadowBlur = 20;
      ctx.filter = "brightness(1.2)";
    },

    applyBurnoutEffect(ctx) {
      ctx.filter = "grayscale(100%)";
    },

    drawOvertimeModeOverlay(ctx, cvs) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    },

    drawRealEstateBoomOverlay(ctx, cvs) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      const overlayHeight = canvasHeight * 0.3;
      ctx.fillStyle = "rgba(139, 111, 71, 0.7)";
      ctx.fillRect(0, canvasHeight - overlayHeight, canvasWidth, overlayHeight);
      ctx.fillStyle = "rgba(92, 70, 50, 0.8)";
      for (let i = 0; i < 5; i++) {
        const x = (canvasWidth / 6) * (i + 1);
        const width = canvasWidth / 10;
        const height = overlayHeight * (0.5 + Math.random() * 0.5);
        ctx.fillRect(x - width / 2, canvasHeight - height, width, height);
      }
    },

    applyGoldenTimeEffect(ctx) {
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 15;
      ctx.filter = "brightness(1.3) saturate(1.5)";
    },

    drawMagnetRange(ctx, cvs, world, agent) {
      if (!agent) return;

      ctx.save();

      const rect = cvs.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const s = world.scale;
      const ox = (displayWidth - world.w * s) / 2;
      const oy = (displayHeight - world.h * s) / 2;

      const px = ox + agent.x * s;
      const py = oy + agent.y * s;

      const agentSpriteHeight = (agent.h || 32) * s * 1.25;
      const agentOffsetY = 8 * s;

      const iconY = py - agentSpriteHeight / 2 - agentOffsetY - 15 * s;
      const iconX = px;

      const time = performance.now() / 1000;
      const pulseScale = 1.0 + Math.sin(time * 3) * 0.1;
      const fontSize = 24 * pulseScale * s;

      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.shadowColor = "rgba(78, 205, 196, 0.5)";
      ctx.shadowBlur = 8;

      ctx.fillText("🧲", iconX, iconY);

      ctx.restore();
    },

    applyStockBoomEffect(ctx, cvs) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      const time = performance.now() / 100;

      const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      const hue = (time * 10) % 360;
      gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, 0.2)`);
      gradient.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 70%, 60%, 0.2)`);
      gradient.addColorStop(1, `hsla(${(hue + 120) % 360}, 70%, 60%, 0.2)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    },

    render(ctx, cvs, world, state) {
      const {
        IMG, COLOR, LABEL, ITEM,
        drops, particles,
        AgentSystem, BuffSystem, ComboSystem,
        hasDebuff, DEBUFFS, BUFFS,
      } = state;

      this.clear(ctx, cvs);
      this.drawBackground(ctx, cvs);

      const now = performance.now();
      const shouldShake = world.shakeT > now;
      if (shouldShake) {
        ctx.save();
        ctx.translate(
          (Math.random() * 2 - 1) * world.shakeAmp,
          (Math.random() * 2 - 1) * world.shakeAmp
        );
      }

      ctx.save();

      const isFeverTime = ComboSystem && ComboSystem.isFeverTime;
      if (isFeverTime) {
        this.applyFeverTimeEffect(ctx);
      }

      for (const d of drops) {
        if (d && d.alive) {
          if (hasDebuff && hasDebuff(DEBUFFS.FOMO_SYNDROME) && (d.type === ITEM.TAX || d.type === ITEM.DEBT)) {
            const fakeType = ITEM.CASH1000;
            this.drawImageOrCircle(
              ctx, cvs, world,
              IMG[fakeType], d.x, d.y, d.r,
              COLOR[fakeType] || "#999",
              LABEL[fakeType] || "?",
              fakeType
            );
          } else {
            this.drawDrop(ctx, cvs, world, d, IMG, COLOR, LABEL);
          }
        }
      }

      this.drawParticles(ctx, cvs, world, particles);

      let agent = null;
      if (AgentSystem) {
        agent = AgentSystem.agent || null;
        if (AgentSystem.drawAgentSprite) {
          AgentSystem.drawAgentSprite(ctx, cvs, world, IMG);
        }
      }

      ctx.restore();

      if (BuffSystem && BuffSystem.hasBuff && BuffSystem.hasBuff(BUFFS.MAGNET) && agent) {
        this.drawMagnetRange(ctx, cvs, world, agent);
      }

      if (hasDebuff && hasDebuff(DEBUFFS.OVERTIME_MODE)) {
        this.drawOvertimeModeOverlay(ctx, cvs);
      }

      if (hasDebuff && hasDebuff(DEBUFFS.REAL_ESTATE_BOOM)) {
        this.drawRealEstateBoomOverlay(ctx, cvs);
      }

      if (BuffSystem && BuffSystem.hasBuff && BuffSystem.hasBuff(BUFFS.STOCK_BOOM)) {
        this.applyStockBoomEffect(ctx, cvs);
      }

      if (shouldShake) {
        ctx.restore();
      }
    },
  };
})();
