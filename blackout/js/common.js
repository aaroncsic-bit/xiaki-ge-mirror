/* ----------------------------------------------
 * HanbitSoft Infra Development Team
 * 아일리스 3차 업데이트 티저 Script - 공통 (영상·음악 주소, css 변수 읽기, 오늘 그만 보기, BGM, globalnav)
 * Author - sgp8116@hanbitsoft.co.kr 261029
------------------------------------------------- */
/* 스크립트 파일: index.html 이 아래 순서로 읽는다. 파일끼리 함께 쓰는 함수는 전역 객체 하나(window.Teaser)에 올리고,
   뒤 파일은 앞 파일이 올린 것을 쓴다. 각 파일은 IIFE 로 감싸 그 밖의 이름은 전역에 남기지 않는다.
   그 전에 head 에서 공용 assetBaseGE.js(리소스 서버 주소 getImageUrl)를 읽는다.
   common.js      공통: 영상·음악 주소, css 변수 읽기(readSeconds·readRatio·bodySeconds), 오늘 그만 보기, BGM, globalnav
   video-load.js  영상 받기 줄(곧 틀 영상은 바로, 나머지는 하나씩), 로딩 표시
   video.js       섹션 영상 재생기(1회 영상 → 루프 디졸브, 시간 초과, 전원), 정지 모드, 탭 배경 영상
   section.js     섹션 헬퍼: 보이는 비율로 켜고 끄기(watchSection), 연출 상태 속성(createStage), 점등이 끝나는 때(litAt)
   sections.js    섹션 연출: hero·story·field·item·mission·character·raid
   tab.js         탭
   mission.js     미션 캐러셀, 스크린샷 슬라이더·크게 보기
-------------------------------------------------------------- */
window.Teaser = window.Teaser || {};

/* Media Path (영상·음악 주소)
-------------------------------------------------------------- */
// 배포 서버는 html 의 images/ 경로만 리소스 서버 주소로 바꾸고 videos/·audio/ 는 그대로 둔다. 그대로면 페이지 주소 기준으로 찾다가 못 찾으므로
// 공용 assetBaseGE.js 의 getImageUrl(리소스 서버 주소. 로컬에서는 페이지 폴더)로 바꿔 단다. 다른 스크립트가 영상을 받기 전에 해야 해서 맨 앞에 둔다.
// 주소가 이미 같으면(로컬) 다시 달지 않는다. 다시 달면 받던 영상(hero 1회 영상, preload=auto)이 처음부터 다시 받는다.
(function () {
    if (typeof window.getImageUrl !== 'function') { return; } // 공용 스크립트를 못 받았으면 마크업 주소 그대로
    var media = document.querySelectorAll('video[src], audio[src]');
    for (var i = 0; i < media.length; i++) {
        var path = media[i].getAttribute('src');
        if (/^([a-z]+:|\/)/i.test(path)) { continue; } // 이미 절대 주소
        var url = window.getImageUrl(path);
        if (media[i].src !== url) { media[i].setAttribute('src', url); }
    }
})();

/* css 변수 읽기 (모든 파일 공통)
-------------------------------------------------------------- */
(function (T) {
    // 시간(0.8s, 800ms)을 초로 읽는다. 없거나 숫자가 아니면 fallback.
    function readSeconds(value, fallback) {
        var text = String(value || '').trim();
        var number = parseFloat(text);
        if (isNaN(number)) { return fallback; }
        return /ms$/.test(text) ? number / 1000 : number;
    }

    // css 변수의 비율(0~1)을 읽는다. 없거나 숫자가 아니면 fallback.
    function readRatio(value, fallback) {
        var number = parseFloat(value);
        if (isNaN(number)) { return fallback; }
        return Math.min(1, Math.max(0, number));
    }

    // body 에 둔 연출 타이밍 변수(css '연출 변수')를 초로 읽는다. 없으면 fallback.
    var bodyStyle = window.getComputedStyle(document.body);
    function bodySeconds(name, fallback) {
        return readSeconds(bodyStyle.getPropertyValue(name), fallback);
    }

    T.readSeconds = readSeconds;
    T.readRatio = readRatio;
    T.bodySeconds = bodySeconds;
})(window.Teaser);

/* BGM Controller
-------------------------------------------------------------- */
(function () {
    var controller = document.querySelector('.bgm-controller');
    if (!controller) { return; }

    var audio = controller.querySelector('.bgm');
    var button = controller.querySelector('.bgm-toggle');
    var icon = button.querySelector('img');

    // 아이콘 주소는 마크업 img(꺼짐 아이콘)의 src 를 따른다. 배포 서버는 html 의 images/ 경로만 리소스 서버 주소로 바꾸고,
    // js 에 적은 상대경로는 페이지 주소 기준이라 그 서버에서 못 찾는다.
    var OFF_SRC = icon.getAttribute('src');
    var ICON = {
        on: { src: OFF_SRC.replace('icon-sound-off', 'icon-sound-on'), alt: '背景音樂已開啟' },
        off: { src: OFF_SRC, alt: '背景音樂已關閉' }
    };

    function render(isPlaying) {
        var state = isPlaying ? ICON.on : ICON.off;
        icon.src = state.src;
        icon.alt = state.alt;
        button.classList.remove(isPlaying ? 'bgm-off' : 'bgm-on');
        button.classList.add(isPlaying ? 'bgm-on' : 'bgm-off');
        button.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    }

    button.addEventListener('click', function () {
        if (audio.paused) {
            var request = audio.play();
            if (request && typeof request.catch === 'function') {
                request.catch(function () { render(false); });
            }
        } else {
            audio.pause();
        }
    });

    // 재생 상태가 바뀔 때마다 아이콘과 클래스를 동기화한다.
    audio.addEventListener('play', function () { render(true); });
    audio.addEventListener('pause', function () { render(false); });

    render(!audio.paused);
})();

/* Globalnav (메뉴를 누르면 해당 섹션으로 부드럽게 스크롤한다)
-------------------------------------------------------------- */
// 시간은 css body 의 --nav-scroll-duration (한 화면 거리 기준. 더 멀면 거리의 제곱근에 비례해 늘되 두 배까지).
// 가는 동안 사용자가 휠·터치·스크롤 키로 움직이면 바로 멈추고 맡긴다. 움직임 줄이기(prefers-reduced-motion)를 켠 환경에서는 바로 이동한다.
// 주소의 # 은 기본 동작처럼 바뀌고, 아직 없는 섹션(history)은 기본 동작에 맡긴다.
// 도착한 섹션의 메뉴를 켜는 것은 css 가 섹션 켜짐 상태(html[data-xxx-power="on"], section.js 의 watchSection)로 한다 (css Globalnav 의 메뉴 활성).
(function (T) {
    var nav = document.querySelector('.globalnav');
    if (!nav) { return; }

    var DURATION = T.bodySeconds('--nav-scroll-duration', 0.8);
    var SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var frame = 0; // 진행 중인 이동의 requestAnimationFrame id (0 이면 없음)

    // 천천히 출발해 천천히 멈춘다 (easeInOutCubic)
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function stop() {
        if (frame) { window.cancelAnimationFrame(frame); }
        frame = 0;
    }

    // 목표 위치까지 스크롤한다. 거리가 한 화면보다 멀면 시간을 늘린다.
    function scrollTo(top) {
        var start = window.pageYOffset;
        var end = Math.max(0, Math.min(top, document.documentElement.scrollHeight - window.innerHeight));
        var distance = end - start;
        stop();
        if (!distance) { return; }
        if (reduceMotion.matches || DURATION <= 0) { window.scrollTo(0, end); return; }

        var screens = Math.abs(distance) / window.innerHeight;
        var seconds = DURATION * Math.min(Math.max(Math.sqrt(screens), 1), 2);
        var began = null;
        function step(now) {
            if (began === null) { began = now; }
            var t = Math.min((now - began) / (seconds * 1000), 1);
            window.scrollTo(0, start + distance * ease(t));
            frame = t < 1 ? window.requestAnimationFrame(step) : 0;
        }
        frame = window.requestAnimationFrame(step);
    }

    nav.addEventListener('click', function (event) {
        var link = event.target.closest('a[href^="#"]');
        if (!link) { return; }
        var id = link.getAttribute('href').slice(1);
        var target = id && document.getElementById(id);
        if (!target) { return; }
        event.preventDefault();
        scrollTo(target.getBoundingClientRect().top + window.pageYOffset);
        if (window.history.pushState) { window.history.pushState(null, '', '#' + id); }
    });

    // 사용자가 직접 스크롤하면 진행 중인 이동을 멈추고 맡긴다.
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', function (event) {
        if (SCROLL_KEYS.indexOf(event.key) !== -1) { stop(); }
    });
})(window.Teaser);
