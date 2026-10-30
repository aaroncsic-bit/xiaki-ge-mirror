/* Phone-only preview. Desktop exits before changing DOM, styles or listeners. */
(function () {
    'use strict';
    var phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!phone) return;

    var root = document.documentElement;
    var sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = new URL('../css/mobile-preview.css?v=1', document.currentScript.src).href;
    document.head.appendChild(sheet);
    root.classList.add('blackout-mobile');
    function size() {
        var scale = Math.min(root.clientWidth / 1600, 1);
        if (Number(root.style.getPropertyValue('--bo-preview-scale')) === scale) return;
        root.style.setProperty('--bo-preview-scale', scale);
    }
    sheet.addEventListener('load', size);
    size();
    new ResizeObserver(size).observe(root);

    document.addEventListener('DOMContentLoaded', function () {
        var labels = { hero: 'BLACKOUT', story: 'STORY 故事', field: 'FIELD 機體', item: 'ITEM 裝備', mission: 'MISSION 任務', character: 'CHARACTER 角色', raid: 'RAID 塞爾維托爾' };
        var sections = Array.from(document.querySelectorAll('main > .section'));
        var current = sections[0];
        var toolbar = document.createElement('div');
        toolbar.className = 'bo-mobile-toolbar';
        toolbar.setAttribute('role', 'navigation');
        toolbar.setAttribute('aria-label', '手機預覽操作');
        toolbar.innerHTML = '<div class="bo-mobile-row"><select aria-label="選擇章節"></select><button type="button" class="bo-mobile-read">放大說明</button><button type="button" class="bo-mobile-sound" aria-label="背景音樂" aria-pressed="false">音樂</button><a class="bo-mobile-home" aria-label="韓版官方原頁">HOME</a></div><div class="bo-mobile-choices" hidden><select aria-label="選擇本區分頁"></select><button type="button" class="bo-mobile-picture" hidden>看截圖</button></div><p class="bo-mobile-hint">橫向觀看更清楚，也可雙指放大</p>';
        document.body.insertBefore(toolbar, document.body.firstChild);
        new ResizeObserver(function () {
            root.style.setProperty('--bo-toolbar-height', toolbar.offsetHeight + 'px');
        }).observe(toolbar);
        var chapter = toolbar.querySelector('select');
        var choices = toolbar.querySelector('.bo-mobile-choices');
        var variant = choices.querySelector('select');
        var read = toolbar.querySelector('.bo-mobile-read');
        var picture = toolbar.querySelector('.bo-mobile-picture');
        var sound = toolbar.querySelector('.bo-mobile-sound');
        var originalSound = document.querySelector('.bgm-toggle');
        toolbar.querySelector('.bo-mobile-home').href = document.querySelector('.link-home').href;
        sections.forEach(function (section) { chapter.add(new Option(labels[section.id], section.id)); });

        var reader = document.createElement('dialog');
        reader.className = 'bo-mobile-reader';
        reader.setAttribute('aria-labelledby', 'bo-mobile-reader-title');
        reader.innerHTML = '<header><h2 id="bo-mobile-reader-title"></h2><button type="button" aria-label="關閉說明">關閉</button></header><div class="bo-mobile-copy"></div>';
        document.body.appendChild(reader);
        reader.querySelector('button').addEventListener('click', function () { reader.close(); });
        reader.addEventListener('click', function (event) { if (event.target === reader) reader.close(); });
        var savedOverflow;
        reader.addEventListener('close', function () { document.body.style.overflow = savedOverflow; read.focus({ preventScroll: true }); });

        function tabs() { return Array.from(current.querySelectorAll('[role="tab"]')); }
        function missions() { return Array.from(current.querySelectorAll('.mission-item')); }
        function refreshChoices() {
            var items = tabs(), isMission = current.id === 'mission';
            if (isMission) items = missions();
            choices.hidden = !items.length;
            picture.hidden = !isMission;
            variant.replaceChildren();
            items.forEach(function (item, index) {
                var text = isMission ? item.querySelector('h3').textContent : item.textContent;
                var option = new Option(text.trim(), String(index));
                option.selected = item.classList.contains('is-active');
                variant.add(option);
            });
            read.disabled = current.id === 'hero';
        }
        function setCurrent(section) {
            if (section === current) return;
            current = section;
            chapter.value = section.id;
            refreshChoices();
        }
        var queued = false;
        var resizeAnchor = null, resizeFrame = 0;
        function trackSection() {
            queued = false;
            if (resizeAnchor) return;
            var line = toolbar.getBoundingClientRect().bottom + Math.min(120, innerHeight / 4);
            var selected = sections.find(function (section) {
                var box = section.getBoundingClientRect();
                return box.top <= line && box.bottom > line;
            });
            if (selected) setCurrent(selected);
        }
        window.addEventListener('scroll', function () {
            if (!queued) { queued = true; requestAnimationFrame(trackSection); }
        }, { passive: true });
        window.addEventListener('resize', function () {
            if (!resizeAnchor) resizeAnchor = current;
            size();
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(function () {
                window.scrollTo(0, resizeAnchor.getBoundingClientRect().top + window.scrollY - toolbar.offsetHeight);
                resizeAnchor = null;
                trackSection();
            });
        }, { passive: true });
        chapter.addEventListener('change', function () {
            setCurrent(document.getElementById(chapter.value));
            root.style.setProperty('--bo-toolbar-height', toolbar.offsetHeight + 'px');
            window.scrollTo(0, current.getBoundingClientRect().top + window.scrollY - toolbar.offsetHeight);
            var url = new URL(window.location.href);
            url.hash = current.id;
            history.replaceState(null, '', url.href);
        });
        variant.addEventListener('change', function () {
            var index = Number(variant.value), items = tabs();
            if (items.length) items[index].click();
            else {
                var list = missions(), active = list.findIndex(function (item) { return item.classList.contains('is-active'); });
                for (var i = 0; i < (index - active + list.length) % list.length; i++) current.querySelector('.mission-next').click();
            }
            refreshChoices();
        });
        document.addEventListener('tabchange', refreshChoices);
        document.querySelectorAll('.mission-prev, .mission-next').forEach(function (button) {
            button.addEventListener('click', refreshChoices);
        });
        current = sections[0];
        refreshChoices();
        trackSection();

        read.addEventListener('click', function () {
            var copy = reader.querySelector('.bo-mobile-copy');
            copy.replaceChildren();
            reader.querySelector('h2').textContent = labels[current.id] + (choices.hidden ? '' : ' · ' + variant.selectedOptions[0].textContent);
            // Read the current source content; no separately maintained translation.
            current.querySelectorAll('.content-wrapper h3, .content-wrapper p, .content-wrapper .item-list li, .content-wrapper .tab-list:not([role]) .tab').forEach(function (source) {
                var panel = source.closest('.tab-panel, .mission-item');
                if (panel && !panel.classList.contains('is-active')) return;
                var paragraph = document.createElement(source.tagName === 'H3' ? 'h3' : 'p');
                var clone = source.cloneNode(true);
                clone.querySelectorAll('br').forEach(function (br) { br.replaceWith('\n'); });
                paragraph.textContent = clone.textContent.trim();
                copy.appendChild(paragraph);
            });
            savedOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            reader.showModal();
            copy.scrollTop = 0;
        });
        picture.addEventListener('click', function () {
            var button = current.querySelector('.mission-item.is-active .screenshot-item.is-active .screenshot-zoom');
            if (button) button.click();
        });
        sound.addEventListener('click', function () { originalSound.click(); });
        function syncSound() {
            var on = originalSound.getAttribute('aria-pressed') === 'true';
            sound.setAttribute('aria-pressed', String(on));
            sound.setAttribute('aria-label', on ? '關閉背景音樂' : '開啟背景音樂');
            sound.textContent = on ? '靜音' : '音樂';
        }
        new MutationObserver(syncSound).observe(originalSound, { attributes: true, attributeFilter: ['aria-pressed'] });
        syncSound();
    });
})();
