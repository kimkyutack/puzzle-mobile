export const gameplayPreviewJs = `
const card = document.querySelector('[data-gameplay-preview]');
const video = card.querySelector('video');
const toggle = card.querySelector('button');
const label = toggle.querySelector('[data-preview-label]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let playback = null;

function stop() {
  playback = null;
  video.pause();
  if (video.readyState > 0) video.currentTime = 0;
  card.removeAttribute('data-preview-playing');
  label.textContent = toggle.dataset.play;
}

function play(fromHover) {
  if (playback) return;
  const attempt = { fromHover };
  playback = attempt;
  if (!video.hasAttribute('src')) video.src = video.dataset.src;
  label.textContent = toggle.dataset.stop;
  video.play().catch(() => {
    if (playback === attempt) stop();
  });
}

video.addEventListener('playing', () => {
  if (playback && !video.paused) card.setAttribute('data-preview-playing', '');
});
video.addEventListener('error', () => {
  stop();
  video.removeAttribute('src');
});
card.addEventListener('pointerenter', event => {
  if (event.pointerType === 'mouse' && !reducedMotion.matches) play(true);
});
card.addEventListener('pointerleave', () => {
  if (playback?.fromHover) stop();
});
toggle.addEventListener('click', () => {
  if (playback) stop();
  else play(false);
});
card.addEventListener('keydown', event => {
  if (event.key === 'Escape' && playback) stop();
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && playback?.fromHover) stop();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
});
toggle.hidden = false;
`;
