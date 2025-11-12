// game.js — Neon arcade + character sprite + combo bar + spawn boost
(() => {
  "use strict";

  /** Canvas / scale */
  const cvs = document.getElementById("game");
  const ctx = cvs.getContext("2d");
  const world = { w: 360, h: 520, scale: 1, shakeT: 0, shakeAmp: 0 };
  function resize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2)); // 최대 2x로 제한 (성능)
    const rect = cvs.getBoundingClientRect();
    const displayWidth = rect.width || 360;
    const displayHeight = rect.height || 520;
    
    // 실제 캔버스 크기 설정 (고해상도 지원)
    const actualWidth = Math.floor(displayWidth * dpr);
    const actualHeight = Math.floor(displayHeight * dpr);
    
    if (cvs.width !== actualWidth || cvs.height !== actualHeight) {
      cvs.width = actualWidth;
      cvs.height = actualHeight;
      // CSS 크기는 표시 크기로 유지 (이미 CSS에서 aspect-ratio로 관리)
    }
    
    // 월드 스케일 계산 (표시 크기 기준, dpr 고려 안 함)
    world.scale = Math.min(displayWidth / world.w, displayHeight / world.h);
    
    // 고해상도 화면에서도 선명하게 (픽셀 아트)
    ctx.imageSmoothingEnabled = false;
    // dpr 스케일 적용 (setTransform으로 누적 방지)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", () => {
    // 화면 회전 시 리사이즈 (약간의 지연을 두어 브라우저가 레이아웃을 완료한 후)
    setTimeout(resize, 100);
  }, { passive: true });
  // 초기 로드 후에도 한 번 더 실행
  if (document.readyState === "loading") {
    window.addEventListener("load", () => {
      setTimeout(resize, 100);
    }, { once: true });
  } else {
    setTimeout(resize, 100);
  }

  /** HUD refs */
  const $ = (id) => document.getElementById(id);
  const elScore = $("score"),
    elCombo = $("combo"),
    elTimer = $("timer"),
    elLevel = $("level"),
    elHi = $("hi");
  const overlay = $("overlay"),
    ovTitle = $("ov-title"),
    ovSub = $("ov-sub"),
    btnStart = $("btn-start");
  const btnPause = $("btn-pause"),
    btnMute = $("btn-mute"),
    btnShare = $("btn-share"),
    btnReport = $("btn-report");
  const banner = $("banner"),
    fill = $("combo-fill"),
    multEl = $("combo-mult");

  /** Assets */
  const IMG = {};
  const toLoad = {
    agent_idle: "assets/agent_idle.png", // 2 frames, 64x64 each
    agent_run: "assets/agent_run.png", // 4 frames, 64x64 each
    money: "assets/money.png",
    point: "assets/point.png",
    coupon: "assets/coupon.png",
    tax: "assets/tax.png",
    debt: "assets/debt.png",
  };
  let assetsLoaded = 0;
  const totalAssets = Object.keys(toLoad).length;
  for (const k in toLoad) {
    const im = new Image();
    im.onerror = () => {
      console.warn(`[Asset] Failed to load: ${toLoad[k]}`);
      assetsLoaded++;
    };
    im.onload = () => {
      assetsLoaded++;
      if (assetsLoaded === totalAssets) {
        console.log(`[Asset] All ${totalAssets} assets loaded`);
      }
    };
    im.src = toLoad[k];
    IMG[k] = im;
  }

  /** Game params */
  const ITEM = {
    MONEY: "money",
    POINT: "point",
    COUPON: "coupon",
    TAX: "tax",
    DEBT: "debt",
  };
  const SCORE = { money: 10, point: 7, coupon: 5, tax: -15, debt: -25 };
  const COLOR = {
    money: "#51CF66", // 슈퍼마리오 스타일 초록색
    point: "#4ECDC4", // 청록색
    coupon: "#FFE66D", // 노란색
    tax: "#FF6B6B", // 빨간색
    debt: "#8B6F47", // 갈색
  };
  const LABEL = {
    money: "₩",
    point: "P",
    coupon: "%",
    tax: "TAX",
    debt: "DEBT",
  };
  const WEIGHTS = [
    [ITEM.MONEY, 34],
    [ITEM.POINT, 24],
    [ITEM.COUPON, 18],
    [ITEM.TAX, 14],
    [ITEM.DEBT, 10],
  ];

  const LV = [
    { id: 1, dur: 60, spawn: 700, g: 0.0006, maxSpeed: 0.38 },
    { id: 2, dur: 60, spawn: 600, g: 0.0007, maxSpeed: 0.42 },
    { id: 3, dur: 70, spawn: 520, g: 0.0008, maxSpeed: 0.46 },
    { id: 4, dur: 80, spawn: 460, g: 0.0009, maxSpeed: 0.5 },
    { id: 5, dur: 90, spawn: 420, g: 0.001, maxSpeed: 0.56 },
  ];

  /** State */
  let levelIndex = 0,
    timeLeft = LV[0].dur,
    score = 0,
    highScore = Number(localStorage.getItem("mc.highscore") || 0);
  let comboType = null,
    comboCount = 0;
  let paused = true,
    gameOver = false,
    muted = false;
  let nextSpawnAt = 0;
  elHi.textContent = `최고 ${highScore}`;

  // combo timer (게임 시간 기반으로 변경)
  const COMBO_DURATION = 3.0; // 3초 동안 콤보 유지
  let comboTimeLeft = 0; // 남은 콤보 시간 (초)
  let comboPendingReset = false; // 콤보 리셋 대기 플래그

  /** Agent (character sprite) */
  const agent = {
    x: world.w / 2,
    y: world.h - 58,
    w: 76,
    h: 32,
    speed: 1.2,
    vx: 0,
    face: 1,
    anim: { kind: "idle", t: 0, frame: 0 },
  };

  /** Drops */
  const drops = []; // {x,y,r,vy,type,alive}
  const particles = []; // {x,y,vx,vy,life,color,size}
  
  function rndWeighted(tbl) {
    const tot = tbl.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * tot;
    for (const [t, w] of tbl) {
      if ((r -= w) <= 0) return t;
    }
    return tbl.at(-1)[0];
  }
  function spawnOne() {
    const type = rndWeighted(WEIGHTS);
    const margin = 16;
    const x = margin + Math.random() * (world.w - margin * 2);
    const y = -20;
    const r = 18;
    const vy = 0.08 + Math.random() * 0.06;
    drops.push({ x, y, r, vy, type, alive: true });
  }
  
  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 0.15 + Math.random() * 0.1;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.05,
        life: 1.0,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  /** FX */
  function vibrate(ms = 35) {
    try {
      navigator.vibrate?.(ms);
    } catch {}
  }
  function shake(amp = 6, ms = 180) {
    world.shakeAmp = amp;
    world.shakeT = performance.now() + ms;
  }
  function popBanner(text, ms = 1500) {
    banner.textContent = text;
    banner.hidden = false;
    clearTimeout(popBanner._t);
    
    // 애니메이션 효과 (페이드 인)
    requestAnimationFrame(() => {
      banner.style.transition = "opacity 0.2s ease-out, transform 0.2s ease-out";
      banner.style.opacity = "1";
      banner.style.transform = "translateX(-50%) translateY(0)";
    });
    
    popBanner._t = setTimeout(() => {
      // 페이드 아웃
      banner.style.opacity = "0";
      banner.style.transform = "translateX(-50%) translateY(-5px)";
      setTimeout(() => {
        banner.hidden = true;
        banner.style.opacity = "";
        banner.style.transform = "";
      }, 200);
    }, ms);
  }

  /** Coords: clientX -> world X (모바일 최적화) */
  function clientToWorldX(clientX) {
    const rect = cvs.getBoundingClientRect();
    if (!rect.width || rect.width === 0) {
      return world.w / 2; // 캔버스가 아직 로드되지 않았으면 중앙 반환
    }
    
    const scale = world.scale || 1;
    const displayWidth = rect.width;
    
    // 클라이언트 좌표를 캔버스 좌표로 변환
    const canvasX = clientX - rect.left;
    
    // 월드 좌표로 변환 (중앙 정렬 고려)
    const worldOffsetX = (displayWidth - world.w * scale) / 2;
    const worldX = (canvasX - worldOffsetX) / scale;
    
    // 월드 범위 내로 제한
    return Math.max(0, Math.min(world.w, worldX));
  }

  /** Collision */
  function hitAgent(c) {
    const rx = agent.x - agent.w / 2,
      ry = agent.y - agent.h / 2,
      rw = agent.w,
      rh = agent.h;
    const nx = Math.max(rx, Math.min(c.x, rx + rw));
    const ny = Math.max(ry, Math.min(c.y, ry + rh));
    const dx = c.x - nx,
      dy = c.y - ny;
    return dx * dx + dy * dy <= c.r * c.r;
  }

  /** Combo */
  function refreshCombo() {
    comboTimeLeft = COMBO_DURATION; // 콤보 시간을 최대로 리셋
  }
  function updateComboUI() {
    // 콤보가 활성화되어 있고 시간이 남아있을 때만 게이지 표시
    if (comboCount > 0 && comboTimeLeft > 0) {
      const pct = Math.min(1, comboTimeLeft / COMBO_DURATION);
      fill.style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
      multEl.textContent = `×${comboCount}`;
    } else if (comboCount > 0 && comboTimeLeft <= 0 && !comboPendingReset) {
      // 콤보 시간이 끝났지만 아직 리셋되지 않은 경우, 게이지를 0%로 설정
      // 플래그가 아직 설정되지 않았을 때만 설정 (중복 방지)
      fill.style.width = '0%';
      multEl.textContent = `×${comboCount}`;
      // 다음 프레임에서 리셋하도록 플래그 설정
      comboPendingReset = true;
    } else if (comboPendingReset) {
      // 리셋 대기 중일 때도 게이지를 0%로 유지
      fill.style.width = '0%';
      multEl.textContent = `×${comboCount}`;
    } else {
      // 콤보가 없으면 게이지를 0%로 설정
      fill.style.width = '0%';
      multEl.textContent = '×1';
    }
  }
  function resetCombo() {
    comboType = null;
    comboCount = 0;
    comboTimeLeft = 0;
    comboPendingReset = false; // 리셋 플래그도 초기화
  }

  /** Score */
  function collect(type) {
    const base = SCORE[type] || 0;
    if (type === ITEM.TAX || type === ITEM.DEBT) {
      score += base;
      // TAX/DEBT 수집 시 콤보 시간만 즉시 초기화 (게이지는 자연스럽게 사라짐)
      comboTimeLeft = 0;
      comboType = null;
      comboCount = 0;
      vibrate(40);
      shake(8, 200);
    } else {
      if (comboType === type) {
        // 같은 타입이면 콤보 증가 (최대 4로 제한)
        comboCount = Math.min(4, comboCount + 1);
      } else {
        // 다른 타입이면 콤보 초기화하고 새 콤보 시작
        comboType = type;
        comboCount = 1;
      }
      refreshCombo();
      const mult = Math.max(1, Math.min(4, comboCount)); // 최대 4로 제한
      score += base * mult;
      if (mult > 1) popBanner(`콤보 ×${mult}`);
    }
  }

  /** Render helpers */
  function clear() {
    // 캔버스 전체 클리어 (dpr 적용 후 좌표계 기준)
    const rect = cvs.getBoundingClientRect();
    const displayWidth = rect.width || 360;
    const displayHeight = rect.height || 520;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
  }
  function drawImageOrCircle(img, x, y, r, fallbackColor, label) {
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
  }
  function drawDrop(d) {
    drawImageOrCircle(
      IMG[d.type],
      d.x,
      d.y,
      d.r,
      COLOR[d.type] || "#999",
      LABEL[d.type] || "?"
    );
  }

  /** 정장을 입은 요원 캐릭터 그리기 (fallback) */
  function drawCutePixelAgentFallback(ctx, x, y, size, frame, isRunning, faceDir) {
    ctx.save();
    ctx.translate(x, y);
  
    const colors = {
      skin: "#FFDBAC",      // 피부색
      hair: "#4A4A4A",      // 머리카락 (어두운 회색)
      suit: "#1A1A1A",      // 정장 (검은색)
      shirt: "#FFFFFF",     // 셔츠 (흰색)
      tie: "#8B0000",       // 넥타이 (어두운 빨강)
      shoe: "#2C2C2C",      // 구두 (검은색)
      eye: "#000000",       // 눈 (검은색)
    };
    
    const scale = size / 64;
    const bounceY = isRunning 
      ? Math.abs(Math.sin(frame * Math.PI / 2)) * 1.5 * scale
      : Math.sin(frame * Math.PI) * 1 * scale;
    const legOffset = isRunning ? Math.sin(frame * Math.PI / 2) * 2 * scale : 0;
    const armSwing = isRunning ? Math.sin(frame * Math.PI / 2) * 5 * scale : 0;
    
    ctx.translate(0, bounceY);
    
    // 방향에 따라 플립
    if (faceDir < 0) {
      ctx.scale(-1, 1);
    }
    
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
    // 넥타이 끝
    ctx.beginPath();
    ctx.moveTo(-1 * scale, 18 * scale);
    ctx.lineTo(-2 * scale, 20 * scale);
    ctx.lineTo(2 * scale, 20 * scale);
    ctx.lineTo(1 * scale, 18 * scale);
    ctx.closePath();
    ctx.fill();
    
    // 팔 (재킷 소매)
    ctx.fillStyle = colors.suit;
    // 왼쪽 팔
    ctx.fillRect(-10 * scale + armSwing, 4 * scale, 4 * scale, 10 * scale);
    // 오른쪽 팔
    ctx.fillRect(6 * scale - armSwing, 4 * scale, 4 * scale, 10 * scale);
    
    // 손 (피부색)
    ctx.fillStyle = colors.skin;
    ctx.fillRect(-10 * scale + armSwing, 12 * scale, 4 * scale, 3 * scale);
    ctx.fillRect(6 * scale - armSwing, 12 * scale, 4 * scale, 3 * scale);
    
    // 머리
    ctx.fillStyle = colors.hair;
    ctx.fillRect(-8 * scale, -18 * scale, 16 * scale, 6 * scale);
    
    // 얼굴 (피부색)
    ctx.fillStyle = colors.skin;
    ctx.fillRect(-8 * scale, -12 * scale, 16 * scale, 14 * scale);
    
    // 뺨 (분홍색 - 오른쪽에만)
    ctx.fillStyle = colors.blush;
    ctx.fillRect(4 * scale, -6 * scale, 3 * scale, 3 * scale);
    
    // 눈
    const blink = frame % 20 < 18 || isRunning;
    if (blink) {
      ctx.fillStyle = colors.eye;
      ctx.fillRect(-6 * scale, -10 * scale, 2 * scale, 2 * scale);
      ctx.fillRect(4 * scale, -10 * scale, 2 * scale, 2 * scale);
    } else {
      // 깜빡임
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
  }

  function drawAgentSprite() {
    const moving = Math.abs(agent.vx) > 0.2;
    const kind = moving ? "run" : "idle";
    if (agent.anim.kind !== kind) {
      agent.anim.kind = kind;
      agent.anim.t = 0;
      agent.anim.frame = 0;
    }

    const sheet = kind === "run" ? IMG.agent_run : IMG.agent_idle;
    const frames = kind === "run" ? 4 : 2;
    const fw = 64,
      fh = 64;
    const fps = kind === "run" ? 10 : 4;

    agent.anim.t += 1;
    if (agent.anim.t >= 60 / fps) {
      agent.anim.t = 0;
      agent.anim.frame = (agent.anim.frame + 1) % frames;
    }
    const sx = agent.anim.frame * fw,
      sy = 0;

    const rect = cvs.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    const s = world.scale,
      ox = (displayWidth - world.w * s) / 2,
      oy = (displayHeight - world.h * s) / 2;
    const px = ox + agent.x * s,
      py = oy + agent.y * s;
    const scale = 1.25,
      dw = fw * s * scale,
      dh = fh * s * scale;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    if (sheet && sheet.complete && sheet.naturalWidth > 0) {
      // flip
      if (agent.face < 0) {
        ctx.translate(px, py);
        ctx.scale(-1, 1);
        ctx.translate(-px, -py);
      }
      ctx.drawImage(
        sheet,
        sx,
        sy,
        fw,
        fh,
        px - dw / 2,
        py - dh / 2 - 8 * s,
        dw,
        dh
      );
    } else {
      drawCutePixelAgentFallback(
        ctx,
        px,
        py - 8 * s,
        dw,
        agent.anim.frame,
        moving,
        agent.face
      );
    }
    ctx.restore();
  }

  /** HUD */
  function updateHud() {
    elScore.textContent = `점수 ${score}`;
    elCombo.textContent = `콤보 ×${Math.max(1, comboCount || 1)}`;
    elLevel.textContent = `LV ${LV[levelIndex].id}`;
    elTimer.textContent = `${Math.max(0, Math.ceil(timeLeft))}s`;
    updateComboUI();
  }

  /** Overlay */
  function showOverlay(t, s, btn) {
    ovTitle.textContent = t;
    ovSub.textContent = s;
    btnStart.textContent = btn || "CONTINUE";
    overlay.style.display = "grid";
  }
  function hideOverlay() {
    overlay.style.display = "none";
  }

  /** Loop */
  let prev = 0;
  function loop(ts) {
    const dt = prev ? Math.min(ts - prev, 100) : 16; // Cap delta to prevent huge jumps
    prev = ts;

    const now = performance.now();

    // shake
    const shouldShake = world.shakeT > now;
    if (shouldShake) {
      ctx.save();
      ctx.translate(
        (Math.random() * 2 - 1) * world.shakeAmp,
        (Math.random() * 2 - 1) * world.shakeAmp
      );
    }

    if (!paused && !gameOver) {
      const deltaTime = dt / 1000; // 초 단위로 변환
      timeLeft -= deltaTime;
      
      // 콤보 시간 감소 (게임 시간과 동일하게)
      // 콤보가 활성화되어 있으면 시간을 감소
      if (comboCount > 0) {
        if (comboTimeLeft > 0) {
          comboTimeLeft = Math.max(0, comboTimeLeft - deltaTime);
        }
      }

      // spawn acceleration with combo (×2 이상부터 가속)
      const baseSpawn = LV[levelIndex].spawn;
      const spawnMul = Math.min(1.8, 1.0 + 0.18 * Math.max(0, comboCount - 1)); // cap 1.8x
      const spawnInterval = baseSpawn / spawnMul;

      if (ts >= nextSpawnAt) {
        spawnOne();
        nextSpawnAt = ts + spawnInterval * (0.92 + Math.random() * 0.16);
      }
      if (timeLeft <= 0) endGame();
    }

    // physics
    const g = LV[levelIndex].g,
      maxV = LV[levelIndex].maxSpeed;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (!d.alive) {
        drops.splice(i, 1);
        continue;
      }
      d.vy = Math.min(maxV, d.vy + g * dt);
      d.y += d.vy * dt;
      if (hitAgent(d)) {
        d.alive = false;
        const itemColor = COLOR[d.type] || "#999";
        spawnParticles(d.x, d.y, itemColor, d.type === ITEM.TAX || d.type === ITEM.DEBT ? 12 : 8);
        collect(d.type);
        drops.splice(i, 1);
        continue;
      }
      if (d.y - d.r > world.h) {
        d.alive = false;
        // 아이템을 놓쳤을 때: TAX/DEBT는 콤보에 영향 없음 (피해야 하는 아이템)
        // 먹어야 하는 아이템(money, point, coupon)만 놓치면 콤보 초기화
        if (comboCount > 0 && d.type !== ITEM.TAX && d.type !== ITEM.DEBT) {
          comboTimeLeft = 0;
        }
        drops.splice(i, 1);
      }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.0002 * dt; // gravity
      p.life -= dt / 400; // fade out
      if (p.life <= 0 || p.y > world.h + 50) {
        particles.splice(i, 1);
      }
    }

    // render
    clear();
    for (const d of drops) {
      if (d.alive) drawDrop(d);
    }
    
    // Draw particles
    const rect = cvs.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    for (const p of particles) {
      const s = world.scale,
        ox = (displayWidth - world.w * s) / 2,
        oy = (displayHeight - world.h * s) / 2;
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
    
    drawAgentSprite();
    updateHud();
    
    // 콤보 게이지가 업데이트된 후에 콤보 리셋 처리
    if (comboPendingReset) {
      resetCombo();
      comboPendingReset = false;
      fill.style.width = '0%';
      multEl.textContent = '×1';
    }

    if (shouldShake) {
      ctx.restore();
    }

    // agent inertia
    agent.vx *= 0.85;

    requestAnimationFrame(loop);
  }

  /** Flow */
  function startGame(nextLv = null) {
    if (nextLv != null) {
      levelIndex = Math.min(nextLv, LV.length - 1);
      levelIndex = Math.max(0, levelIndex);
    }
    score = 0;
    resetCombo();
    timeLeft = LV[levelIndex].dur;
    drops.length = 0;
    particles.length = 0; // Clear particles
    gameOver = false;
    paused = false;
    nextSpawnAt = performance.now() + 400;
    // Reset agent position
    agent.x = world.w / 2;
    agent.vx = 0;
    agent.face = 1;
    agent.anim = { kind: "idle", t: 0, frame: 0 };
    hideOverlay();
  }

  function endGame() {
    gameOver = true;
    paused = true;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("mc.highscore", String(highScore));
      elHi.textContent = `최고 ${highScore}`;
      btnReport.hidden = false;
      popBanner("신기록! 🎉");
    }
    const nextLevel = (levelIndex + 1) % LV.length;
    const levelText = nextLevel === 0 ? "처음부터" : `레벨 ${LV[nextLevel].id}`;
    showOverlay(
      "GAME OVER",
      `점수 ${score} · 콤보 ×${Math.max(1, comboCount || 1)}`,
      levelText === "처음부터" ? "다시 시작" : "NEXT LEVEL"
    );
  }

  /** Input */
  let pDown = false;
  function applyAgentX(nx) {
    const clamped = Math.max(agent.w / 2, Math.min(world.w - agent.w / 2, nx));
    agent.vx = clamped - agent.x;
    if (Math.abs(agent.vx) > 0.1) agent.face = agent.vx > 0 ? 1 : -1;
    agent.x = clamped;
  }
  function onDown(e) {
    if (paused && !gameOver) return;
    pDown = true;
    // 즉시 첫 번째 위치로 이동 (더 빠른 반응)
    const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    if (clientX) {
      const wx = clientToWorldX(clientX);
      applyAgentX(wx);
    }
  }
  function onMove(e) {
    if (!pDown || paused) return;
    e.preventDefault?.(); // Prevent scrolling on mobile
    e.stopPropagation?.(); // 이벤트 버블링 방지
    const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    if (!clientX) return;
    const wx = clientToWorldX(clientX);
    const edgeBoost = wx < world.w * 0.15 || wx > world.w * 0.85 ? 1.25 : 1.0;
    const sensitivity = 0.45; // 모바일 반응성 향상
    const dx = (wx - agent.x) * sensitivity * edgeBoost;
    applyAgentX(agent.x + dx);
  }
  function onUp(e) {
    pDown = false;
    // 터치 종료 시에도 이벤트 전파 방지
    if (e) {
      e.preventDefault?.();
      e.stopPropagation?.();
    }
  }

  window.addEventListener("keydown", (e) => {
    if (paused && e.key === " ") {
      startGame(levelIndex);
      return;
    }
    if (e.key === "ArrowLeft") {
      applyAgentX(agent.x - agent.speed * 28);
    }
    if (e.key === "ArrowRight") {
      applyAgentX(agent.x + agent.speed * 28);
    }
    if (e.key === " ") {
      paused = !paused;
      if (paused) showOverlay("PAUSED", "계속하려면 시작", "CONTINUE");
      else hideOverlay();
    }
  });

  // 터치 및 포인터 이벤트 (모바일 최적화)
  const touchOptions = { passive: false };
  const pointerOptions = { passive: false };
  
  cvs.addEventListener("pointerdown", onDown, pointerOptions);
  cvs.addEventListener("pointermove", onMove, pointerOptions);
  cvs.addEventListener("pointerup", onUp, { passive: true });
  cvs.addEventListener("pointercancel", onUp, { passive: true });
  
  cvs.addEventListener("touchstart", onDown, touchOptions);
  cvs.addEventListener("touchmove", onMove, touchOptions);
  cvs.addEventListener("touchend", onUp, { passive: true });
  cvs.addEventListener("touchcancel", onUp, { passive: true });
  
  // Prevent context menu on long press
  cvs.addEventListener("contextmenu", (e) => e.preventDefault());
  
  // 모바일에서 더블 탭 줌 방지 (전역 처리)
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    // 캔버스 영역에서만 더블 탭 방지
    if (e.target === cvs || cvs.contains(e.target)) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }
  }, { passive: false });

  /** UI */
  btnStart.addEventListener("click", () => {
    if (gameOver) {
      const nextLevel = (levelIndex + 1) % LV.length;
      startGame(nextLevel);
    } else {
      startGame(levelIndex);
    }
  });
  btnPause.addEventListener("click", () => {
    paused = !paused;
    if (paused) showOverlay("PAUSED", "계속하려면 시작", "CONTINUE");
    else hideOverlay();
  });
  btnMute.addEventListener("click", () => {
    muted = !muted;
    btnMute.textContent = muted ? "🔇" : "🔊";
    ["sfx-catch", "sfx-penalty", "sfx-combo", "sfx-clear", "bgm"].forEach(
      (id) => {
        const el = $(id);
        if (el) el.muted = muted;
      }
    );
  });
  /** 토스 딥링크 헬퍼 (간소화 및 개선 버전) */
  function openTossApp(scheme, fallbackUrl = "https://toss.im") {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // 사용자 피드백
    popBanner("토스 앱 열기 중...", 2000);
    
    // 공통: 앱이 열렸는지 감지
    let appOpened = false;
    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        appOpened = true;
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    
    if (isAndroid) {
      // Android: Intent URL (가장 확실)
      const path = scheme.replace("toss://", "");
      const fallback = encodeURIComponent(fallbackUrl || "https://toss.im");
      // 올바른 Intent URL 형식
      const intentUrl = `intent://${path}#Intent;scheme=toss;package=com.vcnc.toss;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${fallback};end`;
      
      // 방법 1: iframe으로 시도 (페이지 전환 없이)
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;";
      iframe.src = intentUrl;
      document.body.appendChild(iframe);
      
      // 1초 후 확인
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
        
        // 앱이 열리지 않았으면 직접 시도
        if (!appOpened && document.visibilityState === "visible") {
          window.location.href = scheme;
          
          // 추가 1.5초 후 fallback
          setTimeout(() => {
            if (!appOpened && document.visibilityState === "visible" && fallbackUrl) {
              document.removeEventListener("visibilitychange", visibilityHandler);
              window.location.href = fallbackUrl;
            }
          }, 1500);
        } else {
          document.removeEventListener("visibilitychange", visibilityHandler);
        }
      }, 1000);
      
    } else if (isIOS) {
      // iOS: 직접 딥링크 시도
      // iOS는 iframe보다 직접 location.href가 더 잘 작동
      window.location.href = scheme;
      
      // 2초 후 확인
      setTimeout(() => {
        if (!appOpened && document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", visibilityHandler);
          // 앱이 없으면 사용자에게 선택권 제공
          const userChoice = confirm("토스 앱이 설치되어 있지 않습니다.\n앱스토어로 이동하시겠습니까?");
          if (userChoice) {
            window.open("https://apps.apple.com/kr/app/toss/id839333328", "_blank");
          } else if (fallbackUrl) {
            window.location.href = fallbackUrl;
          }
        } else {
          document.removeEventListener("visibilitychange", visibilityHandler);
        }
      }, 2000);
      
    } else {
      // 데스크톱: 직접 시도
      window.location.href = scheme;
      setTimeout(() => {
        document.removeEventListener("visibilitychange", visibilityHandler);
        if (fallbackUrl && document.visibilityState === "visible") {
          const shouldOpen = confirm("토스 앱이 필요합니다.\n웹 브라우저로 이동하시겠습니까?");
          if (shouldOpen) {
            window.open(fallbackUrl, "_blank");
          }
        }
      }, 1500);
    }
  }

  btnShare.addEventListener("click", async () => {
    const text = `머니 캐쳐 점수 ${score}점! 도전해보세요! 🎮`;
    try {
      // 모바일에서는 Web Share API 우선 사용
      if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await navigator.share({ 
          text,
          url: window.location.href,
          title: "머니 캐쳐"
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        // 클립보드 복사
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        popBanner("링크 복사됨! ✨");
      } else {
        // Fallback: 수동 복사 안내
        const shareText = `${text} ${window.location.href}`;
        const textarea = document.createElement("textarea");
        textarea.value = shareText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          popBanner("링크 복사됨! ✨");
        } catch (err) {
          popBanner("수동으로 복사해주세요");
        }
        document.body.removeChild(textarea);
      }
    } catch (err) {
      // 사용자가 공유를 취소한 경우는 무시
      if (err.name !== "AbortError") {
        console.warn("공유 실패:", err);
        // Fallback: 클립보드 복사 시도
        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(`${text} ${window.location.href}`);
            popBanner("링크 복사됨! ✨");
          }
        } catch (clipErr) {
          popBanner("공유할 수 없습니다");
        }
      }
    }
  });
  
  btnReport.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 토스 자산 관리 리포트 열기 (더 명확한 피드백)
    openTossApp("toss://asset-report", "https://toss.im/asset");
  });

  /** Boot */
  elLevel.textContent = `LV ${LV[levelIndex].id}`;
  showOverlay(
    "머니 캐쳐",
    "좌우/스와이프 혹은 방향키 이동. 떨어지는 아이템을 받으세요!",
    "GAME START"
  );
  requestAnimationFrame(loop);
  console.log("%c[MoneyCatcher]", "color:#5C94FC; font-size: 14px;");
})();
