/* ----------------------------------------------
 * HanbitSoft Infra Development Team
 * 아일리스 3차 업데이트 티저 Script - 탭
 * Author - sgp8116@hanbitsoft.co.kr 261029
------------------------------------------------- */
/* Tab (탭: role="tablist" 안의 role="tab" 버튼이 aria-controls 로 가리키는 패널만 보여 준다)
-------------------------------------------------------------- */
// 선택 상태는 탭·패널 모두 is-active 로, 탭에는 aria-selected 로도 표시한다. 패널을 숨기고 보이는 것은 css(.is-active)가 한다.
// 키보드: 탭에 초점을 두고 ←→ 로 옆 탭, Home/End 로 첫·끝 탭을 고르면 그 탭이 바로 선택된다.
// 선택되지 않은 탭은 tabindex -1 이라 Tab 키로는 선택된 탭 하나만 거친다.
// 마크업의 role 속성만 보고 찾으므로 field·character 처럼 같은 마크업(.tab-list / .tab-panel)이면 어느 섹션이든 그대로 동작한다.
// 선택 표시(css .tab-list::before)가 미끄러질 자리로 tablist 에 --tab-count·--tab-index 를 적는다.
// 탭을 고를 때마다 tablist 에 tabchange 이벤트(detail: { tab, panel, index })를 보내, 다른 블록(field 배경 영상, character 배경·캐릭터)이 선택을 따라갈 수 있게 한다.
(function () {
    var lists = document.querySelectorAll('[role="tablist"]');
    if (!lists.length) { return; }

    function setup(list) {
        var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
        if (!tabs.length) { return; }
        list.style.setProperty('--tab-count', tabs.length);

        function tabOf(target) {
            var tab = target && target.closest ? target.closest('[role="tab"]') : null;
            return tab && tabs.indexOf(tab) !== -1 ? tab : null;
        }

        function panelOf(tab) {
            return document.getElementById(tab.getAttribute('aria-controls'));
        }

        function select(tab, focus) {
            tabs.forEach(function (each) {
                var selected = each === tab;
                var panel = panelOf(each);
                each.classList.toggle('is-active', selected);
                each.setAttribute('aria-selected', selected ? 'true' : 'false');
                each.setAttribute('tabindex', selected ? '0' : '-1');
                if (panel) { panel.classList.toggle('is-active', selected); }
            });
            list.style.setProperty('--tab-index', tabs.indexOf(tab));
            if (focus) { tab.focus(); }
            if (typeof CustomEvent === 'function') {
                list.dispatchEvent(new CustomEvent('tabchange', { bubbles: true, detail: { tab: tab, panel: panelOf(tab), index: tabs.indexOf(tab) } }));
            }
        }

        list.addEventListener('click', function (event) {
            var tab = tabOf(event.target);
            if (tab) { select(tab); }
        });

        list.addEventListener('keydown', function (event) {
            var tab = tabOf(event.target);
            if (!tab) { return; }
            var index = tabs.indexOf(tab);
            var next;
            if (event.key === 'ArrowLeft') { next = (index - 1 + tabs.length) % tabs.length; }
            else if (event.key === 'ArrowRight') { next = (index + 1) % tabs.length; }
            else if (event.key === 'Home') { next = 0; }
            else if (event.key === 'End') { next = tabs.length - 1; }
            else { return; }
            event.preventDefault();
            select(tabs[next], true);
        });

        // 마크업에서 is-active 인 탭(없으면 첫 탭)으로 시작해 탭·패널 상태를 맞춘다.
        var initial = tabs.filter(function (tab) { return tab.classList.contains('is-active'); })[0] || tabs[0];
        select(initial);
    }

    Array.prototype.forEach.call(lists, setup);
})();
