(function() {
  "use strict";

  window.Game = window.Game || {};

  Game.InputSystem = {
    pDown: false,
    mouseTargetX: null,
    
    init() {
      this.pDown = false;
      this.mouseTargetX = null;
    },
    
    clientToWorldX(clientX, cvs, world) {
      const rect = cvs.getBoundingClientRect();
      if (!rect.width || rect.width === 0) {
        return world.w / 2;
      }
      
      const scale = world.scale || 1;
      const displayWidth = rect.width;
      const canvasX = clientX - rect.left;
      const worldOffsetX = (displayWidth - world.w * scale) / 2;
      const worldX = (canvasX - worldOffsetX) / scale;
      
      return Math.max(0, Math.min(world.w, worldX));
    },
    
    onDown(e, cvs, world) {
      const paused = window.Game?.paused?.() || false;
      const gameOver = window.Game?.gameOver?.() || false;
      const isCountdownActive = window.Game?.isCountdownActive?.() || false;
      const getMeetingCallStopped = window.Game?.getMeetingCallStopped || (() => false);
      
      if (paused || gameOver || isCountdownActive || getMeetingCallStopped()) return;
      
      this.pDown = true;
      
      const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
      if (clientX) {
        const wx = this.clientToWorldX(clientX, cvs, world);
        this.mouseTargetX = wx;
        
        const AgentSystem = window.Game?.AgentSystem;
        if (AgentSystem?.agent) {
          AgentSystem.agent.x = wx;
        }
      }
    },
    
    onMove(e, cvs, world) {
      const paused = window.Game?.paused?.() || false;
      const gameOver = window.Game?.gameOver?.() || false;
      const isCountdownActive = window.Game?.isCountdownActive?.() || false;
      const getMeetingCallStopped = window.Game?.getMeetingCallStopped || (() => false);
      
      if (!this.pDown || paused || gameOver || isCountdownActive || getMeetingCallStopped()) return;
      
      e.preventDefault?.();
      e.stopPropagation?.();
      
      const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
      if (!clientX) return;
      
      const wx = this.clientToWorldX(clientX, cvs, world);
      this.mouseTargetX = wx;
    },
    
    onUp(e) {
      this.pDown = false;
      this.mouseTargetX = null;
      
      if (e) {
        e.preventDefault?.();
        e.stopPropagation?.();
      }
    },
    
    setupEventListeners(cvs, world) {
      const touchOptions = { passive: false };
      const pointerOptions = { passive: false };
      
      cvs.addEventListener("pointerdown", (e) => this.onDown(e, cvs, world), pointerOptions);
      cvs.addEventListener("pointermove", (e) => this.onMove(e, cvs, world), pointerOptions);
      cvs.addEventListener("pointerup", (e) => this.onUp(e), pointerOptions);
      cvs.addEventListener("pointercancel", (e) => this.onUp(e), pointerOptions);
      
      cvs.addEventListener("touchstart", (e) => this.onDown(e, cvs, world), touchOptions);
      cvs.addEventListener("touchmove", (e) => this.onMove(e, cvs, world), touchOptions);
      cvs.addEventListener("touchend", (e) => this.onUp(e), touchOptions);
      cvs.addEventListener("touchcancel", (e) => this.onUp(e), touchOptions);
      
      cvs.addEventListener("contextmenu", (e) => e.preventDefault());
      
      let lastTouchEnd = 0;
      document.addEventListener("touchend", (e) => {
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

