export const homeCss = `
.home-page {
  --hero-navy: #102541;
  --hero-accent: #b8dfff;
}

.game-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  min-height: clamp(560px, 47vw, 730px);
  overflow: hidden;
  background: var(--hero-navy);
  color: #fff;
}

.hero-art {
  display: block;
  position: absolute;
  inset: 0 0 0 auto;
  width: 79%;
  z-index: -2;
}
.hero-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 55% 54%;
}
.game-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(0deg, #102541a6, transparent 23%),
    linear-gradient(90deg, var(--hero-navy) 21%, #102541f5 27%, #102541b0 38%, #10254153 46%, #10254119 55%, transparent 70%);
}

.hero-wrap { padding-block: 40px 64px; }
.hero-copy { width: min(46%, 550px); }
.genre {
  color: var(--hero-accent);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .045em;
}
.hero-logo {
  margin: 14px -6px 17px;
  max-width: 550px;
  line-height: 1.1;
}
.hero-logo img {
  width: 100%;
  height: auto;
  filter: drop-shadow(0 12px 20px #09172188);
}
.hero-tagline {
  font-size: clamp(24px, 2.7vw, 38px);
  font-weight: 850;
  letter-spacing: -.05em;
  line-height: 1.22;
  text-wrap: balance;
}
.hero-description {
  max-width: 420px;
  margin-top: 11px;
  color: #e6efff;
  font-size: clamp(15px, 1.35vw, 17px);
  line-height: 1.7;
}
.stores {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 25px;
}
.store-badge {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 152px;
  min-height: 56px;
  padding: 9px 14px;
  border: 1px solid #d9e6f9;
  border-radius: 12px;
  background: #fff;
  color: #152b49;
  text-align: left;
  text-decoration: none;
  line-height: 1.15;
  box-shadow: 0 8px 19px #07193140;
}
.store-badge:disabled { opacity: 1; cursor: default; }
.store-badge[href]:hover { background: #eaf4ff; border-color: #9cc6f4; }
.store-badge:focus-visible { outline-color: var(--hero-accent); }
.store-badge svg { width: 25px; height: 25px; flex: none; }
.store-badge small { display: block; margin-bottom: 3px; color: #536985; font-size: 10px; }
.store-badge strong { display: block; font-size: 16px; white-space: nowrap; }

.feature-section {
  padding-block: 45px 68px;
  background: linear-gradient(180deg, #edf5ff, #f8fbff);
}
.feature-heading {
  margin-bottom: 24px;
  font-size: clamp(24px, 3.3vw, 41px);
  line-height: 1.2;
  letter-spacing: -.045em;
  text-wrap: balance;
}
.features-grid {
  display: grid;
  grid-template-columns: 1.13fr 1fr;
  grid-template-rows: repeat(2, minmax(262px, auto));
  gap: 15px;
}
.feature {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: flex-end;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #b9cce5;
  border-radius: 20px;
  background: #28466c;
  box-shadow: 0 12px 26px #294b791a;
}
.feature::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(0deg, #102039 2%, #102039e0 22%, #1020394d 48%, transparent 67%);
}
.feature-art { position: absolute; inset: 0; z-index: -2; }
.feature-image { width: 100%; height: 100%; object-fit: cover; }
.feature--garden .feature-image { object-position: 50% 46%; }
.feature--expedition .feature-image { object-position: 50% 45%; }
.feature-copy { width: 100%; padding: 22px 24px; }
.feature-copy h3 {
  color: #fff;
  font-size: clamp(21px, 2.3vw, 28px);
  line-height: 1.18;
  letter-spacing: -.04em;
}
.feature-copy p {
  max-width: 420px;
  margin-top: 7px;
  color: #eaf2ff;
  font-size: 14px;
  line-height: 1.55;
}

.feature--puzzle {
  grid-row: span 2;
  background: radial-gradient(ellipse at 56% 42%, #6e9fd4, #355987 56%, #1c365c 95%);
}
.feature--puzzle::after {
  background: linear-gradient(0deg, #122239 2%, #122239ec 14%, #12223959 31%, transparent 50%);
}
.feature--puzzle :is(.feature-image, .feature-video) {
  position: absolute;
  top: 24px;
  left: 50%;
  width: min(51%, 243px);
  height: auto;
  border: 5px solid #162b42;
  border-radius: 21px;
  outline: 1px solid #d2e8ffa6;
  box-shadow: 13px 19px 32px #091929a8;
  transform: translateX(-50%) rotate(-8deg);
}
.feature-video { visibility: hidden; }
.feature--puzzle[data-preview-playing] .feature-video { visibility: visible; }
.feature--puzzle[data-preview-playing] .feature-image { visibility: hidden; }
.preview-toggle:not([hidden]) {
  position: absolute;
  z-index: 1;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 6px 13px;
  border: 1px solid #d7e8ff;
  border-radius: 999px;
  background: #f4f9ff;
  color: #162e50;
  font-size: 13px;
  font-weight: 750;
  box-shadow: 0 4px 12px #10254155;
  cursor: pointer;
}
.preview-toggle:hover { background: #e4f1ff; }
.preview-toggle:focus-visible { outline-color: #fff; }
.preview-icon {
  width: 0;
  height: 0;
  border-block: 5px solid transparent;
  border-left: 8px solid currentColor;
}
.feature--puzzle[data-preview-playing] .preview-icon {
  width: 8px;
  height: 10px;
  border: 0;
  border-inline: 2px solid currentColor;
}
.puzzle-tile {
  position: absolute;
  width: clamp(45px, 15%, 90px);
  height: auto;
  filter: drop-shadow(0 10px 12px #10192f7f);
}
.puzzle-tile--blue { left: 9%; top: 18%; transform: rotate(-23deg); }
.puzzle-tile--red { right: 7%; top: 30%; transform: rotate(16deg); }
.puzzle-tile--yellow { left: 13%; top: 55%; transform: rotate(13deg); }

@media (max-width: 900px) {
  .hero-copy { width: 49%; }
  .store-badge { min-width: 127px; padding-inline: 10px; }
  .store-badge strong { font-size: 14px; }
  .features-grid { gap: 12px; grid-template-rows: repeat(2, minmax(228px, auto)); }
  .feature-copy { padding: 18px 18px; }
}

@media (max-width: 680px) {
  .game-hero { display: block; min-height: 0; }
  .hero-art { width: 100%; height: clamp(235px, 78vw, 420px); }
  .hero-art img { object-position: 51% 47%; }
  .game-hero::before {
    background: linear-gradient(180deg, transparent 19%, #1025412d 29%, var(--hero-navy) 56%);
  }
  .hero-wrap { padding-block: clamp(182px, 59vw, 320px) 30px; }
  .hero-copy { width: 100%; text-align: center; }
  .genre { font-size: 11px; }
  .hero-logo { width: min(92%, 360px); margin: 10px auto 9px; }
  .hero-tagline { font-size: 24px; }
  .hero-description { max-width: 375px; margin: 8px auto 0; font-size: 14px; }
  .stores { justify-content: center; gap: 8px; margin-top: 17px; }
  .store-badge { width: calc(50% - 4px); max-width: 166px; min-width: 0; min-height: 50px; gap: 8px; }
  .store-badge svg { width: 21px; height: 21px; }
  .store-badge small { font-size: 9px; }
  .feature-section { padding-block: 26px 36px; }
  .feature-heading { margin-bottom: 15px; font-size: 23px; }
  .features-grid { grid-template-columns: 1fr; grid-template-rows: none; gap: 12px; }
  .feature { min-height: 222px; border-radius: 15px; }
  .feature--puzzle { grid-row: auto; min-height: clamp(340px, 108vw, 490px); }
  .feature--puzzle :is(.feature-image, .feature-video) { top: 18px; width: min(51%, 205px); }
  .preview-toggle:not([hidden]) { top: 10px; right: 10px; padding-inline: 10px; font-size: 12px; }
  .feature-copy { padding: 17px 16px; }
  .feature-copy h3 { font-size: 21px; }
  .feature-copy p { font-size: 13px; }
}
`;
