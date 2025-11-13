/**
 * items.js - 아이템 시스템
 * 
 * 아이템의 스폰, 물리, 파티클 효과를 관리합니다.
 * 디버프에 따라 아이템 출현 빈도와 동작이 변경됩니다.
 */
(() => {
  "use strict";

  window.Game = window.Game || {};

  // ============================================
  // 아이템 시스템 상태
  // ============================================
  Game.ItemSystem = {
    drops: [],        // 떨어지는 아이템 목록 {x, y, r, vy, type, alive, shakeOffset, shakeSpeed}
    particles: [],    // 파티클 효과 목록 {x, y, vx, vy, life, color, size}
    nextSpawnAt: 0,  // 다음 아이템 스폰 예정 시간

    /**
     * 가중치 기반 랜덤 아이템 선택
     * @param {Array} tbl - [[타입, 가중치], ...] 형식의 배열
     * @returns {string} 선택된 아이템 타입
     */
    rndWeighted(tbl) {
      const tot = tbl.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * tot;
      for (const [t, w] of tbl) {
        if ((r -= w) <= 0) return t;
      }
      return tbl.at(-1)[0];
    },

    /**
     * 새 아이템 스폰
     * 4칸 그리드에 맞춰 스폰하여 캐릭터 이동과 일치시킵니다.
     * @param {Object} world - 게임 월드 정보
     * @param {Object} config - 게임 설정
     * @param {Object} debuffSystem - 디버프 시스템
     * @param {number} currentLevel - 현재 레벨 (1-based)
     */
    spawnOne(world, config, debuffSystem, currentLevel = 1) {
      const ITEM = window.Game?.ITEM || {};
      const getWeightsByLevel = window.Game?.config?.getWeightsByLevel;
      const BuffSystem = window.Game?.BuffSystem;
      
      // 레벨 3부터 버프 아이템 등장 가능
      let type;
      if (currentLevel >= 3 && Math.random() < 0.1) {
        // 버프 아이템 10% 확률
        const buffWeights = [
          [ITEM.BUFF_GOLDEN_TIME, 50],    // 골든타임: 50%
          [ITEM.BUFF_MAGNET, 45],         // 자석: 45%
          [ITEM.BUFF_STOCK_BOOM, 5],      // 미국 주식 떡상: 5% (버프 아이템 중 5%)
        ];
        type = this.rndWeighted(buffWeights);
      } else {
        // 일반 아이템 90%
        // 레벨별 가중치 가져오기
        let weights = getWeightsByLevel ? getWeightsByLevel(currentLevel) : [];
        
        // 디버프 적용
        weights = [...weights];
        
        // 세금 폭탄: 세금/빚 출현 빈도 증가
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(window.Game?.DEBUFFS?.TAX_BOMB)) {
          weights = weights.map(([type, weight]) => {
            if (type === ITEM.TAX || type === ITEM.DEBT) {
              return [type, weight * 2.5]; // 2.5배 증가
            }
            return [type, weight];
          });
        }
        
        // 유동성 위기: + 아이템 출현 빈도 50% 감소
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(window.Game?.DEBUFFS?.LIQUIDITY_CRISIS)) {
          weights = weights.map(([type, weight]) => {
            // 현금 아이템들 (모든 현금 타입)
            if (type === ITEM.CASH10 || type === ITEM.CASH50 || type === ITEM.CASH100 || 
                type === ITEM.CASH500 || type === ITEM.CASH1000 || type === ITEM.CASH5000 || 
                type === ITEM.CASH10000 || type === ITEM.CASH50000) {
              return [type, weight * 0.5]; // 50% 감소
            }
            return [type, weight];
          });
        }
        
        // 미국 주식 떡상 활성화 중: 세금/빚 아이템 제거, 모든 현금을 5만원으로 변경
        if (BuffSystem && BuffSystem.stockBoomActive) {
          weights = weights.filter(([type]) => type !== ITEM.TAX && type !== ITEM.DEBT);
          // 모든 현금 아이템을 5만원으로 변경
          weights = weights.map(([type, weight]) => {
            // 현금 아이템인 경우 5만원으로 변경
            if (type === ITEM.CASH10 || type === ITEM.CASH50 || type === ITEM.CASH100 || 
                type === ITEM.CASH500 || type === ITEM.CASH1000 || type === ITEM.CASH5000 || 
                type === ITEM.CASH10000 || type === ITEM.CASH50000) {
              return [ITEM.CASH50000, weight];
            }
            return [type, weight];
          });
        }
        
        type = this.rndWeighted(weights);
      }
      const margin = 16;
      
      // 모든 아이템(버프 포함)은 상단에서 떨어지도록 4칸 그리드 시스템 사용
      const gridSize = (world.w - margin * 2) / 4;
      const gridIndex = Math.floor(Math.random() * 4); // 0~3 중 랜덤
      const x = margin + gridIndex * gridSize + gridSize / 2;
      const y = -20;  // 화면 상단 밖에서 시작
      
      const r = 18;   // 아이템 반지름
      const vy = 0.08 + Math.random() * 0.06; // 초기 낙하 속도
      
      this.drops.push({ x, y, r, vy, type, alive: true });
    },

    /**
     * 아이템 수집 시 파티클 효과 생성
     * @param {number} x - 파티클 생성 X 좌표
     * @param {number} y - 파티클 생성 Y 좌표
     * @param {string} color - 파티클 색상
     * @param {number} count - 생성할 파티클 개수
     */
    spawnParticles(x, y, color, count = 8) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 0.15 + Math.random() * 0.1;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.05,
          life: 1.0,
          color,
          size: 3 + Math.random() * 4,
        });
      }
    },

    /**
     * 아이템 수집 시 점수 계산
     * 콤보 배수, 디버프, FEVER 타임, 관리자 모드를 모두 고려합니다.
     * @param {string} type - 아이템 타입
     * @param {number} comboCount - 현재 콤보 수
     * @param {boolean} isFeverTime - FEVER 타임 여부
     * @param {Object} debuffSystem - 디버프 시스템
     * @param {Object} adminMode - 관리자 모드 설정
     * @param {number} comboMultiplier - 콤보 배수
     * @returns {number} 계산된 점수
     */
    calculateScore(type, comboCount, isFeverTime, debuffSystem, adminMode, comboMultiplier) {
      const ITEM = window.Game?.ITEM || {};
      const SCORE = window.Game?.config?.SCORE || {};
      const DEBUFFS = window.Game?.DEBUFFS || {};
      const base = SCORE[type] || 0;
      
      if (type === ITEM.TAX || type === ITEM.DEBT) {
        // 디버프 적용
        let scoreMultiplier = 1.0;
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.KOSPI_DOWN)) {
          scoreMultiplier *= 0.5; // 코스피 하락: 50% 감소
        }
        // 금리 인상: 빚 아이템 감점 2배
        if (type === ITEM.DEBT && debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.INTEREST_RATE_UP)) {
          scoreMultiplier *= 2.0; // 빚 아이템 감점 2배
        }
        // FEVER 타임: 세금아이템 점수 깍이기 방지 (원래 점수 유지)
        if (isFeverTime) {
          scoreMultiplier = 1.0; // FEVER 타임 중에는 모든 감점 무시
        }
        // 관리자 모드: 점수 배수 적용
        if (adminMode && adminMode.enabled) {
          scoreMultiplier *= adminMode.scoreMultiplier;
        }
        return Math.floor(base * scoreMultiplier);
      } else {
        // 연봉동결 디버프: 획득 점수가 없어짐 (0원)
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.SALARY_FREEZE)) {
          return 0;
        }
        
        // 양수 아이템: 콤보 배수 적용 후 디버프 적용
        let baseScore = base * (comboMultiplier || 1.0);
        
        // 미국 주식 떡상 버프: 모든 화폐 가치를 골든바(50000원)로 변경
        const BuffSystem = window.Game?.BuffSystem;
        const BUFFS = window.Game?.BUFFS || {};
        if (BuffSystem && BuffSystem.hasBuff && BuffSystem.hasBuff(BUFFS.STOCK_BOOM)) {
          // 모든 현금 아이템을 50000원으로 변경
          baseScore = (SCORE[ITEM.CASH50000] || 50000) * (comboMultiplier || 1.0);
        }
        
        let scoreMultiplier = 1.0;
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.KOSPI_DOWN)) {
          scoreMultiplier *= 0.5; // 코스피 하락: 50% 감소
        }
        if (debuffSystem && debuffSystem.hasDebuff && debuffSystem.hasDebuff(DEBUFFS.SAVING_OBSESSION)) {
          scoreMultiplier *= 0.7; // 저축 강박: 30% 감소
        }
        // FEVER 타임: 점수 2배
        if (isFeverTime) {
          scoreMultiplier *= 2.0;
        }
        // 관리자 모드: 점수 배수 적용
        if (adminMode && adminMode.enabled) {
          scoreMultiplier *= adminMode.scoreMultiplier;
        }
        return Math.floor(baseScore * scoreMultiplier);
      }
    },

    /**
     * 아이템 물리 업데이트
     * 중력, 낙하 속도, 디버프 효과를 적용합니다.
     * 충돌 감지는 game.js에서 별도로 처리됩니다.
     * @param {number} dt - 델타 타임 (밀리초)
     * @param {Object} world - 게임 월드 정보
     * @param {Object} level - 현재 레벨 정보
     * @param {Object} debuffSystem - 디버프 시스템
     */
    updatePhysics(dt, world, level, debuffSystem) {
      const DEBUFFS = window.Game?.DEBUFFS || {};
      
      let g = level.g;
      let maxV = level.maxSpeed;
      
      // 디버프: 패닉셀 - 낙하 속도 2배
      if (debuffSystem?.hasDebuff?.(DEBUFFS.PANIC_SELL)) {
        g *= 2.0;
        maxV *= 2.0;
      }
      
      // 모든 아이템 물리 업데이트
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        if (!d.alive) {
          this.drops.splice(i, 1);
          continue;
        }
        
        // 중력 적용
        d.vy = Math.min(maxV, d.vy + g * dt);
        d.y += d.vy * dt;
      }
    },

    /**
     * 파티클 효과 업데이트
     * 중력과 페이드 아웃 효과를 적용합니다.
     * @param {number} dt - 델타 타임 (밀리초)
     * @param {Object} world - 게임 월드 정보
     */
    updateParticles(dt, world) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.0002 * dt;  // 중력 적용
        p.life -= dt / 400;   // 페이드 아웃
        
        // 생명력이 0이 되거나 화면 밖으로 나가면 제거
        if (p.life <= 0 || p.y > world.h + 50) {
          this.particles.splice(i, 1);
        }
      }
    },

    /**
     * 아이템 시스템 초기화
     * 게임 시작 시 모든 아이템과 파티클을 초기화합니다.
     */
    init() {
      this.drops = [];
      this.particles = [];
      this.nextSpawnAt = 0;
    }
  };

  console.log("[Items] 아이템 시스템 로드 완료");
})();

