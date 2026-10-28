const lightbox = document.querySelector('.image-lightbox');
const lightboxStage = lightbox?.querySelector('.image-lightbox__stage');
const lightboxImage = lightbox?.querySelector('img');
const lightboxClose = lightbox?.querySelector('.image-lightbox__close');
const zoomableImages = document.querySelectorAll('.media-frame img');

function openImageLightbox(image) {
  if (!lightbox || !lightboxImage || !lightboxStage) return;
  lightboxImage.src = image.currentSrc || image.src;
  lightboxImage.alt = image.alt || '放大圖片';
  lightboxStage.scrollTo({ top: 0, left: 0 });
  document.body.classList.add('lightbox-open');
  lightbox.showModal();
}

function closeImageLightbox() {
  if (!lightbox?.open) return;
  lightbox.close();
  document.body.classList.remove('lightbox-open');
  lightboxImage.removeAttribute('src');
}

zoomableImages.forEach(image => {
  image.classList.add('zoomable-image');
  image.setAttribute('role', 'button');
  image.setAttribute('tabindex', '0');
  image.setAttribute('aria-label', `${image.alt || '圖片'}，點擊放大`);
  image.closest('figure')?.classList.add('zoom-enabled');
  image.addEventListener('click', () => openImageLightbox(image));
  image.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openImageLightbox(image);
    }
  });
});

lightboxClose?.addEventListener('click', closeImageLightbox);
lightboxImage?.addEventListener('click', closeImageLightbox);
lightboxStage?.addEventListener('click', event => {
  if (event.target === lightboxStage) closeImageLightbox();
});
lightbox?.addEventListener('click', event => {
  if (event.target === lightbox) closeImageLightbox();
});
lightbox?.addEventListener('close', () => document.body.classList.remove('lightbox-open'));
