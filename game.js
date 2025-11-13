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
  }, { passive: true });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      resize();
      syncSidebarHeight();
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
    elDebuffNext = $("debuff-next");
  const prologueOverlay = $("prologue-overlay"),
    overlay = $("overlay"),
    tutorialOverlay = $("tutorial-overlay"),
    ovTitle = $("ov-title"),
    ovSub = $("ov-sub"),
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
  const ItemSystem = window.Game?.ItemSystem;
  const ComboSystem = window.Game?.ComboSystem;
  const AgentSystem = window.Game?.AgentSystem;
  const InputSystem = window.Game?.InputSystem;
  const RenderSystem = window.Game?.RenderSystem;
  const UISystem = window.Game?.UISystem;

  // ============================================
  // 게임 상태
  // ============================================
  let levelIndex = 0,
    score = 0,
    highScore = Number(localStorage.getItem("mc.highscore") || 0);
  let paused = true,
    gameOver = false,
    muted = false;
  let hearts = 5;
  elHi.textContent = `₩${highScore.toLocaleString('ko-KR')}`;
  
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
  function playSound(soundId, volume = 0.7, skipTime = 0.1) {
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
      const mult = getComboMultiplier(comboCount);
      let itemScore = base;
      
      // 연봉동결 디버프: 모든 금액을 10000원으로 변경
      if (hasDebuff(DEBUFFS.SALARY_FREEZE)) {
        itemScore = 10000;
      }
      
      if (ItemSystem?.calculateScore) {
        itemScore = ItemSystem.calculateScore(type, comboCount, isFeverTime(), DebuffSystem, adminMode, mult);
    } else {
        let scoreMult = mult;
        if (hasDebuff(DEBUFFS.KOSPI_DOWN)) scoreMult *= 0.5;
        if (hasDebuff(DEBUFFS.SAVING_OBSESSION)) scoreMult *= 0.7;
        // FEVER 타임: 현금을 2배로 획득
        if (isFeverTime()) scoreMult *= 2.0;
        if (adminMode.enabled) scoreMult *= adminMode.scoreMultiplier;
        itemScore = Math.floor(itemScore * scoreMult);
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
          elDebuffText.textContent = currentDebuffs.length > 1 
            ? `${debuffInfo.name} 외 ${currentDebuffs.length - 1}개`
            : debuffInfo.name;
          elDebuffDesc.textContent = debuffInfo.desc;
          elDebuffDesc.hidden = false;
          elDebuffTimer.textContent = `남은 시간: ${remainingSeconds}초`;
          elDebuffTimer.hidden = false;
          elDebuffNext.hidden = true;
        }
      } else {
        elDebuffText.textContent = "대기 중";
        elDebuffDesc.hidden = true;
        elDebuffTimer.hidden = true;
        
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
      elHi.textContent = `₩${highScore.toLocaleString('ko-KR')}`;
      updateHearts();
    updateComboUI();
      updateDebuff();
    }
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

  function showOverlay(t, s, btn) {
    if (UISystem?.showOverlay) {
      UISystem.showOverlay(overlay, ovTitle, ovSub, btnStart, t, s, btn);
    } else {
    ovTitle.textContent = t;
    ovSub.textContent = s;
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
    const dt = prev ? Math.min(ts - prev, 100) : 16;
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

    if (!paused && !gameOver) {
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

      // 아이템 스폰
      const baseSpawn = LV[levelIndex]?.spawn || 700;
      const spawnInterval = baseSpawn * (0.92 + Math.random() * 0.16);
      const nextSpawnAt = ItemSystem?.nextSpawnAt || 0;

      if (ts >= nextSpawnAt) {
        spawnOne();
        if (ItemSystem) ItemSystem.nextSpawnAt = ts + spawnInterval;
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
          if (d.type !== ITEM.TAX && d.type !== ITEM.DEBT) {
            loseHeart();
            if (ComboSystem?.comboCount > 0) resetCombo();
          }
          currentDrops.splice(i, 1);
        }
      }
    }
    
    // 파티클 업데이트
    if (ItemSystem?.updateParticles) {
      ItemSystem.updateParticles(dt, world);
    }

    // 렌더링
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
        ComboSystem,
        hasDebuff,
        DEBUFFS,
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

  function endGame() {
    gameOver = true;
    paused = true;
    
    // BGM 정지
    playBGM(false);
    
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("mc.highscore", String(highScore));
      elHi.textContent = `₩${highScore.toLocaleString('ko-KR')}`;
      btnReport.hidden = false;
      popBanner("신기록! 🎉");
    }
    const comboCount = getComboCount();
    showOverlay(
      "GAME OVER",
      `점수 ${score} · 최고 콤보 ×${comboCount || 1} · 레벨 ${LV[levelIndex]?.id || levelIndex + 1}`,
      "다시 시작"
    );
  }

  // ============================================
  // 이벤트 리스너
  // ============================================
  if (InputSystem?.setupEventListeners) {
    InputSystem.setupEventListeners(cvs, world);
  }

  window.addEventListener("keydown", (e) => {
    if (gameOver) return;
    if (paused && e.key === " ") {
      paused = false;
      playBGM(true); // 재개 시 BGM 재생
      hideOverlay();
      return;
    }
    if (e.key === " ") {
      paused = !paused;
      if (paused) {
        playBGM(false); // 일시정지 시 BGM 정지
        showOverlay("PAUSED", "계속하려면 CONTINUE 버튼을 누르세요", "CONTINUE");
      } else {
        playBGM(true); // 재개 시 BGM 재생
        hideOverlay();
      }
    }
  });

  // 프롤로그 버튼 클릭 이벤트
  if (btnStartPrologue) {
    btnStartPrologue.addEventListener("click", () => {
      // 프롤로그 페이드아웃
      if (prologueOverlay) {
        prologueOverlay.style.transition = "opacity 0.5s ease-out";
        prologueOverlay.style.opacity = "0";
        
        // 페이드아웃 완료 후 메인 메뉴 표시
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
            // 페이드인 시작
            setTimeout(() => {
              if (overlay) overlay.style.opacity = "1";
            }, 10);
          }
        }, 500);
      }
    });
  }
  
  btnStart.addEventListener("click", () => {
    if (paused && !gameOver) {
      paused = false;
      playBGM(true); // 재개 시 BGM 재생
      hideOverlay();
      return;
    }
    startGame();
  });
  
  btnTutorial.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.hidden = true;
    overlay.style.display = "none";
    tutorialOverlay.hidden = false;
    tutorialOverlay.style.display = "grid";
  });
  
  btnCloseTutorial.addEventListener("click", (e) => {
        e.preventDefault();
    e.stopPropagation();
    tutorialOverlay.hidden = true;
    tutorialOverlay.style.display = "none";
    overlay.hidden = false;
    overlay.style.display = "grid";
  });
  
  btnPause.addEventListener("click", () => {
    if (gameOver) return;
    paused = !paused;
    if (paused) {
      playBGM(false); // 일시정지 시 BGM 정지
      showOverlay("PAUSED", "계속하려면 CONTINUE 버튼을 누르세요", "CONTINUE");
    } else {
      playBGM(true); // 재개 시 BGM 재생
      hideOverlay();
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
  
  console.log("💡 테스트 모드: enableAdminMode() - 관리자 모드 활성화");
  console.log("💡 테스트 모드: disableAdminMode() - 관리자 모드 비활성화");
})();
