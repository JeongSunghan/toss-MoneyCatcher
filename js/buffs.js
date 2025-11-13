/**
 * buffs.js - 버프 시스템
 * 
 * 버프 아이템의 효과를 관리합니다.
 * 골든타임, 자석, 실드, 시간정지, 미국 주식 떡상 등의 효과를 처리합니다.
 */
(() => {
  "use strict";

  window.Game = window.Game || {};
  
  // ============================================
  // 버프 타입 정의
  // ============================================
  Game.BUFFS = {
    EARLY_LEAVE: "early_leave",        // 조기퇴근: 생명력 회복/보너스 목숨
    MAGNET: "magnet",                  // 자석: 5초간 +아이템만 자동 수집
    STOCK_BOOM: "stock_boom",          // 미국 주식 떡상: 3.5초간 수표 드랍
  };
  
  // ============================================
  // 버프 시스템 상태 관리
  // ============================================
  Game.BuffSystem = {
    activeBuffs: [],              // 현재 활성화된 버프 목록 [{type, endTime, ...}]
    stockBoomActive: false,        // 미국 주식 떡상 활성화 여부
    stockBoomNextSpawn: 0,         // 미국 주식 떡상: 다음 수표 스폰 시간
    
    /**
     * 버프 활성화
     * @param {string} buffType - 버프 타입
     * @param {number} duration - 지속 시간 (밀리초)
     * @param {Object} options - 추가 옵션
     */
    activateBuff(buffType, duration, options = {}) {
      const now = performance.now();
      const endTime = now + duration;
      
      // 기존 버프가 있으면 시간 연장 (골든타임, 자석)
      const existing = this.activeBuffs.find(b => b.type === buffType);
      if (existing) {
        existing.endTime = Math.max(existing.endTime, endTime);
        if (options.stockBoomActive !== undefined) {
          existing.stockBoomActive = options.stockBoomActive;
        }
        if (options.stockBoomNextSpawn !== undefined) {
          existing.stockBoomNextSpawn = options.stockBoomNextSpawn;
        }
      } else {
        const newBuff = {
          type: buffType,
          endTime: endTime,
        };
        
        // 미국 주식 떡상 특수 처리
        if (buffType === Game.BUFFS.STOCK_BOOM) {
          newBuff.stockBoomActive = true;
          newBuff.stockBoomNextSpawn = now + 500; // 0.5초마다 수표 스폰 (렉 방지)
          this.stockBoomActive = true;
          this.stockBoomNextSpawn = now + 500;
        }
        
        this.activeBuffs.push(newBuff);
      }
      
      return true;
    },
    
    /**
     * 버프 업데이트 (시간 경과 처리)
     * @param {number} deltaTime - 델타 타임 (밀리초)
     */
    updateBuffs(deltaTime) {
      const now = performance.now();
      
      // 만료된 버프 제거
      this.activeBuffs = this.activeBuffs.filter(buff => {
        return buff.endTime > now;
      });
      
      // 미국 주식 떡상 업데이트
      const stockBoom = this.activeBuffs.find(b => b.type === Game.BUFFS.STOCK_BOOM);
      if (stockBoom && stockBoom.endTime > now) {
        this.stockBoomActive = true;
        // stockBoomNextSpawn이 없거나 지났으면 업데이트
        if (!stockBoom.stockBoomNextSpawn || now >= stockBoom.stockBoomNextSpawn) {
          stockBoom.stockBoomNextSpawn = now + 500; // 0.5초마다 (렉 방지)
        }
        this.stockBoomNextSpawn = stockBoom.stockBoomNextSpawn;
      } else {
        this.stockBoomActive = false;
        this.stockBoomNextSpawn = 0;
      }
    },
    
    /**
     * 특정 버프가 활성화되어 있는지 확인
     * @param {string} buffType - 확인할 버프 타입
     * @returns {boolean} 활성화 여부
     */
    hasBuff(buffType) {
      const now = performance.now();
      return this.activeBuffs.some(buff => {
        if (buff.type === Game.BUFFS.SHIELD && !buff.used) {
          return true; // 실드는 사용할 때까지 유지
        }
        return buff.type === buffType && buff.endTime > now;
      });
    },
    
    /**
     * 실드 사용 (디버프 무효화)
     * @returns {boolean} 실드 사용 성공 여부
     */
    useShield() {
      const shield = this.activeBuffs.find(b => b.type === Game.BUFFS.SHIELD && !b.used);
      if (shield) {
        shield.used = true;
        this.shieldCount = 0;
        // 실드 제거
        this.activeBuffs = this.activeBuffs.filter(b => b !== shield);
        return true;
      }
      return false;
    },
    
    /**
     * 버프 시스템 초기화
     */
    init() {
      this.activeBuffs = [];
      this.shieldCount = 0;
      this.stockBoomActive = false;
      this.stockBoomNextSpawn = 0;
    }
  };
  
  console.log("[Buffs] 버프 시스템 로드 완료");
})();

