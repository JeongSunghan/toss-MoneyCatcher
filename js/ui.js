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

      // 점수 업데이트
      if (elScore) elScore.textContent = score;
      
      // 콤보 업데이트
      if (elCombo) {
        const comboCount = ComboSystem ? ComboSystem.comboCount : 0;
        elCombo.textContent = `×${comboCount || 1}`;
      }
      
      // 레벨 업데이트
      if (elLevel && LV && LV[levelIndex]) {
        elLevel.textContent = `LV ${LV[levelIndex].id}`;
      }
      
      // 최고 점수 업데이트
      if (elHi) elHi.textContent = highScore;
      
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
      
      // "❤️ x5" 형식으로 표시
      elHeartsCount.textContent = `×${hearts}`;
      
      // 하트가 적을수록 색상 변경 (시각적 피드백)
      const heartIcon = elHeartsCount.parentElement?.querySelector(".heart-icon");
      if (heartIcon) {
        if (hearts <= 1) {
          heartIcon.style.filter = "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5)) brightness(0.7)";
        } else if (hearts <= 2) {
          heartIcon.style.filter = "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5)) brightness(0.85)";
        } else {
          heartIcon.style.filter = "drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.5))";
        }
      }
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
      } = state;

      if (!elDebuffText) return;

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
    showOverlay(overlay, ovTitle, ovSub, btnStart, title, subtitle, buttonText) {
      if (!overlay || !ovTitle || !ovSub || !btnStart) return;
      
      ovTitle.textContent = title;
      ovSub.textContent = subtitle;
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

