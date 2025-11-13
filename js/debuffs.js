/**
 * debuffs.js - 디버프 시스템
 * 
 * 게임 난이도를 높이는 디버프 효과를 관리합니다.
 * 레벨이 올라갈수록 더 자주, 더 많이 발생합니다.
 */
(() => {
  "use strict";

  window.Game = window.Game || {};
  
  // ============================================
  // 디버프 타입 정의
  // ============================================
  Game.DEBUFFS = {
    KOSPI_DOWN: "kospi_down",           // 점수 획득량 50% 감소
    TAX_BOMB: "tax_bomb",                // 세금/빚 출현 빈도 증가
    MONDAY_BLUES: "monday_blues",        // 콤보 게이지 감소 속도 증가
    INTEREST_RATE_UP: "interest_rate_up",       // 빚 아이템 감점 2배
    LIQUIDITY_CRISIS: "liquidity_crisis",        // + 아이템 출현 빈도 50% 감소
    OVERTIME_MODE: "overtime_mode",      // 화면 어두워짐
    MEETING_CALL: "meeting_call",       // 3초마다 0.5초 정지
    COFFEE_SHORTAGE: "coffee_shortage",  // 이동 속도 30% 감소
    PANIC_SELL: "panic_sell",            // 아이템 낙하 속도 2배
    SALARY_FREEZE: "salary_freeze",      // 연봉동결: 모든 금액이 10000원으로 변경
    FOMO_SYNDROME: "fomo_syndrome",      // - 아이템이 +로 위장
    SAVING_OBSESSION: "saving_obsession", // 획득 점수 30% 감소
    REAL_ESTATE_BOOM: "real_estate_boom",     // 화면 하단 30% 가려짐
    SUBSCRIPTION_BOMB: "subscription_bomb",    // 2초마다 구독료 차감
  };
  
  // ============================================
  // 디버프 상세 정보
  // ============================================
  Game.DEBUFF_INFO = {
    [Game.DEBUFFS.KOSPI_DOWN]: { duration: 15000, name: "📉 코스피 하락", desc: "점수 획득량 50% 감소" },
    [Game.DEBUFFS.TAX_BOMB]: { duration: 15000, name: "💣 세금 폭탄", desc: "세금/빚 출현 빈도 증가" },
    [Game.DEBUFFS.MONDAY_BLUES]: { duration: 15000, name: "😴 월요병", desc: "콤보 게이지 감소 속도 증가" },
    [Game.DEBUFFS.INTEREST_RATE_UP]: { duration: 15000, name: "📈 금리 인상", desc: "빚 아이템 감점 2배" },
    [Game.DEBUFFS.LIQUIDITY_CRISIS]: { duration: 15000, name: "💧 유동성 위기", desc: "+ 아이템 출현 50% 감소" },
    [Game.DEBUFFS.OVERTIME_MODE]: { duration: 10000, name: "🌙 야근 모드", desc: "화면 어두워짐" },
    [Game.DEBUFFS.MEETING_CALL]: { duration: 12000, name: "📞 회의 소환", desc: "3초마다 0.5초 정지" },
    [Game.DEBUFFS.COFFEE_SHORTAGE]: { duration: 10000, name: "☕ 커피 부족", desc: "이동 속도 30% 감소" },
    [Game.DEBUFFS.PANIC_SELL]: { duration: 8000, name: "😱 패닉셀", desc: "낙하 속도 2배" },
    [Game.DEBUFFS.SALARY_FREEZE]: { duration: 10000, name: "❄️ 연봉동결", desc: "모든 금액이 10000원으로 변경" },
    [Game.DEBUFFS.FOMO_SYNDROME]: { duration: 12000, name: "🤯 FOMO 증후군", desc: "- 아이템이 +로 위장" },
    [Game.DEBUFFS.SAVING_OBSESSION]: { duration: 20000, name: "🔒 저축 강박", desc: "획득 점수 30% 잠금" },
    [Game.DEBUFFS.REAL_ESTATE_BOOM]: { duration: 15000, name: "🏠 부동산 폭등", desc: "화면 하단 30% 가려짐" },
    [Game.DEBUFFS.SUBSCRIPTION_BOMB]: { duration: 12000, name: "💳 구독료 폭탄", desc: "2초마다 -1000원" },
  };
  
  // ============================================
  // 디버프 시스템 상태 관리
  // ============================================
  Game.DebuffSystem = {
    activeDebuffs: [],              // 현재 활성화된 디버프 목록
    debuffNextTime: 0,              // 다음 디버프 발생 예정 시간
    
    // 특수 디버프별 상태 변수
    meetingCallNextStop: 0,         // 회의 소환: 다음 정지 예정 시간
    meetingCallStopped: false,      // 회의 소환: 현재 정지 중 여부
    subscriptionBombNextCharge: 0, // 구독료 폭탄: 다음 점수 차감 시간
    lockedScore: 0,                 // 저축 강박: 잠긴 점수
    
    /**
     * 레벨별 디버프 발생 주기 반환
     * 레벨이 올라갈수록 더 빠르게 발생합니다.
     * @param {number} level - 현재 레벨
     * @returns {number} 디버프 발생 주기 (밀리초)
     */
    getDebuffInterval(level) {
      if (level <= 2) return 50000;      // 레벨 1-2: 50초
      if (level <= 4) return 40000;     // 레벨 3-4: 40초
      if (level <= 6) return 30000;     // 레벨 5-6: 30초
      if (level <= 8) return 20000;     // 레벨 7-8: 20초
      return 15000;                      // 레벨 9-10: 15초
    },
    
    /**
     * 최대 디버프 중첩 수 반환
     * 레벨과 관계없이 항상 1개로 고정합니다.
     * @param {number} level - 현재 레벨 (사용하지 않음)
     * @returns {number} 최대 중첩 가능한 디버프 개수 (항상 1)
     */
    getMaxDebuffStack(level) {
      return 1; // 항상 1개만 중첩 가능
    },
    
    /**
     * 특정 디버프가 활성화되어 있는지 확인
     * @param {string} debuffType - 확인할 디버프 타입
     * @returns {boolean} 활성화 여부
     */
    hasDebuff(debuffType) {
      return this.activeDebuffs.some(d => d.type === debuffType);
    },
    
    /**
     * 디버프 시스템 초기화
     * 게임 시작 시 모든 디버프 상태를 리셋합니다.
     */
    init() {
      this.activeDebuffs = [];
      this.debuffNextTime = 0;
      this.meetingCallNextStop = 0;
      this.meetingCallStopped = false;
      this.subscriptionBombNextCharge = 0;
      this.lockedScore = 0;
    }
  };
  
  console.log("[Debuffs] 디버프 시스템 로드 완료");
})();

