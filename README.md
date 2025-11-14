# 머니 캐쳐 (Money Catcher) 🐱

2025년 토스 HTML5 with.넵튠 연습
네온 아케이드 스타일의 머니 캐칭 게임입니다. 떨어지는 아이템을 받아 점수를 획득하고, 콤보를 유지하여 높은 점수를 노려보세요!

## 🎮 게임 플레이

게임을 플레이하려면 다음 링크를 방문하세요:

**🎮 [머니 캐쳐 플레이하기](https://toos-money-catcher.vercel.app/)**

### 게임 방법
- **조작**: 좌우 스와이프 또는 방향키로 요원 이동
- **목표**: 돈, 포인트, 쿠폰을 받아 점수를 획득
- **주의**: 세금(TAX)과 빚(DEBT)은 피하세요!
- **콤보**: 같은 종류를 연속으로 받으면 콤보가 증가합니다

## 🚀 배포

게임은 Vercel을 통해 배포되어 있습니다:

**🔗 배포 URL**: [https://toos-money-catcher.vercel.app/](https://toos-money-catcher.vercel.app/)

### 로컬 실행 방법
1. `index.html`을 웹 브라우저에서 열기
2. "GAME START" 버튼 클릭
3. 게임 시작!

## 📁 파일 구조

```
MoneyCatcher/
├── index.html              # 메인 HTML 파일
├── game.js                 # 게임 메인 로직
├── style.css               # 스타일시트
├── README.md               # 프로젝트 설명서
├── moneyAssets.html        # 에셋 관리 페이지
├── js/                     # 게임 모듈
│   ├── config.js           # 게임 설정 및 상수
│   ├── agent.js            # 캐릭터(요원) 시스템
│   ├── input.js            # 입력 처리 시스템
│   ├── items.js            # 아이템 시스템
│   ├── combo.js            # 콤보 시스템
│   ├── debuffs.js          # 디버프 시스템
│   ├── buffs.js            # 버프 시스템
│   ├── render.js           # 렌더링 시스템
│   └── ui.js               # UI 업데이트 시스템
└── assets/                 # 게임 에셋
    ├── font/               # 폰트 파일
    │   ├── neodgm.ttf
    │   ├── neodgm.woff
    │   └── neodgm.woff2
    ├── money/              # 돈 아이템 이미지
    │   ├── coin_10.png
    │   ├── coin_50.png
    │   ├── coin_100.png
    │   ├── coin_500.png
    │   ├── bill_1000.png
    │   ├── bill_5000.png
    │   ├── bill_10000.png
    │   ├── bill_50000.png
    │   ├── tax.png
    │   └── debt.png
    ├── pixel_heart/        # 하트 아이콘
    │   ├── heart_V2.png
    │   └── heart_V3.png
    ├── sound/              # 사운드 파일
    │   ├── background.mp3
    │   ├── item_get.mp3
    │   ├── minus_item.mp3
    │   ├── combo_up.mp3
    │   ├── level_up.mp3
    │   └── lobby music.mp3
    ├── bg_day.png          # 배경 이미지 (낮)
    ├── bg_night.png        # 배경 이미지 (밤)
    ├── money.png           # 돈 아이템 (레거시)
    ├── point.png           # 포인트 아이템
    ├── coupon.png          # 쿠폰 아이템
    ├── tax.png             # 세금 아이템 (레거시)
    ├── debt.png            # 빚 아이템 (레거시)
    └── ui_panel.png        # UI 패널 이미지
```

## ✨ 주요 기능

- ✅ 귀여운 픽셀 캐릭터 애니메이션
- ✅ 콤보 시스템
- ✅ 파티클 효과
- ✅ 반응형 디자인 (모바일/데스크톱)
- ✅ 터치/키보드 조작 지원
- ✅ 로컬 스토리지 최고 점수 저장
- ✅ 레벨 진행 시스템
- ✅ 네온 아케이드 스타일 UI

## 🐛 수정 사항

### 버그 수정
- 레벨 진행 시 인덱스 범위 검사 추가
- 데드 드롭 자동 정리 (메모리 최적화)
- Shake 효과 컨텍스트 관리 개선
- 이미지 로딩 실패 시 fallback 처리

### 성능 개선
- 데드 드롭 즉시 제거로 메모리 사용량 감소
- 델타 타임 캡으로 큰 점프 방지
- 파티클 시스템 최적화

### 게임플레이 개선
- 터치 반응성 향상
- 파티클 효과 추가 (아이템 수집 시)
- 에이전트 위치 초기화
- 모바일 스크롤 방지

### 시각적 개선
- 귀여운 픽셀 캐릭터 fallback 추가
- 네온 글로우 효과
- 애니메이션 개선

## 🎯 향후 개선 사항

- [ ] 사운드 효과 추가
- [ ] BGM 추가
- [ ] 더 다양한 아이템 타입
- [ ] 파워업 시스템
- [ ] 리더보드 연동

## 📝 라이선스
이 프로젝트는 2025년 토스 HTML5 with.넵튠 공모전 연습

## 👨‍💻 개발
게임은 순수 JavaScript, HTML5 Canvas, CSS로 제작되었습니다.

