/**
 * render.js - 렌더링 시스템
 * 
 * 게임의 모든 그래픽 렌더링을 담당합니다.
 * 배경, 아이템, 파티클, 캐릭터, 디버프 효과를 그립니다.
 */
(function() {
  "use strict";

  window.Game = window.Game || {};

  Game.RenderSystem = {
    /**
     * 캔버스 클리어
     * 매 프레임마다 이전 프레임을 지웁니다.
     */
    clear(ctx, cvs) {
      // 캔버스의 실제 픽셀 크기 사용 (고해상도 지원)
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    },

    /**
     * 배경 그라데이션 렌더링
     * 하늘색에서 파란색으로 변하는 그라데이션을 그립니다.
     */
    drawBackground(ctx, cvs, world) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      
      const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      gradient.addColorStop(0, "#87CEEB");   // 하늘색 (상단)
      gradient.addColorStop(0.5, "#5C94FC"); // 밝은 파란색 (중간)
      gradient.addColorStop(1, "#4A7BC8");   // 진한 파란색 (하단)
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    },

    /**
     * 이미지 또는 원형 fallback 렌더링
     * 이미지가 로드되지 않았을 때 원형과 라벨로 대체합니다.
     */
    drawImageOrCircle(ctx, cvs, world, img, x, y, r, fallbackColor, label) {
      const rect = cvs.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const s = world.scale,
        ox = (displayWidth - world.w * s) / 2,
        oy = (displayHeight - world.h * s) / 2;
      const cx = ox + x * s,
        cy = oy + y * s;
      if (img && img.complete && img.naturalWidth > 0) {
        const sz = r * 2 * s * 1.2;
        ctx.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz);
      } else {
        ctx.beginPath();
        ctx.fillStyle = fallbackColor;
        ctx.arc(cx, cy, r * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.floor(r * s * 0.9)}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx, cy);
      }
    },

    /**
     * 아이템 렌더링
     * 이미지 또는 fallback 원형으로 아이템을 그립니다.
     */
    drawDrop(ctx, cvs, world, d, IMG, COLOR, LABEL) {
      this.drawImageOrCircle(
        ctx,
        cvs,
        world,
        IMG[d.type],
        d.x,
        d.y,
        d.r,
        COLOR[d.type] || "#999",
        LABEL[d.type] || "?"
      );
    },

    /**
     * 파티클 효과 렌더링
     * 아이템 수집 시 발생하는 파티클을 그립니다.
     */
    drawParticles(ctx, cvs, world, particles) {
      const rect = cvs.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const s = world.scale,
        ox = (displayWidth - world.w * s) / 2,
        oy = (displayHeight - world.h * s) / 2;
      
      for (const p of particles) {
        const px = ox + p.x * s,
          py = oy + p.y * s;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, p.size * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },

    /**
     * FEVER 타임 시각 효과 적용
     * 빨간색 글로우와 밝기 증가 효과를 적용합니다.
     */
    applyFeverTimeEffect(ctx) {
      ctx.shadowColor = "#FF0000";
      ctx.shadowBlur = 20;
      ctx.filter = "brightness(1.2)";
    },

    /**
     * 번아웃 디버프 효과 적용
     * 화면을 흑백으로 만듭니다.
     */
    applyBurnoutEffect(ctx) {
      ctx.filter = "grayscale(100%)";
    },

    /**
     * 야근 모드 디버프 오버레이
     * 화면을 어둡게 만듭니다.
     */
    drawOvertimeModeOverlay(ctx, cvs) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    },

    /**
     * 부동산 폭등 디버프 오버레이
     * 화면 하단 30%를 빌딩 실루엣으로 가립니다.
     */
    drawRealEstateBoomOverlay(ctx, cvs) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      const overlayHeight = canvasHeight * 0.3;
      ctx.fillStyle = "rgba(139, 111, 71, 0.7)"; // 갈색 반투명
      ctx.fillRect(0, canvasHeight - overlayHeight, canvasWidth, overlayHeight);
      // 빌딩 실루엣 효과 (간단한 도형)
      ctx.fillStyle = "rgba(92, 70, 50, 0.8)";
      for (let i = 0; i < 5; i++) {
        const x = (canvasWidth / 6) * (i + 1);
        const width = canvasWidth / 10;
        const height = overlayHeight * (0.5 + Math.random() * 0.5);
        ctx.fillRect(x - width / 2, canvasHeight - height, width, height);
      }
    },

    /**
     * 메인 렌더링 함수
     * 모든 게임 요소를 올바른 순서로 렌더링합니다.
     * 배경 → 아이템 → 파티클 → 캐릭터 → 디버프 효과 순서로 그립니다.
     */
    render(ctx, cvs, world, state) {
      const {
        IMG,
        COLOR,
        LABEL,
        ITEM,
        drops,
        particles,
        AgentSystem,
        DebuffSystem,
        ComboSystem,
        hasDebuff,
        DEBUFFS,
      } = state;

      // 캔버스 클리어
      this.clear(ctx, cvs);

      // 배경 그리기
      this.drawBackground(ctx, cvs, world);

      // Shake 효과 적용
      const now = performance.now();
      const shouldShake = world.shakeT > now;
      if (shouldShake) {
        ctx.save();
        ctx.translate(
          (Math.random() * 2 - 1) * world.shakeAmp,
          (Math.random() * 2 - 1) * world.shakeAmp
        );
      }

      // 디버프 및 FEVER 타임 렌더링 효과 적용
      ctx.save();

      // FEVER 타임: 화면에 빨간색 글로우 효과
      const isFeverTime = ComboSystem && ComboSystem.isFeverTime;
      if (isFeverTime) {
        this.applyFeverTimeEffect(ctx);
      }

      // 번아웃: 화면 흑백 효과 (FEVER 타임 중에는 무시)
      if (hasDebuff && hasDebuff(DEBUFFS.BURNOUT) && !isFeverTime) {
        this.applyBurnoutEffect(ctx);
      }

      // 아이템 렌더링
      for (const d of drops) {
        if (d && d.alive) {
          // FOMO 증후군: - 아이템이 +로 위장
          if (hasDebuff && hasDebuff(DEBUFFS.FOMO_SYNDROME) && (d.type === ITEM.TAX || d.type === ITEM.DEBT)) {
            const fakeType = ITEM.MONEY;
            this.drawImageOrCircle(
              ctx,
              cvs,
              world,
              IMG[fakeType],
              d.x,
              d.y,
              d.r,
              COLOR[fakeType] || "#999",
              LABEL[fakeType] || "?"
            );
          } else {
            this.drawDrop(ctx, cvs, world, d, IMG, COLOR, LABEL);
          }
        }
      }

      // 파티클 렌더링
      this.drawParticles(ctx, cvs, world, particles);

      // 캐릭터 렌더링
      if (AgentSystem && AgentSystem.drawAgentSprite) {
        AgentSystem.drawAgentSprite(ctx, cvs, world, IMG);
      }

      ctx.restore(); // 디버프 필터 해제

      // 야근 모드: 화면 어두워짐 (오버레이)
      if (hasDebuff && hasDebuff(DEBUFFS.OVERTIME_MODE)) {
        this.drawOvertimeModeOverlay(ctx, cvs);
      }

      // 부동산 폭등: 화면 하단 30% 가려짐
      if (hasDebuff && hasDebuff(DEBUFFS.REAL_ESTATE_BOOM)) {
        this.drawRealEstateBoomOverlay(ctx, cvs);
      }

      // Shake 효과 해제
      if (shouldShake) {
        ctx.restore();
      }
    },
  };

  console.log("[Render] 렌더링 시스템 로드 완료");
})();

