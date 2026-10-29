/* ----------------------------------------------
 * HanbitSoft Infra Development Team
 * 아일리스 3차 업데이트 티저 Script - 섹션 연출 (hero·story·field·item·mission·character·raid)
 * Author - sgp8116@hanbitsoft.co.kr 261029
------------------------------------------------- */
/* Sections (섹션마다 다른 연출. 블록 순서는 페이지의 섹션 순서)
-------------------------------------------------------------- */
// 영상은 video.js 의 재생기(createVideoSequence·createTabVideos), 보이는 비율로 켜고 끄는 것(watchSection)과
// 연출 상태 속성(createStage)은 section.js 의 헬퍼를 쓴다. hero 정전, story 화면 진입, field·character 탭 전환, 영상 없는 item·mission·raid 의 점등.
(function (T) {
    var createVideoSequence = T.createVideoSequence;
    var createTabVideos = T.createTabVideos;
    var watchSection = T.watchSection;
    var createStage = T.createStage;
    var litAt = T.litAt;
    var bodySeconds = T.bodySeconds;

    /* Hero: 1회 영상 → 정전 → 로고 → 루프 영상·globalnav, 그 뒤 스크롤 정전 스위치
    ---------------------------------------------------------- */
    (function () {
        var stage = createStage('hero');
        var wrapper = document.querySelector('.hero-video');
        var seq = wrapper && createVideoSequence(wrapper, { onOnceEnded: blackout });
        if (!seq) { stage.remove(); return; } // 영상이 없으면 로고·globalnav 를 바로 보인다.

        // 정전 연출 타이밍(css 의 body 변수). 1회 영상이 끝나면 즉시 검게 → 로고 → 루프 영상·globalnav.
        var BLACKOUT_HOLD = bodySeconds('--hero-blackout-hold', 0.6);
        var LOGO_FADE = bodySeconds('--hero-logo-fade', 1.5);
        var LOOP_FADE_IN = bodySeconds('--hero-loop-fade-in', 3);

        // 정전 연출: 1회 영상이 끝나면 화면을 즉시 검게 하고, 로고 → 루프 영상 순으로 켠다. globalnav 는 루프 영상이 나타나기 시작할 때(loop) 같이 켜진다 (css hero).
        // ready 는 루프 영상이 다 보인 뒤 스크롤 정전 감시를 시작하는 단계.
        function blackout() {
            seq.finishOnce();
            stage.set('blackout');
            window.setTimeout(function () { stage.set('logo'); }, BLACKOUT_HOLD * 1000);
            window.setTimeout(function () {
                stage.set('loop');
                seq.startLoop(); // 영상은 서서히 나타나는 동안 처음부터 재생된다.
            }, (BLACKOUT_HOLD + LOGO_FADE) * 1000);
            window.setTimeout(function () {
                stage.set('ready');
                watchScroll();
            }, (BLACKOUT_HOLD + LOGO_FADE + LOOP_FADE_IN) * 1000);
        }

        // 스크롤 정전: 루프 영상까지 다 뜬 뒤(ready) hero 섹션의 위 끝이 화면 위로 벗어나면 영상을 즉시 끄고 루프를 멈춘다.
        // 맨 위로 돌아오면 바로 켜고 멈춘 자리부터 이어서 튼다.
        // 기준이 스크롤 양(0)이 아니라 섹션 위치인 것은, 배포 서버가 body 맨 앞에 끼워 넣는 한빛온 GNB(40px)만큼 섹션이 내려가 있어
        // 그만큼 스크롤해 GNB 를 치우거나 globalnav 의 BLACKOUT 메뉴로 돌아와도(섹션 위 끝에 맞춰 스크롤) 켜져 있어야 하기 때문.
        // 1px 미만의 소수점 스크롤 오차는 허용한다.
        function watchScroll() {
            var section = wrapper.closest('.section');
            function check() {
                var on = section.getBoundingClientRect().top > -1;
                if (seq.setPower(on)) { stage.setPower(on); }
            }
            window.addEventListener('scroll', check, { passive: true });
            check();
        }

        seq.start();
    })();

    /* Story: 섹션이 화면에 --start-ratio 만큼 보이면 intro 를 한 번 튼 뒤 loop 를 반복한다.
       연출 단계는 html[data-story-stage] (wait → intro → loop). intro 는 끝나기 전에 loop 로 크로스 디졸브되고(--once-fade),
       loop 가 온전히 보이면 패널(content-wrapper)이 나타난다. 그 전까지 패널은 숨겨져 있다.
       정전(html[data-story-power]): 위나 아래로 스크롤해 섹션이 --power-ratio 보다 덜 보이면 영상이 꺼지고 멈추며,
       다시 그만큼 보이면 바로 켜지고 멈춘 자리부터 잇는다. hero 와 달리 조금 벗어난 정도로는 꺼지지 않는다.
       보이는 비율의 기준은 css body 의 --start-ratio·--power-ratio (watchSection).
    ---------------------------------------------------------- */
    (function () {
        var stage = createStage('story');
        var wrapper = document.querySelector('.story-video');
        var seq = wrapper && createVideoSequence(wrapper, { onLoopShown: function () { stage.set('loop'); } });
        if (!seq) { stage.remove(); return; } // 영상이 없으면 패널을 바로 보인다.

        watchSection(wrapper.closest('.section') || wrapper.parentNode, wrapper, {
            preload: seq.preload,
            power: function (on) {
                if (seq.setPower(on)) { stage.setPower(on); }
            },
            start: function () { // 전원이 꺼져 있으면 켜질 때 재생된다.
                stage.set('intro');
                seq.start();
            }
        });
    })();

    /* Field: 탭마다 배경 영상 묶음(.video-tab[data-panel])과 캐릭터(.field-character[data-panel])가 있고, 선택된 탭의 것만 보인다 (createTabVideos).
       탭을 바꾸면 새 영상이 위로 디졸브돼 들어오고 캐릭터도 같이 나타나며, 다 들어오면 캐릭터가 점등된다(is-lit). 이전 영상은 디졸브가 끝난 뒤 멈추고 캐릭터는 꺼진다.
       연출 단계는 html[data-field-stage] (wait → on → ready): 처음 영상이 다 들어오면 on 이 되어 패널이 점등되고(css), 끝나면 ready.
       정전(html[data-field-power]): 섹션이 --power-ratio 보다 덜 보이면 영상이 꺼지고 멈추며 캐릭터·패널은 실루엣으로 남는다. story 와 같다.
       탭 선택은 Tab 블록(tab.js)이 tablist 에 보내는 tabchange 이벤트로 받는다. 선택된 탭 이름은 섹션의 data-field-tab 에 적어 css 가 패널 좌우를
       정하게 하고, 패널이 반대편으로 갈 때는 잠깐 껐다가 새 자리에서 깜빡이며 켠다.
    ---------------------------------------------------------- */
    (function () {
        var stage = createStage('field');
        var section = document.querySelector('.section-field');
        var wrapper = section && section.querySelector('.field-video');
        var list = section && section.querySelector('[role="tablist"]');
        var panel = section && section.querySelector('.content-wrapper');
        if (!wrapper || !list || !panel) { stage.remove(); return; } // 영상이 없으면 패널을 바로 보인다.
        stage.set('wait');

        var MOVE_HOLD = bodySeconds('--field-move-hold', 0.15); // 패널이 반대편으로 갈 때 꺼져 있는 시간
        // 점등이 끝나는 때: 패널 점등 시작 + 마지막 줄(본문, css --n 2)이 다 떠오른 때
        var LIT_AT = litAt(bodySeconds('--field-panel-delay', 0.5), bodySeconds('--story-line-start', 1.2), 2);

        /* 탭 배치: 선택된 탭 이름(id 의 field-tab- 뒤)을 섹션에 적는다 (css [data-field-tab] 가 패널 좌우를 정한다)
        ------------------------------------------------------ */
        var tabName = section.getAttribute('data-field-tab');
        var moveTimer = 0;

        function placePanel(name) {
            tabName = name;
            section.setAttribute('data-field-tab', name);
        }

        // 패널이 반대편으로 가면 전원이 옮겨 가듯 잠깐 꺼졌다가(is-off) 새 자리에서 깜빡이며 켜진다(is-relit).
        // 같은 쪽이거나 아직 점등 전이면 바로 옮긴다. 어느 쪽인지는 옮겨 보고 패널 위치가 바뀌는지로 안다(그리기 전에 되돌리므로 보이지 않는다).
        function moveTo(name) {
            if (name === tabName && !panel.classList.contains('is-off')) { return; }
            window.clearTimeout(moveTimer);
            var from = panel.getBoundingClientRect().left;
            section.setAttribute('data-field-tab', name);
            var moved = panel.getBoundingClientRect().left !== from;
            if (!moved || stage.is('wait')) {
                placePanel(name);
                panel.classList.remove('is-off');
                return;
            }
            section.setAttribute('data-field-tab', tabName); // 꺼져 있는 동안은 제자리
            panel.classList.remove('is-relit');
            panel.classList.add('is-off');
            moveTimer = window.setTimeout(function () {
                placePanel(name);
                panel.classList.remove('is-off');
                void panel.offsetWidth; // 깜빡임 애니메이션을 처음부터 다시 돌린다.
                panel.classList.add('is-relit');
            }, MOVE_HOLD * 1000);
        }

        // 깜빡임이 끝나면 클래스를 떼어, 애니메이션 끝 값이 정전 실루엣 필터를 덮지 않게 한다.
        panel.addEventListener('animationend', function (event) {
            if (event.target === panel && event.animationName === 'field-panel-relight') { panel.classList.remove('is-relit'); }
        });

        /* 영상·캐릭터
        ------------------------------------------------------ */
        // 캐릭터는 영상과 함께 나타나고(is-active) 다 들어오면 점등되며(is-lit), 이전 캐릭터는 영상이 나갈 때 꺼지고 디졸브가 끝나면 점등을 푼다.
        function setCharacter(id, className, on) {
            var character = section.querySelector('.field-character[data-panel="' + id + '"]'); // 소재가 없는 탭은 null
            if (character) { character.classList.toggle(className, on); }
        }

        var videos = createTabVideos(wrapper, list, {
            onEnter: function (id) { setCharacter(id, 'is-active', true); },
            onEntered: function (id) {
                setCharacter(id, 'is-lit', true);
                if (stage.is('wait')) { stage.lightUp(LIT_AT); } // 처음 영상이 다 들어오면 섹션을 점등한다: 캐릭터에 이어 패널이 켜지고(css), 끝나면 ready.
            },
            onLeave: function (id) { setCharacter(id, 'is-active', false); },
            onLeft: function (id) { setCharacter(id, 'is-lit', false); }
        });
        if (!videos.count) { stage.remove(); return; } // 영상이 없으면 패널을 바로 보인다.

        // 탭을 고르면 패널을 그 탭 자리로 옮긴다 (영상은 createTabVideos 가 따라간다).
        list.addEventListener('tabchange', function (event) { moveTo(event.detail.tab.id.replace(/^field-tab-/, '')); });

        // 보이는 비율로 전원을 넣고 빼고, 처음 --start-ratio 만큼 보이면 시작한다. story 와 같은 기준 (body 의 공통값).
        watchSection(section, wrapper, {
            preload: videos.preload,
            power: function (on) {
                stage.setPower(on);
                videos.setPower(on);
            },
            start: videos.start
        });
    })();

    /* Item: 영상 없이 배경 그림만 있는 섹션. 보이는 비율로 켜고 끄는 것은 story·field 와 같아 watchSection 을 같이 쓴다.
       섹션이 --start-ratio 만큼 보이면 배경이 실루엣에서 깜빡이며 켜지고, 이어서 패널이 점등되며 아이템 아이콘이 하나씩 나타난다 (css).
       연출 단계는 html[data-item-stage] (wait → on). 정전(html[data-item-power]): 섹션이 --power-ratio 보다 덜 보이면
       배경이 꺼지고 패널은 실루엣으로 남으며, 다시 그만큼 보이면 바로 켜진다. 보이는 비율의 기준은 css body 의 공통값.
    ---------------------------------------------------------- */
    (function () {
        var stage = createStage('item');
        var section = document.querySelector('.section-item');
        if (!section) { stage.remove(); return; }

        watchSection(section, section, {
            power: stage.setPower,
            start: function () { stage.set('on'); }
        });
    })();

    /* Mission: item 처럼 영상 없이 배경 그림만 있는 섹션. 보이는 비율로 켜고 끄는 것은 watchSection 을 같이 쓴다.
       섹션이 --start-ratio 만큼 보이면 배경이 실루엣에서 깜빡이며 켜지고, 이어서 패널이 점등된다 (css).
       연출 단계는 html[data-mission-stage] (wait → on → ready). 점등이 끝나면 ready 가 되어, 미션을 넘길 때 새 내용이 통째로 떠오른다.
       정전(html[data-mission-power]): 섹션이 --power-ratio 보다 덜 보이면 배경이 꺼지고 패널은 실루엣으로 남으며, 다시 그만큼 보이면 바로 켜진다.
       보이는 비율의 기준은 css body 의 공통값. 미션·스크린샷 넘기기는 mission.js 의 Mission·Screenshot Slider 블록.
    ---------------------------------------------------------- */
    (function () {
        var stage = createStage('mission');
        var section = document.querySelector('.section-mission');
        if (!section) { stage.remove(); return; }

        // 점등이 끝나는 때: 패널 점등 시작 + 마지막 줄(화살표, css --n 4)이 다 떠오른 때
        var LIT_AT = litAt(bodySeconds('--mission-panel-delay', 0.5), bodySeconds('--mission-line-start', 1.45), 4);

        watchSection(section, section, {
            power: stage.setPower,
            start: function () { stage.lightUp(LIT_AT); } // 배경·패널이 켜지고(css), 끝나면 ready.
        });
    })();

    /* Character: 탭마다 배경 영상 묶음(.video-tab[data-panel])과 캐릭터(.character-figure[data-panel])가 있고, 선택된 탭의 것만 보인다 (createTabVideos).
       탭을 바꾸면 새 영상이 위로 디졸브돼 들어오고 캐릭터도 같이 나타나며, 이전 영상은 디졸브가 끝난 뒤 멈추고 캐릭터는 숨는다. field 와 같다.
       연출 단계는 html[data-character-stage] (wait → on → ready): 처음 영상이 다 들어오면 on 이 되어 패널이 점등되고(css), 끝나면 ready.
       정전(html[data-character-power]): 섹션이 --power-ratio 보다 덜 보이면 영상이 꺼지고 멈추며 캐릭터·패널은 실루엣으로 남는다. field 와 같다.
       보이는 비율의 기준은 css body 의 공통값. 탭 선택은 Tab 블록(tab.js)이 tablist 에 보내는 tabchange 이벤트로 받는다 (createTabVideos).
    ---------------------------------------------------------- */
    (function () {
        var stage = createStage('character');
        var section = document.querySelector('.section-character');
        var wrapper = section && section.querySelector('.character-video');
        var list = section && section.querySelector('[role="tablist"]');
        if (!wrapper || !list) { stage.remove(); return; } // 영상이 없으면 패널을 바로 보인다.
        stage.set('wait');

        // 점등이 끝나는 때: 패널 점등 시작 + 마지막 줄이 다 떠오른 때. 줄 번호(css --n)는 제목 0, 탭 1, 탭 패널 안의 줄이 2부터라
        // 가장 줄이 많은 탭 패널 기준으로 센다.
        var lines = 0;
        Array.prototype.forEach.call(section.querySelectorAll('.tab-panel'), function (each) { lines = Math.max(lines, each.children.length); });
        var LIT_AT = litAt(bodySeconds('--character-panel-delay', 0.5), bodySeconds('--character-line-start', 1.1), lines + 1);

        function setFigure(id, on) {
            var figure = section.querySelector('.character-figure[data-panel="' + id + '"]'); // 소재가 없는 탭은 null
            if (figure) { figure.classList.toggle('is-active', on); }
        }

        var videos = createTabVideos(wrapper, list, {
            onEnter: function (id) { setFigure(id, true); },
            onEntered: function () { if (stage.is('wait')) { stage.lightUp(LIT_AT); } }, // 처음 영상이 다 들어오면 섹션을 점등한다: 패널이 켜지고(css), 끝나면 ready.
            onLeave: function (id) { setFigure(id, false); }
        });
        if (!videos.count) { stage.remove(); return; } // 영상이 없으면 패널을 바로 보인다.

        watchSection(section, wrapper, {
            preload: videos.preload,
            power: function (on) {
                stage.setPower(on);
                videos.setPower(on);
            },
            start: videos.start
        });
    })();

    /* Raid: item 처럼 영상 없이 배경 그림만 있는 섹션. 보이는 비율로 켜고 끄는 것은 watchSection 을 같이 쓴다.
       섹션이 --start-ratio 만큼 보이면 배경이 실루엣에서 깜빡이며 켜지고, 이어서 패널이 점등된다 (css).
       연출 단계는 html[data-raid-stage] (wait → on). 정전(html[data-raid-power]): 섹션이 --power-ratio 보다 덜 보이면
       배경이 꺼지고 패널은 실루엣으로 남으며, 다시 그만큼 보이면 바로 켜진다. 보이는 비율의 기준은 css body 의 공통값.
    ---------------------------------------------------------- */
    (function () {
        var stage = createStage('raid');
        var section = document.querySelector('.section-raid');
        if (!section) { stage.remove(); return; }

        watchSection(section, section, {
            power: stage.setPower,
            start: function () { stage.set('on'); }
        });
    })();
})(window.Teaser);
