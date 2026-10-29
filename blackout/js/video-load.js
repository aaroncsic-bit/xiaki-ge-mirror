/* ----------------------------------------------
 * HanbitSoft Infra Development Team
 * 아일리스 3차 업데이트 티저 Script - 영상 받기 (받기 줄, 로딩 표시)
 * Author - sgp8116@hanbitsoft.co.kr 261029
------------------------------------------------- */
/* Video Load (섹션 영상 받기와 로딩 표시. video.js 의 재생기가 쓴다)
-------------------------------------------------------------- */
(function (T) {
    var HAVE_METADATA = 1;    // readyState: 길이·크기를 알았음
    var NETWORK_LOADING = 2;  // networkState: 지금 받는 중

    // 정지 배경(마크업 data-poster)을 포스터로 건다. 첫 프레임과 같은 그림이라 영상이 그려지기 전과 영상이 못 오는 동안 그 자리에 보인다.
    function setPoster(video) {
        var poster = video.getAttribute('data-poster');
        if (poster && !video.getAttribute('poster')) { video.setAttribute('poster', poster); }
    }

    /* 받기: 곧 재생할 영상은 바로 받고(load), 지금 안 보이는 영상(루프 두 번째 복사본, 다른 탭, 다음 섹션의 첫 영상)은 줄을 서서(queueLoad)
       아무것도 받고 있지 않을 때 한 번에 하나씩 받는다. 여럿을 동시에 받으면 재생 중인 영상과 회선을 나눠 써 느린 회선에서 그 영상이 끊긴다.
       받던 영상을 다 받으면(또는 브라우저가 받기를 멈췄거나 오류가 나면) 줄의 다음 것을 받는다. 받는 중에 멈춘 영상이 줄을 막고 있어도
       곧 재생할 영상은 줄과 상관없이 바로 받는다. 그때 줄에서 시작한 미리 받기(speculative)가 진행 중이면 중단하고 줄 맨 앞으로 돌려보내
       (yieldLoads) 회선을 양보한다. 받던 부분은 버리고 나중에 처음부터 다시 받는다. 보고 있는 섹션이 먼저다. */
    var queue = [];
    var loads = []; // 지금 받는 영상들 { video, speculative, stop } (바로 받는 것과 줄에서 받는 것 모두. speculative = 줄에서 시작한 미리 받기)

    // 끝까지 받았다 (버퍼가 거의 끝까지 찼다).
    function isWhole(video) {
        var buffered = video.buffered;
        return !!(video.duration && buffered.length && buffered.end(buffered.length - 1) >= video.duration - 0.5);
    }

    // 다 받았거나 더 안 받는다: 오류, 끝까지 받음, 또는 길이를 안 뒤 브라우저가 받기를 멈춤(suspend. 틀면 다시 받는다).
    function isLoaded(video) {
        if (video.error || isWhole(video)) { return true; }
        return video.readyState >= HAVE_METADATA && video.networkState !== NETWORK_LOADING;
    }

    function indexOfLoad(video) {
        for (var i = 0; i < loads.length; i++) {
            if (loads[i].video === video) { return i; }
        }
        return -1;
    }

    // 받는 영상으로 센다. 다 받으면 빼고 줄의 다음 것을 받는다. 방금 load() 를 부른 영상(started)은 아직 받기 전이라 이벤트로만 판단한다
    // (load() 뒤에 오는 abort·emptied 는 이전 상태를 비우는 것이라 보지 않는다). 마크업에서 preload=auto 로 이미 받던 영상(hero intro)도 여기서 센다.
    function track(video, started, speculative) {
        if (indexOfLoad(video) >= 0 || (!started && isLoaded(video))) { return; }
        loads.push({
            video: video,
            speculative: speculative,
            stop: whenLoaded(video, function () {
                untrack(video);
                pump();
            })
        });
    }

    // 다 받으면(isLoaded) callback 을 한 번 부른다. 지금 상태는 보지 않고 이벤트로만 판단한다 (load() 직후엔 아직 받기 전이라).
    // 돌려주는 함수는 기다리기를 그만둔다.
    function whenLoaded(video, callback) {
        var events = ['progress', 'suspend', 'canplaythrough', 'loadeddata', 'error'];
        function stop() {
            for (var i = 0; i < events.length; i++) { video.removeEventListener(events[i], check); }
        }
        function check() {
            if (!isLoaded(video)) { return; }
            stop();
            callback();
        }
        for (var i = 0; i < events.length; i++) { video.addEventListener(events[i], check); }
        return stop;
    }

    function untrack(video) {
        var at = indexOfLoad(video);
        if (at < 0) { return; }
        loads[at].stop();
        loads.splice(at, 1);
    }

    // 지금 바로 받기 시작한다 (곧 틀 영상). 줄에 서 있었으면 빼내고, 진행 중인 미리 받기는 양보시킨다.
    function load(video) {
        startLoad(video, false);
    }

    // speculative: 줄에서 시작하는 미리 받기. 아니면 곧 틀 영상이라 다른 미리 받기를 양보시키고, 이미 미리 받는 중이었으면 곧 틀 것으로 올린다.
    function startLoad(video, speculative) {
        unqueue(video);
        var at = indexOfLoad(video);
        if (at >= 0 && !speculative) { loads[at].speculative = false; }
        if (!speculative) { yieldLoads(); }
        if (at >= 0) { return; }
        var started = video.preload !== 'auto';
        if (started) {
            setPoster(video);
            video.preload = 'auto';
            video.load();
        }
        track(video, started, speculative);
    }

    // 진행 중인 미리 받기를 모두 중단하고 줄 맨 앞으로 돌려보낸다. src 를 뗐다 붙여 받기를 끊고(받던 부분은 버려진다),
    // preload=none 으로 되돌려 두면 줄에서 차례가 올 때 처음부터 다시 받는다. 포스터는 그대로 남는다.
    function yieldLoads() {
        for (var i = loads.length - 1; i >= 0; i--) {
            if (!loads[i].speculative) { continue; }
            var video = loads[i].video;
            var src = video.getAttribute('src');
            untrack(video);
            video.preload = 'none';
            video.removeAttribute('src');
            video.load();
            video.setAttribute('src', src);
            queue.unshift(video);
        }
    }

    // 받기를 그만둔다 (건너뛴 1회 영상): 남은 부분이 회선을 차지하지 않게 한다. 다시 틀 수 없다.
    function cancel(video) {
        untrack(video);
        unqueue(video);
        video.removeAttribute('src');
        video.load();
        pump();
    }

    function unqueue(video) {
        var at = queue.indexOf(video);
        if (at >= 0) { queue.splice(at, 1); }
    }

    // first 면 줄 맨 앞에 서고 진행 중인 미리 받기를 양보시킨다 (지금 보는 섹션에서 곧 이어 틀 영상). 아니면 맨 뒤 (다른 탭, 다음 섹션).
    function queueLoad(video, first) {
        if (video.preload === 'auto' || queue.indexOf(video) >= 0) { return; }
        setPoster(video); // 그림은 작으니 바로 받아 둔다. 영상이 오기 전 탭을 바꿔도 이 그림이 디졸브돼 들어온다.
        if (first) {
            yieldLoads();
            queue.unshift(video);
        } else {
            queue.push(video);
        }
        pump();
    }

    // 아무것도 받고 있지 않으면 줄의 다음 것을 미리 받는다. 이미 다 받은 것이면 그다음으로 넘어간다.
    function pump() {
        while (!loads.length && queue.length) { startLoad(queue.shift(), true); }
    }

    /* 로딩 표시 (.loading)
    ---------------------------------------------------------- */
    // 영상을 다 받기를 기다리는 동안(재생기의 playWhenLoaded) 기다림이 --loading-delay(body)를 넘으면 화면 아래의 진행선을 보인다.
    // 진행은 맨 먼저 기다린 영상의 버퍼 비율(css --progress). 기다리던 영상을 다 받았거나 기다리기를 그만두면(꺼짐·건너뜀) 숨긴다.
    // 보통 회선에서는 그 전에 다 받아 한 번도 보이지 않는다.
    var loading = (function () {
        var box = document.querySelector('.loading');
        if (!box) { return { add: function () {}, remove: function () {} }; }
        var DELAY = T.bodySeconds('--loading-delay', 0.8);
        var waiting = []; // 기다리는 영상들 (먼저 기다린 순)
        var timer = 0;    // 보이기까지의 지연 타이머
        var ticker = 0;   // 진행 갱신 타이머
        var shown = false;

        function progress() {
            var video = waiting[0];
            var buffered = video.buffered;
            var ratio = video.duration && buffered.length ? buffered.end(buffered.length - 1) / video.duration : 0;
            box.style.setProperty('--progress', Math.min(1, ratio).toFixed(3));
        }

        function show() {
            timer = 0;
            shown = true;
            box.classList.add('is-shown');
            box.setAttribute('aria-hidden', 'false');
            progress();
            ticker = window.setInterval(progress, 100);
        }

        function hide() {
            window.clearTimeout(timer);
            window.clearInterval(ticker);
            timer = 0;
            ticker = 0;
            if (!shown) { return; }
            shown = false;
            box.classList.remove('is-shown');
            box.setAttribute('aria-hidden', 'true');
        }

        return {
            add: function (video) {
                if (waiting.indexOf(video) >= 0) { return; }
                waiting.push(video);
                if (!shown && !timer) { timer = window.setTimeout(show, DELAY * 1000); }
            },
            remove: function (video) {
                var at = waiting.indexOf(video);
                if (at < 0) { return; }
                waiting.splice(at, 1);
                if (!waiting.length) { hide(); }
            }
        };
    })();

    T.setPoster = setPoster;
    T.isWhole = isWhole;
    T.isLoaded = isLoaded;
    T.whenLoaded = whenLoaded;
    T.load = load;
    T.queueLoad = queueLoad;
    T.cancel = cancel;
    T.loading = loading;
})(window.Teaser);
