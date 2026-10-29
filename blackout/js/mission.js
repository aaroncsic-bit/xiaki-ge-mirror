/* ----------------------------------------------
 * HanbitSoft Infra Development Team
 * 아일리스 3차 업데이트 티저 Script - 미션 (미션 캐러셀, 스크린샷 슬라이더·크게 보기)
 * Author - sgp8116@hanbitsoft.co.kr 261029
------------------------------------------------- */
/* Mission (미션 캐러셀: 양옆 화살표로 미션을 넘기면 패널 내용과 배경이 함께 바뀐다)
-------------------------------------------------------------- */
// 미션(.mission-item)과 배경(.mission-bg-item)은 마크업 순서대로 짝이 된다. 선택된 짝만 is-active 로 보이고(css),
// 배경은 새 그림이 위로 디졸브돼 들어오며 패널 내용은 떠오른다. 양 끝에서는 반대쪽 끝으로 이어진다. 미션이 하나뿐이면 화살표는 아무 일도 하지 않는다.
(function () {
    var section = document.querySelector('.section-mission');
    if (!section) { return; }
    var items = section.querySelectorAll('.mission-item');
    var backgrounds = section.querySelectorAll('.mission-bg-item');
    var prev = section.querySelector('.mission-prev');
    var next = section.querySelector('.mission-next');
    if (!items.length) { return; }

    var index = -1;

    function select(n) {
        n = ((n % items.length) + items.length) % items.length;
        if (n === index) { return; }
        index = n;
        for (var i = 0; i < items.length; i++) { items[i].classList.toggle('is-active', i === n); }
        for (i = 0; i < backgrounds.length; i++) { backgrounds[i].classList.toggle('is-active', i === n); }
    }

    if (prev) { prev.addEventListener('click', function () { select(index - 1); }); }
    if (next) { next.addEventListener('click', function () { select(index + 1); }); }

    // 마크업에서 is-active 인 미션(없으면 첫 미션)으로 시작해 배경도 맞춘다.
    var initial = 0;
    for (var i = 0; i < items.length; i++) {
        if (items[i].classList.contains('is-active')) { initial = i; break; }
    }
    select(initial);
})();

/* Screenshot Slider (스크린샷 캐러셀: ‹ › 로 한 장씩 넘기고, 돋보기를 누르면 크게 본다)
-------------------------------------------------------------- */
// .screenshot-slider 마다 하나. 목록(.screenshot-list)을 장 너비(100%)씩 옮겨(transform) 보이는 장을 바꾸고, 양 끝에서는 반대쪽 끝으로 이어진다.
// 보이는 장은 is-active. 쪽수(.screenshot-current / .screenshot-total)는 장 수로 적는다. 장 수는 넘길 때마다 다시 세어, 나중에 장을 더 넣어도 그대로 동작한다.
// 돋보기(.screenshot-zoom)는 그 장의 그림을 크게 보기(.lightbox)로 연다. 그림은 원본 크기 한 장뿐이고 틀에서는 css 가 줄여 보이므로 크게 보기도 같은 그림을 쓴다.
// 크게 보기는 페이지에 하나. 연 캐러셀의 장들을 ‹ › 와 ←→ 로 넘기고, 닫기·Esc·그림 바깥을 누르면 닫히며 초점은 눌렀던 돋보기로 돌아간다.
// 열려 있는 동안 Tab 키 초점은 크게 보기 안의 버튼만 돈다 (뒤 페이지로 나가지 않는다).
(function () {
    var sliders = document.querySelectorAll('.screenshot-slider');
    if (!sliders.length) { return; }

    function wrap(n, length) { return ((n % length) + length) % length; }

    function itemsOf(slider) { return slider.querySelectorAll('.screenshot-item'); }

    // 장의 그림: li 바로 아래 첫 img (돋보기 안의 아이콘 img 는 제외)
    function pictureOf(item) {
        for (var i = 0; i < item.children.length; i++) {
            if (item.children[i].tagName === 'IMG') { return item.children[i]; }
        }
        return null;
    }

    /* 크게 보기
    ---------------------------------------------------------- */
    var lightbox = document.querySelector('.lightbox');
    var large = lightbox && {
        image: lightbox.querySelector('.lightbox-image'),
        current: lightbox.querySelector('.lightbox-current'),
        total: lightbox.querySelector('.lightbox-total'),
        close: lightbox.querySelector('.lightbox-close'),
        items: [],    // 연 캐러셀의 장들
        index: 0,
        opener: null  // 눌렀던 돋보기. 닫을 때 초점을 돌려준다.
    };

    function showLarge(n) {
        large.index = wrap(n, large.items.length);
        var picture = pictureOf(large.items[large.index]);
        large.image.src = picture ? picture.currentSrc || picture.src : '';
        large.image.alt = picture ? picture.alt : '';
        if (large.current) { large.current.textContent = large.index + 1; }
        if (large.total) { large.total.textContent = large.items.length; }
    }

    function openLarge(slider, n, opener) {
        large.items = Array.prototype.slice.call(itemsOf(slider));
        large.opener = opener;
        showLarge(n);
        lightbox.hidden = false;
        document.body.style.overflow = 'hidden'; // 뒤 페이지가 스크롤되지 않게
        if (large.close) { large.close.focus(); }
    }

    function closeLarge() {
        if (lightbox.hidden) { return; }
        lightbox.hidden = true;
        document.body.style.overflow = '';
        large.image.removeAttribute('src'); // 다음에 열 때 이전 그림이 잠깐 보이지 않게
        if (large.opener) { large.opener.focus(); }
    }

    // 초점을 크게 보기 안에 가둔다: Tab 은 마지막 버튼에서 첫 버튼으로, Shift+Tab 은 첫 버튼에서 마지막 버튼으로 돈다.
    // 초점이 밖에 있으면(그림을 눌러 초점이 빠졌을 때 등) 가는 방향의 끝 버튼으로 데려온다.
    function trapFocus(event) {
        var buttons = lightbox.querySelectorAll('button');
        if (!buttons.length) { return; }
        var first = buttons[0];
        var last = buttons[buttons.length - 1];
        var focused = document.activeElement;
        var inside = lightbox.contains(focused);
        if (event.shiftKey ? (!inside || focused === first) : (!inside || focused === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
        }
    }

    if (lightbox) {
        lightbox.addEventListener('click', function (event) {
            var target = event.target;
            if (target.closest('.lightbox-prev')) { showLarge(large.index - 1); }
            else if (target.closest('.lightbox-next')) { showLarge(large.index + 1); }
            else if (target.closest('.lightbox-close') || !target.closest('.lightbox-figure')) { closeLarge(); }
        });
        document.addEventListener('keydown', function (event) {
            if (lightbox.hidden) { return; }
            if (event.key === 'Tab') { trapFocus(event); return; }
            if (event.key === 'Escape') { closeLarge(); }
            else if (event.key === 'ArrowLeft') { showLarge(large.index - 1); }
            else if (event.key === 'ArrowRight') { showLarge(large.index + 1); }
            else { return; }
            event.preventDefault();
        });
    }

    /* 캐러셀
    ---------------------------------------------------------- */
    function setup(slider) {
        var list = slider.querySelector('.screenshot-list');
        var current = slider.querySelector('.screenshot-current');
        var total = slider.querySelector('.screenshot-total');
        if (!list) { return; }
        var index = 0;

        function show(n) {
            var items = itemsOf(slider);
            if (!items.length) { return; }
            index = wrap(n, items.length);
            list.style.transform = 'translateX(' + (-100 * index) + '%)';
            for (var i = 0; i < items.length; i++) { items[i].classList.toggle('is-active', i === index); }
            if (current) { current.textContent = index + 1; }
            if (total) { total.textContent = items.length; }
        }

        slider.addEventListener('click', function (event) {
            var target = event.target;
            if (target.closest('.screenshot-prev')) { show(index - 1); return; }
            if (target.closest('.screenshot-next')) { show(index + 1); return; }
            var zoom = target.closest('.screenshot-zoom');
            if (!zoom || !lightbox) { return; }
            openLarge(slider, Array.prototype.indexOf.call(itemsOf(slider), zoom.closest('.screenshot-item')), zoom);
        });

        show(0);
    }

    Array.prototype.forEach.call(sliders, setup);
})();
