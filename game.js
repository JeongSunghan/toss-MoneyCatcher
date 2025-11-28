/**
 * game.js - 메인 게임 루프 및 초기화
 * 
 * 게임의 메인 루프와 모든 시스템을 조율합니다.
 * Canvas 초기화, 게임 상태 관리, 이벤트 처리, 모듈 간 통신을 담당합니다.
 */
(() => {
  "use strict";

  // ============================================
  // Canvas 초기화 및 리사이즈
  // ============================================
  const cvs = document.getElementById("game");
  const ctx = cvs.getContext("2d");
  const world = { w: 360, h: 520, scale: 1, shakeT: 0, shakeAmp: 0 };
  
  function resize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const rect = cvs.getBoundingClientRect();
    const displayWidth = rect.width || 360;
    const displayHeight = rect.height || 520;
    
    const actualWidth = Math.floor(displayWidth * dpr);
    const actualHeight = Math.floor(displayHeight * dpr);
    
    if (cvs.width !== actualWidth || cvs.height !== actualHeight) {
      cvs.width = actualWidth;
      cvs.height = actualHeight;
    }
    
    world.scale = Math.min(displayWidth / world.w, displayHeight / world.h);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  
  function syncSidebarHeight() {
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
  setTimeout(() => syncSidebarHeight(), 100);
  window.addEventListener("resize", () => {
    resize();
    setTimeout(syncSidebarHeight, 50);
    updateMobileHeaderVisibility(); // 모바일 헤드바 표시/숨김 업데이트
  }, { passive: true });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      resize();
      syncSidebarHeight();
      updateMobileHeaderVisibility(); // 모바일 헤드바 표시/숨김 업데이트
    }, 100);
  }, { passive: true });
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
  
  // ============================================
  // DOM 요소 참조
  // ============================================
  const $ = (id) => document.getElementById(id);
  const elScore = $("score"),
    elCombo = $("combo"),
    elLevel = $("level"),
    elHi = $("hi"),
    elHeartsCount = $("hearts-count"),
    elDebuffText = $("debuff-text"),
    elDebuffDesc = $("debuff-desc"),
    elDebuffTimer = $("debuff-timer"),
    elDebuffNext = $("debuff-next"),
    buffsDisplay = $("buffs-display");
  // 모바일 헤드바 요소
  const mobileHeader = $("mobile-header"),
    mobileScore = $("mobile-score"),
    mobileCombo = $("mobile-combo"),
    mobileLevel = $("mobile-level"),
    mobileHi = $("mobile-hi"),
    mobileDebuffText = $("mobile-debuff-text");
  
  // 모바일 감지 함수
  function isMobile() {
    return window.innerWidth <= 768;
  }
  
  // 모바일 헤드바 표시/숨김
  function updateMobileHeaderVisibility() {
    if (mobileHeader) {
      mobileHeader.hidden = !isMobile();
    }
  }
  
  // 초기 모바일 헤드바 표시/숨김 설정
  updateMobileHeaderVisibility();
  const prologueOverlay = $("prologue-overlay"),
    overlay = $("overlay"),
    tutorialOverlay = $("tutorial-overlay"),
    ovTitle = $("ov-title"),
    ovSub = $("ov-sub"),
    ovStats = $("ov-stats"),
    btnStartPrologue = $("btn-start-prologue"),
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
  const btnTutorialPrev = $("btn-tutorial-prev"),
    btnTutorialNext = $("btn-tutorial-next"),
    tutorialPageIndicator = $("tutorial-page-indicator"),
    tutorialDebuffs = $("tutorial-debuffs"),
    tutorialBuffs = $("tutorial-buffs");

  // ============================================
  // Asset 로딩
  // ============================================
  const IMG = {};
  const toLoad = {
    agent_idle: "assets/agent_idle.png",
    agent_run: "assets/agent_run.png",
    // 돈 에셋 (동전)
    cash10: "assets/money/coin_10.png",
    cash50: "assets/money/coin_50.png",
    cash100: "assets/money/coin_100.png",
    cash500: "assets/money/coin_500.png",
    // 돈 에셋 (지폐)
    cash1000: "assets/money/bill_1000.png",
    cash5000: "assets/money/bill_5000.png",
    cash10000: "assets/money/bill_10000.png",
    cash50000: "assets/money/bill_50000.png",
    // 기타 아이템
    tax: "assets/money/tax.png",
    debt: "assets/money/debt.png",
  };
  let assetsLoaded = 0;
  const totalAssets = Object.keys(toLoad).length;
  for (const k in toLoad) {
    const im = new Image();
    im.onerror = () => {
      // agent 이미지는 fallback 렌더링이 있으므로 경고만 출력 (에러 아님)
      if (k === 'agent_idle' || k === 'agent_run') {
        console.log(`[Asset] Agent sprite not found: ${toLoad[k]} (using fallback rendering)`);
      } else {
        console.warn(`[Asset] Failed to load: ${toLoad[k]}`);
      }
      assetsLoaded++;
      if (assetsLoaded === totalAssets) {
        console.log(`[Asset] All ${totalAssets} assets loaded (some with fallback)`);
      }
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

  // ============================================
  // 게임 설정 (모듈에서 가져오기)
  // ============================================
  const ITEM = window.Game?.ITEM || {};
  const SCORE = window.Game?.config?.SCORE || {};
  const COLOR = window.Game?.config?.COLOR || {};
  const LABEL = window.Game?.config?.LABEL || {};
  const MAX_LEVEL = window.Game?.config?.MAX_LEVEL || 10;
  const LEVEL_SCORE_INTERVAL = window.Game?.config?.LEVEL_SCORE_INTERVAL || 100;
  const LV = window.Game?.LEVELS || [];
  const DEBUFFS = window.Game?.DEBUFFS || {};
  const DEBUFF_INFO = window.Game?.DEBUFF_INFO || {};

  // ============================================
  // 모듈 시스템 참조
  // ============================================
  const DebuffSystem = window.Game?.DebuffSystem;
  const BuffSystem = window.Game?.BuffSystem;
  const ItemSystem = window.Game?.ItemSystem;
  const ComboSystem = window.Game?.ComboSystem;
  const AgentSystem = window.Game?.AgentSystem;
  const InputSystem = window.Game?.InputSystem;
  const RenderSystem = window.Game?.RenderSystem;
  const UISystem = window.Game?.UISystem;
  const BUFFS = window.Game?.BUFFS || {};

  // ============================================
  // 게임 상태
  // ============================================
  let levelIndex = 0,
    score = 0,
    highScore = Number(localStorage.getItem("mc.highscore") || 0);
  let paused = true,
    pauseStartTime = 0, // 일시정지 시작 시간
    pausedSpawnOffset = 0, // 일시정지 중 누적된 스폰 시간 오프셋
    gameOver = false,
    muted = false,
    isCountdownActive = false; // 카운트다운 진행 중 플래그
  let hearts = 5;
  elHi.textContent = `₩${highScore.toLocaleString('ko-KR')}`;
  
  // 통계 추적 변수
  let gameStartTime = 0;        // 게임 시작 시간
  let maxComboReached = 0;      // 최고 콤보
  let totalDebtAvoided = 0;     // 피한 빚 총액
  
  // 관리자 모드
  let adminMode = {
    enabled: false,
    infiniteLives: false,
    scoreMultiplier: 1.0,
  };

  // 디버프 상태 (fallback)
  let activeDebuffs = [];
  let debuffNextTime = 0;
  let feverPausedDebuffNextTime = 0; // FEVER 타임 중 디버프 대기 타이머 일시정지용
  let meetingCallNextStop = 0;
  let meetingCallStopped = false;
  let subscriptionBombNextCharge = 0;
  let lockedScore = 0;

  // ============================================
  // 디버프 헬퍼 함수
  // ============================================
  function getActiveDebuffs() {
    return DebuffSystem ? DebuffSystem.activeDebuffs : activeDebuffs;
  }
  function setActiveDebuffs(arr) {
    if (DebuffSystem) DebuffSystem.activeDebuffs = arr;
    else activeDebuffs = arr;
  }
  function getDebuffNextTime() {
    return DebuffSystem ? DebuffSystem.debuffNextTime : debuffNextTime;
  }
  function setDebuffNextTime(time) {
    if (DebuffSystem) DebuffSystem.debuffNextTime = time;
    else debuffNextTime = time;
  }
  function getMeetingCallNextStop() {
    return DebuffSystem ? DebuffSystem.meetingCallNextStop : meetingCallNextStop;
  }
  function setMeetingCallNextStop(time) {
    if (DebuffSystem) DebuffSystem.meetingCallNextStop = time;
    else meetingCallNextStop = time;
  }
  function getMeetingCallStopped() {
    return DebuffSystem ? DebuffSystem.meetingCallStopped : meetingCallStopped;
  }
  function setMeetingCallStopped(stop) {
    if (DebuffSystem) DebuffSystem.meetingCallStopped = stop;
    else meetingCallStopped = stop;
  }
  function getSubscriptionBombNextCharge() {
    return DebuffSystem ? DebuffSystem.subscriptionBombNextCharge : subscriptionBombNextCharge;
  }
  function setSubscriptionBombNextCharge(time) {
    if (DebuffSystem) DebuffSystem.subscriptionBombNextCharge = time;
    else subscriptionBombNextCharge = time;
  }
  function getDebuffInterval(level) {
    if (DebuffSystem?.getDebuffInterval) return DebuffSystem.getDebuffInterval(level);
    if (level <= 3) return 45000;
    if (level <= 5) return 40000;
    return 30000;
  }
  function getMaxDebuffStack(level) {
    if (DebuffSystem?.getMaxDebuffStack) return DebuffSystem.getMaxDebuffStack(level);
    if (level <= 5) return 1;
    if (level <= 8) return 2;
    return 3;
  }
  function hasDebuff(debuffType) {
    if (DebuffSystem?.hasDebuff) return DebuffSystem.hasDebuff(debuffType);
    return getActiveDebuffs().some(d => d.type === debuffType);
  }

  // ============================================
  // 모듈 헬퍼 함수
  // ============================================
  function getAgent() {
    return AgentSystem?.agent || null;
  }
  function getDrops() {
    return ItemSystem?.drops || [];
  }
  function getParticles() {
    return ItemSystem?.particles || [];
  }
  function spawnOne() {
    if (ItemSystem?.spawnOne) {
      const currentLevel = levelIndex + 1; // levelIndex는 0-based이므로 +1
      ItemSystem.spawnOne(world, window.Game?.config, DebuffSystem, currentLevel);
    }
  }
  function spawnParticles(x, y, color, count = 8) {
    if (ItemSystem?.spawnParticles) {
      ItemSystem.spawnParticles(x, y, color, count);
    }
  }
  function hitAgent(c) {
    if (AgentSystem?.hitAgent) return AgentSystem.hitAgent(c);
    const agent = getAgent();
    if (!agent) return false;
    const rx = agent.x - agent.w / 2, ry = agent.y - agent.h / 2;
    const nx = Math.max(rx, Math.min(c.x, rx + agent.w));
    const ny = Math.max(ry, Math.min(c.y, ry + agent.h));
    const dx = c.x - nx, dy = c.y - ny;
    return dx * dx + dy * dy <= (c.r * 1.2) ** 2;
  }
  function getComboCount() {
    return ComboSystem?.comboCount || 0;
  }
  function isFeverTime() {
    return ComboSystem?.isFeverTime || false;
  }
  function getComboMultiplier(combo) {
    if (ComboSystem?.getComboMultiplier) return ComboSystem.getComboMultiplier(combo);
    if (combo >= 100) return 4;
    if (combo >= 75) return 3;
    if (combo >= 50) return 2.5;
    if (combo >= 25) return 2;
    if (combo >= 10) return 1.5;
    if (combo >= 5) return 1.2;
    return 1;
  }
  function resetCombo() {
    if (ComboSystem?.resetCombo) ComboSystem.resetCombo();
  }
  function updateComboUI() {
    if (ComboSystem?.updateComboUI) ComboSystem.updateComboUI(fill, multEl, DebuffSystem);
  }

  // ============================================
  // FX 함수
  // ============================================
  function vibrate(ms = 35) {
    try { navigator.vibrate?.(ms); } catch {}
  }
  function shake(amp = 6, ms = 180) {
    world.shakeAmp = amp;
    world.shakeT = performance.now() + ms;
  }
  function popBanner(text, ms = 1500, priority = 0) {
    if (UISystem?.popBanner) {
      UISystem.popBanner(banner, text, ms, priority);
    } else {
    banner.textContent = text;
    banner.hidden = false;
      setTimeout(() => { banner.hidden = true; }, ms);
    }
  }

  /**
   * 사운드 효과 재생
   * 오디오를 clone하여 동시 재생 가능하게 하고, 앞부분 빈 공간을 건너뜁니다.
   * @param {string} soundId - 오디오 요소 ID
   * @param {number} volume - 볼륨 (0.0 ~ 1.0, 기본값 0.7)
   * @param {number} skipTime - 건너뛸 시간 (초, 기본값 0.1)
   */
  function playSound(soundId, volume = 0.5, skipTime = 0.1) {
    if (muted) return;
    const audio = $(soundId);
    if (!audio || !audio.src) return;
    
    try {
      // 새로운 Audio 객체를 생성하여 동시 재생 가능하게 함
      const audioInstance = new Audio(audio.src);
      audioInstance.volume = volume;
      
      // 오디오가 로드되면 앞부분 빈 공간을 건너뛰고 재생
      const playAudio = () => {
        audioInstance.currentTime = skipTime; // 앞부분 빈 공간 건너뛰기
        audioInstance.play().catch(err => {
          // 자동 재생 정책으로 인한 오류는 무시
          if (err.name !== 'NotAllowedError') {
            console.warn(`[Sound] Failed to play ${soundId}:`, err);
          }
        });
      };
      
      // 오디오가 이미 로드되었으면 즉시 재생, 아니면 로드 대기
      if (audioInstance.readyState >= 2) { // HAVE_CURRENT_DATA 이상
        playAudio();
      } else {
        audioInstance.addEventListener('canplay', playAudio, { once: true });
        audioInstance.load(); // 오디오 로드 시작
      }
      
      // 재생 완료 후 메모리 정리 (이벤트 리스너 제거)
      audioInstance.addEventListener('ended', () => {
        audioInstance.removeEventListener('canplay', playAudio);
        audioInstance.src = '';
      }, { once: true });
    } catch (err) {
      console.warn(`[Sound] Error playing ${soundId}:`, err);
    }
  }

  /**
   * BGM 재생/정지
   * @param {boolean} play - true면 재생, false면 정지
   */
  function playBGM(play = true) {
    const bgm = $("bgm");
    if (bgm) {
      try {
        if (play && !muted) {
          bgm.volume = 0.1; // BGM 볼륨 감소 
          updateBGMTempo(); // 레벨에 맞는 템포 적용
          bgm.play().catch(err => {
            if (err.name !== 'NotAllowedError') {
              console.warn("[Sound] Failed to play BGM:", err);
            }
          });
        } else {
          bgm.pause();
          bgm.currentTime = 0;
        }
      } catch (err) {
        console.warn("[Sound] Error controlling BGM:", err);
      }
    }
  }

  /**
   * 레벨에 따른 BGM 템포 업데이트
   * 레벨 1-3: 100 BPM (기본 속도 1.0x)
   * 레벨 4-6: 120 BPM (1.2x)
   * 레벨 7-10: 140 BPM (1.4x)
   */
  function updateBGMTempo() {
    const bgm = $("bgm");
    if (!bgm) return;
    
    const currentLevel = levelIndex + 1; // levelIndex는 0-based이므로 +1
    let playbackRate = 1.0;
    
    if (currentLevel <= 3) {
      playbackRate = 1.0; // 레벨 1-3: 100 BPM (기본 속도)
    } else if (currentLevel <= 6) {
      playbackRate = 1.2; // 레벨 4-6: 120 BPM (1.2x)
    } else {
      playbackRate = 1.4; // 레벨 7-10: 140 BPM (1.4x)
    }
    
    bgm.playbackRate = playbackRate;
  }

  // ============================================
  // 게임 로직
  // ============================================
  function collect(type) {
    const base = SCORE[type] || 0;
    const currentLevel = levelIndex + 1; // levelIndex는 0-based이므로 +1
    
    // 버프 아이템 처리
    if (type === ITEM.BUFF_GOLDEN_TIME) {
      // 조기퇴근: 생명력 회복/보너스 목숨
      const maxHearts = 5;
      if (hearts < maxHearts) {
        hearts = maxHearts;
        updateHearts();
        popBanner("🏃 조기퇴근! 생명력 회복!", 2000);
      } else {
        hearts = Math.min(maxHearts + 1, hearts + 1); // 보너스 목숨 +1
        updateHearts();
        popBanner("🏃 조기퇴근! 보너스 목숨 +1!", 2000);
      }
      playSound("sfx-catch", 1.0);
      return;
    } else if (type === ITEM.BUFF_MAGNET) {
      if (BuffSystem) {
        BuffSystem.activateBuff(BUFFS.MAGNET, 5000); // 5초
        popBanner("🧲 자석! 5초간 +아이템 자동 수집", 2000);
        playSound("sfx-catch", 1.0);
      }
      return;
    } else if (type === ITEM.BUFF_STOCK_BOOM) {
      if (BuffSystem) {
        BuffSystem.activateBuff(BUFFS.STOCK_BOOM, 3500); // 3.5초
        popBanner("📈 미국 주식 떡상! 수표 폭풍!", 2000);
        playSound("sfx-catch", 1.0);
        
        // 화면에 떨어지고 있는 모든 현금 아이템을 5만원으로 변경
        const currentDrops = getDrops();
        for (let i = 0; i < currentDrops.length; i++) {
          const d = currentDrops[i];
          if (d && d.alive) {
            // 현금 아이템인 경우 (세금/빚 제외)
            if (d.type !== ITEM.TAX && d.type !== ITEM.DEBT && 
                d.type !== ITEM.BUFF_GOLDEN_TIME && d.type !== ITEM.BUFF_MAGNET && 
                d.type !== ITEM.BUFF_STOCK_BOOM) {
              d.type = ITEM.CASH50000; // 모든 현금을 5만원으로 변경
            }
          }
        }
      }
      return;
    }
    
    if (type === ITEM.TAX || type === ITEM.DEBT) {
      if (ComboSystem?.comboCount > 0) {
        resetCombo();
        popBanner("콤보 초기화!");
      }
      
      // 레벨별 퍼센트 차감 계산
      let percentDeduction = 0;
      if (type === ITEM.TAX) {
        // 세금: 레벨별 현재 금액의 % 차감
        if (currentLevel <= 2) percentDeduction = 0.03;      // 3%
        else if (currentLevel <= 5) percentDeduction = 0.07; // 7%
        else if (currentLevel <= 8) percentDeduction = 0.12; // 12%
        else percentDeduction = 0.25;                         // 25%
      } else if (type === ITEM.DEBT) {
        // 빚: 레벨별 현재 금액의 % 차감
        if (currentLevel <= 2) percentDeduction = 0.01;       // 1%
        else if (currentLevel <= 5) percentDeduction = 0.03;  // 3%
        else if (currentLevel <= 8) percentDeduction = 0.05;  // 5%
        else percentDeduction = 0.10;                        // 10%
      }
      
      // FEVER 타임: 세금/빚 차감 무시
      let itemScore = 0;
      if (!isFeverTime()) {
        itemScore = Math.floor(score * percentDeduction);
        
        // 금리 인상: 빚 아이템 차감 2배
        if (type === ITEM.DEBT && hasDebuff(DEBUFFS.INTEREST_RATE_UP)) {
          itemScore *= 2.0;
        }
        
        // 관리자 모드: 점수 배수 적용
        if (adminMode.enabled) {
          itemScore *= adminMode.scoreMultiplier;
        }
      }
      
      score = Math.max(0, score - itemScore); // 점수는 0 이하로 내려가지 않음
      vibrate(40);
      shake(8, 200);
      playSound("sfx-penalty", 1.0); // TAX/DEBT 수집 사운드 (볼륨 최대)
    } else {
      // + 아이템 수집
      if (ComboSystem?.incrementCombo) {
        const feverTriggered = ComboSystem.incrementCombo(DebuffSystem);
        if (feverTriggered) {
          // FEVER 타임 시작: 모든 디버프 해제 및 디버프 대기 타이머 일시정지
          const currentNextTime = getDebuffNextTime();
          if (currentNextTime > 0) {
            const remainingTime = currentNextTime - performance.now();
            if (remainingTime > 0) {
              feverPausedDebuffNextTime = remainingTime; // 남은 시간 저장
            }
          }
          setActiveDebuffs([]); // 모든 디버프 해제
          setDebuffNextTime(0); // 디버프 대기 타이머 정지
          popBanner(`FEVER TIME!🔥\n(${ComboSystem.comboCount} 콤보)`);
          playSound("sfx-combo", 0.8); // FEVER 타임 발동 사운드 (25, 50, 75, 100 콤보)
        }
      }
      
      const comboCount = getComboCount();
      // 최고 콤보 업데이트
      if (comboCount > maxComboReached) {
        maxComboReached = comboCount;
      }
      const mult = getComboMultiplier(comboCount);
      let itemScore = base;
      
      // 연봉동결 디버프: 획득 점수가 없어짐 (0원)
      if (hasDebuff(DEBUFFS.SALARY_FREEZE)) {
        itemScore = 0;
      } else {
        if (ItemSystem?.calculateScore) {
          itemScore = ItemSystem.calculateScore(type, comboCount, isFeverTime(), DebuffSystem, adminMode, mult);
        } else {
          let scoreMult = mult;
          if (hasDebuff(DEBUFFS.KOSPI_DOWN)) scoreMult *= 0.5;
          if (hasDebuff(DEBUFFS.SAVING_OBSESSION)) scoreMult *= 0.7;
          // FEVER 타임: 현금을 2배로 획득
          if (isFeverTime()) scoreMult *= 2.0;
          // 조기퇴근 버프는 점수 배수 없음 (생명력 회복만)
          if (adminMode.enabled) scoreMult *= adminMode.scoreMultiplier;
          itemScore = Math.floor(itemScore * scoreMult);
        }
      }
      
      score += itemScore;
      playSound("sfx-catch", 1.0); // + 아이템 수집 사운드 (볼륨 최대)
      checkLevelUp();
    }
  }
  
  function checkLevelUp() {
    // 레벨별 다른 간격을 적용하여 레벨 계산
    const getLevelScoreInterval = window.Game?.config?.getLevelScoreInterval;
    const calculateLevelFromScore = window.Game?.config?.calculateLevelFromScore;
    
    let newLevel;
    if (calculateLevelFromScore) {
      // 레벨별 간격을 적용한 계산 함수 사용
      newLevel = calculateLevelFromScore(score);
    } else if (getLevelScoreInterval) {
      // 레벨별 간격 함수가 있으면 누적 점수로 계산
      let currentScore = 0;
      newLevel = 0;
      for (let i = 1; i <= MAX_LEVEL; i++) {
        const interval = getLevelScoreInterval(i);
        currentScore += interval;
        if (score >= currentScore) {
          newLevel = i;
        } else {
          break;
        }
      }
      newLevel = Math.min(MAX_LEVEL - 1, newLevel);
    } else {
      // 폴백: 기본 간격 사용
      newLevel = Math.min(MAX_LEVEL - 1, Math.floor(score / LEVEL_SCORE_INTERVAL));
    }
    if (newLevel > levelIndex) {
      const prevLevel = levelIndex;
      levelIndex = newLevel;
      popBanner(`레벨 업! LV ${LV[levelIndex]?.id || levelIndex + 1} 🎉`);
      playSound("sfx-clear", 0.8); // 레벨업 사운드
      
      // 레벨이 변경되면 BGM 템포 업데이트
      const prevLevelNum = prevLevel + 1;
      const newLevelNum = levelIndex + 1;
      
      // 템포 구간이 변경되었는지 확인 (1-3, 4-6, 7-10)
      const prevTempoGroup = prevLevelNum <= 3 ? 1 : (prevLevelNum <= 6 ? 2 : 3);
      const newTempoGroup = newLevelNum <= 3 ? 1 : (newLevelNum <= 6 ? 2 : 3);
      
      if (prevTempoGroup !== newTempoGroup) {
        updateBGMTempo(); // 템포 구간이 변경되었을 때만 업데이트
      }
      
      if (levelIndex >= 1 && !isFeverTime()) {
        const maxStack = getMaxDebuffStack(levelIndex + 1);
        const currentDebuffs = getActiveDebuffs();
        if (currentDebuffs.length < maxStack) {
          activateRandomDebuff();
        }
        if (levelIndex === 3 || levelIndex === 5 || levelIndex === 8) {
          hearts = Math.min(5, hearts + 1);
          popBanner(`생명 회복! ❤️ (${hearts}개)`);
        }
      }
      
      if (levelIndex >= 1 && !isFeverTime()) {
        setDebuffNextTime(performance.now() + getDebuffInterval(levelIndex + 1));
      }
    }
  }
  
  function activateRandomDebuff() {
    // FEVER 타임 중에는 디버프 생성 안 함
    if (isFeverTime()) return;
    const debuffTypes = Object.values(DEBUFFS);
    const currentDebuffs = getActiveDebuffs();
    const availableDebuffs = debuffTypes.filter(type => 
      !currentDebuffs.some(d => d.type === type)
    );
    
    if (availableDebuffs.length === 0) return;
    
    const debuffType = availableDebuffs[Math.floor(Math.random() * availableDebuffs.length)];
    const debuffInfo = DEBUFF_INFO[debuffType];
    if (!debuffInfo) return;
    
    const newDebuff = {
      type: debuffType,
      startTime: performance.now(),
      duration: debuffInfo.duration,
    };
    // 실드 버프 체크: 디버프 무효화
    if (BuffSystem && BuffSystem.useShield && BuffSystem.useShield()) {
      popBanner("🛡️ 실드로 디버프 무효화!", 2000);
      return; // 디버프 적용 안 함
    }
    
    const debuffs = getActiveDebuffs();
    debuffs.push(newDebuff);
    setActiveDebuffs(debuffs);
    
    updateDebuffUI();
    
    // FEVER 타임 중에는 디버프 팝업 표시 안 함
    if (!isFeverTime()) {
      popBanner(`${debuffInfo.name} 발생!\n${debuffInfo.desc}`, 4000, 1);
    }
  }
  
  function updateDebuff() {
    const now = performance.now();
    const currentDebuffs = getActiveDebuffs();
    
    // FEVER 타임 중에는 디버프 시간이 멈춤 (startTime을 조정하여 경과 시간을 동결)
    if (isFeverTime()) {
      // FEVER 타임 중에는 디버프를 필터링만 하고 시간은 업데이트하지 않음
      // (startTime을 조정하여 경과 시간을 동결시키는 대신, 필터링만 수행)
      const filteredDebuffs = currentDebuffs.filter(debuff => {
        // FEVER 타임 시작 시점의 남은 시간을 유지
        if (!debuff.feverPausedTime) {
          debuff.feverPausedTime = now; // FEVER 타임 시작 시점 기록
          debuff.feverPausedRemaining = debuff.duration - (now - debuff.startTime); // 남은 시간 기록
        }
        return debuff.feverPausedRemaining > 0; // 남은 시간이 있으면 유지
      });
      setActiveDebuffs(filteredDebuffs);
    } else {
      // FEVER 타임이 아닐 때는 정상적으로 시간 경과 처리
      const filteredDebuffs = currentDebuffs.map(debuff => {
        // FEVER 타임이 끝났으면 startTime을 조정하여 남은 시간을 반영
        if (debuff.feverPausedTime) {
          const pausedDuration = now - debuff.feverPausedTime; // FEVER 타임 동안 멈춘 시간
          debuff.startTime = now - (debuff.feverPausedRemaining || 0); // 남은 시간을 반영하여 startTime 조정
          debuff.feverPausedTime = null; // 초기화
          debuff.feverPausedRemaining = null; // 초기화
        }
        return debuff;
      }).filter(debuff => {
        const elapsed = now - debuff.startTime;
        return elapsed < debuff.duration;
      });
      setActiveDebuffs(filteredDebuffs);
    }
    
    // FEVER 타임 중에는 새로운 디버프 생성 안 함
    if (levelIndex >= 1 && !paused && !gameOver && !isFeverTime()) {
      const maxStack = getMaxDebuffStack(levelIndex + 1);
      const nextTime = getDebuffNextTime();
      const currentDebuffsAfterFilter = getActiveDebuffs();
      if (currentDebuffsAfterFilter.length < maxStack && nextTime > 0 && now >= nextTime) {
        activateRandomDebuff();
        setDebuffNextTime(now + getDebuffInterval(levelIndex + 1));
      }
    }
    
    updateDebuffUI();
  }
  
  function updateDebuffUI() {
    if (UISystem?.updateDebuffUI) {
      UISystem.updateDebuffUI({
        elDebuffText,
        elDebuffDesc,
        elDebuffTimer,
        elDebuffNext,
        levelIndex,
        DebuffSystem,
        DEBUFF_INFO,
        getActiveDebuffs,
        getDebuffNextTime,
        getDebuffInterval,
        isFeverTime,
      });
    } else {
      // FEVER 타임 중에는 "FEVER 적용중" 표시
      if (isFeverTime()) {
        elDebuffText.textContent = "FEVER 적용중";
        elDebuffDesc.textContent = "모든 디버프가 일시 중지됩니다";
        elDebuffDesc.hidden = false;
        elDebuffTimer.hidden = true;
        elDebuffNext.hidden = true;
        
        // 모바일 헤드바 디버프 업데이트
        if (isMobile() && mobileDebuffText) {
          mobileDebuffText.textContent = "FEVER";
        }
        return;
      }
      
      const currentDebuffs = getActiveDebuffs();
      if (currentDebuffs.length > 0) {
        const firstDebuff = currentDebuffs[0];
        const debuffInfo = DEBUFF_INFO[firstDebuff.type];
        const elapsed = performance.now() - firstDebuff.startTime;
        const remaining = Math.max(0, firstDebuff.duration - elapsed);
        const remainingSeconds = Math.ceil(remaining / 1000);
        
        if (debuffInfo) {
          const debuffText = currentDebuffs.length > 1 
            ? `${debuffInfo.name} 외 ${currentDebuffs.length - 1}개`
            : debuffInfo.name;
          elDebuffText.textContent = debuffText;
          elDebuffDesc.textContent = debuffInfo.desc;
          elDebuffDesc.hidden = false;
          elDebuffTimer.textContent = `남은 시간: ${remainingSeconds}초`;
          elDebuffTimer.hidden = false;
          elDebuffNext.hidden = true;
          
          // 모바일 헤드바 디버프 업데이트
          if (isMobile() && mobileDebuffText) {
            mobileDebuffText.textContent = debuffText;
          }
        }
      } else {
        elDebuffText.textContent = "대기 중";
        elDebuffDesc.hidden = true;
        elDebuffTimer.hidden = true;
        
        // 모바일 헤드바 디버프 업데이트
        if (isMobile() && mobileDebuffText) {
          mobileDebuffText.textContent = "대기 중";
        }
        
        if (levelIndex >= 1) {
          const interval = getDebuffInterval(levelIndex + 1);
          const nextTime = getDebuffNextTime();
          const timeUntilNext = nextTime > 0 
            ? Math.max(0, nextTime - performance.now())
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
  }

  // ============================================
  // UI 업데이트
  // ============================================
  function updateHud() {
    if (UISystem?.updateHud) {
      UISystem.updateHud({
        elScore,
        elCombo,
        elLevel,
        elHi,
        elHeartsCount,
        score,
        highScore,
        levelIndex,
        LV,
        hearts,
        ComboSystem,
        fill,
        multEl,
        DebuffSystem,
        updateComboUI,
        updateDebuff,
      });
    } else {
      elScore.textContent = `₩${score.toLocaleString('ko-KR')}`;
      elCombo.textContent = `×${getComboCount() || 1}`;
      elLevel.textContent = `LV ${LV[levelIndex]?.id || levelIndex + 1}`;
    }
    
    // 모바일 헤드바 업데이트
    if (isMobile() && mobileHeader && !mobileHeader.hidden) {
      if (mobileScore) mobileScore.textContent = `₩${score.toLocaleString('ko-KR')}`;
      if (mobileCombo) mobileCombo.textContent = `×${getComboCount() || 1}`;
      if (mobileLevel) mobileLevel.textContent = `LV ${LV[levelIndex]?.id || levelIndex + 1}`;
      if (mobileHi) mobileHi.textContent = `₩${highScore.toLocaleString('ko-KR')}`;
    }
    elHi.textContent = `₩${highScore.toLocaleString('ko-KR')}`;
    updateHearts();
    updateComboUI();
    updateDebuff();
    updateBuffsUI();
  }
  
  function updateBuffsUI() {
    if (!buffsDisplay || !BuffSystem) return;
    
    const now = performance.now();
    const activeBuffs = BuffSystem.activeBuffs || [];
    
    // 시간 제한 버프들만 필터링
    const timeBuffs = activeBuffs.filter(b => b.endTime > now);
    
    // 모든 버프 제거
    buffsDisplay.innerHTML = '';
    
    // 시간 제한 버프들 표시
    timeBuffs.forEach(buff => {
      const remaining = Math.max(0, buff.endTime - now);
      const seconds = Math.ceil(remaining / 1000);
      
      const buffDiv = document.createElement('div');
      buffDiv.className = 'buff-item';
      
      let icon = '';
      if (buff.type === BUFFS.EARLY_LEAVE) icon = '🏃';
      else if (buff.type === BUFFS.MAGNET) icon = '🧲';
      else if (buff.type === BUFFS.STOCK_BOOM) icon = '📈';
      
      buffDiv.innerHTML = `<span class="buff-icon">${icon}</span><span class="buff-time">${seconds}초</span>`;
      buffsDisplay.appendChild(buffDiv);
    });
  }
  
  function updateHearts() {
    if (UISystem?.updateHearts) {
      UISystem.updateHearts({ elHeartsCount, hearts });
    } else {
      if (elHeartsCount) elHeartsCount.textContent = `×${hearts}`;
    }
  }
  
  function loseHeart() {
    if (adminMode.enabled && adminMode.infiniteLives) return;
    if (isFeverTime()) return;
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

  function showOverlay(t, s, btn, isGameOver = false) {
    if (UISystem?.showOverlay) {
      UISystem.showOverlay(overlay, ovTitle, ovSub, btnStart, t, s, btn, isGameOver);
    } else {
    ovTitle.textContent = t;
    if (isGameOver && ovStats) {
      // 게임 오버일 때는 통계를 별도 요소로 표시
      ovSub.hidden = true;
      ovStats.hidden = false;
    } else {
      // 일반 오버레이일 때는 기존 방식 사용
      ovSub.hidden = false;
      ovSub.textContent = s;
      if (ovStats) ovStats.hidden = true;
    }
    btnStart.textContent = btn || "CONTINUE";
      overlay.hidden = false;
    overlay.style.display = "grid";
  }
    if (!tutorialOverlay.hidden) {
      tutorialOverlay.hidden = true;
      tutorialOverlay.style.display = "none";
    }
  }
  
  function hideOverlay() {
    if (UISystem?.hideOverlay) {
      UISystem.hideOverlay(overlay);
    } else {
      overlay.hidden = true;
    overlay.style.display = "none";
    }
  }

  // ============================================
  // 메인 게임 루프
  // ============================================
  let prev = 0;
  function loop(ts) {
    // 모든 플랫폼에서 60fps (16.67ms = 60fps)
    const targetFPS = 16.67;
    const dt = prev ? Math.min(ts - prev, 100) : targetFPS;
    prev = ts;
    const now = performance.now();

    const shouldShake = world.shakeT > now;
    if (shouldShake) {
      ctx.save();
      ctx.translate(
        (Math.random() * 2 - 1) * world.shakeAmp,
        (Math.random() * 2 - 1) * world.shakeAmp
      );
    }

    if (!paused && !gameOver && !isCountdownActive) {
      const deltaTime = dt / 1000;
      
      // 입력 처리 및 캐릭터 이동
      const mouseTargetX = InputSystem?.mouseTargetX;
      if (mouseTargetX !== null && !getMeetingCallStopped()) {
        let speedMultiplier = 1.0;
        if (hasDebuff(DEBUFFS.COFFEE_SHORTAGE)) speedMultiplier = 0.7;
        if (ComboSystem?.isFeverTime) speedMultiplier *= 1.15;
        
        if (AgentSystem?.updatePosition) {
          AgentSystem.updatePosition(mouseTargetX, world, speedMultiplier);
        } else {
          const agent = getAgent();
          if (agent) {
            const targetX = Math.max(agent.w / 2, Math.min(world.w - agent.w / 2, mouseTargetX));
            const distance = targetX - agent.x;
            agent.x += distance * 0.85 * speedMultiplier;
            agent.vx = distance * speedMultiplier;
            if (Math.abs(agent.vx) > 0.1) agent.face = agent.vx > 0 ? 1 : -1;
          }
        }
      }
      
      // 콤보 시스템 업데이트
      if (ComboSystem?.updateCombo) ComboSystem.updateCombo(deltaTime, DebuffSystem);
      if (ComboSystem?.updateFeverTime) {
        const feverEnded = ComboSystem.updateFeverTime(deltaTime);
        // FEVER 타임이 끝나면 디버프 대기 타이머 원상 복구
        if (feverEnded) {
          setActiveDebuffs([]); // 모든 디버프 해제
          // FEVER 타임 전에 저장된 디버프 대기 타이머 시간 복구
          if (feverPausedDebuffNextTime > 0) {
            setDebuffNextTime(performance.now() + feverPausedDebuffNextTime);
            feverPausedDebuffNextTime = 0; // 초기화
          }
          popBanner("FEVER 타임 종료!");
        }
      }
      
      // 디버프 업데이트
      if (!isFeverTime()) updateDebuff();
      
      // 버프 업데이트
      if (BuffSystem?.updateBuffs) {
        BuffSystem.updateBuffs(dt * 1000); // 밀리초로 변환 (실제로는 사용하지 않지만 호환성을 위해)
      }
      
      // 자석 버프: +아이템만 자동 수집 처리
      if (BuffSystem && BuffSystem.hasBuff(BUFFS.MAGNET)) {
        const agent = getAgent();
        if (agent) {
          const magnetRange = 100; // 100px 범위 (더 좁힘)
          const currentDrops = getDrops();
          for (let i = currentDrops.length - 1; i >= 0; i--) {
            const d = currentDrops[i];
            if (!d || !d.alive) continue;
            
            // - 아이템(세금/빚)은 자석으로 끌어오지 않음
            if (d.type === ITEM.TAX || d.type === ITEM.DEBT) continue;
            
            // 캐릭터와의 거리 계산
            const dx = d.x - agent.x;
            const dy = d.y - agent.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 범위 내에 있으면 자동 수집 (135px 범위)
            if (distance <= magnetRange + d.r) {
              d.alive = false;
              const itemColor = COLOR[d.type] || "#999";
              spawnParticles(d.x, d.y, itemColor, 8);
              collect(d.type);
              currentDrops.splice(i, 1);
            }
          }
        }
      }
      
      // 회의 소환 디버프 처리
      if (hasDebuff(DEBUFFS.MEETING_CALL)) {
        const meetingNow = performance.now();
        const isStopped = getMeetingCallStopped();
        const nextStop = getMeetingCallNextStop();
        if (!isStopped) {
          if (nextStop === 0) {
            setMeetingCallNextStop(meetingNow + 3000);
          } else if (meetingNow >= nextStop) {
            setMeetingCallStopped(true);
            setMeetingCallNextStop(meetingNow + 500);
            const agent = getAgent();
            if (agent) agent.vx = 0;
            popBanner("📞 긴급 회의! 정지", 500);
          }
        } else {
          if (meetingNow >= nextStop) {
            setMeetingCallStopped(false);
            setMeetingCallNextStop(meetingNow + 3000);
          }
        }
      } else {
        if (getMeetingCallStopped()) {
          setMeetingCallStopped(false);
          setMeetingCallNextStop(0);
        }
      }
      
      // 구독료 폭탄 디버프 처리 (2초마다 1000원 차감)
      if (hasDebuff(DEBUFFS.SUBSCRIPTION_BOMB)) {
        const subscriptionNow = performance.now();
        const nextCharge = getSubscriptionBombNextCharge();
        if (nextCharge === 0 || subscriptionNow >= nextCharge) {
          score = Math.max(0, score - 1000); // 2초마다 1000원 차감
          setSubscriptionBombNextCharge(subscriptionNow + 2000);
          if (score > 0) popBanner("구독료 차감 -1,000원 💳", 1000);
        }
      } else {
        setSubscriptionBombNextCharge(0);
      }
      
      // 회의 소환 중 캐릭터 이동 중지
      if (getMeetingCallStopped()) {
        const agent = getAgent();
        if (agent) agent.vx = 0;
      }

      // 아이템 스폰 (일시정지 중이 아닐 때만)
      if (!paused) {
        const baseSpawn = LV[levelIndex]?.spawn || 700;
        const spawnInterval = baseSpawn * (0.92 + Math.random() * 0.16);
        const nextSpawnAt = ItemSystem?.nextSpawnAt || 0;

        if (ts >= nextSpawnAt) {
          spawnOne();
          if (ItemSystem) ItemSystem.nextSpawnAt = ts + spawnInterval;
        }
      }

      // 미국 주식 떡상 버프: 빠른 수표 스폰 (일시정지 중이 아닐 때만)
      if (!paused && BuffSystem && BuffSystem.stockBoomActive && ts >= BuffSystem.stockBoomNextSpawn) {
        const ITEM = window.Game?.ITEM || {};
        const margin = 16;
        const gridSize = (world.w - margin * 2) / 4;
        const gridIndex = Math.floor(Math.random() * 4);
        const x = margin + gridIndex * gridSize + gridSize / 2;
        const y = -20;
        const r = 18;
        const vy = 0.08 + Math.random() * 0.06;
        
        // 5만원 수표 스폰 (cash50000 사용)
        if (ItemSystem && ItemSystem.drops) {
          ItemSystem.drops.push({ 
            x, y, r, vy, 
            type: ITEM.CASH50000, 
            alive: true,
            stockBoomItem: true // 미국 주식 떡상 아이템 표시
          });
        }
        
        BuffSystem.stockBoomNextSpawn = ts + 500; // 0.5초마다 스폰 (렉 방지)
      }

      // 아이템 물리 업데이트
      if (ItemSystem?.updatePhysics) {
        ItemSystem.updatePhysics(dt, world, LV[levelIndex], DebuffSystem);
      }
      
      // 충돌 및 낙하 체크
      const currentDrops = getDrops();
      for (let i = currentDrops.length - 1; i >= 0; i--) {
        const d = currentDrops[i];
        if (!d || !d.alive) {
          currentDrops.splice(i, 1);
        continue;
      }
        
      if (hitAgent(d)) {
        d.alive = false;
        const itemColor = COLOR[d.type] || "#999";
          spawnParticles(d.x, d.y, itemColor, (d.type === ITEM.TAX || d.type === ITEM.DEBT) ? 12 : 8);
        collect(d.type);
          currentDrops.splice(i, 1);
        continue;
      }
        
      if (d.y - d.r > world.h) {
        d.alive = false;
          // 미국 주식 떡상 아이템은 놓쳐도 생명/콤보 감소 없음
          if (d.stockBoomItem) {
            // 아무것도 하지 않음
          } else if (d.type !== ITEM.TAX && d.type !== ITEM.DEBT) {
            loseHeart();
            if (ComboSystem?.comboCount > 0) resetCombo();
          } else if (d.type === ITEM.DEBT) {
            // 빚 아이템이 화면 밖으로 떨어져 사라지면 피한 빚으로 계산
            const currentLevel = levelIndex + 1;
            let percentDeduction = 0;
            if (currentLevel <= 2) percentDeduction = 0.01;       // 1%
            else if (currentLevel <= 5) percentDeduction = 0.03;  // 3%
            else if (currentLevel <= 8) percentDeduction = 0.05;  // 5%
            else percentDeduction = 0.10;                        // 10%
            const avoidedAmount = Math.floor(score * percentDeduction);
            totalDebtAvoided += avoidedAmount;
          }
          currentDrops.splice(i, 1);
        }
      }
    }
    
    // 파티클 업데이트
    if (ItemSystem?.updateParticles) {
      ItemSystem.updateParticles(dt, world);
    }

    // 렌더링 (60fps 유지)
    if (RenderSystem?.render) {
      RenderSystem.render(ctx, cvs, world, {
        IMG,
        COLOR,
        LABEL,
        ITEM,
        drops: getDrops(),
        particles: getParticles(),
        AgentSystem,
        DebuffSystem,
        BuffSystem,
        ComboSystem,
        hasDebuff,
        DEBUFFS,
        BUFFS,
      });
      } else {
        // Fallback 렌더링
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const canvasWidth = cvs.width || 360;
      const canvasHeight = cvs.height || 520;
      const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      gradient.addColorStop(0, "#87CEEB");
      gradient.addColorStop(0.5, "#5C94FC");
      gradient.addColorStop(1, "#4A7BC8");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      ctx.save();
      if (isFeverTime()) {
        ctx.shadowColor = "#FF0000";
        ctx.shadowBlur = 20;
        ctx.filter = "brightness(1.2)";
      }
      // 연봉동결 디버프는 collect 함수에서 처리 (모든 금액을 10000원으로 변경)
      
      for (const d of getDrops()) {
        if (d && d.alive) {
          if (hasDebuff(DEBUFFS.FOMO_SYNDROME) && (d.type === ITEM.TAX || d.type === ITEM.DEBT)) {
            const fakeType = ITEM.CASH1000; // FOMO 증후군: 세금/빚을 1000원으로 위장
            ctx.fillStyle = COLOR[fakeType] || "#999";
      ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
          } else {
            ctx.fillStyle = COLOR[d.type] || "#999";
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      
      if (AgentSystem?.drawAgentSprite) {
        AgentSystem.drawAgentSprite(ctx, cvs, world, IMG);
      }
      
      ctx.restore();
      
      if (hasDebuff(DEBUFFS.OVERTIME_MODE)) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
      
      if (hasDebuff(DEBUFFS.REAL_ESTATE_BOOM)) {
        const overlayHeight = canvasHeight * 0.3;
        ctx.fillStyle = "rgba(139, 111, 71, 0.7)";
        ctx.fillRect(0, canvasHeight - overlayHeight, canvasWidth, overlayHeight);
      }
    }
    
    updateHud();
    
    // 콤보 리셋 처리
    if (ComboSystem?.comboPendingReset) {
      resetCombo();
      ComboSystem.comboPendingReset = false;
      fill.style.width = '0%';
      multEl.textContent = '×1';
      multEl.style.color = "";
      multEl.style.animation = "";
    }

    if (shouldShake) ctx.restore();

    // Agent 관성 업데이트
    if (AgentSystem?.updateInertia) {
      AgentSystem.updateInertia();
    } else {
      const agent = getAgent();
      if (agent) agent.vx *= 0.80;
    }

    requestAnimationFrame(loop);
  }

  // ============================================
  // 게임 시작/종료
  // ============================================
  function startGame() {
    levelIndex = 0;
    score = 0;
    hearts = 5;
    
    // 통계 초기화
    gameStartTime = performance.now();
    maxComboReached = 0;
    totalDebtAvoided = 0;
    
    if (ComboSystem?.init) ComboSystem.init();
    if (ItemSystem?.init) {
      ItemSystem.init();
      ItemSystem.nextSpawnAt = performance.now() + 400;
    }
    if (AgentSystem?.init) {
      AgentSystem.init(world);
    } else {
      const agent = getAgent();
      if (agent) {
    agent.x = world.w / 2;
        agent.y = world.h - 58;
    agent.vx = 0;
    agent.face = 1;
    agent.anim = { kind: "idle", t: 0, frame: 0 };
      }
    }
    if (InputSystem?.init) InputSystem.init();
    if (DebuffSystem?.init) {
      DebuffSystem.init();
    } else {
      activeDebuffs = [];
      debuffNextTime = 0;
      meetingCallNextStop = 0;
      meetingCallStopped = false;
      subscriptionBombNextCharge = 0;
      lockedScore = 0;
    }
    
    if (BuffSystem?.init) BuffSystem.init();
    
    if (UISystem?.init) UISystem.init();
    
    elDebuffText.textContent = "대기 중";
    elDebuffDesc.hidden = true;
    elDebuffTimer.hidden = true;
    elDebuffNext.hidden = false;
    
    gameOver = false;
    paused = false;
    
    // BGM 재생 (레벨에 맞는 템포로)
    updateBGMTempo(); // 초기 레벨(1)에 맞는 템포 설정
    playBGM(true);
    
    hideOverlay();
    updateHud();
  }

  /**
   * 시간 포맷팅 (초를 분:초 형식으로)
   * @param {number} seconds - 초 단위 시간
   * @returns {string} "X분 Y초" 형식의 문자열
   */
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}분 ${secs}초`;
  }
  
  /**
   * 점수에 따른 등급 계산
   * @param {number} score - 게임 점수
   * @returns {string} 등급 (KING, S, A, B, C, D)
   */
  function getGrade(score) {
    if (score >= 5000000) return "KING";
    if (score >= 2000000) return "S";
    if (score >= 1500000) return "A";
    if (score >= 1000000) return "B";
    if (score >= 500000) return "C";
    return "D";
  }
  
  /**
   * 등급에 따른 엔딩 메시지 반환
   * @param {number} score - 게임 점수
   * @returns {string} 엔딩 메시지
   */
  function getEndingMessage(score) {
    const grade = getGrade(score);
    switch (grade) {
      case "KING":
        return "🍗 깐부치킨으로 가십시오! 🍗";
      case "S":
        return "🎉 축하합니다! 부의 자유 달성! 이제 당신은 파이어족입니다!";
      case "A":
        return "💎 훌륭해요! 경제적 여유가 생겼습니다. 조금만 더!";
      case "B":
        return "👍 잘했어요! 평범한 직장인의 삶, 나쁘지 않네요.";
      case "C":
        return "😅 그래도 월급은 있어요... 다음엔 더 잘할 수 있어요!";
      case "D":
        return "😭 이번 달도 마이너스... 소비 습관을 점검해보세요.";
      default:
        return "게임 오버";
    }
  }

  function endGame() {
    gameOver = true;
    paused = true;
    
    // BGM 정지
    playBGM(false);
    
    let isNewRecord = false;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("mc.highscore", String(highScore));
      elHi.textContent = `₩${highScore.toLocaleString('ko-KR')}`;
      btnReport.hidden = false;
      isNewRecord = true;
      // 팝업 배너 제거, 오버레이에만 표시
    }
    
    // 통계 계산
    const comboCount = getComboCount();
    const finalMaxCombo = Math.max(maxComboReached, comboCount || 0);
    const survivalTime = (performance.now() - gameStartTime) / 1000; // 초 단위
    const endingMessage = getEndingMessage(score);
    const grade = getGrade(score);
    
    // 통계를 별도 요소로 생성
    if (ovStats) {
      ovStats.innerHTML = ''; // 기존 내용 초기화
      
      // 제목
      const titleDiv = document.createElement('div');
      titleDiv.className = 'stat-item';
      titleDiv.style.textAlign = 'center';
      titleDiv.style.fontWeight = 'bold';
      titleDiv.style.fontSize = 'clamp(13px, 3.2vw, 17px)';
      titleDiv.textContent = '📊 플레이 결과';
      ovStats.appendChild(titleDiv);
      
      // 신기록 표시 (오버레이에만)
      if (isNewRecord) {
        const newRecordDiv = document.createElement('div');
        newRecordDiv.className = 'stat-item';
        newRecordDiv.style.textAlign = 'center';
        newRecordDiv.style.fontWeight = 'bold';
        newRecordDiv.style.color = '#FFD700';
        newRecordDiv.style.fontSize = 'clamp(14px, 3.5vw, 18px)';
        newRecordDiv.textContent = '🎉 신기록 달성! 🎉';
        ovStats.appendChild(newRecordDiv);
        
        const divider0 = document.createElement('div');
        divider0.className = 'stat-divider';
        ovStats.appendChild(divider0);
      }
      
      // 구분선
      const divider1 = document.createElement('div');
      divider1.className = 'stat-divider';
      ovStats.appendChild(divider1);
      
      // 획득 총액
      const scoreDiv = document.createElement('div');
      scoreDiv.className = 'stat-item';
      scoreDiv.textContent = `💰 획득 총액: ₩${score.toLocaleString('ko-KR')}`;
      ovStats.appendChild(scoreDiv);
      
      // 피한 빚
      const debtDiv = document.createElement('div');
      debtDiv.className = 'stat-item';
      debtDiv.textContent = `🛡️ 피한 빚: ₩${totalDebtAvoided.toLocaleString('ko-KR')}`;
      ovStats.appendChild(debtDiv);
      
      // 최고 콤보
      const comboDiv = document.createElement('div');
      comboDiv.className = 'stat-item';
      comboDiv.textContent = `🔥 최고 콤보: ${finalMaxCombo}`;
      ovStats.appendChild(comboDiv);
      
      // 생존 시간
      const timeDiv = document.createElement('div');
      timeDiv.className = 'stat-item';
      timeDiv.textContent = `⏱️ 생존 시간: ${formatTime(survivalTime)}`;
      ovStats.appendChild(timeDiv);
      
      // 경제력 등급
      const gradeDiv = document.createElement('div');
      gradeDiv.className = 'stat-item';
      gradeDiv.textContent = `📈 경제력 등급: ${grade}`;
      ovStats.appendChild(gradeDiv);
      
      // 구분선
      const divider2 = document.createElement('div');
      divider2.className = 'stat-divider';
      ovStats.appendChild(divider2);
      
      // 엔딩 메시지
      const endingDiv = document.createElement('div');
      endingDiv.className = 'stat-item ending-message';
      endingDiv.textContent = endingMessage;
      ovStats.appendChild(endingDiv);
    }
    
    showOverlay(
      `GAME OVER - ${grade}등급`,
      '',
      "다시 시작",
      true // 게임 오버 플래그
    );
  }

  // ============================================
  // 이벤트 리스너
  // ============================================
  if (InputSystem?.setupEventListeners) {
    InputSystem.setupEventListeners(cvs, world);
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!tutorialOverlay.hidden) {
        if (btnCloseTutorial) btnCloseTutorial.click();
        e.preventDefault();
        return;
      }
      if (!overlay.hidden && !gameOver) {
        if (paused) {
          hideOverlay();
          startCountdown(() => {
            if (ItemSystem && ItemSystem.nextSpawnAt > 0) {
              ItemSystem.nextSpawnAt = performance.now() + pausedSpawnOffset;
              pausedSpawnOffset = 0;
            }
            
            if (InputSystem) {
              InputSystem.mouseTargetX = null;
              InputSystem.pDown = false;
            }
            
            paused = false;
            pauseStartTime = 0;
            
            if (isCountdownActive) {
              isCountdownActive = false;
            }
            
            playBGM(true);
          });
        }
        e.preventDefault();
        return;
      }
    }
    
    if ((e.key === "Enter" || e.key === " ") && document.activeElement?.tagName === "BUTTON") {
      if (e.key === " " && document.activeElement.tagName === "BUTTON") {
        e.preventDefault();
      }
      return;
    }
    
    if (!gameOver && !paused && !isCountdownActive && tutorialOverlay.hidden && overlay.hidden) {
      const agent = getAgent();
      if (agent) {
        const moveSpeed = 5;
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
          const targetX = Math.max(agent.w / 2, agent.x - moveSpeed * 10);
          if (InputSystem) InputSystem.mouseTargetX = targetX;
          e.preventDefault();
        } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          const targetX = Math.min(world.w - agent.w / 2, agent.x + moveSpeed * 10);
          if (InputSystem) InputSystem.mouseTargetX = targetX;
          e.preventDefault();
        }
      }
    }
    
    if (e.key === " " && !gameOver && tutorialOverlay.hidden && overlay.hidden) {
      if (!paused) {
        paused = true;
        pauseStartTime = performance.now();
        playBGM(false);
        showOverlay("PAUSED", "계속하려면 CONTINUE 버튼을 누르세요", "CONTINUE");
        setTimeout(() => {
          if (btnStart) btnStart.focus();
        }, 100);
        
        if (ItemSystem && ItemSystem.nextSpawnAt > 0) {
          const remainingTime = ItemSystem.nextSpawnAt - pauseStartTime;
          ItemSystem.nextSpawnAt = pauseStartTime;
          pausedSpawnOffset = remainingTime;
        }
      } else {
        hideOverlay();
        startCountdown(() => {
          if (ItemSystem && ItemSystem.nextSpawnAt > 0) {
            ItemSystem.nextSpawnAt = performance.now() + pausedSpawnOffset;
            pausedSpawnOffset = 0;
          }
          
          if (InputSystem) {
            InputSystem.mouseTargetX = null;
            InputSystem.pDown = false;
          }
          
          paused = false;
          pauseStartTime = 0;
          
          if (isCountdownActive) {
            isCountdownActive = false;
          }
          
          playBGM(true);
        });
      }
      e.preventDefault();
    }
  });
  

  if (btnStartPrologue) {
    btnStartPrologue.addEventListener("click", () => {
      if (prologueOverlay) {
        prologueOverlay.style.transition = "opacity 0.5s ease-out";
        prologueOverlay.style.opacity = "0";
        
        setTimeout(() => {
          if (prologueOverlay) {
            prologueOverlay.hidden = true;
            prologueOverlay.style.display = "none";
          }
          if (overlay) {
            overlay.hidden = false;
            overlay.style.display = "grid";
            overlay.style.opacity = "0";
            overlay.style.transition = "opacity 0.5s ease-in";
            setTimeout(() => {
              if (overlay) overlay.style.opacity = "1";
            }, 10);
          }
        }, 500);
      }
    });
  }
  
  const countdownEl = document.getElementById("countdown");
  
  function startCountdown(callback) {
    if (isCountdownActive) return;
    isCountdownActive = true;
    
    if (InputSystem) {
      InputSystem.mouseTargetX = null;
      InputSystem.pDown = false;
    }
    
    let count = 3;
    const showCountdown = (num) => {
      if (!countdownEl) return;
      if (num > 0) {
        countdownEl.textContent = `${num}`;
        countdownEl.hidden = false;
        countdownEl.style.opacity = "1";
        countdownEl.style.animation = "none";
        countdownEl.className = "countdown";
        setTimeout(() => {
          countdownEl.style.animation = "countdownPulse 1s ease-in-out";
        }, 10);
      } else {
        countdownEl.textContent = "시작!";
        countdownEl.hidden = false;
        countdownEl.style.opacity = "1";
        countdownEl.style.animation = "countdownPulse 0.5s ease-in-out";
        countdownEl.className = "countdown countdown-start";
      }
    };
    
    const hideCountdown = () => {
      if (!countdownEl) return;
      countdownEl.style.opacity = "0";
      setTimeout(() => {
        if (countdownEl) {
          countdownEl.hidden = true;
          countdownEl.textContent = "";
          countdownEl.className = "countdown";
        }
      }, 500);
    };
    
    showCountdown(count);
    count--;
    
    const countdownInterval = setInterval(() => {
      if (gameOver || !paused) {
        clearInterval(countdownInterval);
        isCountdownActive = false;
        hideCountdown();
        return;
      }
      
      if (count > 0) {
        showCountdown(count);
        count--;
      } else {
        clearInterval(countdownInterval);
        showCountdown(0);
        setTimeout(() => {
          hideCountdown();
          isCountdownActive = false;
          if (InputSystem) {
            InputSystem.pDown = false;
            InputSystem.mouseTargetX = null;
          }
          if (callback) callback();
        }, 1000);
      }
    }, 1000);
  }
  
  btnStart.addEventListener("click", () => {
    if (paused && !gameOver) {
      hideOverlay();
      startCountdown(() => {
        if (ItemSystem && ItemSystem.nextSpawnAt > 0) {
          ItemSystem.nextSpawnAt = performance.now() + pausedSpawnOffset;
          pausedSpawnOffset = 0;
        }
        
        if (InputSystem) {
          InputSystem.mouseTargetX = null;
          InputSystem.pDown = false;
        }
        
        paused = false;
        pauseStartTime = 0;
        
        if (isCountdownActive) {
          isCountdownActive = false;
        }
        
        playBGM(true);
      });
      return;
    }
    startGame();
  });
  
  // ============================================
  // 튜토리얼 페이지 관리
  // ============================================
  let tutorialCurrentPage = 0;
  let tutorialTotalPages = 3; // 동적으로 계산됨
  const DEBUFFS_PER_PAGE = 5; // 페이지당 디버프 개수
  
  function initTutorialPages() {
    const tutorialPagesContainer = tutorialOverlay?.querySelector('.tutorial-pages');
    if (!tutorialPagesContainer) return;
    
    // 기존 디버프 페이지들 제거 (data-page가 숫자인 것들)
    const existingDebuffPages = tutorialPagesContainer.querySelectorAll('.tutorial-page[data-page]:not([data-page="0"]):not([data-page="buff"])');
    existingDebuffPages.forEach(page => page.remove());
    
    // 디버프 정보를 페이지별로 나누기
    if (DEBUFF_INFO) {
      const debuffTypes = Object.keys(DEBUFF_INFO);
      const debuffPages = [];
      
      // 5개씩 나누기
      for (let i = 0; i < debuffTypes.length; i += DEBUFFS_PER_PAGE) {
        const pageDebuffs = debuffTypes.slice(i, i + DEBUFFS_PER_PAGE);
        debuffPages.push(pageDebuffs);
      }
      
      // 디버프 페이지들 생성
      debuffPages.forEach((pageDebuffs, pageIndex) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'tutorial-page';
        pageDiv.setAttribute('data-page', String(pageIndex + 1)); // 페이지 번호는 1부터 시작
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'tutorial-content';
        
        const titleP = document.createElement('p');
        titleP.innerHTML = '<strong>디버프 항목:</strong>';
        contentDiv.appendChild(titleP);
        
        const listDiv = document.createElement('div');
        listDiv.className = 'tutorial-list';
        
        pageDebuffs.forEach(debuffType => {
          const debuffInfo = DEBUFF_INFO[debuffType];
          if (debuffInfo) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'tutorial-item';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = debuffInfo.name;
            const descSpan = document.createElement('span');
            descSpan.className = 'item-desc';
            descSpan.textContent = debuffInfo.desc;
            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(descSpan);
            listDiv.appendChild(itemDiv);
          }
        });
        
        contentDiv.appendChild(listDiv);
        pageDiv.appendChild(contentDiv);
        
        // 버프 페이지 앞에 삽입
        const buffPage = tutorialPagesContainer.querySelector('.tutorial-page[data-page="buff"]');
        if (buffPage) {
          tutorialPagesContainer.insertBefore(pageDiv, buffPage);
        } else {
          tutorialPagesContainer.appendChild(pageDiv);
        }
      });
      
      // 총 페이지 수 업데이트 (기본 룰 1개 + 디버프 페이지들 + 버프 1개)
      tutorialTotalPages = 1 + debuffPages.length + 1;
    }
    
    // 버프 정보 표시
    if (tutorialBuffs) {
      tutorialBuffs.innerHTML = '';
      
      // FEVER 타임
      const feverDiv = document.createElement('div');
      feverDiv.className = 'tutorial-item';
      const feverName = document.createElement('span');
      feverName.className = 'item-name';
      feverName.textContent = '🔥 FEVER 타임';
      const feverDesc = document.createElement('span');
      feverDesc.className = 'item-desc';
      feverDesc.textContent = '25, 50, 75, 100 콤보 달성 시 발동. 모든 디버프 해제, 세금/빚 차감 무시, 현금 획득 2배';
      feverDiv.appendChild(feverName);
      feverDiv.appendChild(feverDesc);
      tutorialBuffs.appendChild(feverDiv);
      
      // 콤보 배수 (combo.js의 getComboMultiplier 반영)
      const comboDiv = document.createElement('div');
      comboDiv.className = 'tutorial-item';
      const comboName = document.createElement('span');
      comboName.className = 'item-name';
      comboName.textContent = '⚡ 콤보 배수';
      const comboDesc = document.createElement('span');
      comboDesc.className = 'item-desc';
      comboDesc.textContent = '25+ 콤보: 1.25배, 50+ 콤보: 1.5배, 75+ 콤보: 1.75배, 100+ 콤보: 2.0배 (MAX COMBO!!!)';
      comboDiv.appendChild(comboName);
      comboDiv.appendChild(comboDesc);
      tutorialBuffs.appendChild(comboDiv);
      
      // 조기퇴근 버프
      const earlyLeaveDiv = document.createElement('div');
      earlyLeaveDiv.className = 'tutorial-item';
      const earlyLeaveName = document.createElement('span');
      earlyLeaveName.className = 'item-name';
      earlyLeaveName.textContent = '🏃 조기퇴근';
      const earlyLeaveDesc = document.createElement('span');
      earlyLeaveDesc.className = 'item-desc';
      earlyLeaveDesc.textContent = '생명력 회복 (최대 5개). 생명력이 최대일 경우 보너스 목숨 +1';
      earlyLeaveDiv.appendChild(earlyLeaveName);
      earlyLeaveDiv.appendChild(earlyLeaveDesc);
      tutorialBuffs.appendChild(earlyLeaveDiv);
      
      // 자석 버프
      const magnetDiv = document.createElement('div');
      magnetDiv.className = 'tutorial-item';
      const magnetName = document.createElement('span');
      magnetName.className = 'item-name';
      magnetName.textContent = '🧲 자석';
      const magnetDesc = document.createElement('span');
      magnetDesc.className = 'item-desc';
      magnetDesc.textContent = '5초간 캐릭터 주변 100px 범위 내 +아이템 자동 수집';
      magnetDiv.appendChild(magnetName);
      magnetDiv.appendChild(magnetDesc);
      tutorialBuffs.appendChild(magnetDiv);
      
      // 미국 주식 떡상 버프
      const stockBoomDiv = document.createElement('div');
      stockBoomDiv.className = 'tutorial-item';
      const stockBoomName = document.createElement('span');
      stockBoomName.className = 'item-name';
      stockBoomName.textContent = '📈 미국 주식 떡상';
      const stockBoomDesc = document.createElement('span');
      stockBoomDesc.className = 'item-desc';
      stockBoomDesc.textContent = '3.5초간 모든 화폐 가치가 골든바(50000원)로 변경, 세금/빚 아이템 제거';
      stockBoomDiv.appendChild(stockBoomName);
      stockBoomDiv.appendChild(stockBoomDesc);
      tutorialBuffs.appendChild(stockBoomDiv);
    }
    
    // 첫 페이지로 리셋
    tutorialCurrentPage = 0;
    updateTutorialPage();
  }
  
  function updateTutorialPage() {
    // 모든 페이지 숨기기
    const pages = tutorialOverlay?.querySelectorAll('.tutorial-page');
    if (pages) {
      pages.forEach((page, index) => {
        if (index === tutorialCurrentPage) {
          page.classList.add('active');
        } else {
          page.classList.remove('active');
        }
      });
    }
    
    // 총 페이지 수 다시 계산 (디버프 페이지 수가 변경되었을 수 있음)
    const allPages = tutorialOverlay?.querySelectorAll('.tutorial-page');
    if (allPages) {
      tutorialTotalPages = allPages.length;
    }
    
    // 페이지 인디케이터 업데이트
    if (tutorialPageIndicator) {
      tutorialPageIndicator.textContent = `${tutorialCurrentPage + 1} / ${tutorialTotalPages}`;
    }
    
    // 이전/다음 버튼 상태 업데이트
    if (btnTutorialPrev) {
      btnTutorialPrev.disabled = tutorialCurrentPage === 0;
      btnTutorialPrev.style.opacity = tutorialCurrentPage === 0 ? '0.5' : '1';
    }
    if (btnTutorialNext) {
      btnTutorialNext.disabled = tutorialCurrentPage === tutorialTotalPages - 1;
      btnTutorialNext.style.opacity = tutorialCurrentPage === tutorialTotalPages - 1 ? '0.5' : '1';
    }
  }
  
  function goToTutorialPage(page) {
    if (page >= 0 && page < tutorialTotalPages) {
      tutorialCurrentPage = page;
      updateTutorialPage();
    }
  }
  
  btnTutorial.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.hidden = true;
    overlay.style.display = "none";
    tutorialOverlay.hidden = false;
    tutorialOverlay.style.display = "grid";
    initTutorialPages();
  });
  
  btnCloseTutorial.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    tutorialOverlay.hidden = true;
    tutorialOverlay.style.display = "none";
    overlay.hidden = false;
    overlay.style.display = "grid";
    // 페이지 리셋
    tutorialCurrentPage = 0;
    updateTutorialPage();
  });
  
  if (btnTutorialPrev) {
    btnTutorialPrev.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (tutorialCurrentPage > 0) {
        goToTutorialPage(tutorialCurrentPage - 1);
      }
    });
  }
  
  if (btnTutorialNext) {
    btnTutorialNext.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (tutorialCurrentPage < tutorialTotalPages - 1) {
        goToTutorialPage(tutorialCurrentPage + 1);
      }
    });
  }
  
  btnPause.addEventListener("click", () => {
    if (gameOver) return;
    if (!paused) {
      // 일시정지 시작
      paused = true;
      pauseStartTime = performance.now();
      playBGM(false); // 일시정지 시 BGM 정지
      showOverlay("PAUSED", "계속하려면 CONTINUE 버튼을 누르세요", "CONTINUE");
      
      // 아이템 스폰 타이머 일시정지: 일시정지 시작 시간을 기록하여 재개 시 보정
      if (ItemSystem && ItemSystem.nextSpawnAt > 0) {
        const remainingTime = ItemSystem.nextSpawnAt - pauseStartTime;
        ItemSystem.nextSpawnAt = pauseStartTime; // 일시정지 시점으로 설정
        pausedSpawnOffset = remainingTime; // 남은 시간 저장
      }
    }
  });
  
  btnMute.addEventListener("click", () => {
    muted = !muted;
    btnMute.textContent = muted ? "🔇" : "🔊";
    
    // 모든 오디오 요소의 muted 상태 업데이트
    ["sfx-catch", "sfx-penalty", "sfx-combo", "sfx-clear", "bgm"].forEach((id) => {
      const el = $(id);
      if (el) el.muted = muted;
    });
    
    // BGM 제어
    if (muted) {
      playBGM(false);
    } else if (!paused && !gameOver) {
      playBGM(true);
    }
  });
  
  function openTossApp(scheme, fallbackUrl = "https://toss.im") {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    popBanner("토스 앱 열기 중...", 2000);
    
    let appOpened = false;
    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        appOpened = true;
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    
    if (isAndroid) {
      const path = scheme.replace("toss://", "");
      const fallback = encodeURIComponent(fallbackUrl || "https://toss.im");
      const intentUrl = `intent://${path}#Intent;scheme=toss;package=com.vcnc.toss;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${fallback};end`;
      
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;";
      iframe.src = intentUrl;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
        if (!appOpened && document.visibilityState === "visible") {
          window.location.href = scheme;
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
      window.location.href = scheme;
      setTimeout(() => {
        if (!appOpened && document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", visibilityHandler);
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
      window.location.href = scheme;
      setTimeout(() => {
        document.removeEventListener("visibilitychange", visibilityHandler);
        if (fallbackUrl && document.visibilityState === "visible") {
          const shouldOpen = confirm("토스 앱이 필요합니다.\n웹 브라우저로 이동하시겠습니까?");
          if (shouldOpen) window.open(fallbackUrl, "_blank");
        }
      }, 1500);
    }
  }

  btnShare.addEventListener("click", async () => {
    const text = `머니 캐쳐 점수 ${score}점! 도전해보세요! 🎮`;
    try {
      if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await navigator.share({ 
          text,
          url: window.location.href,
          title: "머니 캐쳐"
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        popBanner("링크 복사됨! ✨");
      } else {
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
      if (err.name !== "AbortError") {
        console.warn("공유 실패:", err);
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
    openTossApp("toss://asset-report", "https://toss.im/asset");
  });

  // ============================================
  // 오디오 사전 로드 및 준비
  // ============================================
  function preloadAudio() {
    const audioIds = ["sfx-catch", "sfx-penalty", "sfx-combo", "sfx-clear"];
    audioIds.forEach(id => {
      const audio = $(id);
      if (audio) {
        // 오디오를 미리 로드하여 재생 지연 최소화
        audio.load();
        // 일부 브라우저에서 오디오가 준비될 때까지 대기
        if (audio.readyState < 2) {
          audio.addEventListener('canplay', () => {
            // 오디오가 준비되면 currentTime을 0.1초로 설정하여 앞부분 빈 공간 건너뛰기 준비
            audio.currentTime = 0.1;
          }, { once: true });
        }
      }
    });
  }
  
  // 페이지 로드 시 오디오 사전 로드
  if (document.readyState === "loading") {
    window.addEventListener("load", preloadAudio, { once: true });
  } else {
    preloadAudio();
  }

  // ============================================
  // 초기화
  // ============================================
  elLevel.textContent = `LV ${LV[levelIndex]?.id || levelIndex + 1}`;
  elHi.textContent = highScore;
  elDebuffText.textContent = "대기 중";
  elDebuffDesc.hidden = true;
  elDebuffTimer.hidden = true;
  elDebuffNext.textContent = "다음: LV 2부터";
  elDebuffNext.hidden = false;
  updateHearts();
  
  // 프롤로그 화면 표시 (초기 화면)
  if (prologueOverlay) {
    prologueOverlay.hidden = false;
    prologueOverlay.style.display = "grid";
  }
  if (overlay) {
    overlay.hidden = true;
    overlay.style.display = "none";
  }
  
  requestAnimationFrame(loop);
  console.log("%c[MoneyCatcher]", "color:#5C94FC; font-size: 14px;");
  
  // 관리자 모드
  window.enableAdminMode = function() {
    adminMode.enabled = true;
    adminMode.infiniteLives = true;
    adminMode.scoreMultiplier = 10.0;
    console.log("%c[관리자 모드 활성화]", "color:#FFD700; font-size: 14px; font-weight: bold;");
    console.log("✓ 목숨 무한");
    console.log("✓ 점수 10배 증가");
    if (typeof popBanner !== 'undefined') {
      popBanner("관리자 모드 활성화! 🔧", 2000);
    }
  };
  
  window.disableAdminMode = function() {
    adminMode.enabled = false;
    adminMode.infiniteLives = false;
    adminMode.scoreMultiplier = 1.0;
    console.log("%c[관리자 모드 비활성화]", "color:#999; font-size: 14px;");
    if (typeof popBanner !== 'undefined') {
      popBanner("관리자 모드 비활성화", 2000);
    }
  };
  
  // 전역 접근을 위한 게터 함수들
  window.Game.paused = () => paused;
  window.Game.gameOver = () => gameOver;
  window.Game.isCountdownActive = () => isCountdownActive;
  window.Game.getMeetingCallStopped = () => meetingCallStopped;
  window.Game.getMeetingCallNextStop = () => meetingCallNextTime;
  window.Game.getSubscriptionBombNextCharge = () => subscriptionBombNextCharge;
  
  console.log("💡 테스트 모드: enableAdminMode() - 관리자 모드 활성화");
  console.log("💡 테스트 모드: disableAdminMode() - 관리자 모드 비활성화");
})();
