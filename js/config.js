/**
 * config.js - 게임 설정 및 상수 관리
 * 
 * 게임의 모든 설정값과 상수를 중앙에서 관리합니다.
 * 레벨별 난이도 데이터도 자동으로 생성합니다.
 */
(() => {
  "use strict";

  window.Game = window.Game || {};
  
  // ============================================
  // 게임 기본 설정
  // ============================================
  Game.config = {
    WORLD_WIDTH: 360,        // 게임 월드 너비
    WORLD_HEIGHT: 520,       // 게임 월드 높이
    MAX_LEVEL: 10,           // 최대 레벨
    LEVEL_SCORE_INTERVAL: 100, // 레벨업에 필요한 점수 간격
    COMBO_DURATION: 3.0,      // 콤보 유지 시간 (초)
    FEVER_DURATION: 7.0,      // FEVER 타임 지속 시간 (초)
    MAX_HEARTS: 5,            // 최대 생명 수
    
    // 아이템별 점수 (음수는 감점)
    SCORE: {
      money: 10,
      point: 7,
      coupon: 5,
      tax: -15,
      debt: -25
    },
    
    // 아이템별 색상
    COLOR: {
      money: "#51CF66",  // 초록색
      point: "#4ECDC4",   // 청록색
      coupon: "#FFE66D", // 노란색
      tax: "#FF6B6B",    // 빨간색
      debt: "#8B6F47",   // 갈색
    },
    
    // 아이템별 표시 라벨
    LABEL: {
      money: "₩",
      point: "P",
      coupon: "%",
      tax: "TAX",
      debt: "DEBT",
    },
    
    // 아이템 스폰 가중치 [타입, 가중치]
    // 가중치가 높을수록 더 자주 출현
    WEIGHTS: [
      ["money", 34],
      ["point", 24],
      ["coupon", 18],
      ["tax", 14],
      ["debt", 10],
    ],
  };
  
  // ============================================
  // 아이템 타입 상수
  // ============================================
  Game.ITEM = {
    MONEY: "money",
    POINT: "point",
    COUPON: "coupon",
    TAX: "tax",
    DEBT: "debt",
  };
  
  // ============================================
  // 레벨별 난이도 데이터 생성
  // ============================================
  Game.LEVELS = [];
  for (let i = 1; i <= Game.config.MAX_LEVEL; i++) {
    // 레벨이 올라갈수록:
    // - 스폰 간격 감소 (더 빠른 스폰)
    // - 중력 증가 (더 빠른 낙하)
    // - 최대 속도 증가 (더 빠른 낙하)
    const baseSpawn = 700 - (i - 1) * 50;        // 스폰 간격 (ms)
    const baseG = 0.0006 + (i - 1) * 0.00005;   // 중력 가속도
    const baseMaxSpeed = 0.38 + (i - 1) * 0.02; // 최대 낙하 속도
    
    Game.LEVELS.push({
      id: i,
      spawn: Math.max(400, baseSpawn),      // 최소 400ms
      g: Math.min(0.0012, baseG),           // 최대 0.0012
      maxSpeed: Math.min(0.65, baseMaxSpeed), // 최대 0.65
    });
  }
  
  console.log("[Config] 게임 설정 로드 완료");
})();

