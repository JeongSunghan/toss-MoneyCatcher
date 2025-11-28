/**
 * stats.js - 통계 시스템
 *
 * 게임 플레이 통계를 기록하고 관리합니다.
 * localStorage를 사용하여 영구 저장합니다.
 */
(() => {
  "use strict";

  window.Game = window.Game || {};

  Game.StatsSystem = {
    /**
     * 통계 초기화 및 로드
     */
    init() {
      const savedStats = localStorage.getItem("mc.stats");
      if (savedStats) {
        try {
          return JSON.parse(savedStats);
        } catch (e) {
          console.error("[Stats] Failed to load stats:", e);
        }
      }

      // 기본 통계 구조
      return {
        totalGames: 0,              // 총 게임 횟수
        totalScore: 0,              // 총 획득 점수
        totalPlayTime: 0,           // 총 플레이 시간 (초)
        bestScore: 0,               // 최고 점수
        bestCombo: 0,               // 최고 콤보
        bestLevel: 0,               // 최고 레벨
        longestSurvival: 0,         // 최장 생존 시간 (초)

        // 아이템 수집 통계
        itemsCollected: {
          cash10: 0,
          cash50: 0,
          cash100: 0,
          cash500: 0,
          cash1000: 0,
          cash5000: 0,
          cash10000: 0,
          cash50000: 0,
          goldbar: 0,
          fever: 0,
          magnet: 0,
          overtime: 0,
          stockBoom: 0,
          shield: 0,
          tax: 0,
          debt: 0,
        },

        // 최근 10게임 히스토리
        recentGames: [],

        // 업적 진행도
        achievements: {
          firstGame: false,           // 첫 게임 플레이
          score100k: false,           // 10만원 달성
          score1m: false,             // 100만원 달성
          score10m: false,            // 1000만원 달성
          combo50: false,             // 50 콤보 달성
          combo100: false,            // 100 콤보 달성
          level5: false,              // 레벨 5 달성
          level10: false,             // 레벨 10 달성
          survival60s: false,         // 60초 생존
          survival120s: false,        // 120초 생존
          survival300s: false,        // 300초 생존
          games10: false,             // 10게임 플레이
          games50: false,             // 50게임 플레이
          games100: false,            // 100게임 플레이
        },

        version: 1, // 통계 버전 (향후 호환성용)
      };
    },

    /**
     * 통계 저장
     */
    save(stats) {
      try {
        localStorage.setItem("mc.stats", JSON.stringify(stats));
      } catch (e) {
        console.error("[Stats] Failed to save stats:", e);
      }
    },

    /**
     * 게임 종료 시 통계 업데이트
     */
    recordGame(stats, gameData) {
      const {
        score,
        maxCombo,
        level,
        survivalTime,
        itemsCollected = {},
      } = gameData;

      // 기본 통계 업데이트
      stats.totalGames++;
      stats.totalScore += score;
      stats.totalPlayTime += survivalTime;

      // 최고 기록 업데이트
      if (score > stats.bestScore) stats.bestScore = score;
      if (maxCombo > stats.bestCombo) stats.bestCombo = maxCombo;
      if (level > stats.bestLevel) stats.bestLevel = level;
      if (survivalTime > stats.longestSurvival) stats.longestSurvival = survivalTime;

      // 아이템 수집 통계 업데이트
      for (const [item, count] of Object.entries(itemsCollected)) {
        if (stats.itemsCollected[item] !== undefined) {
          stats.itemsCollected[item] += count;
        }
      }

      // 최근 게임 히스토리 추가 (최대 10개)
      stats.recentGames.unshift({
        timestamp: Date.now(),
        score,
        maxCombo,
        level,
        survivalTime,
      });
      if (stats.recentGames.length > 10) {
        stats.recentGames.pop();
      }

      // 업적 체크
      this.checkAchievements(stats, gameData);

      // 저장
      this.save(stats);

      return stats;
    },

    /**
     * 업적 달성 체크
     */
    checkAchievements(stats, gameData) {
      const { score, maxCombo, level, survivalTime } = gameData;
      const ach = stats.achievements;
      const newAchievements = [];

      // 첫 게임
      if (!ach.firstGame && stats.totalGames >= 1) {
        ach.firstGame = true;
        newAchievements.push({ id: 'firstGame', name: '첫 걸음', desc: '첫 게임 플레이' });
      }

      // 점수 업적
      if (!ach.score100k && score >= 100000) {
        ach.score100k = true;
        newAchievements.push({ id: 'score100k', name: '월급쟁이', desc: '10만원 달성' });
      }
      if (!ach.score1m && score >= 1000000) {
        ach.score1m = true;
        newAchievements.push({ id: 'score1m', name: '백만장자', desc: '100만원 달성' });
      }
      if (!ach.score10m && score >= 10000000) {
        ach.score10m = true;
        newAchievements.push({ id: 'score10m', name: '재벌', desc: '1000만원 달성' });
      }

      // 콤보 업적
      if (!ach.combo50 && maxCombo >= 50) {
        ach.combo50 = true;
        newAchievements.push({ id: 'combo50', name: '콤보 마스터', desc: '50 콤보 달성' });
      }
      if (!ach.combo100 && maxCombo >= 100) {
        ach.combo100 = true;
        newAchievements.push({ id: 'combo100', name: '콤보 신', desc: '100 콤보 달성' });
      }

      // 레벨 업적
      if (!ach.level5 && level >= 5) {
        ach.level5 = true;
        newAchievements.push({ id: 'level5', name: '중급자', desc: '레벨 5 달성' });
      }
      if (!ach.level10 && level >= 10) {
        ach.level10 = true;
        newAchievements.push({ id: 'level10', name: '고수', desc: '레벨 10 달성' });
      }

      // 생존 시간 업적
      if (!ach.survival60s && survivalTime >= 60) {
        ach.survival60s = true;
        newAchievements.push({ id: 'survival60s', name: '생존자', desc: '60초 생존' });
      }
      if (!ach.survival120s && survivalTime >= 120) {
        ach.survival120s = true;
        newAchievements.push({ id: 'survival120s', name: '버티기 마스터', desc: '120초 생존' });
      }
      if (!ach.survival300s && survivalTime >= 300) {
        ach.survival300s = true;
        newAchievements.push({ id: 'survival300s', name: '불사조', desc: '300초 생존' });
      }

      // 플레이 횟수 업적
      if (!ach.games10 && stats.totalGames >= 10) {
        ach.games10 = true;
        newAchievements.push({ id: 'games10', name: '열정가', desc: '10게임 플레이' });
      }
      if (!ach.games50 && stats.totalGames >= 50) {
        ach.games50 = true;
        newAchievements.push({ id: 'games50', name: '중독자', desc: '50게임 플레이' });
      }
      if (!ach.games100 && stats.totalGames >= 100) {
        ach.games100 = true;
        newAchievements.push({ id: 'games100', name: '레전드', desc: '100게임 플레이' });
      }

      return newAchievements;
    },

    /**
     * 통계 초기화 (모든 데이터 삭제)
     */
    reset() {
      localStorage.removeItem("mc.stats");
      return this.init();
    },

    /**
     * 통계 포맷팅 (화면 표시용)
     */
    format(stats) {
      const avgScore = stats.totalGames > 0 ? Math.floor(stats.totalScore / stats.totalGames) : 0;
      const avgPlayTime = stats.totalGames > 0 ? Math.floor(stats.totalPlayTime / stats.totalGames) : 0;

      return {
        totalGames: stats.totalGames.toLocaleString(),
        totalScore: `₩${stats.totalScore.toLocaleString('ko-KR')}`,
        totalPlayTime: this.formatTime(stats.totalPlayTime),
        avgScore: `₩${avgScore.toLocaleString('ko-KR')}`,
        avgPlayTime: this.formatTime(avgPlayTime),
        bestScore: `₩${stats.bestScore.toLocaleString('ko-KR')}`,
        bestCombo: stats.bestCombo,
        bestLevel: stats.bestLevel,
        longestSurvival: this.formatTime(stats.longestSurvival),
        achievementCount: Object.values(stats.achievements).filter(v => v).length,
        achievementTotal: Object.keys(stats.achievements).length,
      };
    },

    /**
     * 시간 포맷팅 (초 -> 분:초)
     */
    formatTime(seconds) {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}:${sec.toString().padStart(2, '0')}`;
    },
  };

  console.log("[Stats] 통계 시스템 로드 완료");
})();
