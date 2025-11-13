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
     * 동전과 지폐에 맞는 비율과 효과를 적용합니다.
     */
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
        // 동전인지 지폐인지 판단 (정확한 매칭)
        const isCoin = type && (type === "cash10" || type === "cash50" || 
                                 type === "cash100" || type === "cash500");
        const isBill = type && (type === "cash1000" || type === "cash5000" || 
                                type === "cash10000" || type === "cash50000");
        
        if (isCoin) {
          // 동전: 원형 비율 유지, 그림자 효과 (크기 조금 줄임)
          ctx.save();
          const coinSize = r * 2 * s * 1.1; // 1.3에서 1.1로 줄임
          const coinRadius = coinSize / 2;
          
          // 그림자 먼저 그리기 (클리핑 전)
          ctx.beginPath();
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.arc(cx + 3, cy + 3, coinRadius * 0.95, 0, Math.PI * 2);
          ctx.fill();
          
          // 동전은 원형으로 클리핑
          ctx.beginPath();
          ctx.arc(cx, cy, coinRadius, 0, Math.PI * 2);
          ctx.clip();
          
          // 이미지 그리기 (정사각형으로 그려서 원형 클리핑 적용)
          ctx.drawImage(img, cx - coinSize / 2, cy - coinSize / 2, coinSize, coinSize);
          ctx.restore();
        } else if (isBill) {
          // 지폐: 직사각형 비율 유지, 크기 축소
          // 지폐 비율: 너비를 더 넓게, 높이는 적당히 (실제 지폐 비율에 가깝게)
          ctx.save();
          const billWidth = r * 2 * s * 1.6;  // 너비 축소 (2.4 → 1.6)
          const billHeight = r * 2 * s * 1.0; // 높이 축소 (1.4 → 1.0)
          
          // 그림자 먼저 그리기
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.fillRect(cx - billWidth / 2 + 3, cy - billHeight / 2 + 3, billWidth, billHeight);
          
          // 지폐 이미지 그리기 (직사각형으로, 클리핑 없음)
          ctx.drawImage(img, cx - billWidth / 2, cy - billHeight / 2, billWidth, billHeight);
          ctx.restore();
        } else {
          // 기타 아이템: 기본 원형 (그림자 효과 포함)
          ctx.save();
          const sz = r * 2 * s * 1.2;
          
          // 그림자
          ctx.beginPath();
          ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
          ctx.arc(cx + 2, cy + 2, sz / 2 * 0.95, 0, Math.PI * 2);
          ctx.fill();
          
          // 이미지 그리기
          ctx.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz);
          ctx.restore();
        }
      } else {
        // Fallback: 원형과 라벨
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
        LABEL[d.type] || "?",
        d.type // 타입 전달 (동전/지폐 구분용)
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
      
      // 모바일 최적화: 그림자 효과 줄이기
      const isMobile = window.innerWidth <= 768;
      const shadowBlur = isMobile ? 4 : 8;
      
      // 배치 렌더링을 위해 같은 색상의 파티클을 그룹화
      for (const p of particles) {
        const px = ox + p.x * s,
          py = oy + p.y * s;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        if (!isMobile) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = shadowBlur;
        }
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
     * 골든타임 버프 효과: 황금빛 필터
     */
    applyGoldenTimeEffect(ctx) {
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 15;
      ctx.filter = "brightness(1.3) saturate(1.5)";
    },

    /**
     * 자석 버프 효과: 캐릭터 머리 위에 자석 아이콘 표시
     */
    drawMagnetRange(ctx, cvs, world, agent) {
      if (!agent) return;
      
      ctx.save();
      
      // 월드 좌표를 화면 좌표로 변환 (agent.js의 drawAgentSprite와 동일한 방식)
      const rect = cvs.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const s = world.scale;
      const ox = (displayWidth - world.w * s) / 2;
      const oy = (displayHeight - world.h * s) / 2;
      
      // 캐릭터의 화면 좌표 (agent.js의 drawAgentSprite와 동일)
      const px = ox + agent.x * s;
      const py = oy + agent.y * s;
      
      // 캐릭터 스프라이트의 실제 높이 (agent.js에서 scale 1.25 적용)
      const agentSpriteHeight = (agent.h || 32) * s * 1.25;
      const agentOffsetY = 8 * s; // agent.js에서 py - dh / 2 - 8 * s로 그려짐
      
      // 캐릭터 머리 위 위치 (머리에서 15px 떨어진 위치)
      const iconY = py - agentSpriteHeight / 2 - agentOffsetY - 15 * s;
      const iconX = px; // 캐릭터 중심 X 좌표
      
      // 펄스 효과를 위한 시간 기반 크기 조정
      const time = performance.now() / 1000;
      const pulseScale = 1.0 + Math.sin(time * 3) * 0.1; // 0.9 ~ 1.1 사이로 펄스
      const fontSize = 24 * pulseScale * s; // 스케일 적용
      
      // 자석 이모지 그리기
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // 그림자 효과
      ctx.shadowColor = "rgba(78, 205, 196, 0.5)";
      ctx.shadowBlur = 8;
      
      // 자석 이모지
      ctx.fillText("🧲", iconX, iconY);
      
      ctx.restore();
    },


    /**
     * 미국 주식 떡상 버프 효과: 레인보우 조명
     */
    applyStockBoomEffect(ctx, cvs) {
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      const time = performance.now() / 100;
      
      // 레인보우 그라데이션 오버레이
      const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      const hue = (time * 10) % 360;
      gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, 0.2)`);
      gradient.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 70%, 60%, 0.2)`);
      gradient.addColorStop(1, `hsla(${(hue + 120) % 360}, 70%, 60%, 0.2)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
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
        BuffSystem,
        ComboSystem,
        hasDebuff,
        DEBUFFS,
        BUFFS,
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

      // 연봉동결 디버프는 collect 함수에서 처리 (모든 금액을 10000원으로 변경)

      // 아이템 렌더링
      for (const d of drops) {
        if (d && d.alive) {
          // FOMO 증후군: - 아이템이 +로 위장
          if (hasDebuff && hasDebuff(DEBUFFS.FOMO_SYNDROME) && (d.type === ITEM.TAX || d.type === ITEM.DEBT)) {
            const fakeType = ITEM.CASH1000; // FOMO 증후군: 세금/빚을 1000원으로 위장
            this.drawImageOrCircle(
              ctx,
              cvs,
              world,
              IMG[fakeType],
              d.x,
              d.y,
              d.r,
              COLOR[fakeType] || "#999",
              LABEL[fakeType] || "?",
              fakeType // 타입 전달
            );
          } else {
            this.drawDrop(ctx, cvs, world, d, IMG, COLOR, LABEL);
          }
        }
      }

      // 파티클 렌더링
      this.drawParticles(ctx, cvs, world, particles);

      // 캐릭터 렌더링
      let agent = null;
      if (AgentSystem) {
        agent = AgentSystem.agent || null;
        if (AgentSystem.drawAgentSprite) {
          AgentSystem.drawAgentSprite(ctx, cvs, world, IMG);
        }
      }

      ctx.restore(); // 디버프 필터 해제

      // 자석 버프: 캐릭터 주변 푸른 원형 범위
      if (BuffSystem && BuffSystem.hasBuff && BuffSystem.hasBuff(BUFFS.MAGNET) && agent) {
        this.drawMagnetRange(ctx, cvs, world, agent);
      }

      // 야근 모드: 화면 어두워짐 (오버레이)
      if (hasDebuff && hasDebuff(DEBUFFS.OVERTIME_MODE)) {
        this.drawOvertimeModeOverlay(ctx, cvs);
      }

      // 부동산 폭등: 화면 하단 30% 가려짐
      if (hasDebuff && hasDebuff(DEBUFFS.REAL_ESTATE_BOOM)) {
        this.drawRealEstateBoomOverlay(ctx, cvs);
      }

      // 미국 주식 떡상 버프: 레인보우 조명
      if (BuffSystem && BuffSystem.hasBuff && BuffSystem.hasBuff(BUFFS.STOCK_BOOM)) {
        this.applyStockBoomEffect(ctx, cvs);
      }

      // Shake 효과 해제
      if (shouldShake) {
        ctx.restore();
      }
    },
  };

  console.log("[Render] 렌더링 시스템 로드 완료");
})();

