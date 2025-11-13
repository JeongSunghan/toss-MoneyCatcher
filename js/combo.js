/**
 * combo.js - 콤보 시스템
 * 
 * 연속으로 아이템을 수집할 때 발생하는 콤보를 관리합니다.
 * 콤보가 높을수록 점수 배수가 증가하고, 특정 구간에서 FEVER 타임이 발동됩니다.
 */
(() => {
  "use strict";

  window.Game = window.Game || {};

  // ============================================
  // 콤보 시스템 상태
  // ============================================
  Game.ComboSystem = {
    comboCount: 0,              // 현재 콤보 수 (+ 아이템만 카운트)
    comboTimeLeft: 0,           // 콤보 유지 남은 시간 (초)
    comboPendingReset: false,   // 콤보 리셋 대기 플래그
    
    // FEVER 타임 상태
    isFeverTime: false,         // FEVER 타임 활성화 여부
    feverTimeLeft: 0,           // FEVER 타임 남은 시간 (초)
    lastFeverCombo: 0,          // 마지막 FEVER 발동 콤보 수

    // 콤보 설정
    COMBO_DURATION: 3.0,        // 콤보 유지 시간 (초)
    FEVER_DURATION: 7.0,        // FEVER 타임 지속 시간 (초)
    FEVER_COMBOS: [25, 50, 75, 100], // FEVER 발동 콤보 구간

    /**
     * 콤보 수에 따른 점수 배수 계산
     * @param {number} combo - 현재 콤보 수
     * @returns {number} 점수 배수
     */
    getComboMultiplier(combo) {
      if (combo >= 100) return 2.0;  // MAX COMBO
      if (combo >= 75) return 1.75;
      if (combo >= 50) return 1.5;
      if (combo >= 25) return 1.25;
      return 1.0;
    },

    /**
     * 콤보 시간 갱신
     * 디버프에 따라 유지 시간이 단축될 수 있습니다.
     * @param {Object} debuffSystem - 디버프 시스템
     */
    refreshCombo(debuffSystem) {
      const DEBUFFS = window.Game?.DEBUFFS || {};
      let duration = this.COMBO_DURATION;
      
      // 디버프: 월요병 - 콤보 유지 시간 50% 감소
      if (debuffSystem?.hasDebuff) {
        if (debuffSystem.hasDebuff(DEBUFFS.MONDAY_BLUES)) {
          duration *= 0.5;
        }
      }
      this.comboTimeLeft = duration;
    },

    /**
     * 콤보 증가 및 FEVER 타임 체크
     * @param {Object} debuffSystem - 디버프 시스템
     * @returns {boolean} FEVER 타임 발동 여부
     */
    incrementCombo(debuffSystem) {
      this.comboCount++;
      this.refreshCombo(debuffSystem);
      
      // FEVER 타임 발동 체크 (25, 50, 75, 100 콤보)
      if (this.FEVER_COMBOS.includes(this.comboCount) && 
          this.comboCount !== this.lastFeverCombo) {
        this.isFeverTime = true;
        this.feverTimeLeft = this.FEVER_DURATION;
        this.lastFeverCombo = this.comboCount;
        return true;
      }
      return false;
    },

    /**
     * 콤보 시간 업데이트
     * 매 프레임마다 콤보 유지 시간을 감소시킵니다.
     * @param {number} deltaTime - 델타 타임 (초)
     * @param {Object} debuffSystem - 디버프 시스템
     */
    updateCombo(deltaTime, debuffSystem) {
      const DEBUFFS = window.Game?.DEBUFFS || {};
      if (this.comboCount > 0 && this.comboTimeLeft > 0) {
        let decayRate = 1.0;
        
        // 디버프: 월요병 - 콤보 감소 속도 2배
        if (debuffSystem?.hasDebuff) {
          if (debuffSystem.hasDebuff(DEBUFFS.MONDAY_BLUES)) {
            decayRate = 2.0;
          }
        }
        
        this.comboTimeLeft = Math.max(0, this.comboTimeLeft - deltaTime * decayRate);
        if (this.comboTimeLeft <= 0) {
          this.resetCombo();
        }
      }
    },

    /**
     * FEVER 타임 시간 업데이트
     * @param {number} deltaTime - 델타 타임 (초)
     * @returns {boolean} FEVER 타임 종료 여부
     */
    updateFeverTime(deltaTime) {
      if (this.isFeverTime) {
        this.feverTimeLeft = Math.max(0, this.feverTimeLeft - deltaTime);
        if (this.feverTimeLeft <= 0) {
          this.isFeverTime = false;
          return true;
        }
      }
      return false;
    },

    /**
     * 콤보 UI 업데이트
     * 게이지 바와 배수 표시를 업데이트합니다.
     * @param {HTMLElement} fillEl - 콤보 게이지 바 요소
     * @param {HTMLElement} multEl - 배수 표시 요소
     * @param {Object} debuffSystem - 디버프 시스템
     */
    updateComboUI(fillEl, multEl, debuffSystem) {
      const DEBUFFS = window.Game?.DEBUFFS || {};
      if (!fillEl || !multEl) return;
      
      // 디버프에 따른 콤보 유지 시간 계산
      let duration = this.COMBO_DURATION;
      if (debuffSystem?.hasDebuff) {
        if (debuffSystem.hasDebuff(DEBUFFS.MONDAY_BLUES)) {
          duration *= 0.5;
        }
      }
      
      // 콤보 게이지 바 업데이트
      if (this.comboCount > 0 && this.comboTimeLeft > 0) {
        const pct = Math.min(1, this.comboTimeLeft / duration);
        fillEl.style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
        
        // MAX COMBO 특수 표시
        if (this.comboCount >= 100) {
          multEl.textContent = "MAX COMBO!!!";
          multEl.style.color = "#FFE66D";
          multEl.style.animation = "pulse 0.5s infinite";
        } else {
          multEl.textContent = `×${this.comboCount}`;
          multEl.style.color = "";
          multEl.style.animation = "";
        }
      } else if (this.comboCount > 0 && this.comboTimeLeft <= 0 && !this.comboPendingReset) {
        // 콤보 시간 종료, 리셋 대기
        fillEl.style.width = '0%';
        multEl.textContent = this.comboCount >= 100 ? "MAX COMBO!!!" : `×${this.comboCount}`;
        this.comboPendingReset = true;
      } else if (this.comboPendingReset) {
        // 리셋 대기 중
        fillEl.style.width = '0%';
        multEl.textContent = `×${this.comboCount}`;
      } else {
        // 콤보 없음
        fillEl.style.width = '0%';
        multEl.textContent = '×1';
        multEl.style.color = "";
        multEl.style.animation = "";
      }
    },

    /**
     * 콤보 리셋
     * 콤보 시간이 만료되거나 TAX/DEBT를 수집했을 때 호출됩니다.
     */
    resetCombo() {
      this.comboCount = 0;
      this.comboTimeLeft = 0;
      this.comboPendingReset = false;
    },

    /**
     * 콤보 시스템 초기화
     * 게임 시작 시 모든 콤보 상태를 리셋합니다.
     */
    init() {
      this.comboCount = 0;
      this.comboTimeLeft = 0;
      this.comboPendingReset = false;
      this.isFeverTime = false;
      this.feverTimeLeft = 0;
      this.lastFeverCombo = 0;
    }
  };

  console.log("[Combo] 콤보 시스템 로드 완료");
})();

