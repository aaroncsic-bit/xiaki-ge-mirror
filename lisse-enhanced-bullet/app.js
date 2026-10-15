document.querySelectorAll('.skill-gif').forEach((image) => {
  image.addEventListener('error', () => {
    const message = document.createElement('div');
    message.className = 'media-error';
    message.textContent = `動圖暫時無法載入：${image.alt}`;
    image.replaceWith(message);
  }, { once: true });
});

const quickNav = document.querySelector('.quick-nav');
const quickNavToggle = document.querySelector('.quick-nav-toggle');
const quickNavMenu = document.querySelector('#quick-nav-menu');

function closeQuickNav() {
  quickNavMenu.hidden = true;
  quickNavToggle.setAttribute('aria-expanded', 'false');
}

quickNavToggle.addEventListener('click', () => {
  const willOpen = quickNavMenu.hidden;
  quickNavMenu.hidden = !willOpen;
  quickNavToggle.setAttribute('aria-expanded', String(willOpen));
});

quickNavMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeQuickNav);
});

document.addEventListener('pointerdown', (event) => {
  if (!quickNav.contains(event.target)) closeQuickNav();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeQuickNav();
    quickNavToggle.focus();
  }
});

const sectionLinks = [...document.querySelectorAll('[data-section-link]')];
const sectionIds = [...new Set(sectionLinks.map((link) => link.getAttribute('href').slice(1)))];
const trackedSections = sectionIds
  .map((id) => document.getElementById(id))
  .filter(Boolean);

function updateActiveSection() {
  const marker = window.scrollY + document.querySelector('.site-header').offsetHeight + 36;
  let currentId = trackedSections[0]?.id;

  trackedSections.forEach((section) => {
    if (section.offsetTop <= marker) currentId = section.id;
  });

  sectionLinks.forEach((link) => {
    const active = link.getAttribute('href') === `#${currentId}`;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  window.requestAnimationFrame(() => {
    updateActiveSection();
    scrollTicking = false;
  });
}, { passive: true });

window.addEventListener('resize', updateActiveSection);
window.addEventListener('load', updateActiveSection);
updateActiveSection();
