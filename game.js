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

  // ============================================
  // Asset 로딩
  // ============================================
  const IMG = {};
  const toLoad = {
    agent_idle: "assets/agent_idle.png",
    agent_run: "assets/agent_run.png",
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
  elHi.textContent = highScore;
  
  // 관리자 모드
  let adminMode = {
    enabled: false,
    infiniteLives: false,
    scoreMultiplier: 1.0,
  };

  // 디버프 상태 (fallback)
  let activeDebuffs = [];
  let debuffNextTime = 0;
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
      ItemSystem.spawnOne(world, window.Game?.config, DebuffSystem);
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
   * @param {string} soundId - 오디오 요소 ID
   * @param {number} volume - 볼륨 (0.0 ~ 1.0, 기본값 0.7)
   */
  function playSound(soundId, volume = 0.7) {
    if (muted) return;
    const audio = $(soundId);
    if (audio) {
      try {
        audio.volume = volume;
        audio.currentTime = 0; // 처음부터 재생
        audio.play().catch(err => {
          // 자동 재생 정책으로 인한 오류는 무시
          if (err.name !== 'NotAllowedError') {
            console.warn(`[Sound] Failed to play ${soundId}:`, err);
          }
        });
      } catch (err) {
        console.warn(`[Sound] Error playing ${soundId}:`, err);
      }
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
          bgm.volume = 0.3; // BGM 볼륨 감소 (0.5에서 0.3으로)
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

  // ============================================
  // 게임 로직
  // ============================================
  function collect(type) {
    const base = SCORE[type] || 0;
    
    if (type === ITEM.TAX || type === ITEM.DEBT) {
      if (ComboSystem?.comboCount > 0) {
        resetCombo();
        popBanner("콤보 초기화!");
      }
      
      let itemScore = base;
      if (ItemSystem?.calculateScore) {
        itemScore = ItemSystem.calculateScore(type, getComboCount(), isFeverTime(), DebuffSystem, adminMode, 1.0);
    } else {
        let mult = 1.0;
        if (hasDebuff(DEBUFFS.KOSPI_DOWN)) mult *= 0.5;
        if (type === ITEM.DEBT && hasDebuff(DEBUFFS.INTEREST_RATE_UP)) mult *= 2.0;
        if (isFeverTime()) mult = 1.0;
        if (adminMode.enabled) mult *= adminMode.scoreMultiplier;
        itemScore = Math.floor(base * mult);
      }
      
      score += itemScore;
      vibrate(40);
      shake(8, 200);
      playSound("sfx-penalty", 0.6); // TAX/DEBT 수집 사운드
    } else {
      // + 아이템 수집
      if (ComboSystem?.incrementCombo) {
        const feverTriggered = ComboSystem.incrementCombo(DebuffSystem);
        if (feverTriggered) {
          setActiveDebuffs([]);
          popBanner(`FEVER TIME! 🔥 (${ComboSystem.comboCount} 콤보)`);
          playSound("sfx-combo", 0.8); // FEVER 타임 발동 사운드 (25, 50, 75, 100 콤보)
        }
      }
      
      const comboCount = getComboCount();
      const mult = getComboMultiplier(comboCount);
      let itemScore = base;
      if (ItemSystem?.calculateScore) {
        itemScore = ItemSystem.calculateScore(type, comboCount, isFeverTime(), DebuffSystem, adminMode, mult);
    } else {
        let scoreMult = mult;
        if (hasDebuff(DEBUFFS.KOSPI_DOWN)) scoreMult *= 0.5;
        if (hasDebuff(DEBUFFS.SAVING_OBSESSION)) scoreMult *= 0.7;
        if (isFeverTime()) scoreMult *= 2.0;
        if (adminMode.enabled) scoreMult *= adminMode.scoreMultiplier;
        itemScore = Math.floor(base * scoreMult);
      }
      
      score += itemScore;
      playSound("sfx-catch", 0.7); // + 아이템 수집 사운드
      checkLevelUp();
    }
  }
  
  function checkLevelUp() {
    const newLevel = Math.min(MAX_LEVEL - 1, Math.floor(score / LEVEL_SCORE_INTERVAL));
    if (newLevel > levelIndex) {
      levelIndex = newLevel;
      popBanner(`레벨 업! LV ${LV[levelIndex]?.id || levelIndex + 1} 🎉`);
      playSound("sfx-clear", 0.8); // 레벨업 사운드
      
      if (levelIndex >= 1) {
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
      
      if (levelIndex >= 1) {
        setDebuffNextTime(performance.now() + getDebuffInterval(levelIndex + 1));
      }
    }
  }
  
  function activateRandomDebuff() {
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
    popBanner(`${debuffInfo.name} 발생!\n${debuffInfo.desc}`, 4000, 1);
  }
  
  function updateDebuff() {
    const now = performance.now();
    const currentDebuffs = getActiveDebuffs();
    const filteredDebuffs = currentDebuffs.filter(debuff => {
      const elapsed = now - debuff.startTime;
      return elapsed < debuff.duration;
    });
    setActiveDebuffs(filteredDebuffs);
    
    if (levelIndex >= 1 && !paused && !gameOver) {
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
      });
    } else {
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
      elScore.textContent = score;
      elCombo.textContent = `×${getComboCount() || 1}`;
      elLevel.textContent = `LV ${LV[levelIndex]?.id || levelIndex + 1}`;
      elHi.textContent = highScore;
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
        if (feverEnded) popBanner("FEVER 타임 종료");
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
      
      // 구독료 폭탄 디버프 처리
      if (hasDebuff(DEBUFFS.SUBSCRIPTION_BOMB)) {
        const subscriptionNow = performance.now();
        const nextCharge = getSubscriptionBombNextCharge();
        if (nextCharge === 0 || subscriptionNow >= nextCharge) {
          score = Math.max(0, score - 10);
          setSubscriptionBombNextCharge(subscriptionNow + 2000);
          if (score > 0) popBanner("구독료 차감 -10점 💳", 1000);
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
      if (hasDebuff(DEBUFFS.BURNOUT) && !isFeverTime()) {
        ctx.filter = "grayscale(100%)";
      }
      
      for (const d of getDrops()) {
        if (d && d.alive) {
          if (hasDebuff(DEBUFFS.FOMO_SYNDROME) && (d.type === ITEM.TAX || d.type === ITEM.DEBT)) {
            const fakeType = ITEM.MONEY;
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
    
    // BGM 재생
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
      elHi.textContent = highScore;
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
  showOverlay(
    "머니 캐쳐",
    "좌우 스와이프로 이동하여 떨어지는 돈을 받으세요!",
    "GAME START"
  );
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
