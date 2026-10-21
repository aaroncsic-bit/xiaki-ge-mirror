const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
const progress = document.querySelector('.page-progress span');
const toast = document.querySelector('.toast');
const lightbox = document.querySelector('.lightbox');
const lightboxImage = lightbox.querySelector('img');

menuButton.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

nav.addEventListener('click', event => {
  if (event.target.matches('a')) {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
});

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = `${scrollable > 0 ? (scrollY / scrollable) * 100 : 0}%`;
}
addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

document.querySelectorAll('[data-copy-target]').forEach(button => {
  button.addEventListener('click', async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      toast.textContent = '安裝路徑已複製';
    } catch {
      toast.textContent = '請手動選取並複製路徑';
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  });
});

document.querySelectorAll('[data-lightbox]').forEach(button => {
  button.addEventListener('click', () => {
    lightboxImage.src = button.dataset.lightbox;
    lightboxImage.alt = button.querySelector('img')?.alt || '放大圖片';
    lightbox.showModal();
  });
});

lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => {
  if (event.target === lightbox) lightbox.close();
});

document.querySelectorAll('[data-tabs]').forEach(tabs => {
  const buttons = [...tabs.querySelectorAll('[role="tab"]')];
  const panels = [...tabs.querySelectorAll('[role="tabpanel"]')];
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      buttons.forEach(item => item.setAttribute('aria-selected', String(item === button)));
      panels.forEach(panel => { panel.hidden = panel.id !== button.getAttribute('aria-controls'); });
    });
  });
});

const observedSections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...document.querySelectorAll('#main-nav a')];

function updateActiveNavigation() {
  const headerHeight = document.querySelector('.topbar')?.offsetHeight || 0;
  const marker = scrollY + headerHeight + Math.min(innerHeight * .24, 150);
  let current = observedSections[0];

  observedSections.forEach(section => {
    if (section.offsetTop <= marker) current = section;
  });

  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current?.id}`);
  });
}

addEventListener('scroll', updateActiveNavigation, { passive: true });
addEventListener('resize', updateActiveNavigation);
addEventListener('hashchange', updateActiveNavigation);
updateActiveNavigation();

const cardArchiveLimit = 6;
const cardLayoutDemo = new URLSearchParams(location.search).get('card-demo') === '1';

function addDemoCards(section, grid) {
  if (!cardLayoutDemo) return;

  const sourceCard = grid.querySelector('.event-card');
  const kind = section.dataset.cardArchive;
  if (!sourceCard) return;

  const labels = kind === 'sea'
    ? ['最新 SEA 活動', 'SEA 活動第二則', 'SEA 活動第三則', 'SEA 活動第四則']
    : ['最新韓版資訊', '韓版資訊第二則', '韓版資訊第三則', '韓版資訊第四則'];

  labels.slice().reverse().forEach((label, reverseIndex) => {
    const index = labels.length - reverseIndex;
    const clone = sourceCard.cloneNode(true);
    const day = String(12 - index).padStart(2, '0');
    const link = clone.querySelector('a');
    const time = clone.querySelector('time');
    const title = clone.querySelector('h3');
    const description = clone.querySelector('p');

    clone.classList.add('demo-card');
    clone.dataset.demo = 'true';
    if (link) {
      link.href = `#${section.id}`;
      link.removeAttribute('target');
      link.setAttribute('aria-label', `${label}版面模擬卡片`);
    }
    if (time) {
      time.dateTime = `2026-10-${day}`;
      time.textContent = `2026.10.${day}`;
    }
    if (title) title.textContent = label;
    if (description) description.textContent = '此卡片僅用來預覽超過六則時的排列與按鈕。';
    grid.prepend(clone);
  });
}

function applyCenteredCardLayout(cards) {
  cards.forEach(card => card.classList.remove('grid-center-single', 'grid-center-pair-start', 'grid-center-pair-end'));
  const remainder = cards.length % 3;

  if (remainder === 1) {
    cards.at(-1)?.classList.add('grid-center-single');
  } else if (remainder === 2) {
    cards.at(-2)?.classList.add('grid-center-pair-start');
    cards.at(-1)?.classList.add('grid-center-pair-end');
  }
}

document.querySelectorAll('[data-card-archive]').forEach(section => {
  const grid = section.querySelector('[data-card-grid]');
  const controls = section.querySelector('[data-archive-controls]');
  const toggle = controls?.querySelector('.archive-toggle');
  const label = controls?.querySelector('[data-archive-label]');
  const count = controls?.querySelector('[data-archive-count]');
  if (!grid || !controls || !toggle || !label || !count) return;

  addDemoCards(section, grid);
  const cards = [...grid.querySelectorAll('.event-card')];

  cards.sort((a, b) => {
    const first = a.querySelector('time')?.dateTime || '';
    const second = b.querySelector('time')?.dateTime || '';
    return second.localeCompare(first);
  }).forEach(card => grid.append(card));

  const render = expanded => {
    cards.forEach((card, index) => { card.hidden = !expanded && index >= cardArchiveLimit; });
    const visibleCards = cards.filter(card => !card.hidden);
    applyCenteredCardLayout(visibleCards);
    toggle.setAttribute('aria-expanded', String(expanded));
    label.textContent = expanded ? '收起內容' : '展開更多';
    count.textContent = expanded ? '回到最新 6 筆' : `顯示全部 ${cards.length} 筆`;
  };

  if (cards.length <= cardArchiveLimit) {
    controls.hidden = true;
    applyCenteredCardLayout(cards);
    return;
  }

  controls.hidden = false;
  render(false);
  toggle.addEventListener('click', () => render(toggle.getAttribute('aria-expanded') !== 'true'));
});

document.querySelectorAll('[data-maintenance-panel]').forEach(panel => {
  const details = panel.querySelector('.maintenance-details');
  const toggles = [...panel.querySelectorAll('[data-maintenance-toggle]')];
  const label = panel.querySelector('[data-maintenance-label]');
  const hint = panel.querySelector('[data-maintenance-hint]');
  if (!details || !toggles.length) return;

  const render = expanded => {
    details.hidden = !expanded;
    toggles.forEach(toggle => toggle.setAttribute('aria-expanded', String(expanded)));
    if (label) label.textContent = expanded ? '收起更新內容' : '展開完整更新內容';
    if (hint) hint.textContent = expanded ? '保留維修時間，隱藏下方完整內容' : '問題修正、商城、新角色與活動異動';
  };

  render(false);
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      render(expanded);
      if (!expanded && toggle.hasAttribute('data-collapse-button')) {
        document.querySelector('#maintenance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
