(function() {
  "use strict";

  window.Game = window.Game || {};
  
  Game.AgentSystem = {
    agent: {
      x: 180,
      y: 462,
      w: 76,
      h: 32,
      speed: 2.0,
      vx: 0,
      face: 1,
      anim: { kind: "idle", t: 0, frame: 0 },
    },
    
    init(world) {
      this.agent.x = world.w / 2;
      this.agent.y = world.h - 58;
      this.agent.vx = 0;
      this.agent.face = 1;
      this.agent.anim = { kind: "idle", t: 0, frame: 0 };
    },
    
    updatePosition(targetX, world, speedMultiplier = 1.0) {
      const agent = this.agent;
      const clamped = Math.max(agent.w / 2, Math.min(world.w - agent.w / 2, targetX));
      const distance = clamped - agent.x;
      const absDistance = Math.abs(distance);
      
      let lerpFactor = 0.85;
      if (absDistance > 60) lerpFactor = 0.95;
      else if (absDistance > 30) lerpFactor = 0.90;
      else if (absDistance > 10) lerpFactor = 0.85;
      
      agent.x += distance * lerpFactor * speedMultiplier;
      agent.vx = distance * speedMultiplier;
      
      if (Math.abs(agent.vx) > 0.1) {
        agent.face = agent.vx > 0 ? 1 : -1;
      }
    },
    
    updateInertia() {
      this.agent.vx *= 0.80;
    },
    
    hitAgent(c) {
      const agent = this.agent;
      const rx = agent.x - agent.w / 2;
      const ry = agent.y - agent.h / 2;
      const rw = agent.w;
      const rh = agent.h;
      
      const nx = Math.max(rx, Math.min(c.x, rx + rw));
      const ny = Math.max(ry, Math.min(c.y, ry + rh));
      const dx = c.x - nx;
      const dy = c.y - ny;
      
      const adjustedRadius = c.r * 1.2;
      return dx * dx + dy * dy <= adjustedRadius * adjustedRadius;
    },
    
    /**
     * 캐릭터 fallback 렌더링
     * 이미지가 로드되지 않았을 때 픽셀 아트 스타일로 그립니다.
     * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
     * @param {number} x - 렌더링 X 좌표
     * @param {number} y - 렌더링 Y 좌표
     * @param {number} size - 캐릭터 크기
     * @param {number} frame - 애니메이션 프레임
     * @param {boolean} isRunning - 달리기 여부
     * @param {number} faceDir - 방향 (1: 오른쪽, -1: 왼쪽)
     */
    drawCutePixelAgentFallback(ctx, x, y, size, frame, isRunning, faceDir) {
      ctx.save();
      ctx.translate(x, y);
    
      // 캐릭터 색상 팔레트
      const colors = {
        skin: "#FFDBAC",
        hair: "#4A4A4A",
        suit: "#1A1A1A",
        shirt: "#FFFFFF",
        tie: "#8B0000",
        shoe: "#2C2C2C",
        eye: "#000000",
      };
      
      const scale = size / 64;
      
      // 애니메이션 효과 계산
      const bounceY = isRunning 
        ? Math.abs(Math.sin(frame * Math.PI / 2)) * 1.5 * scale
        : Math.sin(frame * Math.PI) * 1 * scale;
      const legOffset = isRunning ? Math.sin(frame * Math.PI / 2) * 2 * scale : 0;
      const armSwing = isRunning ? Math.sin(frame * Math.PI / 2) * 5 * scale : 0;
      
      ctx.translate(0, bounceY);
      
      // 방향에 따라 좌우 반전
      if (faceDir < 0) ctx.scale(-1, 1);
      
      // 그림자
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.ellipse(0, 30 * scale, 14 * scale, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 다리 (정장 바지)
      const leftLegX = -6 * scale + legOffset;
      const rightLegX = 6 * scale - legOffset;
      ctx.fillStyle = colors.suit;
      ctx.fillRect(leftLegX - 2 * scale, 18 * scale, 4 * scale, 12 * scale);
      ctx.fillRect(rightLegX - 2 * scale, 18 * scale, 4 * scale, 12 * scale);
      
      // 발 (구두)
      ctx.fillStyle = colors.shoe;
      ctx.fillRect(leftLegX - 3 * scale, 28 * scale, 6 * scale, 3 * scale);
      ctx.fillRect(rightLegX - 3 * scale, 28 * scale, 6 * scale, 3 * scale);
      
      // 몸통 (정장 재킷)
      ctx.fillStyle = colors.suit;
      ctx.fillRect(-8 * scale, 2 * scale, 16 * scale, 18 * scale);
      
      // 셔츠 (V넥)
      ctx.fillStyle = colors.shirt;
      ctx.beginPath();
      ctx.moveTo(0, 4 * scale);
      ctx.lineTo(-4 * scale, 8 * scale);
      ctx.lineTo(-3 * scale, 10 * scale);
      ctx.lineTo(0, 6 * scale);
      ctx.lineTo(3 * scale, 10 * scale);
      ctx.lineTo(4 * scale, 8 * scale);
      ctx.closePath();
      ctx.fill();
      
      // 넥타이
      ctx.fillStyle = colors.tie;
      ctx.fillRect(-1 * scale, 6 * scale, 2 * scale, 12 * scale);
      ctx.beginPath();
      ctx.moveTo(-1 * scale, 18 * scale);
      ctx.lineTo(-2 * scale, 20 * scale);
      ctx.lineTo(2 * scale, 20 * scale);
      ctx.lineTo(1 * scale, 18 * scale);
      ctx.closePath();
      ctx.fill();
      
      // 팔 (재킷 소매)
      ctx.fillStyle = colors.suit;
      ctx.fillRect(-10 * scale + armSwing, 4 * scale, 4 * scale, 10 * scale);
      ctx.fillRect(6 * scale - armSwing, 4 * scale, 4 * scale, 10 * scale);
      
      // 손
      ctx.fillStyle = colors.skin;
      ctx.fillRect(-10 * scale + armSwing, 12 * scale, 4 * scale, 3 * scale);
      ctx.fillRect(6 * scale - armSwing, 12 * scale, 4 * scale, 3 * scale);
      
      // 머리
      ctx.fillStyle = colors.hair;
      ctx.fillRect(-8 * scale, -18 * scale, 16 * scale, 6 * scale);
      
      // 얼굴
      ctx.fillStyle = colors.skin;
      ctx.fillRect(-8 * scale, -12 * scale, 16 * scale, 14 * scale);
      
      // 눈 (깜빡임 효과)
      const blink = frame % 20 < 18 || isRunning;
      if (blink) {
        ctx.fillStyle = colors.eye;
        ctx.fillRect(-6 * scale, -10 * scale, 2 * scale, 2 * scale);
        ctx.fillRect(4 * scale, -10 * scale, 2 * scale, 2 * scale);
      } else {
        ctx.strokeStyle = colors.eye;
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(-6 * scale, -9 * scale);
        ctx.lineTo(-4 * scale, -9 * scale);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4 * scale, -9 * scale);
        ctx.lineTo(6 * scale, -9 * scale);
        ctx.stroke();
      }
      
      // 입
      ctx.strokeStyle = colors.eye;
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(-2 * scale, -4 * scale);
      ctx.lineTo(2 * scale, -4 * scale);
      ctx.stroke();
      ctx.restore();
    },
    
    /**
     * 캐릭터 스프라이트 렌더링
     * 이미지가 있으면 스프라이트 시트에서 그리고, 없으면 fallback을 사용합니다.
     * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
     * @param {HTMLCanvasElement} cvs - 캔버스 요소
     * @param {Object} world - 게임 월드 정보
     * @param {Object} IMG - 이미지 객체
     */
    drawAgentSprite(ctx, cvs, world, IMG) {
      const agent = this.agent;
      const moving = Math.abs(agent.vx) > 0.15;
      const kind = moving ? "run" : "idle";
      
      // 애니메이션 상태 변경 시 리셋
      if (agent.anim.kind !== kind) {
        agent.anim.kind = kind;
        agent.anim.t = 0;
        agent.anim.frame = 0;
      }

      // 스프라이트 시트 정보
      const sheet = kind === "run" ? IMG.agent_run : IMG.agent_idle;
      const frames = kind === "run" ? 4 : 2;
      const fw = 64, fh = 64;
      const fps = kind === "run" ? 12 : 4;

      // 프레임 업데이트
      agent.anim.t += 1;
      if (agent.anim.t >= 60 / fps) {
        agent.anim.t = 0;
        agent.anim.frame = (agent.anim.frame + 1) % frames;
      }
      const sx = agent.anim.frame * fw;
      const sy = 0;

      // 월드 좌표를 화면 좌표로 변환
      const rect = cvs.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const s = world.scale;
      const ox = (displayWidth - world.w * s) / 2;
      const oy = (displayHeight - world.h * s) / 2;
      const px = ox + agent.x * s;
      const py = oy + agent.y * s;
      const scale = 1.25;
      const dw = fw * s * scale;
      const dh = fh * s * scale;

      ctx.save();
      // 모바일 최적화: 그림자 효과 줄이기
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }
      
      // 이미지가 로드되었으면 스프라이트 시트 사용
      if (sheet && sheet.complete && sheet.naturalWidth > 0) {
        // 방향에 따라 좌우 반전
        if (agent.face < 0) {
          ctx.translate(px, py);
          ctx.scale(-1, 1);
          ctx.translate(-px, -py);
        }
        ctx.drawImage(sheet, sx, sy, fw, fh, px - dw / 2, py - dh / 2 - 8 * s, dw, dh);
      } else {
        // 이미지 미로드 시 fallback 렌더링
        this.drawCutePixelAgentFallback(ctx, px, py - 8 * s, dw, agent.anim.frame, moving, agent.face);
      }
      ctx.restore();
    },
  };
  
  console.log("[Agent] 캐릭터 시스템 로드 완료");
})();

