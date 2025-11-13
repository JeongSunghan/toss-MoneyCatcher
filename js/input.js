/**
 * input.js - 입력 처리 시스템
 * 
 * 마우스와 터치 입력을 처리하여 캐릭터 이동 목표 위치를 설정합니다.
 * 모바일과 데스크톱 모두 지원하며, 더블 탭 줌을 방지합니다.
 */
(function() {
  "use strict";

  window.Game = window.Game || {};

  // ============================================
  // 입력 시스템 상태
  // ============================================
  Game.InputSystem = {
    pDown: false,        // 포인터/터치 다운 상태
    mouseTargetX: null, // 목표 X 좌표 (null이면 추적 안 함)
    
    /**
     * 입력 시스템 초기화
     * 게임 시작 시 입력 상태를 리셋합니다.
     */
    init() {
      this.pDown = false;
      this.mouseTargetX = null;
    },
    
    /**
     * 클라이언트 좌표를 월드 좌표로 변환
     * 화면 좌표를 게임 내부 좌표계로 변환합니다.
     * @param {number} clientX - 클라이언트 X 좌표
     * @param {HTMLCanvasElement} cvs - 캔버스 요소
     * @param {Object} world - 게임 월드 정보
     * @returns {number} 월드 X 좌표
     */
    clientToWorldX(clientX, cvs, world) {
      const rect = cvs.getBoundingClientRect();
      if (!rect.width || rect.width === 0) {
        return world.w / 2; // 캔버스 미로드 시 중앙 반환
      }
      
      const scale = world.scale || 1;
      const displayWidth = rect.width;
      const canvasX = clientX - rect.left;
      
      // 중앙 정렬 고려한 월드 좌표 변환
      const worldOffsetX = (displayWidth - world.w * scale) / 2;
      const worldX = (canvasX - worldOffsetX) / scale;
      
      return Math.max(0, Math.min(world.w, worldX));
    },
    
    /**
     * 포인터 다운 이벤트 핸들러
     * 터치/마우스 다운 시 목표 위치를 설정하고 즉시 이동합니다.
     * @param {Event} e - 이벤트 객체
     * @param {HTMLCanvasElement} cvs - 캔버스 요소
     * @param {Object} world - 게임 월드 정보
     */
    onDown(e, cvs, world) {
      // 게임이 일시정지/종료/회의 소환 상태면 입력 무시
      const paused = window.Game?.paused || false;
      const gameOver = window.Game?.gameOver || false;
      const getMeetingCallStopped = window.Game?.getMeetingCallStopped || (() => false);
      
      if (paused || gameOver || getMeetingCallStopped()) return;
      
      this.pDown = true;
      
      // 클라이언트 좌표 추출 (터치/마우스 모두 지원)
      const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
      if (clientX) {
        const wx = this.clientToWorldX(clientX, cvs, world);
        this.mouseTargetX = wx;
        
        // 즉시 위치 업데이트 (더 빠른 반응)
        const AgentSystem = window.Game?.AgentSystem;
        if (AgentSystem?.agent) {
          AgentSystem.agent.x = wx;
        }
      }
    },
    
    /**
     * 포인터 이동 이벤트 핸들러
     * 목표 위치만 업데이트합니다. 실제 이동은 game.js의 루프에서 처리됩니다.
     * @param {Event} e - 이벤트 객체
     * @param {HTMLCanvasElement} cvs - 캔버스 요소
     * @param {Object} world - 게임 월드 정보
     */
    onMove(e, cvs, world) {
      const paused = window.Game?.paused || false;
      const gameOver = window.Game?.gameOver || false;
      const getMeetingCallStopped = window.Game?.getMeetingCallStopped || (() => false);
      
      if (!this.pDown || paused || gameOver || getMeetingCallStopped()) return;
      
      e.preventDefault?.();   // 모바일 스크롤 방지
      e.stopPropagation?.();  // 이벤트 버블링 방지
      
      const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
      if (!clientX) return;
      
      const wx = this.clientToWorldX(clientX, cvs, world);
      this.mouseTargetX = wx; // 목표 위치만 업데이트
    },
    
    /**
     * 포인터 업 이벤트 핸들러
     * 터치/마우스 업 시 추적을 중지합니다.
     * @param {Event} e - 이벤트 객체
     */
    onUp(e) {
      this.pDown = false;
      this.mouseTargetX = null;
      
      if (e) {
        e.preventDefault?.();
        e.stopPropagation?.();
      }
    },
    
    /**
     * 이벤트 리스너 등록
     * 포인터와 터치 이벤트를 모두 등록하고, 더블 탭 줌을 방지합니다.
     * @param {HTMLCanvasElement} cvs - 캔버스 요소
     * @param {Object} world - 게임 월드 정보
     */
    setupEventListeners(cvs, world) {
      const touchOptions = { passive: false };
      const pointerOptions = { passive: false };
      
      // 포인터 이벤트
      cvs.addEventListener("pointerdown", (e) => this.onDown(e, cvs, world), pointerOptions);
      cvs.addEventListener("pointermove", (e) => this.onMove(e, cvs, world), pointerOptions);
      cvs.addEventListener("pointerup", (e) => this.onUp(e), pointerOptions);
      cvs.addEventListener("pointercancel", (e) => this.onUp(e), pointerOptions);
      
      // 터치 이벤트
      cvs.addEventListener("touchstart", (e) => this.onDown(e, cvs, world), touchOptions);
      cvs.addEventListener("touchmove", (e) => this.onMove(e, cvs, world), touchOptions);
      cvs.addEventListener("touchend", (e) => this.onUp(e), touchOptions);
      cvs.addEventListener("touchcancel", (e) => this.onUp(e), touchOptions);
      
      // 컨텍스트 메뉴 방지
      cvs.addEventListener("contextmenu", (e) => e.preventDefault());
      
      // 모바일에서 더블 탭 줌 방지 (전역 처리)
      let lastTouchEnd = 0;
      document.addEventListener("touchend", (e) => {
        // 캔버스 영역에서만 더블 탭 방지
        if (e.target === cvs || cvs.contains(e.target)) {
          const now = Date.now();
          if (now - lastTouchEnd <= 300) {
            e.preventDefault();
          }
          lastTouchEnd = now;
        }
      }, { passive: false });
    },
  };
  
  console.log("[Input] 입력 처리 시스템 로드 완료");
})();

