/* ----------------------------------------------
 * HanbitSoft Infra Development Team
 * 아일리스 3차 업데이트 티저 Script - 섹션 영상 (재생기, 정지 모드, 탭 배경 영상)
 * Author - sgp8116@hanbitsoft.co.kr 261029
------------------------------------------------- */
/* Section Video (1회 영상 순차 재생 → 루프 영상 반복)
-------------------------------------------------------------- */
// hero·story·field·character 섹션이 같은 재생기(createVideoSequence)를 쓴다. 래퍼(.section-video) 안의 .video-once 를 마크업 순서대로 한 번씩 튼 뒤
// .video-loop 두 복사본을 번갈아 디졸브하며 반복한다. 섹션마다 다른 연출(hero 정전, story 화면 진입, field·character 탭 전환)은 sections.js 에서 붙인다.
// 영상 받기(load·queueLoad)와 로딩 표시는 video-load.js 에 있다.
(function (T) {
    var HAVE_FUTURE_DATA = 3; // readyState: 지금 위치부터 이어서 재생할 데이터가 있음
    var START_MARGIN = 0.2;   // play() 뒤 첫 프레임이 나오기까지(두세 프레임) 기다리는 여유(초)
    var FADE_MARGIN = 0.1;    // 디졸브가 지금 영상이 끝나기 전에 마치도록 남겨 두는 여유(초)

    // 정지 모드: 데이터 절약(saveData)이나 움직임 줄이기(prefers-reduced-motion)를 켠 환경.
    // 정지 배경(마크업 data-poster)이 있는 섹션은 영상을 받지 않고 그 그림만 보인다 (createStillSequence). hero 는 정지 배경이 없어 그대로 재생한다.
    var STILL_ONLY = !!(navigator.connection && navigator.connection.saveData)
        || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // 다른 파일의 함수 (common.js, video-load.js)
    var readSeconds = T.readSeconds;
    var setPoster = T.setPoster;
    var isWhole = T.isWhole;
    var isLoaded = T.isLoaded;
    var whenLoaded = T.whenLoaded;
    var load = T.load;
    var queueLoad = T.queueLoad;
    var cancel = T.cancel;
    var loading = T.loading;

    function play(video, onFail) {
        var request = video.play();
        if (request && typeof request.catch === 'function') {
            request.catch(function () { if (onFail) { onFail(); } });
        }
    }

    // 다음 프레임이 그려질 때 재생 위치를 알려 준다. requestVideoFrameCallback 이 없으면 rAF 로 대신한다.
    function onFrame(video, callback) {
        if (typeof video.requestVideoFrameCallback === 'function') {
            video.requestVideoFrameCallback(function (now, metadata) { callback(metadata.mediaTime); });
        } else {
            window.requestAnimationFrame(function () { callback(video.currentTime); });
        }
    }

    // 매 프레임 재생 위치를 callback 에 넘긴다. callback 이 true 를 돌려주면 감시를 멈춘다.
    function everyFrame(video, callback) {
        onFrame(video, function (time) {
            if (!callback(time)) { everyFrame(video, callback); }
        });
    }

    // 영상을 투명하게(hiddenClass) 올린 뒤 shownClass 로 opacity 트랜지션을 시작한다.
    // transitionend 가 오거나 seconds 가 지나면 두 클래스를 벗기고 onEnd 를 한 번 부른다.
    // 돌려주는 함수는 트랜지션을 중단하고 두 클래스를 벗긴다(onEnd 는 부르지 않는다). 끝난 뒤에 다시 불러도 해가 없다.
    function fadeIn(video, hiddenClass, shownClass, seconds, onEnd) {
        var timer = 0;
        function stop() {
            window.clearTimeout(timer);
            video.removeEventListener('transitionend', end);
            video.classList.remove(hiddenClass);
            video.classList.remove(shownClass);
        }
        function end() {
            stop();
            onEnd();
        }
        video.classList.add(hiddenClass);
        void video.offsetWidth; // 스타일을 한 번 계산시켜 opacity 0 이 적용된 뒤에 트랜지션이 시작되게 한다. (rAF 대기만으로는 같은 프레임에 묶여 건너뛰는 경우가 있다.)
        video.classList.add(shownClass);
        video.addEventListener('transitionend', end);
        timer = window.setTimeout(end, seconds * 1000 + 100); // transitionend 가 안 와도 마무리한다.
        return stop;
    }

    /* 정지 모드 재생기 (STILL_ONLY)
    ---------------------------------------------------------- */
    // 영상을 받지 않고, 루프 영상 자리에 정지 배경(포스터)만 보인다. 재생기(createVideoSequence)와 같은 인터페이스라 섹션 코드는 둘을 구별하지 않는다.
    function createStillSequence(onces, loops, options) {
        var still = loops[0];
        var shown = false;
        var powerOn = null;

        function show() {
            if (shown) { return; }
            shown = true;
            for (var i = 0; i < onces.length; i++) { onces[i].classList.add('is-done'); }
            setPoster(still);
            still.classList.add('is-active');
            if (options.onLoopShown) { options.onLoopShown(); }
        }

        return {
            preload: function () { setPoster(still); },
            start: function () { if (options.onOnceEnded) { options.onOnceEnded(); } else { show(); } }, // 1회 영상은 없는 셈. onOnceEnded 를 넘긴 쪽은 startLoop 로 보인다.
            startLoop: show,
            finishOnce: function () {},
            setPower: function (on) {
                if (powerOn === on) { return false; }
                powerOn = on;
                return true;
            }
        };
    }

    /* 재생기
    ---------------------------------------------------------- */
    // 모든 영상은 다 받은 뒤에 튼다 (playWhenLoaded): 받으면서 틀면 느린 회선에서 더듬거린다. 받는 동안은 정지 배경(포스터)이 보인다.
    // 반복은 같은 영상 두 개를 번갈아 튼다. video 의 loop 속성은 되감을 때마다 한두 프레임 멈추고,
    // 이 영상들은 끝 프레임과 첫 프레임이 이어지지 않아 어떻게 맞춰도 되감는 순간 화면이 튄다.
    // 그래서 끝나기 전에 대기 영상을 미리 돌리고 그 위로 짧게 디졸브해 이음새를 감춘다.
    // 디졸브 길이와 배속은 래퍼의 css 변수 --loop-fade, --loop-rate 로 조절한다.
    // 래퍼에 --once-fade 가 있으면 마지막 1회 영상이 끝나기 그만큼 전에 루프 영상을 미리 돌려 그 위로 크로스 디졸브해 잇는다.
    // options.onOnceEnded: 마지막 1회 영상이 끝났을 때 부른다. 넘기면 호출한 쪽이 알맞은 때에 startLoop() 를 불러야 하고 크로스 디졸브는 쓰지 않는다.
    // options.onLoopShown: 루프 영상이 온전히 보이게 된 때(크로스 디졸브가 끝났거나, 없으면 첫 프레임이 그려진 때) 한 번 부른다.
    function createVideoSequence(wrapper, options) {
        var onces = wrapper.querySelectorAll('.video-once'); // 마크업 순서대로 한 번씩 재생
        var loops = wrapper.querySelectorAll('.video-loop');
        if (loops.length < 2) { return null; }
        options = options || {};
        if (STILL_ONLY && wrapper.querySelector('[data-poster]')) { return createStillSequence(onces, loops, options); } // 정지 배경이 있으면 정지 모드

        var style = window.getComputedStyle(wrapper);
        var FADE = readSeconds(style.getPropertyValue('--loop-fade'), 1);
        var RATE = parseFloat(style.getPropertyValue('--loop-rate')) || 1; // 루프 재생 배속
        var ONCE_FADE = readSeconds(style.getPropertyValue('--once-fade'), 0); // 1회 영상 → 루프 영상 크로스 디졸브 길이 (0 = 하드 컷)
        var TIMEOUT = readSeconds(style.getPropertyValue('--video-timeout'), 4); // 영상이 이만큼 프레임을 못 그리면 기다리지 않는다 (아래 시간 초과. 0 = 끝까지 기다림)

        var current = loops[0];   // 지금 보이는 루프 영상
        var next = loops[1];      // 첫 프레임에 멈춰 대기 중인 루프 영상
        var activeOnce = null;    // 지금 트는 1회 영상
        var resumeOnce = null;    // 꺼졌다 켜질 때 1회 영상을 이어 트는 함수
        var started = false;
        var loopStarted = false;
        var loopShown = false;
        var fading = false;       // 대기 영상을 미리 돌려 디졸브하는 중
        var stopFade = null;      // 그 디졸브를 중단하는 함수 (fadeIn 이 돌려줌. 트랜지션이 시작되기 전엔 null)
        var onceFading = false;   // 마지막 1회 영상 위로 루프 영상을 디졸브하는 중
        var stopEnter = null;     // 그 디졸브를 중단하는 함수
        var onceWatchToken = 0;
        var loopNotified = false; // onLoopShown 을 불렀는지
        var powerOn = null;       // 전원 (null = 아직 스위치가 안 붙음, false = 꺼짐: 멈추고 교대도 미룬다)
        var watchToken = 0;       // 프레임 감시 세대. 새로 걸면 이전 감시는 다음 콜백에서 멈춘다.
        var skipOnce = null;      // 지금 트는 1회 영상을 건너뛰는 함수 (시간 초과)
        var watchdog = 0;         // 시간 초과 타이머
        var watchdogFor = null;   // 그 타이머가 기다리는 영상
        var stalledVideo = null;  // 멈춘 시간을 합산 중인 영상
        var stalled = 0;          // 그 영상이 멈춰 있던 시간의 합(초). 영상이 바뀌면 0
        var stalledSince = 0;     // 이번 멈춤이 시작된 때 (Date.now(). 0 = 안 멈춤)
        var gracedVideo = null;   // 다 받은 뒤 한 번 더 기다려 준 영상
        var waits = [];           // 다 받기를 기다리는 재생 요청 { video, stop } (받은 뒤 재생)

        // 자동 재생 정책 때문에 속성과 별개로 스크립트에서도 음소거를 보장한다. waiting·playing 은 시간 초과(아래)가 본다.
        var i;
        for (i = 0; i < onces.length; i++) {
            onces[i].muted = true;
            onces[i].addEventListener('waiting', onWaiting);
            onces[i].addEventListener('playing', onPlaying);
        }
        for (i = 0; i < loops.length; i++) {
            loops[i].muted = true;
            loops[i].addEventListener('waiting', onWaiting);
            loops[i].addEventListener('playing', onPlaying);
            loops[i].loop = false; // 되감기는 아래 스크립트가 맡는다.
            loops[i].defaultPlaybackRate = RATE; // load() 가 playbackRate 를 이 값으로 되돌리므로 둘 다 맞춘다.
            loops[i].playbackRate = RATE;
            loops[i].addEventListener('ended', onLoopEnded);
        }
        current.addEventListener('playing', showLoop);

        /* 1회 영상: 순서대로 이어 재생
        ------------------------------------------------------ */
        // 다음 영상은 앞 영상이 재생되는 동안 미리 받아 두고(첫 영상 시작을 늦추지 않도록 재생된 뒤부터),
        // 앞 영상이 끝나면 바로 재생해 첫 프레임이 그려지는 순간 앞 영상을 끈다.
        // 자동 재생이 막히거나 파일이 깨졌으면 그 영상은 건너뛴다.

        /* 받은 뒤 재생: 다 받았으면(isLoaded) 바로 틀고, 아니면 다 받을 때 튼다. 기다리는 동안은 로딩 표시(loading)에 알린다.
           꺼지면(setPower) 기다리기를 그만두고 켜질 때 다시 요청한다.
        ------------------------------------------------------ */
        function playWhenLoaded(video, onFail) {
            stopWait(video); // 같은 영상의 이전 요청은 거둔다. 로딩 표시는 그대로 두어 다시 요청할 때 깜빡이지 않는다.
            if (isLoaded(video)) {
                loading.remove(video);
                play(video, onFail);
                return;
            }
            loading.add(video);
            waits.push({
                video: video,
                stop: whenLoaded(video, function () {
                    cancelWait(video);
                    play(video, onFail);
                })
            });
        }

        function stopWait(video) {
            for (var i = waits.length - 1; i >= 0; i--) {
                if (waits[i].video === video) {
                    waits[i].stop();
                    waits.splice(i, 1);
                }
            }
        }

        function cancelWait(video) {
            stopWait(video);
            loading.remove(video);
        }

        function cancelWaits() {
            while (waits.length) { cancelWait(waits[0].video); }
        }

        function playOnce(index) {
            var video = onces[index];
            if (!video) {
                activeOnce = null;
                resumeOnce = null;
                skipOnce = null;
                if (options.onOnceEnded) {
                    options.onOnceEnded();
                } else if (!onceFading) { // 크로스 디졸브 중이면 finishEnter 가 마무리한다.
                    startLoop();
                } else if (!loopShown) { // 크로스 디졸브로 미리 돌린 루프 영상이 아직 프레임을 못 그렸으면 이제 그 영상을 기다린다.
                    armWatchdog(current);
                }
                return;
            }

            var advanced = false;
            function advance() {
                if (advanced) { return; }
                advanced = true;
                disarmWatchdog();
                playOnce(index + 1);
            }
            // 시간 초과로 건너뛴다: 멈춘 그림을 치워(is-done) 아래 영상이나 정지 배경이 보이게 하고, 남은 부분은 더 받지 않고 다음으로 넘어간다.
            function skip() {
                cancelWait(video);
                video.pause();
                video.classList.add('is-done');
                cancel(video);
                advance();
            }
            function shown() {
                video.removeEventListener('playing', shown);
                if (index > 0) { onces[index - 1].classList.add('is-done'); }
                queueLoad(onces[index + 1] || loops[0], true); // 다음 영상은 이 영상을 다 받은 뒤 줄 맨 앞에서 받는다. 같이 받으면 느린 회선에서 이 영상이 끊긴다.
            }

            // 마지막 1회 영상은 끝나기 전에 루프 영상으로 크로스 디졸브한다(--once-fade 가 있고 onOnceEnded 를 안 넘겼을 때).
            var crossfade = index === onces.length - 1 && ONCE_FADE > 0 && !options.onOnceEnded;
            function run() {
                playWhenLoaded(video, advance); // 다 받은 뒤 튼다.
                armWatchdog(video); // 시간 안에 첫 프레임이 안 그려지면 건너뛴다.
                if (crossfade) { watchOnce(video); }
            }

            activeOnce = video;
            resumeOnce = run;
            skipOnce = skip;
            video.classList.add('is-playing');
            video.addEventListener('playing', shown);
            video.addEventListener('ended', advance);
            video.addEventListener('error', advance);
            load(video);
            if (powerOn !== false) { run(); } // 꺼져 있으면 켜질 때 튼다.
        }

        // 1회 영상을 모두 끈다. 루프 첫 프레임이 그려질 때 저절로 불리고, 미리 꺼야 하면(hero 정전) 직접 부른다.
        function finishOnce() {
            for (var k = 0; k < onces.length; k++) {
                onces[k].classList.add('is-done');
                onces[k].pause();
            }
            activeOnce = null;
            resumeOnce = null;
        }

        /* 1회 영상 → 루프 영상 크로스 디졸브 (--once-fade)
        ------------------------------------------------------ */
        // 마지막 1회 영상의 남은 시간을 매 프레임 확인해, 끝나기 전에 루프 영상을 돌리고 그 위로 디졸브한다.
        function watchOnce(video) {
            var token = ++onceWatchToken;
            everyFrame(video, function (time) {
                if (token !== onceWatchToken || video !== activeOnce || loopStarted || powerOn === false) { return true; }
                if (video.duration && video.duration - time <= ONCE_FADE + FADE_MARGIN) { enterLoop(); return true; }
                return false;
            });
        }

        // 루프 영상을 시작하고, 첫 프레임이 그려지면 1회 영상 위에 투명하게 올린 뒤 서서히 나타낸다.
        function enterLoop() {
            if (loopStarted) { return; }
            onceFading = true;
            startLoop();
            onFrame(current, function () {
                if (!onceFading) { return; }
                stopEnter = fadeIn(current, 'is-entering', 'is-shown', ONCE_FADE, finishEnter);
            });
        }

        // 디졸브가 끝나면 1회 영상을 끄고 루프 영상을 제자리(is-active)로 내린다.
        function finishEnter() {
            if (!onceFading) { return; }
            onceFading = false;
            if (stopEnter) { stopEnter(); stopEnter = null; }
            finishOnce();
            notifyLoopShown();
        }

        function notifyLoopShown() {
            if (loopNotified) { return; }
            loopNotified = true;
            if (options.onLoopShown) { options.onLoopShown(); }
        }

        /* 루프 영상: 두 복사본을 번갈아 디졸브
        ------------------------------------------------------ */
        // 대기 영상을 미리 돌린다. 첫 프레임이 그려진 뒤, 대기 영상의 위치가 지금 영상의 남은 시간과 같아지는 순간
        // (끝과 처음이 거울처럼 맞는 핑퐁 루프에서는 두 화면이 같은 그림이 되는 때)에 투명하게 위로 올린 뒤 디졸브를 시작한다.
        // 그 전에 남은 시간이 디졸브 길이(+여유)까지 줄면 더 기다리지 않는다. 대기 영상을 아직 다 못 받았으면(느린 회선) 시작하지 않는다 (onLoopEnded 가 되감아 잇는다).
        function startFade() {
            if (fading || powerOn === false || !isLoaded(next) || next.readyState < HAVE_FUTURE_DATA) { return false; }
            fading = true;
            play(next, cancelFade);
            everyFrame(next, function (time) {
                if (!fading) { return true; }
                var remaining = current.duration - current.currentTime; // 영상 시간 기준
                if (time < remaining && remaining > (FADE + FADE_MARGIN) * RATE) { return false; }
                stopFade = fadeIn(next, 'is-next', 'is-fading', FADE, finishFade);
                return true;
            });
            return true;
        }

        // 디졸브를 그만둔다. 트랜지션이 시작됐으면 중단하고 대기 영상을 다시 숨긴다.
        function cancelFade() {
            fading = false;
            if (stopFade) { stopFade(); stopFade = null; }
        }

        // 디졸브가 끝나면 앞뒤를 바꾸고, 끝난 영상은 0초로 되감아 다음 차례를 기다린다.
        function finishFade() {
            if (!fading) { return; }
            cancelFade();
            next.classList.add('is-active');
            current.classList.remove('is-active');
            current.pause();
            current.currentTime = 0;
            var finished = current;
            current = next;
            next = finished;
            watch(current);
        }

        // 매 프레임 남은 시간을 확인해, 디졸브가 끝나기 전에 영상이 끝나지 않도록 미리 시작한다.
        // 남은 시간은 영상 시간이라 배속을 곱해 실제 시간 기준으로 맞춘다.
        function watch(video) {
            var token = ++watchToken;
            everyFrame(video, function (time) {
                if (token !== watchToken || video !== current || fading || powerOn === false) { return true; }
                if (video.duration && video.duration - time <= (FADE + START_MARGIN) * RATE && startFade()) { return true; }
                return false;
            });
        }

        // 디졸브를 못 끝낸 채 끝났으면(탭이 숨겨져 프레임 콜백이 멈춘 경우 등) 지금 바로 바꾼다.
        function onLoopEnded() {
            if (this !== current) { return; }
            if (powerOn === false) { current.currentTime = 0; return; } // 꺼진 동안엔 되감아 두기만 한다.
            if (fading || startFade()) {
                finishFade();
            } else {
                current.currentTime = 0; // 대기 영상이 준비되지 않았으면 지금 영상을 되감아 잇는다.
                play(current);
            }
        }

        // 루프 영상이 실제로 그려지기 시작하면 1회 영상을 끄고(크로스 디졸브 중이면 finishEnter 가 끈다) 두 번째 복사본을 받기 시작한다.
        function showLoop() {
            if (loopShown) { return; }
            loopShown = true;
            if (!onceFading) {
                finishOnce();
                notifyLoopShown();
            }
            queueLoad(next, powerOn !== false); // 두 번째 복사본은 줄을 서서 받는다 (지금 영상과 회선을 나누지 않도록. 보고 있는 섹션이면 맨 앞). 아직이면 되감아 잇는다 (onLoopEnded).
            watch(current);
        }

        // 루프 영상의 자동 재생이 막히면 첫 프레임에 멈춘 채 남는다. 1회 영상은 끄고 다음 연출은 이어 간다.
        function onLoopPlayFail() {
            if (onceFading) { finishEnter(); } else { finishOnce(); notifyLoopShown(); }
        }

        function startLoop() {
            if (loopStarted) { return; }
            loopStarted = true;
            load(current);
            current.classList.add('is-active');
            if (powerOn !== false) {
                playWhenLoaded(current, onLoopPlayFail); // 다 받은 뒤 튼다.
                armWatchdog(current); // 시간 안에 첫 프레임이 안 그려지면 영상 없이 연출을 진행한다.
            }
        }

        /* 시간 초과 (--video-timeout): 느린 회선에서 영상이 안 와도 페이지가 멈추지 않게 한다
        ------------------------------------------------------ */
        // 영상을 틀려고 한 때부터(다 받기를 기다리는 시간 포함) 첫 프레임이 그려질 때까지 걸린 시간과, 재생 중 데이터가 끊겨 멈춰 있던(waiting) 시간을
        // 합쳐 이만큼이 되면: 1회 영상은 건너뛰고(hero 는 정전 연출로, story 는 루프 영상으로), 루프 영상이면 영상 없이 다음 연출을 진행한다
        // (onLoopPlayFail 과 같다. 정지 배경이 있으면 그 위에서). 영상은 그 뒤에 와도 제자리에서 이어서 그려진다. 꺼진 동안(setPower)은 기다리지 않는다.
        // 1회 영상을 건너뛴 뒤 루프 영상도 아직이면 또 기다리지 않는다 (기다림은 섹션마다 한 번. hero 는 정전 연출 뒤 루프를 따로 기다린다).
        // 다 받은 뒤 트므로 재생 중 멈춤은 드물지만(브라우저가 받기를 일찍 멈춘 영상), 그때는 짧게 끊기며 더듬거리므로 합산해서 본다.
        function armWatchdog(video) {
            disarmWatchdog();
            if (TIMEOUT <= 0 || powerOn === false) { return; }
            if (video !== stalledVideo) {
                stalledVideo = video;
                stalled = 0;
            }
            watchdogFor = video;
            stalledSince = Date.now();
            watchdog = window.setTimeout(function () {
                watchdog = 0;
                watchdogFor = null;
                stalledSince = 0;
                if (isWhole(video) && gracedVideo !== video) { // 그 사이 다 받았으면 곧 그려진다. 한 번만 처음부터 다시 기다린다.
                    gracedVideo = video;
                    stalled = 0;
                    armWatchdog(video);
                    return;
                }
                stalled = TIMEOUT;
                if (video === activeOnce && skipOnce) {
                    skipOnce();
                    // 건너뛰어 바로 시작된 루프 영상도 아직이면 또 기다리지 않고 정지 배경 위에서 연출을 진행한다 (기다림은 섹션마다 한 번).
                    if (loopStarted && !loopShown && !isLoaded(current)) {
                        disarmWatchdog();
                        onLoopPlayFail();
                    }
                } else if (video === current && loopStarted && !loopShown) {
                    onLoopPlayFail();
                }
            }, Math.max(0, TIMEOUT - stalled) * 1000);
        }

        // 기다리기를 멈춘다 (그려지기 시작했거나, 꺼졌거나, 다음 영상으로 넘어감). 멈춰 있던 시간은 합산해 둔다.
        function disarmWatchdog() {
            if (stalledSince) { stalled += (Date.now() - stalledSince) / 1000; }
            stalledSince = 0;
            window.clearTimeout(watchdog);
            watchdog = 0;
            watchdogFor = null;
        }

        // 재생 중 데이터가 끊겨 멈추면 다시 기다리기 시작한다 (1회 영상, 또는 아직 첫 프레임을 못 그린 루프 영상만).
        function onWaiting() {
            if (this === activeOnce || (this === current && loopStarted && !loopShown)) { armWatchdog(this); }
        }

        // 기다리던 영상이 그려지기 시작하면 그만 기다린다.
        function onPlaying() {
            if (this === watchdogFor) { disarmWatchdog(); }
        }

        /* 전원: 꺼지면 지금 트는 영상을 멈추고, 켜지면 멈춘 자리부터 잇는다. 상태가 바뀌었으면 true
        ------------------------------------------------------ */
        function setPower(on) {
            if (powerOn === on) { return false; }
            powerOn = on;
            // 크로스 디졸브 중에는 1회 영상과 루프 영상이 같이 돌고 있으므로 둘 다 다룬다.
            if (on) {
                if (resumeOnce) { resumeOnce(); } // 1회 영상을 이어 틀고 다시 기다린다 (run).
                if (loopStarted) {
                    playWhenLoaded(current);
                    watch(current); // 멈춰 있던 감시를 새로 건다.
                    if (!loopShown && !activeOnce) { armWatchdog(current); } // 아직 첫 프레임을 못 그린 루프 영상을 다시 기다린다.
                }
            } else {
                disarmWatchdog(); // 꺼진 동안은 기다리지 않는다.
                cancelWaits(); // 받기를 기다리던 재생 요청도 거둔다 (켜질 때 다시 요청한다).
                if (fading) { finishFade(); } // 교대 중이면 먼저 끝내고 멈춘다.
                if (activeOnce) { activeOnce.pause(); }
                if (loopStarted) {
                    current.pause();
                    next.pause();
                }
            }
            return true;
        }

        return {
            preload: function () { queueLoad(onces[0] || loops[0]); }, // 첫 영상을 줄을 서서 미리 받아 둔다. 시작(start)하면 줄과 상관없이 바로 받는다.
            start: function () { if (!started) { started = true; playOnce(0); } },
            startLoop: startLoop,
            finishOnce: finishOnce,
            setPower: setPower
        };
    }

    /* 탭 배경 영상 (field·character 공통)
    ---------------------------------------------------------- */
    // 래퍼(.section-video) 안에 탭마다 묶음(.video-tab, data-panel = 그 탭이 aria-controls 로 가리키는 패널 id)이 있고, 묶음마다 hero·story 와 같은 재생기를 쓴다.
    // select(패널 id) 로 고른 묶음만 보이고 재생된다: 새 영상의 첫 프레임이 그려진 뒤 is-active 가 붙어 위로 디졸브돼 들어오고(css --tab-fade),
    // 이전 묶음은 디졸브가 끝나면 숨고(css) 멈춘다. 고른 영상이 보이면 나머지 탭의 영상도 미리 받아 탭을 바꿀 때 기다리지 않게 한다.
    // 전원(setPower)과 시작(start)은 watchSection 을 거는 쪽이 넘긴다. 시작 전이거나 꺼져 있으면 고른 영상도 멈춰 있다가 켜질 때 튼다.
    // list(tablist)를 넘기면 탭 선택을 따라간다: 마크업에서 선택된 탭(없으면 첫 탭)으로 시작하고, Tab 블록(tab.js)이 보내는 tabchange 마다 그 탭의 패널을 고른다.
    // hooks(모두 선택, 인자는 패널 id): onEnter 새 묶음이 보이기 시작할 때, onEntered 다 들어왔을 때, onLeave 이전 묶음이 나가기 시작할 때, onLeft 다 나가 꺼졌을 때.
    function createTabVideos(wrapper, list, hooks) {
        hooks = hooks || {};
        var TAB_FADE = readSeconds(window.getComputedStyle(wrapper).getPropertyValue('--tab-fade'), 0.6); // 탭 전환 디졸브 길이

        var players = {};    // 패널 id → { id, wrapper, seq, shown, timer }
        var count = 0;
        var active = null;   // 고른 탭의 재생기
        var showing = null;  // 지금 보이는(is-active) 재생기. 새 영상은 첫 프레임이 그려진 뒤에 보이므로 active 와 다를 수 있다
        var visible = false; // 전원 (섹션이 --power-ratio 만큼 보이는지)
        var started = false; // 섹션이 처음 --start-ratio 만큼 보였는지

        function call(name, player) {
            if (hooks[name]) { hooks[name](player.id); }
        }

        Array.prototype.forEach.call(wrapper.querySelectorAll('[data-panel]'), function (each) {
            var player = { id: each.getAttribute('data-panel'), wrapper: each, seq: null, shown: false, timer: 0 }; // timer: 디졸브가 끝난 뒤 할 일
            player.seq = createVideoSequence(each, {
                onLoopShown: function () {
                    player.shown = true;
                    if (player === active) { enter(player); }
                    // Other tabs load only when selected.
                }
            });
            if (player.seq) {
                players[player.id] = player;
                count++;
            }
        });

        // 보이는 묶음을 바꾼다: 새 묶음이 위로 디졸브돼 들어오고, 이전 묶음은 디졸브가 끝나면 숨고(css) 멈춘다.
        function enter(player) {
            var previous = showing;
            if (previous === player) { return; }
            showing = player;
            player.wrapper.classList.add('is-active');
            call('onEnter', player);
            window.clearTimeout(player.timer);
            player.timer = window.setTimeout(function () { call('onEntered', player); }, TAB_FADE * 1000);
            if (!previous) { return; }
            previous.wrapper.classList.remove('is-active');
            call('onLeave', previous);
            window.clearTimeout(previous.timer);
            previous.timer = window.setTimeout(function () {
                if (previous === active) { return; } // 그 사이 다시 골랐으면 계속 튼다.
                previous.seq.setPower(false);
                call('onLeft', previous);
            }, TAB_FADE * 1000);
        }

        // 섹션이 시작된 뒤 고른 탭의 영상을 켜져 있으면 틀고(처음이면 시작, 멈춰 있었으면 이어서), 꺼져 있으면 멈춘다.
        function run() {
            if (!active || !started) { return; }
            active.seq.setPower(visible);
            if (visible) { active.seq.start(); }
        }

        // 고른 탭이 바뀌면 그 영상을 튼다. 이미 첫 프레임이 그려진 영상이면 바로 보이고, 아니면 그려질 때(onLoopShown) 보인다.
        // 앞서 고른 영상이 아직 첫 프레임도 못 그린 채 바뀌면 그 영상은 보일 일이 없으니 바로 멈춘다 (보이던 영상은 enter 가 디졸브 뒤에 멈춘다).
        function select(panelId) {
            var player = players[panelId];
            if (!player || player === active) { return; }
            var previous = active;
            active = player;
            if (previous && previous !== showing) { previous.seq.setPower(false); }
            if (player.shown) { enter(player); }
            run();
        }



        if (list) {
            list.addEventListener('tabchange', function (event) { select(event.detail.tab.getAttribute('aria-controls')); });
            // 마크업에서 선택된 탭(없으면 첫 탭)으로 시작한다. Tab 블록(tab.js)은 이 뒤에 읽혀 설정되며 같은 탭을 다시 알린다.
            var initial = list.querySelector('[role="tab"][aria-selected="true"]') || list.querySelector('[role="tab"].is-active') || list.querySelector('[role="tab"]');
            if (initial) { select(initial.getAttribute('aria-controls')); }
        }

        return {
            count: count, // 재생기가 붙은 묶음 수. 0 이면 영상이 없다
            preload: function () { if (active) { active.seq.preload(); } }, // 고른 탭의 첫 영상
            setPower: function (on) { visible = on; run(); },
            start: function () { started = true; run(); }
        };
    }

    T.createVideoSequence = createVideoSequence;
    T.createTabVideos = createTabVideos;
})(window.Teaser);
