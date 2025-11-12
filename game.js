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
  function syncSidebarHeight() {
    // 사이드바 높이를 캔버스와 동일하게 설정
    const elSidebar = document.getElementById("sidebar");
    if (elSidebar && cvs) {
      const canvasRect = cvs.getBoundingClientRect();
      const canvasHeight = canvasRect.height;
      if (canvasHeight > 0) {
        elSidebar.style.height = `${canvasHeight}px`;
        elSidebar.style.maxHeight = `${canvasHeight}px`;
        elSidebar.style.minHeight = `${canvasHeight}px`;
      }
    }
  }
  resize();
  // 사이드바 높이 동기화 (DOM이 준비된 후)
  setTimeout(() => {
    syncSidebarHeight();
  }, 100);
  window.addEventListener("resize", () => {
    resize();
    // 리사이즈 후 사이드바 높이 동기화
    setTimeout(syncSidebarHeight, 50);
  }, { passive: true });
  window.addEventListener("orientationchange", () => {
    // 화면 회전 시 리사이즈 (약간의 지연을 두어 브라우저가 레이아웃을 완료한 후)
    setTimeout(() => {
      resize();
      syncSidebarHeight();
    }, 100);
  }, { passive: true });
  // 초기 로드 후에도 한 번 더 실행
  if (document.readyState === "loading") {
    window.addEventListener("load", () => {
      setTimeout(() => {
        resize();
        syncSidebarHeight();
      }, 100);
    }, { once: true });
  } else {
    setTimeout(() => {
      resize();
      syncSidebarHeight();
    }, 100);
  }

  /** HUD refs */
  const $ = (id) => document.getElementById(id);
  const elScore = $("score"),
    elCombo = $("combo"),
    elLevel = $("level"),
    elHi = $("hi"),
    elHearts = $("hearts"),
    elDebuffCard = $("debuff-card"),
    elDebuffText = $("debuff-text"),
    elDebuffDesc = $("debuff-desc"),
    elDebuffTimer = $("debuff-timer"),
    elDebuffNext = $("debuff-next"),
    elSidebar = $("sidebar");
  const overlay = $("overlay"),
    tutorialOverlay = $("tutorial-overlay"),
    ovTitle = $("ov-title"),
    ovSub = $("ov-sub"),
    btnStart = $("btn-start"),
    btnTutorial = $("btn-tutorial"),
    btnCloseTutorial = $("btn-close-tutorial");
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

  // 레벨 설정 (점수 기반 자동 레벨업, 최대 10)
  const MAX_LEVEL = 10;
  const LEVEL_SCORE_INTERVAL = 100; // 100점 단위로 레벨업
  const LV = [];
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const baseSpawn = 700 - (i - 1) * 50;
    const baseG = 0.0006 + (i - 1) * 0.00005;
    const baseMaxSpeed = 0.38 + (i - 1) * 0.02;
    LV.push({
      id: i,
      spawn: Math.max(400, baseSpawn),
      g: Math.min(0.0012, baseG),
      maxSpeed: Math.min(0.65, baseMaxSpeed),
    });
  }

  /** State */
  let levelIndex = 0,
    score = 0,
    highScore = Number(localStorage.getItem("mc.highscore") || 0);
  let comboCount = 0; // 통합 콤보 카운트 (+ 요소만)
  let paused = true,
    gameOver = false,
    muted = false;
  let nextSpawnAt = 0;
  let hearts = 5; // 생명 5개 시스템
  elHi.textContent = highScore;

  // combo timer (게임 시간 기반)
  const COMBO_DURATION = 3.0; // 3초 동안 콤보 유지
  let comboTimeLeft = 0; // 남은 콤보 시간 (초)
  let comboPendingReset = false; // 콤보 리셋 대기 플래그

  // 디버프 시스템 (18개 디버프)
  const DEBUFFS = {
    // 기존 디버프 (3개)
    KOSPI_DOWN: "kospi_down", // 코스피 하락: 점수 획득량 50% 감소
    TAX_BOMB: "tax_bomb", // 세금 폭탄: 세금/빚 출현 빈도 증가
    MONDAY_BLUES: "monday_blues", // 월요병: 콤보 게이지 감소 속도 증가
    
    // 경제/금융 관련 (4개)
    INTEREST_RATE_UP: "interest_rate_up", // 📈 금리 인상: 빚 아이템 감점 2배
    EXCHANGE_RATE_SPIKE: "exchange_rate_spike", // 💱 환율 폭등: 아이템 좌우 흔들림
    LIQUIDITY_CRISIS: "liquidity_crisis", // 💧 유동성 위기: + 아이템 출현 빈도 50% 감소
    
    // 직장/일상 관련 (4개)
    OVERTIME_MODE: "overtime_mode", // 🌙 야근 모드: 화면 어두워짐
    MEETING_CALL: "meeting_call", // 📞 회의 소환: 3초마다 0.5초 정지
    COFFEE_SHORTAGE: "coffee_shortage", // ☕ 커피 부족: 이동 속도 30% 감소
    
    // 심리/상태 관련 (4개)
    PANIC_SELL: "panic_sell", // 😱 패닉셀: 아이템 낙하 속도 2배
    BURNOUT: "burnout", // 😵 번아웃: 화면 흑백, 콤보 게이지 2배속 감소
    FOMO_SYNDROME: "fomo_syndrome", // 🤯 FOMO 증후군: - 아이템이 +로 위장
    SAVING_OBSESSION: "saving_obsession", // 🔒 저축 강박: 획득 점수 30% 잠금
    
    // 사회/시사 관련 (2개)
    REAL_ESTATE_BOOM: "real_estate_boom", // 🏠 부동산 폭등: 화면 하단 30% 가려짐
    SUBSCRIPTION_BOMB: "subscription_bomb", // 💳 구독료 폭탄: 2초마다 -10점
  };
  
  // 디버프 중첩 시스템 (최대 3개)
  let activeDebuffs = []; // 배열로 관리
  let debuffNextTime = 0; // 다음 디버프 발생 시간
  
  // 디버프별 특수 상태 변수
  let meetingCallNextStop = 0; // 회의 소환: 다음 정지 시간
  let meetingCallStopped = false; // 회의 소환: 현재 정지 상태
  let subscriptionBombNextCharge = 0; // 구독료 폭탄: 다음 차감 시간
  let lockedScore = 0; // 저축 강박: 잠긴 점수
  
  // 배너 큐 시스템 (디버프 메시지 우선순위 관리)
  let bannerQueue = []; // 배너 메시지 큐
  let currentBannerEndTime = 0; // 현재 배너 종료 시간
  
  // 디버프 정보 구조
  const DEBUFF_INFO = {
    [DEBUFFS.KOSPI_DOWN]: { duration: 15000, name: "📉 코스피 하락", desc: "점수 획득량 50% 감소" },
    [DEBUFFS.TAX_BOMB]: { duration: 15000, name: "💣 세금 폭탄", desc: "세금/빚 출현 빈도 증가" },
    [DEBUFFS.MONDAY_BLUES]: { duration: 15000, name: "😴 월요병", desc: "콤보 게이지 감소 속도 증가" },
    [DEBUFFS.INTEREST_RATE_UP]: { duration: 15000, name: "📈 금리 인상", desc: "빚 아이템 감점 2배" },
    [DEBUFFS.EXCHANGE_RATE_SPIKE]: { duration: 12000, name: "💱 환율 폭등", desc: "아이템 좌우 흔들림" },
    [DEBUFFS.LIQUIDITY_CRISIS]: { duration: 15000, name: "💧 유동성 위기", desc: "+ 아이템 출현 50% 감소" },
    [DEBUFFS.OVERTIME_MODE]: { duration: 10000, name: "🌙 야근 모드", desc: "화면 어두워짐" },
    [DEBUFFS.MEETING_CALL]: { duration: 12000, name: "📞 회의 소환", desc: "3초마다 0.5초 정지" },
    [DEBUFFS.COFFEE_SHORTAGE]: { duration: 10000, name: "☕ 커피 부족", desc: "이동 속도 30% 감소" },
    [DEBUFFS.PANIC_SELL]: { duration: 8000, name: "😱 패닉셀", desc: "낙하 속도 2배" },
    [DEBUFFS.BURNOUT]: { duration: 10000, name: "😵 번아웃", desc: "화면 흑백, 콤보 2배속 감소" },
    [DEBUFFS.FOMO_SYNDROME]: { duration: 12000, name: "🤯 FOMO 증후군", desc: "- 아이템이 +로 위장" },
    [DEBUFFS.SAVING_OBSESSION]: { duration: 20000, name: "🔒 저축 강박", desc: "획득 점수 30% 잠금" },
    [DEBUFFS.REAL_ESTATE_BOOM]: { duration: 15000, name: "🏠 부동산 폭등", desc: "화면 하단 30% 가려짐" },
    [DEBUFFS.SUBSCRIPTION_BOMB]: { duration: 12000, name: "💳 구독료 폭탄", desc: "2초마다 -10점" },
  };
  
  // 레벨별 디버프 주기 (밀리초)
  function getDebuffInterval(level) {
    if (level <= 3) return 45000; // 2~3레벨: 45초
    if (level <= 5) return 40000; // 4~5레벨: 40초
    return 30000; // 6~10레벨: 30초
  }
  
  // 레벨별 최대 디버프 중첩 수
  function getMaxDebuffStack(level) {
    if (level <= 5) return 1; // 2~5레벨: 1개
    if (level <= 8) return 2; // 6~8레벨: 2개
    return 3; // 9~10레벨: 3개
  }
  
  // 디버프가 활성화되어 있는지 확인
  function hasDebuff(debuffType) {
    return activeDebuffs.some(d => d.type === debuffType);
  }

  /** Agent (character sprite) - 이동 속도 증가 */
  const agent = {
    x: world.w / 2,
    y: world.h - 58,
    w: 76,
    h: 32,
    speed: 2.0, // 이동 속도 증가 (1.2 -> 2.0)
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
    // 디버프 적용
    let weights = [...WEIGHTS];
    
    // 세금 폭탄: 세금/빚 출현 빈도 증가
    if (hasDebuff(DEBUFFS.TAX_BOMB)) {
      weights = weights.map(([type, weight]) => {
        if (type === ITEM.TAX || type === ITEM.DEBT) {
          return [type, weight * 2.5]; // 2.5배 증가
        }
        return [type, weight];
      });
    }
    
    // 유동성 위기: + 아이템 출현 빈도 50% 감소
    if (hasDebuff(DEBUFFS.LIQUIDITY_CRISIS)) {
      weights = weights.map(([type, weight]) => {
        if (type === ITEM.MONEY || type === ITEM.POINT || type === ITEM.COUPON) {
          return [type, weight * 0.5]; // 50% 감소
        }
        return [type, weight];
      });
    }
    
    const type = rndWeighted(weights);
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
  function popBanner(text, ms = 1500, priority = 0) {
    // priority: 0 = 일반, 1 = 디버프 (낮은 우선순위)
    const now = performance.now();
    
    // 디버프 메시지는 큐에 추가 (다른 메시지가 표시 중이면 대기)
    if (priority === 1) {
      // 현재 배너가 표시 중이고 디버프가 아니면 큐에 추가
      if (!banner.hidden && now < currentBannerEndTime) {
        bannerQueue.push({ text, ms, priority });
        return;
      }
    } else {
      // 일반 메시지는 즉시 표시 (기존 배너 중단)
      clearTimeout(popBanner._t);
      // 큐에 있던 디버프 메시지들은 나중에 표시
    }
    
    // 배너 표시
    banner.textContent = text;
    banner.hidden = false;
    clearTimeout(popBanner._t);
    currentBannerEndTime = now + ms;
    
    // 여러 줄 텍스트 지원
    if (text.includes("\n")) {
      banner.style.whiteSpace = "pre-line";
      banner.style.lineHeight = "1.5";
      banner.style.textAlign = "center";
    } else {
      banner.style.whiteSpace = "normal";
      banner.style.textAlign = "center";
    }
    
    // 애니메이션 효과 (페이드 인)
    requestAnimationFrame(() => {
      banner.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";
      banner.style.opacity = "1";
      banner.style.transform = "translateX(-50%) translateY(0)";
    });
    
    popBanner._t = setTimeout(() => {
      // 페이드 아웃
      banner.style.opacity = "0";
      banner.style.transform = "translateX(-50%) translateY(-10px)";
      setTimeout(() => {
        banner.hidden = true;
        banner.style.whiteSpace = "normal";
        banner.style.lineHeight = "";
        banner.style.textAlign = "";
        currentBannerEndTime = 0;
        
        // 큐에 있는 다음 메시지 표시
        if (bannerQueue.length > 0) {
          const next = bannerQueue.shift();
          popBanner(next.text, next.ms, next.priority);
        }
      }, 300);
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

  /** Combo - 새로운 배수 시스템 */
  // 요청사항: 10+ → 0.25배, 20+ → 0.5배, 30+ → 0.75배, 40+ → 1.25배, 50+ → 1.5배
  // 이것은 기본 점수에 곱해지는 배수로 해석
  function getComboMultiplier(combo) {
    if (combo >= 50) return 1.5; // MAX COMBO!!!
    if (combo >= 40) return 1.25;
    if (combo >= 30) return 0.75;
    if (combo >= 20) return 0.5;
    if (combo >= 10) return 0.25;
    return 1.0; // 10 미만은 기본 배수
  }
  
  function refreshCombo() {
    let duration = COMBO_DURATION;
    // 월요병 또는 번아웃: 콤보 게이지 감소 속도 2배
    if (hasDebuff(DEBUFFS.MONDAY_BLUES) || hasDebuff(DEBUFFS.BURNOUT)) {
      duration *= 0.5;
    }
    comboTimeLeft = duration;
  }
  
  function updateComboUI() {
    // 콤보 게이지 업데이트
    let duration = COMBO_DURATION;
    // 월요병 또는 번아웃: 콤보 게이지 감소 속도 2배
    if (hasDebuff(DEBUFFS.MONDAY_BLUES) || hasDebuff(DEBUFFS.BURNOUT)) {
      duration *= 0.5;
    }
    
    if (comboCount > 0 && comboTimeLeft > 0) {
      const pct = Math.min(1, comboTimeLeft / duration);
      fill.style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
      if (comboCount >= 50) {
        multEl.textContent = "MAX COMBO!!!";
        multEl.style.color = "#FFE66D";
        multEl.style.animation = "pulse 0.5s infinite";
      } else {
        multEl.textContent = `×${comboCount}`;
        multEl.style.color = "";
        multEl.style.animation = "";
      }
    } else if (comboCount > 0 && comboTimeLeft <= 0 && !comboPendingReset) {
      fill.style.width = '0%';
      if (comboCount >= 50) {
        multEl.textContent = "MAX COMBO!!!";
      } else {
        multEl.textContent = `×${comboCount}`;
      }
      comboPendingReset = true;
    } else if (comboPendingReset) {
      fill.style.width = '0%';
      multEl.textContent = `×${comboCount}`;
    } else {
      fill.style.width = '0%';
      multEl.textContent = '×1';
      multEl.style.color = "";
      multEl.style.animation = "";
    }
  }
  
  function resetCombo() {
    comboCount = 0;
    comboTimeLeft = 0;
    comboPendingReset = false;
  }

  /** Score - 새로운 콤보 시스템 */
  function collect(type) {
    const base = SCORE[type] || 0;
    if (type === ITEM.TAX || type === ITEM.DEBT) {
      // TAX/DEBT 수집 시 콤보 완전 초기화
      if (comboCount > 0) {
        resetCombo();
        popBanner("콤보 초기화!");
      }
      // 디버프 적용
      let scoreMultiplier = 1.0;
      if (hasDebuff(DEBUFFS.KOSPI_DOWN)) {
        scoreMultiplier *= 0.5; // 코스피 하락: 50% 감소
      }
      // 금리 인상: 빚 아이템 감점 2배
      if (type === ITEM.DEBT && hasDebuff(DEBUFFS.INTEREST_RATE_UP)) {
        scoreMultiplier *= 2.0; // 빚 아이템 감점 2배
      }
      score += base * scoreMultiplier;
      vibrate(40);
      shake(8, 200);
    } else {
      // + 요소만 콤보 증가
      comboCount++;
      refreshCombo();
      const mult = getComboMultiplier(comboCount);
      // 디버프 적용
      let scoreMultiplier = 1.0;
      if (hasDebuff(DEBUFFS.KOSPI_DOWN)) {
        scoreMultiplier *= 0.5; // 코스피 하락: 50% 감소
      }
      if (hasDebuff(DEBUFFS.SAVING_OBSESSION)) {
        // 저축 강박: 30% 잠금 (추후 구현)
        scoreMultiplier *= 0.7; // 일단 30% 감소로 적용
      }
      score += base * mult * scoreMultiplier;
      
      // 콤보 배너는 게임 화면에 표시하지 않음 (사이드바에서만 확인 가능)
      
      // 점수 기반 자동 레벨업
      checkLevelUp();
    }
  }
  
  function checkLevelUp() {
    const newLevel = Math.min(MAX_LEVEL - 1, Math.floor(score / LEVEL_SCORE_INTERVAL));
    if (newLevel > levelIndex) {
      levelIndex = newLevel;
      popBanner(`레벨 업! LV ${LV[levelIndex].id} 🎉`);
      
      // 레벨 2 이상부터 레벨업 시 바로 디버프 발생
      if (levelIndex >= 1) {
        const maxStack = getMaxDebuffStack(levelIndex + 1); // 레벨은 0-based이므로 +1
        // 최대 중첩 수에 도달하지 않았으면 새 디버프 추가
        if (activeDebuffs.length < maxStack) {
          activateRandomDebuff();
        }
        // 생명 회복 및 목숨 +1 (레벨 4, 6, 9에서)
        if (levelIndex === 3 || levelIndex === 5 || levelIndex === 8) {
          hearts = Math.min(5, hearts + 1);
          popBanner(`생명 회복! ❤️ (${hearts}개)`);
        }
      }
      
      // 다음 디버프 시간 설정 (레벨업 시점 기준)
      if (levelIndex >= 1) {
        debuffNextTime = performance.now() + getDebuffInterval(levelIndex + 1);
      }
    }
  }
  
  function activateRandomDebuff() {
    // 기존 디버프와 중복되지 않는 디버프 선택
    const debuffTypes = Object.values(DEBUFFS);
    const availableDebuffs = debuffTypes.filter(type => 
      !activeDebuffs.some(d => d.type === type)
    );
    
    if (availableDebuffs.length === 0) return; // 추가할 디버프가 없으면 반환
    
    const debuffType = availableDebuffs[Math.floor(Math.random() * availableDebuffs.length)];
    const debuffInfo = DEBUFF_INFO[debuffType];
    
    if (!debuffInfo) return;
    
    // 디버프 추가
    const newDebuff = {
      type: debuffType,
      startTime: performance.now(),
      duration: debuffInfo.duration,
    };
    activeDebuffs.push(newDebuff);
    
    // UI 업데이트
    updateDebuffUI();
    
    // 디버프 설명을 게임 화면에 표시 (우선순위 낮음 - 다른 메시지가 끝난 후 표시)
    const debuffFullDesc = `${debuffInfo.name} 발생!\n${debuffInfo.desc}`;
    popBanner(debuffFullDesc, 4000, 1); // priority = 1 (디버프)
  }
  
  function updateDebuff() {
    const now = performance.now();
    
    // 만료된 디버프 제거
    activeDebuffs = activeDebuffs.filter(debuff => {
      const elapsed = now - debuff.startTime;
      return elapsed < debuff.duration;
    });
    
    // 레벨 2 이상에서 시간 기반 디버프 발생 (레벨업 시 바로 발생하는 것 외에도)
    if (levelIndex >= 1 && !paused && !gameOver) {
      const maxStack = getMaxDebuffStack(levelIndex + 1);
      if (activeDebuffs.length < maxStack && debuffNextTime > 0 && now >= debuffNextTime) {
        activateRandomDebuff();
        debuffNextTime = now + getDebuffInterval(levelIndex + 1);
      }
    }
    
    // UI 업데이트
    updateDebuffUI();
  }
  
  function updateDebuffUI() {
    if (activeDebuffs.length > 0) {
      // 첫 번째 디버프 표시 (나중에 여러 개 표시하도록 개선 가능)
      const firstDebuff = activeDebuffs[0];
      const debuffInfo = DEBUFF_INFO[firstDebuff.type];
      const elapsed = performance.now() - firstDebuff.startTime;
      const remaining = Math.max(0, firstDebuff.duration - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);
      
      if (debuffInfo) {
        elDebuffText.textContent = activeDebuffs.length > 1 
          ? `${debuffInfo.name} 외 ${activeDebuffs.length - 1}개`
          : debuffInfo.name;
        elDebuffDesc.textContent = debuffInfo.desc;
        elDebuffDesc.hidden = false;
        elDebuffTimer.textContent = `남은 시간: ${remainingSeconds}초`;
        elDebuffTimer.hidden = false;
        elDebuffNext.hidden = true;
      }
    } else {
      // 디버프가 없을 때
      elDebuffText.textContent = "대기 중";
      elDebuffDesc.hidden = true;
      elDebuffTimer.hidden = true;
      
      // 다음 디버프 예상 시간 표시
      if (levelIndex >= 1) {
        const interval = getDebuffInterval(levelIndex + 1);
        const timeUntilNext = debuffNextTime > 0 
          ? Math.max(0, debuffNextTime - performance.now())
          : 0;
        const secondsUntilNext = Math.ceil(timeUntilNext / 1000);
        
        if (secondsUntilNext > 0) {
          elDebuffNext.textContent = `다음: ${secondsUntilNext}초 후`;
        } else {
          elDebuffNext.textContent = `다음: 레벨업 시`;
        }
        elDebuffNext.hidden = false;
      } else {
        elDebuffNext.textContent = `다음: LV 2부터`;
        elDebuffNext.hidden = false;
      }
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
    const moving = Math.abs(agent.vx) > 0.15; // 더 민감한 이동 감지 (애니메이션 개선)
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
    const fps = kind === "run" ? 12 : 4; // 런 애니메이션 속도 증가 (10 -> 12)

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
    elScore.textContent = score;
    elCombo.textContent = `×${comboCount || 1}`;
    elLevel.textContent = `LV ${LV[levelIndex].id}`;
    elHi.textContent = highScore;
    updateHearts();
    updateComboUI();
    updateDebuff();
  }
  
  function updateHearts() {
    const heartElements = elHearts.querySelectorAll(".heart");
    heartElements.forEach((heart, index) => {
      if (index < hearts) {
        heart.classList.remove("lost");
      } else {
        heart.classList.add("lost");
      }
    });
  }
  
  function loseHeart() {
    if (hearts > 0) {
      hearts--;
      updateHearts();
      vibrate(50);
      shake(10, 250);
      if (hearts <= 0) {
        endGame();
      } else {
        popBanner(`생명 ${hearts}개 남음`);
      }
    }
  }

  /** Overlay */
  function showOverlay(t, s, btn) {
    ovTitle.textContent = t;
    ovSub.textContent = s;
    btnStart.textContent = btn || "CONTINUE";
    overlay.hidden = false;
    overlay.style.display = "grid";
    // 튜토리얼 오버레이가 열려있으면 닫기
    if (!tutorialOverlay.hidden) {
      tutorialOverlay.hidden = true;
      tutorialOverlay.style.display = "none";
    }
  }
  function hideOverlay() {
    overlay.hidden = true;
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
      
      // 콤보 시간 감소
      if (comboCount > 0 && comboTimeLeft > 0) {
        let decayRate = 1.0;
        // 월요병 또는 번아웃: 콤보 게이지 감소 속도 2배
        if (hasDebuff(DEBUFFS.MONDAY_BLUES) || hasDebuff(DEBUFFS.BURNOUT)) {
          decayRate = 2.0;
        }
        comboTimeLeft = Math.max(0, comboTimeLeft - deltaTime * decayRate);
        if (comboTimeLeft <= 0) {
          resetCombo();
        }
      }
      
      // 디버프 업데이트
      updateDebuff();
      
      // 회의 소환: 3초마다 0.5초 정지
      if (hasDebuff(DEBUFFS.MEETING_CALL)) {
        const now = performance.now();
        if (!meetingCallStopped) {
          if (meetingCallNextStop === 0) {
            meetingCallNextStop = now + 3000; // 첫 정지는 3초 후
          } else if (now >= meetingCallNextStop) {
            meetingCallStopped = true;
            meetingCallNextStop = now + 500; // 0.5초 정지
            agent.vx = 0; // 즉시 정지
            popBanner("📞 긴급 회의! 정지", 500);
          }
        } else {
          if (now >= meetingCallNextStop) {
            meetingCallStopped = false;
            meetingCallNextStop = now + 3000; // 3초 후 다음 정지
          }
        }
      } else {
        if (meetingCallStopped) {
          meetingCallStopped = false;
          meetingCallNextStop = 0;
        }
      }
      
      // 구독료 폭탄: 2초마다 -10점
      if (hasDebuff(DEBUFFS.SUBSCRIPTION_BOMB)) {
        const now = performance.now();
        if (subscriptionBombNextCharge === 0 || now >= subscriptionBombNextCharge) {
          score = Math.max(0, score - 10);
          subscriptionBombNextCharge = now + 2000; // 2초마다
          if (score > 0) {
            popBanner("구독료 차감 -10점 💳", 1000);
          }
        }
      } else {
        subscriptionBombNextCharge = 0;
      }
      
      // 회의 소환 중에는 캐릭터 이동 중지
      if (meetingCallStopped) {
        agent.vx = 0;
      }

      // spawn with level difficulty
      const baseSpawn = LV[levelIndex].spawn;
      const spawnInterval = baseSpawn * (0.92 + Math.random() * 0.16);

      if (ts >= nextSpawnAt) {
        spawnOne();
        nextSpawnAt = ts + spawnInterval;
      }

      // physics (pause 상태일 때는 완전히 중지)
      let g = LV[levelIndex].g;
      let maxV = LV[levelIndex].maxSpeed;
      
      // 패닉셀: 아이템 낙하 속도 2배
      if (hasDebuff(DEBUFFS.PANIC_SELL)) {
        g *= 2.0;
        maxV *= 2.0;
      }
      
      // 환율 폭등: 아이템 좌우 흔들림 (추가할 것)
      const exchangeRateSpike = hasDebuff(DEBUFFS.EXCHANGE_RATE_SPIKE);
      
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (!d.alive) {
          drops.splice(i, 1);
          continue;
        }
        d.vy = Math.min(maxV, d.vy + g * dt);
        d.y += d.vy * dt;
        
        // 환율 폭등: 아이템 좌우 흔들림
        if (exchangeRateSpike && !d.shakeOffset) {
          d.shakeOffset = 0;
          d.shakeSpeed = (Math.random() - 0.5) * 0.3;
        }
        if (exchangeRateSpike) {
          d.shakeOffset += d.shakeSpeed * dt;
          d.shakeSpeed += (Math.random() - 0.5) * 0.001 * dt;
          d.shakeSpeed = Math.max(-0.5, Math.min(0.5, d.shakeSpeed));
          d.x += d.shakeOffset * dt * 0.5;
          d.x = Math.max(16, Math.min(world.w - 16, d.x)); // 화면 밖으로 나가지 않도록
        }
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
          // 아이템을 놓쳤을 때
          if (d.type === ITEM.TAX || d.type === ITEM.DEBT) {
            // TAX/DEBT를 놓치면 좋은 일 (생명 감소 없음)
            // 콤보는 유지
          } else {
            // + 요소를 놓치면 생명 감소 및 콤보 초기화
            loseHeart();
            if (comboCount > 0) {
              resetCombo();
            }
          }
          drops.splice(i, 1);
        }
      }
    }
    // pause 상태일 때는 물리 업데이트를 완전히 중지
    // 기존 아이템들은 그대로 유지 (화면에만 그려짐, 이동하지 않음)
    
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
    
    // 디버프 렌더링 효과 적용
    ctx.save();
    
    // 번아웃: 화면 흑백 효과
    if (hasDebuff(DEBUFFS.BURNOUT)) {
      ctx.filter = "grayscale(100%)";
    }
    
    for (const d of drops) {
      if (d.alive) {
        // FOMO 증후군: - 아이템이 +로 위장
        if (hasDebuff(DEBUFFS.FOMO_SYNDROME) && (d.type === ITEM.TAX || d.type === ITEM.DEBT)) {
          // 위장: TAX/DEBT를 MONEY 색으로 그리기 (실제 타입은 유지)
          const fakeType = ITEM.MONEY;
          drawImageOrCircle(
            IMG[fakeType],
            d.x,
            d.y,
            d.r,
            COLOR[fakeType] || "#999",
            LABEL[fakeType] || "?"
          );
        } else {
          drawDrop(d);
        }
      }
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
    
    ctx.restore(); // 디버프 필터 해제
    
    // 야근 모드: 화면 어두워짐 (오버레이)
    if (hasDebuff(DEBUFFS.OVERTIME_MODE)) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, cvs.width, cvs.height);
    }
    
    // 부동산 폭등: 화면 하단 30% 가려짐
    if (hasDebuff(DEBUFFS.REAL_ESTATE_BOOM)) {
      const overlayHeight = rect.height * 0.3;
      ctx.fillStyle = "rgba(139, 111, 71, 0.7)"; // 갈색 반투명
      ctx.fillRect(0, rect.height - overlayHeight, cvs.width, overlayHeight);
      // 빌딩 실루엣 효과 (간단한 도형)
      ctx.fillStyle = "rgba(92, 70, 50, 0.8)";
      for (let i = 0; i < 5; i++) {
        const x = (cvs.width / 6) * (i + 1);
        const width = cvs.width / 10;
        const height = overlayHeight * (0.5 + Math.random() * 0.5);
        ctx.fillRect(x - width / 2, rect.height - height, width, height);
      }
    }
    
    updateHud();
    
    // 콤보 게이지가 업데이트된 후에 콤보 리셋 처리
    if (comboPendingReset) {
      resetCombo();
      comboPendingReset = false;
      fill.style.width = '0%';
      multEl.textContent = '×1';
      multEl.style.color = "";
      multEl.style.animation = "";
    }

    if (shouldShake) {
      ctx.restore();
    }

    // agent inertia (더 빠른 감속으로 반응성 향상)
    agent.vx *= 0.80; // 0.85 -> 0.80 (더 빠른 감속)

    requestAnimationFrame(loop);
  }

  /** Flow */
  function startGame() {
    levelIndex = 0;
    score = 0;
    hearts = 5;
    resetCombo();
    activeDebuffs = []; // 디버프 초기화
    debuffNextTime = 0;
    meetingCallNextStop = 0;
    meetingCallStopped = false;
    subscriptionBombNextCharge = 0;
    lockedScore = 0;
    bannerQueue = []; // 배너 큐 초기화
    currentBannerEndTime = 0;
    elDebuffText.textContent = "대기 중";
    elDebuffDesc.hidden = true;
    elDebuffTimer.hidden = true;
    elDebuffNext.hidden = false;
    drops.length = 0; // 기존 아이템 제거
    particles.length = 0;
    gameOver = false;
    paused = false; // 게임 시작 시 pause 해제
    nextSpawnAt = performance.now() + 400;
    // Reset agent position
    agent.x = world.w / 2;
    agent.vx = 0;
    agent.face = 1;
    agent.anim = { kind: "idle", t: 0, frame: 0 };
    hideOverlay();
    updateHud();
  }

  function endGame() {
    gameOver = true;
    paused = true;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("mc.highscore", String(highScore));
      elHi.textContent = highScore;
      btnReport.hidden = false;
      popBanner("신기록! 🎉");
    }
    showOverlay(
      "GAME OVER",
      `점수 ${score} · 최고 콤보 ×${comboCount || 1} · 레벨 ${LV[levelIndex].id}`,
      "다시 시작"
    );
  }

  /** Input */
  let pDown = false;
  function applyAgentX(nx) {
    // 회의 소환: 캐릭터 정지
    if (meetingCallStopped) return;
    
    // 커피 부족: 이동 속도 30% 감소
    let speedMultiplier = 1.0;
    if (hasDebuff(DEBUFFS.COFFEE_SHORTAGE)) {
      speedMultiplier = 0.7;
    }
    
    const clamped = Math.max(agent.w / 2, Math.min(world.w - agent.w / 2, nx));
    const targetVx = (clamped - agent.x) * speedMultiplier;
    agent.vx = targetVx;
    if (Math.abs(agent.vx) > 0.1) agent.face = agent.vx > 0 ? 1 : -1;
    agent.x = clamped;
  }
  function onDown(e) {
    if (paused || gameOver || meetingCallStopped) return; // pause, gameOver, 회의 소환 상태에서는 터치 입력 무시
    pDown = true;
    // 즉시 첫 번째 위치로 이동 (더 빠른 반응)
    const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    if (clientX) {
      const wx = clientToWorldX(clientX);
      applyAgentX(wx);
    }
  }
  function onMove(e) {
    if (!pDown || paused || gameOver || meetingCallStopped) return; // pause, gameOver, 회의 소환 상태에서는 이동 무시
    e.preventDefault?.(); // Prevent scrolling on mobile
    e.stopPropagation?.(); // 이벤트 버블링 방지
    const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    if (!clientX) return;
    const wx = clientToWorldX(clientX);
    const edgeBoost = wx < world.w * 0.15 || wx > world.w * 0.85 ? 1.3 : 1.0;
    let sensitivity = 0.65; // 이동 속도 증가에 맞춰 반응성 향상 (0.45 -> 0.65)
    // 커피 부족: 이동 속도 30% 감소
    if (hasDebuff(DEBUFFS.COFFEE_SHORTAGE)) {
      sensitivity *= 0.7;
    }
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
    if (gameOver) return; // 게임 오버 상태에서는 키 입력 무시
    if (paused && e.key === " ") {
      // pause 상태에서 스페이스바를 누르면 게임 재개
      paused = false;
      hideOverlay();
      return;
    }
    if (paused || meetingCallStopped) return; // pause 또는 회의 소환 상태에서는 이동 입력 무시
    let moveSpeed = agent.speed * 35; // 이동 속도 증가 (28 -> 35)
    // 커피 부족: 이동 속도 30% 감소
    if (hasDebuff(DEBUFFS.COFFEE_SHORTAGE)) {
      moveSpeed *= 0.7;
    }
    if (e.key === "ArrowLeft") {
      applyAgentX(agent.x - moveSpeed);
    }
    if (e.key === "ArrowRight") {
      applyAgentX(agent.x + moveSpeed);
    }
    if (e.key === " ") {
      paused = !paused;
      if (paused) {
        showOverlay("PAUSED", "계속하려면 CONTINUE 버튼을 누르세요", "CONTINUE");
      } else {
        hideOverlay();
      }
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
    // pause 상태에서 재개
    if (paused && !gameOver) {
      paused = false;
      hideOverlay();
      return;
    }
    // 게임 시작
    startGame();
  });
  
  btnTutorial.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 메인 오버레이 숨기고 튜토리얼 오버레이 표시
    overlay.hidden = true;
    overlay.style.display = "none";
    tutorialOverlay.hidden = false;
    tutorialOverlay.style.display = "grid";
  });
  
  btnCloseTutorial.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 튜토리얼 오버레이 숨기고 메인 오버레이 표시
    tutorialOverlay.hidden = true;
    tutorialOverlay.style.display = "none";
    overlay.hidden = false;
    overlay.style.display = "grid";
  });
  btnPause.addEventListener("click", () => {
    if (gameOver) return; // 게임 오버 상태에서는 pause 버튼 작동 안 함
    paused = !paused;
    if (paused) {
      showOverlay("PAUSED", "계속하려면 CONTINUE 버튼을 누르세요", "CONTINUE");
    } else {
      hideOverlay();
    }
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
  elHi.textContent = highScore;
  elDebuffText.textContent = "대기 중";
  elDebuffDesc.hidden = true;
  elDebuffTimer.hidden = true;
  elDebuffNext.textContent = "다음: LV 2부터";
  elDebuffNext.hidden = false;
  updateHearts();
  showOverlay(
    "머니 캐쳐",
    "좌우/스와이프 혹은 방향키 이동. 떨어지는 아이템을 받으세요!",
    "GAME START"
  );
  requestAnimationFrame(loop);
  console.log("%c[MoneyCatcher]", "color:#5C94FC; font-size: 14px;");
})();
