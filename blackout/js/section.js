/* ----------------------------------------------
 * HanbitSoft Infra Development Team
 * 아일리스 3차 업데이트 티저 Script - 섹션 헬퍼 (보이는 비율로 켜고 끄기, 연출 상태)
 * Author - sgp8116@hanbitsoft.co.kr 261029
------------------------------------------------- */
/* Section (섹션 연출 공통 헬퍼. sections.js 가 쓴다)
-------------------------------------------------------------- */
(function (T) {
    var readRatio = T.readRatio;
    var bodySeconds = T.bodySeconds;

    // hero 정전 연출(html[data-hero-stage])이 루프까지 간 뒤에 부른다. hero 가 없으면 바로 부른다.
    // 다른 섹션 영상이 hero 영상과 회선을 나눠 쓰지 않게 하려는 것이다.
    function whenHeroSettled(callback) {
        var html = document.documentElement;
        function settled() {
            var stage = html.getAttribute('data-hero-stage');
            return stage === null || stage === 'loop' || stage === 'ready';
        }
        if (settled() || typeof MutationObserver !== 'function') { callback(); return; }
        var observer = new MutationObserver(function () {
            if (!settled()) { return; }
            observer.disconnect();
            callback();
        });
        observer.observe(html, { attributes: true, attributeFilter: ['data-hero-stage'] });
    }

    // 섹션이 화면에 보이는 비율로 영상을 미리 받고, 켜고 끄고, 시작한다 (story·field·item·mission·character·raid 공통).
    // 기준 비율은 래퍼(wrapper)의 계산값으로 읽는 css 변수. body 의 공통값을 물려받고, 래퍼에서 덮어쓸 수 있다.
    //   --power-ratio: 이만큼 이상 보이면 켜지고, 덜 보이면 정전. 비율이 이 선을 넘나들 때마다 handlers.power(on) 을 부른다.
    //   --start-ratio: 처음 이만큼 보이면(위·아래 어느 쪽에서 와도) handlers.start() 를 한 번 부른다.
    //   handlers.preload(선택): 섹션이 한 화면 안으로 다가오면 한 번 부른다. hero 가 아직 자기 영상을 받는 중이면 끝난 뒤에.
    //   영상이 없는 섹션(item·mission·raid)은 넘기지 않는다. 배경 그림(css 배경, mission 은 마크업 img)은 페이지와 함께 받는다.
    // 화면을 다 덮을 때(비율 1)를 기준으로 삼으면 스크롤을 거의 끝까지 내려야 시작돼 늦고, 가로 스크롤바나 주소창 높이 변화로
    // 비율이 1 에 못 미쳐 아예 시작되지 않을 수도 있어, 그보다 낮은 비율에서 시작한다.
    // isIntersecting 은 섹션이 화면 끝에 딱 닿기만 해도(맨 위로 돌아와 story 가 화면 바로 아래 있을 때) true 라서 비율로 판단한다.
    // IntersectionObserver 가 없는 브라우저에서는 바로 켜고 시작한다.
    function watchSection(section, wrapper, handlers) {
        if (!('IntersectionObserver' in window)) {
            handlers.power(true);
            handlers.start();
            return;
        }
        var style = window.getComputedStyle(wrapper);
        var POWER_RATIO = readRatio(style.getPropertyValue('--power-ratio'), 0.6);
        var START_RATIO = readRatio(style.getPropertyValue('--start-ratio'), POWER_RATIO);

        if (handlers.preload) {
            var preloader = new IntersectionObserver(function (entries) {
                if (!entries[entries.length - 1].isIntersecting) { return; }
                preloader.disconnect();
                whenHeroSettled(handlers.preload);
            }, { rootMargin: '100% 0px' });
            preloader.observe(section);
        }

        var started = false;
        var thresholds = [0, POWER_RATIO, START_RATIO].filter(function (t, i, all) { return all.indexOf(t) === i; });
        var watcher = new IntersectionObserver(function (entries) {
            var entry = entries[entries.length - 1];
            var ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
            handlers.power(ratio >= POWER_RATIO - 0.001);
            if (!started && ratio >= START_RATIO - 0.001) {
                started = true;
                handlers.start();
            }
        }, { threshold: thresholds });
        watcher.observe(section);
    }

    // 패널 점등이 끝나는 때(초): 점등 시작(panelDelay) + 첫 줄이 떠오르기 시작하는 때(lineStart) + 마지막 줄 차례(lastLine, css --n) × 줄 간격 + 한 줄이 떠오르는 시간.
    // 그 뒤에 연출 상태를 ready 로 바꾼다 (createStage 의 lightUp).
    function litAt(panelDelay, lineStart, lastLine) {
        return panelDelay + lineStart
            + bodySeconds('--story-line-step', 0.12) * lastLine
            + bodySeconds('--story-line-in', 0.6);
    }

    // 섹션 연출 상태(html[data-<name>-stage])와 전원(html[data-<name>-power]) 속성. 처음 값은 마크업의 head 스크립트가 적어 둔다.
    function createStage(name) {
        var html = document.documentElement;
        var attribute = 'data-' + name + '-stage';
        var value = html.getAttribute(attribute);
        function set(stage) {
            value = stage;
            html.setAttribute(attribute, stage);
        }
        return {
            is: function (stage) { return value === stage; },
            set: set,
            remove: function () { html.removeAttribute(attribute); }, // 연출을 걷어 로고·패널을 바로 보인다 (영상이 없을 때)
            // 점등: on 으로 바꾸고, 점등이 끝나는 때(seconds, litAt) 조금 뒤에 ready 로 바꾼다.
            lightUp: function (seconds) {
                set('on');
                window.setTimeout(function () { set('ready'); }, seconds * 1000 + 100);
            },
            setPower: function (on) { html.setAttribute('data-' + name + '-power', on ? 'on' : 'off'); }
        };
    }

    T.watchSection = watchSection;
    T.litAt = litAt;
    T.createStage = createStage;
})(window.Teaser);
