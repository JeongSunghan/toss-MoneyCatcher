/**
 * ui.js - UI 업데이트 시스템
 * 
 * 게임의 모든 UI 요소를 업데이트합니다.
 * 점수, 콤보, 레벨, 하트, 디버프 정보, 배너 등을 관리합니다.
 */
(function() {
  "use strict";

  window.Game = window.Game || {};

  Game.UISystem = {
    bannerQueue: [],           // 배너 메시지 큐
    currentBannerEndTime: 0,   // 현재 배너 종료 시간
    animatedScore: 0,          // 애니메이션용 현재 점수
    targetScore: 0,            // 목표 점수
    scoreAnimationFrame: null, // 점수 애니메이션 프레임

    /**
     * 점수 애니메이션 트리거
     * 점수가 증가할 때 부드러운 카운팅 효과를 적용합니다.
     */
    animateScore(elScore, newScore) {
      if (!elScore) return;

      // 기존 애니메이션 취소
      if (this.scoreAnimationFrame) {
        cancelAnimationFrame(this.scoreAnimationFrame);
      }

      // 점수가 줄어들면 즉시 업데이트 (애니메이션 없음)
      if (newScore < this.animatedScore) {
        this.animatedScore = newScore;
        this.targetScore = newScore;
        elScore.textContent = `₩${newScore.toLocaleString('ko-KR')}`;
        return;
      }

      this.targetScore = newScore;
      const startScore = this.animatedScore;
      const diff = newScore - startScore;
      const duration = Math.min(300, Math.max(150, diff / 100)); // 150-300ms
      const startTime = performance.now();

      // 팝업 애니메이션 클래스 추가
      elScore.classList.add('score-animate');
      setTimeout(() => elScore.classList.remove('score-animate'), 300);

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // easeOutQuad 이징 함수
        const easeProgress = 1 - (1 - progress) * (1 - progress);

        this.animatedScore = Math.floor(startScore + diff * easeProgress);
        elScore.textContent = `₩${this.animatedScore.toLocaleString('ko-KR')}`;

        if (progress < 1) {
          this.scoreAnimationFrame = requestAnimationFrame(animate);
        } else {
          this.animatedScore = newScore;
          elScore.textContent = `₩${newScore.toLocaleString('ko-KR')}`;
        }
      };

      this.scoreAnimationFrame = requestAnimationFrame(animate);
    },

    /**
     * 콤보 펄스 애니메이션 트리거
     * 콤보가 증가할 때 시각적 피드백을 제공합니다.
     */
    triggerComboPulse(elCombo) {
      if (!elCombo) return;

      // 기존 애니메이션 제거
      elCombo.classList.remove('combo-pulse');

      // 리플로우 강제 (애니메이션 재시작)
      void elCombo.offsetWidth;

      // 새 애니메이션 추가
      elCombo.classList.add('combo-pulse');

      // 애니메이션 종료 후 클래스 제거
      setTimeout(() => {
        elCombo.classList.remove('combo-pulse');
      }, 400);
    },

    /**
     * 레벨업 플래시 효과 트리거
     * 레벨업 시 화면 전체에 황금빛 플래시 효과를 표시합니다.
     */
    triggerLevelUpFlash() {
      // 플래시 오버레이 생성
      const flash = document.createElement('div');
      flash.className = 'level-up-flash';
      document.body.appendChild(flash);

      // 애니메이션 종료 후 제거
      setTimeout(() => {
        flash.remove();
      }, 800);
    },

    /**
     * HUD 전체 업데이트
     * 점수, 콤보, 레벨, 하트 등 모든 UI 요소를 업데이트합니다.
     */
    updateHud(state) {
      const {
        elScore,
        elCombo,
        elLevel,
        elHi,
        elHearts,
        score,
        highScore,
        levelIndex,
        LV,
        ComboSystem,
        fill,
        multEl,
        DebuffSystem,
        updateComboUI,
        updateDebuff,
      } = state;

      // 점수 업데이트 (애니메이션 적용)
      if (elScore) {
        this.animateScore(elScore, score);
      }
      
      // 콤보 업데이트
      if (elCombo) {
        const comboCount = ComboSystem ? ComboSystem.comboCount : 0;
        const prevCombo = parseInt(elCombo.dataset.prevCombo || '0');
        elCombo.textContent = `×${comboCount || 1}`;

        // 콤보가 증가했을 때 펄스 효과
        if (comboCount > prevCombo && comboCount > 1) {
          this.triggerComboPulse(elCombo);
        }

        elCombo.dataset.prevCombo = comboCount;
      }
      
      // 레벨 업데이트
      if (elLevel && LV && LV[levelIndex]) {
        elLevel.textContent = `LV ${LV[levelIndex].id}`;
      }
      
      // 최고 점수 업데이트 (금액 형식으로 표시: ₩1,000,000)
      if (elHi) {
        elHi.textContent = `₩${highScore.toLocaleString('ko-KR')}`;
      }
      
      // 하트 업데이트
      this.updateHearts(state);
      
      // 콤보 UI 업데이트
      if (updateComboUI) {
        updateComboUI();
      }
      
      // 디버프 UI 업데이트
      if (updateDebuff) {
        updateDebuff();
      }
    },

    /**
     * 하트 UI 업데이트
     * 생명 수를 표시하고, 적을수록 어둡게 표시합니다.
     */
    updateHearts(state) {
      const { elHeartsCount, hearts } = state;
      if (!elHeartsCount) return;

      const prevHearts = parseInt(elHeartsCount.dataset.prevHearts || hearts);

      // "❤️ x5" 형식으로 표시
      elHeartsCount.textContent = `×${hearts}`;

      // 하트가 적을수록 색상 변경 (시각적 피드백)
      const heartIcon = elHeartsCount.parentElement?.querySelector(".heart-icon");
      if (heartIcon) {
        // 하트 변화 애니메이션 트리거
        if (hearts > prevHearts) {
          // 하트 증가
          this.triggerHeartAnimation(heartIcon, 'gain');
        } else if (hearts < prevHearts) {
          // 하트 감소
          this.triggerHeartAnimation(heartIcon, 'loss');
        }

        // 하트 개수에 따른 밝기 조정
        if (hearts <= 1) {
          heartIcon.style.filter = "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5)) brightness(0.7)";
        } else if (hearts <= 2) {
          heartIcon.style.filter = "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5)) brightness(0.85)";
        } else {
          heartIcon.style.filter = "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5))";
        }
      }

      // 이전 하트 개수 저장
      elHeartsCount.dataset.prevHearts = hearts;
    },

    /**
     * 하트 애니메이션 트리거
     * @param {HTMLElement} heartIcon - 하트 아이콘 요소
     * @param {string} type - 'gain' 또는 'loss'
     */
    triggerHeartAnimation(heartIcon, type) {
      if (!heartIcon) return;

      const animClass = type === 'gain' ? 'heart-gain' : 'heart-loss';
      const duration = type === 'gain' ? 500 : 400;

      // 기존 애니메이션 제거
      heartIcon.classList.remove('heart-gain', 'heart-loss');

      // 리플로우 강제
      void heartIcon.offsetWidth;

      // 새 애니메이션 추가
      heartIcon.classList.add(animClass);

      // 애니메이션 종료 후 클래스 제거
      setTimeout(() => {
        heartIcon.classList.remove(animClass);
      }, duration);
    },

    /**
     * 디버프 UI 업데이트
     * 현재 활성화된 디버프 정보와 남은 시간을 표시합니다.
     */
    updateDebuffUI(state) {
      const {
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
      } = state;

      if (!elDebuffText) return;

      // FEVER 타임 중에는 "FEVER 적용중" 표시
      if (isFeverTime && typeof isFeverTime === 'function' && isFeverTime()) {
        elDebuffText.textContent = "FEVER 적용중";
        if (elDebuffDesc) {
          elDebuffDesc.textContent = "모든 디버프가 일시 중지됩니다";
          elDebuffDesc.hidden = false;
        }
        if (elDebuffTimer) elDebuffTimer.hidden = true;
        if (elDebuffNext) elDebuffNext.hidden = true;
        return;
      }

      const currentDebuffs = getActiveDebuffs ? getActiveDebuffs() : [];
      
      if (currentDebuffs.length > 0) {
        // 첫 번째 디버프 표시
        const firstDebuff = currentDebuffs[0];
        const debuffInfo = DEBUFF_INFO[firstDebuff.type];
        const elapsed = performance.now() - firstDebuff.startTime;
        const remaining = Math.max(0, firstDebuff.duration - elapsed);
        const remainingSeconds = Math.ceil(remaining / 1000);
        
        if (debuffInfo) {
          elDebuffText.textContent = currentDebuffs.length > 1 
            ? `${debuffInfo.name} 외 ${currentDebuffs.length - 1}개`
            : debuffInfo.name;
          if (elDebuffDesc) {
            elDebuffDesc.textContent = debuffInfo.desc;
            elDebuffDesc.hidden = false;
          }
          if (elDebuffTimer) {
            elDebuffTimer.textContent = `남은 시간: ${remainingSeconds}초`;
            elDebuffTimer.hidden = false;
          }
          if (elDebuffNext) elDebuffNext.hidden = true;
        }
      } else {
        // 디버프가 없을 때
        elDebuffText.textContent = "대기 중";
        if (elDebuffDesc) elDebuffDesc.hidden = true;
        if (elDebuffTimer) elDebuffTimer.hidden = true;
        
        // 다음 디버프 예상 시간 표시
        if (levelIndex >= 1 && elDebuffNext) {
          const interval = getDebuffInterval ? getDebuffInterval(levelIndex + 1) : 0;
          const nextTime = getDebuffNextTime ? getDebuffNextTime() : 0;
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
        } else if (elDebuffNext) {
          elDebuffNext.textContent = `다음: LV 2부터`;
          elDebuffNext.hidden = false;
        }
      }
    },

    /**
     * 배너 메시지 표시
     * 게임 중 중요한 메시지를 화면 상단에 표시합니다.
     * 디버프 메시지는 큐에 추가되어 순차적으로 표시됩니다.
     * @param {HTMLElement} banner - 배너 요소
     * @param {string} text - 표시할 텍스트
     * @param {number} ms - 표시 시간 (밀리초)
     * @param {number} priority - 우선순위 (0: 일반, 1: 디버프)
     */
    popBanner(banner, text, ms = 1500, priority = 0) {
      if (!banner) return;
      
      const now = performance.now();
      
      // 디버프 메시지는 큐에 추가 (다른 메시지가 표시 중이면 대기)
      if (priority === 1) {
        // 현재 배너가 표시 중이고 디버프가 아니면 큐에 추가
        if (!banner.hidden && now < this.currentBannerEndTime) {
          this.bannerQueue.push({ text, ms, priority });
          return;
        }
      } else {
        // 일반 메시지는 즉시 표시 (기존 배너 중단)
        clearTimeout(this.popBanner._t);
        // 큐에 있던 디버프 메시지들은 나중에 표시
      }
      
      // 배너 표시
      banner.textContent = text;
      banner.hidden = false;
      clearTimeout(this.popBanner._t);
      this.currentBannerEndTime = now + ms;
      
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
      
      this.popBanner._t = setTimeout(() => {
        // 페이드 아웃
        banner.style.opacity = "0";
        banner.style.transform = "translateX(-50%) translateY(-10px)";
        setTimeout(() => {
          banner.hidden = true;
          banner.style.whiteSpace = "normal";
          banner.style.lineHeight = "";
          banner.style.textAlign = "";
          this.currentBannerEndTime = 0;
          
          // 큐에 있는 다음 메시지 표시
          if (this.bannerQueue.length > 0) {
            const next = this.bannerQueue.shift();
            this.popBanner(banner, next.text, next.ms, next.priority);
          }
        }, 300);
      }, ms);
    },

    /**
     * 오버레이 표시
     * 게임 오버, 일시정지 등의 오버레이를 표시합니다.
     */
    showOverlay(overlay, ovTitle, ovSub, btnStart, title, subtitle, buttonText, isGameOver = false) {
      if (!overlay || !ovTitle || !ovSub || !btnStart) return;
      
      ovTitle.textContent = title;
      
      // 게임 오버일 때는 통계 컨테이너를 사용 (game.js에서 이미 설정됨)
      const ovStats = document.getElementById("ov-stats");
      if (isGameOver && ovStats) {
        ovSub.hidden = true;
        ovStats.hidden = false;
      } else {
        ovSub.hidden = false;
        ovSub.textContent = subtitle;
        if (ovStats) ovStats.hidden = true;
      }
      
      btnStart.textContent = buttonText || "CONTINUE";
      overlay.hidden = false;
      overlay.style.display = "grid";
    },

    /**
     * 오버레이 숨기기
     */
    hideOverlay(overlay) {
      if (!overlay) return;
      overlay.hidden = true;
      overlay.style.display = "none";
    },

    /**
     * UI 시스템 초기화
     */
    init() {
      this.bannerQueue = [];
      this.currentBannerEndTime = 0;
    },
  };

  console.log("[UI] UI 시스템 로드 완료");
})();

