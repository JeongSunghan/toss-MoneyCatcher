/**
 * items.js - 아이템 시스템
 */
(() => {
  "use strict";

  window.Game = window.Game || {};

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  const PARTICLE_POOL_SIZE = window.Game?.performanceMode?.maxParticles || (isMobile ? 80 : 150);
  const particlePool = [];
  let particlePoolIndex = 0;

  function initParticlePool() {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      particlePool.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, lifeDecay: 0,
        color: '', size: 0, type: '',
        active: false
      });
    }
  }

  function getParticleFromPool() {
    if (particlePool.length === 0) {
      initParticlePool();
    }

    for (let i = 0; i < particlePool.length; i++) {
      const idx = (particlePoolIndex + i) % particlePool.length;
      if (!particlePool[idx].active) {
        particlePoolIndex = (idx + 1) % particlePool.length;
        return particlePool[idx];
      }
    }
    const oldest = particlePool[particlePoolIndex];
    particlePoolIndex = (particlePoolIndex + 1) % particlePool.length;
    return oldest;
  }

  initParticlePool();

  Game.ItemSystem = {
    drops: [],
    particles: particlePool,
    nextSpawnAt: 0,

    rndWeighted(tbl) {
      const tot = tbl.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * tot;
      for (const [t, w] of tbl) {
        if ((r -= w) <= 0) return t;
      }
      return tbl.at(-1)[0];
    },

    spawnOne(world, config, debuffSystem, currentLevel = 1) {
      const ITEM = window.Game?.ITEM || {};
      const getWeightsByLevel = window.Game?.config?.getWeightsByLevel;
      const BuffSystem = window.Game?.BuffSystem;

      let type;
      if (currentLevel >= 3 && Math.random() < 0.1) {
        const buffWeights = [
          [ITEM.BUFF_GOLDEN_TIME, 50],
          [ITEM.BUFF_MAGNET, 45],
          [ITEM.BUFF_STOCK_BOOM, 5],
        ];
        type = this.rndWeighted(buffWeights);
      } else {
        let weights = getWeightsByLevel ? getWeightsByLevel(currentLevel) : [];
        weights = [...weights];

        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(window.Game?.DEBUFFS?.TAX_BOMB)) {
          weights = weights.map(([type, weight]) => {
            if (type === ITEM.TAX || type === ITEM.DEBT) {
              return [type, weight * 2.75];
            }
            return [type, weight];
          });
        }

        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(window.Game?.DEBUFFS?.LIQUIDITY_CRISIS)) {
          weights = weights.map(([type, weight]) => {
            if (type === ITEM.CASH10 || type === ITEM.CASH50 || type === ITEM.CASH100 ||
                type === ITEM.CASH500 || type === ITEM.CASH1000 || type === ITEM.CASH5000 ||
                type === ITEM.CASH10000 || type === ITEM.CASH50000) {
              return [type, weight * 0.5];
            }
            return [type, weight];
          });
        }

        if (BuffSystem && BuffSystem.stockBoomActive) {
          weights = weights.filter(([type]) => type !== ITEM.TAX && type !== ITEM.DEBT);
          weights = weights.map(([type, weight]) => {
            if (type === ITEM.CASH10 || type === ITEM.CASH50 || type === ITEM.CASH100 ||
                type === ITEM.CASH500 || type === ITEM.CASH1000 || type === ITEM.CASH5000 ||
                type === ITEM.CASH10000 || type === ITEM.CASH50000) {
              return [ITEM.CASH50000, weight];
            }
            return [type, weight];
          });
        }

        type = this.rndWeighted(weights);
      }
      const margin = 16;

      const gridSize = (world.w - margin * 2) / 4;
      const gridIndex = Math.floor(Math.random() * 4);
      const x = margin + gridIndex * gridSize + gridSize / 2;
      const y = -20;

      const r = 18;
      const vy = 0.08 + Math.random() * 0.06;

      this.drops.push({ x, y, r, vy, type, alive: true });
    },

    spawnParticles(x, y, color, count = 8, options = {}) {
      const {
        speed = 1.0,
        sizeMultiplier = 1.0,
        spread = 1.0,
        type = 'normal'
      } = options;

      for (let i = 0; i < count; i++) {
        let vx, vy, size, lifeDecay;

        if (type === 'burst') {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
          const baseSpeed = (0.3 + Math.random() * 0.2) * speed;
          vx = Math.cos(angle) * baseSpeed;
          vy = Math.sin(angle) * baseSpeed - 0.1;
          size = (4 + Math.random() * 6) * sizeMultiplier;
          lifeDecay = 0.015;
        } else if (type === 'sparkle') {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 1.0;
          const baseSpeed = (0.1 + Math.random() * 0.15) * speed;
          vx = Math.cos(angle) * baseSpeed * spread;
          vy = Math.sin(angle) * baseSpeed * spread - 0.03;
          size = (2 + Math.random() * 3) * sizeMultiplier;
          lifeDecay = 0.02;
        } else if (type === 'explosion') {
          const angle = Math.random() * Math.PI * 2;
          const baseSpeed = (0.4 + Math.random() * 0.3) * speed;
          vx = Math.cos(angle) * baseSpeed * spread;
          vy = Math.sin(angle) * baseSpeed * spread;
          size = (5 + Math.random() * 10) * sizeMultiplier;
          lifeDecay = 0.012;
        } else {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
          const baseSpeed = (0.15 + Math.random() * 0.1) * speed;
          vx = Math.cos(angle) * baseSpeed * spread;
          vy = Math.sin(angle) * baseSpeed * spread - 0.05;
          size = (3 + Math.random() * 4) * sizeMultiplier;
          lifeDecay = 0.018;
        }

        const p = getParticleFromPool();
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.life = 1.0;
        p.lifeDecay = lifeDecay;
        p.color = color;
        p.size = size;
        p.type = type;
        p.active = true;
      }
    },

    spawnComboParticles(x, y, comboLevel) {
      const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#FFE66D'];
      const count = Math.min(15, 8 + comboLevel / 10);

      this.spawnParticles(x, y, colors[Math.floor(Math.random() * colors.length)], count, {
        speed: 1.5,
        sizeMultiplier: 1.8,
        spread: 1.3,
        type: 'burst'
      });

      this.spawnParticles(x, y, '#FFFFFF', Math.ceil(count / 2), {
        speed: 2.0,
        sizeMultiplier: 1.0,
        spread: 1.5,
        type: 'sparkle'
      });
    },

    spawnExplosion(x, y) {
      const colors = ['#FF6B6B', '#FFA500', '#FFD700', '#FF4444'];

      for (let ring = 0; ring < 3; ring++) {
        setTimeout(() => {
          const count = 20 + ring * 10;
          const color = colors[ring % colors.length];
          this.spawnParticles(x, y, color, count, {
            speed: 1.0 + ring * 0.3,
            sizeMultiplier: 2.0 - ring * 0.3,
            spread: 1.5 + ring * 0.5,
            type: 'explosion'
          });
        }, ring * 100);
      }
    },

    calculateScore(type, comboCount, isFeverTime, debuffSystem, adminMode, comboMultiplier) {
      const ITEM = window.Game?.ITEM || {};
      const SCORE = window.Game?.config?.SCORE || {};
      const DEBUFFS = window.Game?.DEBUFFS || {};
      const base = SCORE[type] || 0;

      if (type === ITEM.TAX || type === ITEM.DEBT) {
        let scoreMultiplier = 1.0;
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.KOSPI_DOWN)) {
          scoreMultiplier *= 0.5;
        }
        if (type === ITEM.DEBT && debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.INTEREST_RATE_UP)) {
          scoreMultiplier *= 2.0;
        }
        if (isFeverTime) {
          scoreMultiplier = 1.0;
        }
        if (adminMode && adminMode.enabled) {
          scoreMultiplier *= adminMode.scoreMultiplier;
        }
        return Math.floor(base * scoreMultiplier);
      } else {
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.SALARY_FREEZE)) {
          return 0;
        }

        let baseScore = base * (comboMultiplier || 1.0);

        const BuffSystem = window.Game?.BuffSystem;
        const BUFFS = window.Game?.BUFFS || {};
        if (BuffSystem && BuffSystem.hasBuff && BuffSystem.hasBuff(BUFFS.STOCK_BOOM)) {
          baseScore = (SCORE[ITEM.CASH50000] || 50000) * (comboMultiplier || 1.0);
        }

        let scoreMultiplier = 1.0;
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.KOSPI_DOWN)) {
          scoreMultiplier *= 0.5;
        }
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.SAVING_OBSESSION)) {
          scoreMultiplier *= 0.7;
        }
        if (isFeverTime) {
          scoreMultiplier *= 2.0;
        }
        if (adminMode && adminMode.enabled) {
          scoreMultiplier *= adminMode.scoreMultiplier;
        }
        return Math.floor(baseScore * scoreMultiplier);
      }
    },

    updatePhysics(dt, world, level, debuffSystem) {
      const DEBUFFS = window.Game?.DEBUFFS || {};

      let g = level.g;
      let maxV = level.maxSpeed;

      if (debuffSystem?.hasDebuff?.(DEBUFFS.PANIC_SELL)) {
        g *= 2.0;
        maxV *= 2.0;
      }

      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        if (!d.alive) {
          this.drops.splice(i, 1);
          continue;
        }

        d.vy = Math.min(maxV, d.vy + g * dt);
        d.y += d.vy * dt;
      }
    },

    updateParticles(dt, world) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (!p.active) continue;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.type === 'sparkle') {
          p.vy += 0.0001 * dt;
        } else if (p.type === 'explosion') {
          p.vy += 0.0003 * dt;
          p.vx *= 0.998;
          p.vy *= 0.998;
        } else {
          p.vy += 0.0002 * dt;
        }

        p.life -= (p.lifeDecay || 0.018) * dt;

        if (p.life <= 0 || p.y > world.h + 50) {
          p.active = false;
        }
      }
    },

    init() {
      this.drops = [];
      if (this.particles.length === 0) {
        initParticlePool();
        this.particles = particlePool;
      }
      for (let i = 0; i < this.particles.length; i++) {
        this.particles[i].active = false;
      }
      this.nextSpawnAt = 0;
    }
  };
})();
