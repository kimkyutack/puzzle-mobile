const dialog = document.querySelector('.video-dialog');
const video = dialog.querySelector('video');
const videoTitle = dialog.querySelector('#video-title');
const videoError = dialog.querySelector('.video-error');
const closeVideo = dialog.querySelector('.video-close');
const dialogImage = dialog.querySelector('.dialog-image');
const dialogNavigation = dialog.querySelector('.dialog-navigation');
let opener;

function clearMedia() {
  video.pause();
  if (video.hasAttribute('src')) {
    video.removeAttribute('src');
    video.load();
  }
  dialogImage.removeAttribute('src');
}

function showMedia(title, source, isVideo) {
  clearMedia();
  videoTitle.textContent = title;
  videoError.hidden = true;
  video.hidden = !isVideo;
  dialogImage.hidden = isVideo;
  video.classList.toggle('portrait', isVideo && source.endsWith('puzzle-gameplay-v1.mp4'));
  if (isVideo) {
    video.src = source;
  } else {
    dialogImage.alt = title;
    dialogImage.src = source;
  }
  if (!dialog.open) {
    dialog.showModal();
    closeVideo.focus();
  }
  if (isVideo) video.play().catch(() => {});
}

document.querySelectorAll('[data-video]').forEach(link => {
  link.addEventListener('click', event => {
    if (typeof dialog.showModal !== 'function' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    dialogNavigation.hidden = true;
    showMedia(link.dataset.video, link.href, true);
  });
});

for (const media of [video, dialogImage]) {
  media.addEventListener('error', () => {
    if (dialog.open && !media.hidden && media.hasAttribute('src')) videoError.hidden = false;
  });
}
video.addEventListener('loadedmetadata', () => {
  video.classList.toggle('portrait', video.videoHeight > video.videoWidth);
});
closeVideo.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  const withinDialog = event.clientX >= bounds.left && event.clientX <= bounds.right &&
    event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  if (!withinDialog) dialog.close();
});
dialog.addEventListener('close', () => {
  clearMedia();
  opener?.focus();
});

for (const region of document.querySelectorAll('.media-preview, .media-library, .video-dialog')) {
  region.addEventListener('contextmenu', event => {
    if (event.target.closest('img, video, .media-card-action')) event.preventDefault();
  });
}

const mediaGrid = document.querySelector('[data-media-grid]');
if (mediaGrid && typeof dialog.showModal === 'function') {
  const entries = [...mediaGrid.children];
  const filters = document.querySelector('.media-filters');
  const count = filters.querySelector('.media-count');
  const empty = document.querySelector('.media-empty');
  const previous = dialogNavigation.querySelector('[data-gallery-step="-1"]');
  const next = dialogNavigation.querySelector('[data-gallery-step="1"]');
  const position = dialogNavigation.querySelector('span');
  const selected = {game: 'all', kind: 'all'};
  let visibleEntries = entries;
  let index = 0;

  function updateFilters() {
    visibleEntries = entries.filter(entry => {
      const matches = (selected.game === 'all' || entry.dataset.game === selected.game) &&
        (selected.kind === 'all' || entry.dataset.kind === selected.kind);
      entry.hidden = !matches;
      return matches;
    });
    count.textContent = visibleEntries.length + '개 자료';
    empty.hidden = visibleEntries.length !== 0;
  }

  function selectEntry(nextIndex) {
    const entry = visibleEntries[nextIndex];
    if (!entry) return;
    index = nextIndex;
    const button = entry.querySelector('[data-gallery-src]');
    dialogNavigation.hidden = false;
    previous.disabled = index === 0;
    next.disabled = index === visibleEntries.length - 1;
    position.textContent = (index + 1) + ' / ' + visibleEntries.length;
    showMedia(button.dataset.title, button.dataset.gallerySrc, entry.dataset.kind === 'video');
  }

  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    const {filter, value} = button.dataset;
    selected[filter] = value;
    for (const option of button.parentElement.children) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    updateFilters();
  });
  filters.hidden = false;

  mediaGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-src]');
    if (!button) return;
    opener = button;
    selectEntry(visibleEntries.indexOf(button.parentElement));
  });
  previous.addEventListener('click', () => selectEntry(index - 1));
  next.addEventListener('click', () => selectEntry(index + 1));
  dialog.addEventListener('keydown', event => {
    if (dialogNavigation.hidden || event.target === video) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      selectEntry(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });

  const linkedEntry = document.getElementById(location.hash.slice(1));
  if (linkedEntry?.parentElement === mediaGrid) {
    opener = linkedEntry.querySelector('[data-gallery-src]');
    selectEntry(visibleEntries.indexOf(linkedEntry));
  }
}

const premiere = document.querySelector('.premiere');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

const mediaCarousel = document.querySelector('.media-carousel');
if (mediaCarousel && mediaCarousel.firstElementChild.children.length > 1) {
  const track = mediaCarousel.firstElementChild;
  const cards = [...track.children];
  const bufferSize = 6;
  const cloneCard = card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelector('a').tabIndex = -1;
    return clone;
  };
  const leading = cards.slice(-bufferSize).map(cloneCard);
  const trailing = cards.slice(0, bufferSize).map(cloneCard);
  track.prepend(...leading);
  track.append(...trailing);

  let origin = 0;
  let step = 0;
  let targetIndex = null;
  let drag = null;
  let suppressClick = false;
  const currentIndex = () => step ? Math.round((mediaCarousel.scrollLeft - origin) / step) : 0;
  const wrappedIndex = index => (index % cards.length + cards.length) % cards.length;

  function measureCarousel() {
    const firstLeft = cards[0].getBoundingClientRect().left;
    const nextOrigin = firstLeft - leading[0].getBoundingClientRect().left;
    const nextStep = (trailing[0].getBoundingClientRect().left - firstLeft) / cards.length;
    if (!nextStep || (nextOrigin === origin && nextStep === step)) return;
    const index = wrappedIndex(targetIndex ?? currentIndex());
    origin = nextOrigin;
    step = nextStep;
    targetIndex = null;
    mediaCarousel.scrollLeft = origin + index * step;
  }

  function settleCarousel() {
    if (drag?.active) return;
    targetIndex = null;
    const index = currentIndex();
    if (index < 0 || index >= cards.length) {
      // Move from the repeated card to its matching position in the main list.
      mediaCarousel.scrollLeft += (wrappedIndex(index) - index) * step;
    }
  }

  function scrollToCard(index) {
    mediaCarousel.scrollTo({
      left: origin + index * step,
      behavior: motionPreference.matches ? 'instant' : 'smooth',
    });
  }

  function advanceCarousel(direction) {
    const index = targetIndex ?? currentIndex();
    const nextIndex = index + direction;
    const nextLeft = origin + nextIndex * step;
    if (nextLeft < -1 || nextLeft > mediaCarousel.scrollWidth - mediaCarousel.clientWidth + 1) {
      const wrapped = wrappedIndex(index);
      mediaCarousel.scrollLeft = origin + wrapped * step;
      targetIndex = wrapped + direction;
    } else {
      targetIndex = nextIndex;
    }
    scrollToCard(targetIndex);
  }

  measureCarousel();
  mediaCarousel.classList.add('is-looping');
  new ResizeObserver(measureCarousel).observe(mediaCarousel);

  const controls = document.querySelector('.media-carousel-controls');
  controls.hidden = false;
  for (const button of controls.querySelectorAll('[data-media-step]')) {
    button.addEventListener('click', () => advanceCarousel(Number(button.dataset.mediaStep)));
  }

  mediaCarousel.addEventListener('keydown', event => {
    if (event.target !== mediaCarousel || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    advanceCarousel(event.key === 'ArrowLeft' ? -1 : 1);
  });
  if ('onscrollend' in mediaCarousel) {
    mediaCarousel.addEventListener('scrollend', settleCarousel);
  } else {
    let scrollTimer;
    mediaCarousel.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(settleCarousel, 140);
    }, { passive: true });
  }

  mediaCarousel.addEventListener('pointerdown', event => {
    targetIndex = null;
    suppressClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, left: mediaCarousel.scrollLeft, active: false };
  });
  mediaCarousel.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (!drag.active) {
      if (Math.abs(distance) < 6) return;
      drag.active = true;
      mediaCarousel.setPointerCapture(event.pointerId);
      mediaCarousel.classList.add('is-dragging');
    }
    const left = drag.left - distance;
    const cycle = cards.length * step;
    const shift = Math.floor((left - origin) / cycle) * cycle;
    drag.left -= shift;
    mediaCarousel.scrollLeft = left - shift;
  });
  function endCarouselDrag(event) {
    if (drag?.id !== event.pointerId) return;
    const wasDragging = drag.active;
    drag = null;
    if (!wasDragging) return;
    suppressClick = true;
    const index = currentIndex();
    mediaCarousel.classList.remove('is-dragging');
    scrollToCard(index);
  }
  mediaCarousel.addEventListener('pointerup', endCarouselDrag);
  mediaCarousel.addEventListener('pointercancel', endCarouselDrag);
  mediaCarousel.addEventListener('lostpointercapture', endCarouselDrag);
  mediaCarousel.addEventListener('pointerleave', event => {
    if (!drag?.active) endCarouselDrag(event);
  });
  mediaCarousel.addEventListener('dragstart', event => event.preventDefault());
  mediaCarousel.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
  }, true);
}

if (premiere) {
  const tabList = premiere.querySelector('.premiere-tabs');
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const stage = premiere.querySelector('.premiere-stage');
  const motionButton = premiere.querySelector('[data-motion-toggle]');
  let selection = 0;
  let motionPaused = false;

  function updateMotion() {
    const enabled = !motionPaused && !motionPreference.matches;
    document.body.toggleAttribute('data-motion-paused', !enabled || document.hidden || dialog.open);
    const label = enabled ? '움직임 일시정지' : '움직임 재생';
    motionButton.hidden = motionPreference.matches;
    motionButton.classList.toggle('is-playing', enabled);
    motionButton.setAttribute('aria-label', label);
    motionButton.title = label;
    const film = panels[selection].querySelector('[data-loop]');
    if (!film) return;
    if (document.body.hasAttribute('data-motion-paused') ||
        !stage.classList.contains('motion-visible') || navigator.connection?.saveData) {
      film.pause();
      return;
    }
    if (!film.hasAttribute('src')) film.src = film.dataset.loop;
    film.play().catch(() => {});
  }

  function select(index) {
    if (index === selection) return;
    const previous = panels[selection];
    const poster = previous.querySelector('.project-wall').currentSrc;
    previous.querySelector('[data-loop]')?.pause();
    if (poster && !motionPreference.matches && !motionPaused) {
      stage.style.setProperty('--previous-scene', 'url(' + JSON.stringify(poster) + ')');
    }
    selection = index;
    for (const [i, tab] of tabs.entries()) {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    }
    updateMotion();
  }

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => select(index));
  }

  tabList.addEventListener('keydown', event => {
    const next = {
      ArrowRight: (selection + 1) % tabs.length,
      ArrowLeft: (selection + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
    tabs[next].focus();
  });

  let swipe;
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.pointerType !== 'touch' || event.target.closest('a, button')) return;
    swipe = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  stage.addEventListener('pointercancel', () => { swipe = undefined; });
  stage.addEventListener('pointerup', event => {
    if (event.pointerId !== swipe?.id) return;
    const x = event.clientX - swipe.x;
    const y = event.clientY - swipe.y;
    swipe = undefined;
    if (Math.abs(x) >= 55 && Math.abs(y) < Math.abs(x) * .65) {
      const step = x < 0 ? 1 : -1;
      select((selection + step + tabs.length) % tabs.length);
    }
  });

  let sceneFrame;
  stage.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || document.body.hasAttribute('data-motion-paused') || sceneFrame) return;
    sceneFrame = requestAnimationFrame(() => {
      const bounds = stage.getBoundingClientRect();
      stage.style.setProperty('--scene-x', ((event.clientX - bounds.left) / bounds.width - .5) * 18 + 'px');
      stage.style.setProperty('--scene-y', ((event.clientY - bounds.top) / bounds.height - .5) * 12 + 'px');
      sceneFrame = undefined;
    });
  }, {passive: true});
  stage.addEventListener('pointerleave', () => {
    if (sceneFrame) cancelAnimationFrame(sceneFrame);
    sceneFrame = undefined;
    stage.style.removeProperty('--scene-x');
    stage.style.removeProperty('--scene-y');
  });

  motionButton.addEventListener('click', () => {
    motionPaused = !motionPaused;
    updateMotion();
  });

  tabList.hidden = false;
  if ('IntersectionObserver' in window) {
    const motionObserver = new IntersectionObserver(([entry]) => {
      stage.classList.toggle('motion-visible', entry.intersectionRatio >= .24);
      updateMotion();
    }, {threshold: .24});
    motionObserver.observe(stage);
  } else {
    stage.classList.add('motion-visible');
  }
  updateMotion();
  document.addEventListener('visibilitychange', updateMotion);
  motionPreference.addEventListener('change', updateMotion);
  new MutationObserver(updateMotion).observe(dialog, {attributes: true, attributeFilter: ['open']});
}

if ('IntersectionObserver' in window && !motionPreference.matches) {
  const reveals = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('has-revealed');
      reveals.unobserve(entry.target);
    }
  }, {threshold: .1});
  document.querySelectorAll('[data-reveal]').forEach(element => reveals.observe(element));
}
