const clock = document.querySelector('.clock');
const clockTime = document.querySelector('#local-time');
const meridiem = document.querySelector('.meridiem');
const flapTemplate = document.querySelector('#flaps');
const focusTime = document.querySelector('#focus-time');
const focusDialog = document.querySelector('#focus-dialog');
const focusSetup = document.querySelector('#focus-setup');
const focusDuration = document.querySelector('#focus-duration');
const focusChime = document.querySelector('#focus-chime');
const focusControls = document.querySelector('#focus-controls');
const toggleFocus = document.querySelector('#toggle-focus');
const settings = document.querySelector('#settings');
const openSettings = document.querySelector('#open-settings');
const fullscreen = document.querySelector('#fullscreen');
const notice = document.querySelector('#notice');
const formatButtons = document.querySelectorAll('[data-format]');
const showSeconds = document.querySelector('#show-seconds');
const numeralFont = document.querySelector('#numeral-font');
const numeralColor = document.querySelector('#numeral-color');
const resetNumeralColor = document.querySelector('#reset-numeral-color');
const size = document.querySelector('#clock-size');
const brightness = document.querySelector('#brightness');
const keepAwake = document.querySelector('#keep-awake');
const awakeStatus = document.querySelector('#awake-status');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = 'flip-clock.settings';

const tiles = Array.from(document.querySelectorAll('.tile'), (element) => {
  element.prepend(flapTemplate.content.cloneNode(true));
  const [top, bottom, outgoing, incoming] = element.querySelectorAll('.flap');
  return { element, top, bottom, outgoing, incoming, value: '', animation: null };
});

let stored;
try {
  stored = JSON.parse(localStorage.getItem(storageKey));
} catch {
  // Browser storage is optional, including when opened from a local file.
}

const preferences = {
  format: stored?.format === 24 ? 24 : 12,
  seconds: stored?.seconds === true,
  font: Array.from(numeralFont.options).some((option) => option.value === stored?.font) ? stored.font : numeralFont.value,
  color: /^#[0-9a-f]{6}$/i.test(stored?.color) ? stored.color : numeralColor.defaultValue,
  size: percent(stored?.size, 50),
  brightness: percent(stored?.brightness, 20),
  awake: stored?.awake === true,
};

let tickTimer;
let idleTimer;
let noticeTimer;
let wakeLock;
let requestingWakeLock = false;
let lastTick;
let focusSession;

function percent(value, minimum) {
  return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(minimum, value)) / 5) * 5 : 100;
}

function setFlap(flap, value) {
  flap.firstElementChild.textContent = value;
}

function updateTile(tile, value, animate) {
  if (tile.value === value) return;
  tile.animation?.cancel();
  tile.outgoing.hidden = true;
  tile.incoming.hidden = true;

  const previous = tile.value;
  tile.value = value;
  setFlap(tile.top, value);
  setFlap(tile.bottom, value);

  if (!previous || !animate || reduceMotion.matches) return;

  setFlap(tile.bottom, previous);
  setFlap(tile.outgoing, previous);
  setFlap(tile.incoming, value);
  tile.outgoing.hidden = false;
  tile.incoming.hidden = false;

  const close = tile.outgoing.animate([
    { transform: 'rotateX(0deg)', filter: 'brightness(1)' },
    { transform: 'rotateX(-90deg)', filter: 'brightness(.45)' },
  ], { duration: 190, easing: 'cubic-bezier(.5, 0, .85, .5)', fill: 'both' });

  const open = tile.incoming.animate([
    { transform: 'rotateX(90deg)', filter: 'brightness(.5)' },
    { transform: 'rotateX(0deg)', filter: 'brightness(1)' },
  ], { duration: 240, delay: 190, easing: 'cubic-bezier(.15, .65, .35, 1)', fill: 'both' });

  tile.animation = { cancel: () => { close.cancel(); open.cancel(); } };
  open.onfinish = () => {
    setFlap(tile.bottom, value);
    tile.outgoing.hidden = true;
    tile.incoming.hidden = true;
    tile.animation.cancel();
    tile.animation = null;
  };
}

function showTiles(hours, minutes, seconds, period, animate) {
  const showThirdTile = seconds !== null;
  clock.classList.toggle('with-seconds', showThirdTile);
  tiles[2].element.hidden = !showThirdTile;
  updateTile(tiles[0], hours, animate);
  updateTile(tiles[1], minutes, animate);
  if (showThirdTile) updateTile(tiles[2], seconds, animate);
  meridiem.textContent = period;
}

function tick(animate = true) {
  window.clearTimeout(tickTimer);
  const now = new Date();
  const canFlip = animate && !document.hidden && now - lastTick < (focusSession || preferences.seconds ? 2500 : 90000);
  lastTick = now;

  if (focusSession) {
    const remaining = focusSession.endsAt === null ? focusSession.remaining : focusSession.endsAt - now.getTime();
    if (remaining <= 0) {
      endFocus(true);
      return;
    }

    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    const paused = focusSession.endsAt === null;
    showTiles(minutes, seconds, null, paused ? 'PAUSED' : 'FOCUS', canFlip);
    focusTime.textContent = `${paused ? 'Paused, ' : ''}${Number(minutes)} minutes and ${Number(seconds)} seconds remaining`;

    if (!paused) tickTimer = window.setTimeout(tick, remaining - (totalSeconds - 1) * 1000);
    return;
  }

  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const twelveHour = preferences.format === 12;
  const displayHour = twelveHour ? String(hours % 12 || 12) : String(hours).padStart(2, '0');
  const period = twelveHour ? (hours < 12 ? 'AM' : 'PM') : '';
  showTiles(displayHour, minutes, preferences.seconds ? seconds : null, period, canFlip);

  const shownSeconds = preferences.seconds ? `:${seconds}` : '';
  clockTime.dateTime = `${String(hours).padStart(2, '0')}:${minutes}${shownSeconds}`;
  clockTime.textContent = `${displayHour}:${minutes}${shownSeconds}${period ? ` ${period}` : ''}`;
  const interval = preferences.seconds ? 1000 : 60000;
  tickTimer = window.setTimeout(tick, interval - (Date.now() % interval) + 12);
}

function renderFocusControls() {
  const active = Boolean(focusSession);
  focusSetup.hidden = active;
  focusControls.hidden = !active;
  toggleFocus.textContent = focusSession?.endsAt === null ? 'Resume' : 'Pause';
  clockTime.hidden = active;
  focusTime.hidden = !active;
  clock.classList.toggle('focus-mode', active);
  tick(false);
}

function playFocusChime(audio) {
  const start = audio.currentTime;
  for (const [frequency, delay] of [[660, 0], [880, .16]]) {
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    const noteTime = start + delay;
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(.001, noteTime);
    volume.gain.exponentialRampToValueAtTime(.15, noteTime + .018);
    volume.gain.exponentialRampToValueAtTime(.001, noteTime + .3);
    tone.connect(volume).connect(audio.destination);
    tone.start(noteTime);
    tone.stop(noteTime + .3);
    if (delay > 0) tone.onended = () => { void audio.close().catch(() => {}); };
  }
}

function endFocus(completed = false) {
  const { audio } = focusSession;
  focusSession = undefined;
  if (focusDialog.open) focusDialog.close();
  renderFocusControls();

  if (completed) showNotice('Focus session complete');
  if (!audio) return;
  if (completed && audio.state === 'running') {
    playFocusChime(audio);
  } else {
    void audio.close().catch(() => {});
  }
}

function applyPreferences() {
  for (const button of formatButtons) {
    button.setAttribute('aria-pressed', Number(button.dataset.format) === preferences.format);
  }
  showSeconds.checked = preferences.seconds;
  numeralFont.value = preferences.font;
  numeralColor.value = preferences.color;
  size.value = preferences.size;
  brightness.value = preferences.brightness;
  keepAwake.checked = preferences.awake;
  document.querySelector('#clock-size-value').value = `${preferences.size}%`;
  document.querySelector('#brightness-value').value = `${preferences.brightness}%`;
  clock.dataset.font = preferences.font;
  clock.style.setProperty('--numeral-color', preferences.color);
  clock.style.setProperty('--scale', preferences.size / 100);
  clock.style.setProperty('--brightness', preferences.brightness / 100);
  tick(false);
}

function changePreference(key, value) {
  preferences[key] = value;
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // The changes still apply to this instance.
  }
  applyPreferences();
}

function showAwakeStatus(message = '') {
  awakeStatus.textContent = message;
  awakeStatus.hidden = !message;
}

async function syncWakeLock() {
  if (!navigator.wakeLock) {
    keepAwake.disabled = true;
    showAwakeStatus('Screen wake lock is unavailable in this browser.');
    return;
  }

  if (!preferences.awake || document.hidden) {
    const lock = wakeLock;
    wakeLock = undefined;
    showAwakeStatus();
    if (lock && !lock.released) await lock.release();
    return;
  }

  if (requestingWakeLock || (wakeLock && !wakeLock.released)) return;
  requestingWakeLock = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!preferences.awake || document.hidden) {
      await lock.release();
      return;
    }

    wakeLock = lock;
    showAwakeStatus('Screen wake lock is active.');
    lock.addEventListener('release', () => {
      if (wakeLock !== lock) return;
      wakeLock = undefined;
      showAwakeStatus(document.hidden ? '' : 'The browser released the screen wake lock.');
    });
  } catch {
    if (preferences.awake && !document.hidden) showAwakeStatus('The browser could not keep the screen awake.');
  } finally {
    requestingWakeLock = false;
  }
}

function revealControls() {
  document.body.classList.remove('idle');
  window.clearTimeout(idleTimer);
  if (settings.open || focusDialog.open) return;
  idleTimer = window.setTimeout(() => document.body.classList.add('idle'), 3000);
}

function showNotice(message) {
  window.clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 4500);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    showNotice('Use your browser’s fullscreen option if available.');
  }
}

for (const button of formatButtons) {
  button.addEventListener('click', () => changePreference('format', Number(button.dataset.format)));
}
showSeconds.addEventListener('change', () => changePreference('seconds', showSeconds.checked));
numeralFont.addEventListener('change', () => changePreference('font', numeralFont.value));
numeralColor.addEventListener('input', () => changePreference('color', numeralColor.value));
resetNumeralColor.addEventListener('click', () => changePreference('color', numeralColor.defaultValue));
size.addEventListener('input', () => changePreference('size', size.valueAsNumber));
brightness.addEventListener('input', () => changePreference('brightness', brightness.valueAsNumber));
keepAwake.addEventListener('change', () => {
  changePreference('awake', keepAwake.checked);
  void syncWakeLock();
});

openSettings.addEventListener('click', () => {
  settings.showModal();
  revealControls();
});
settings.addEventListener('close', revealControls);
settings.addEventListener('click', (event) => {
  if (event.target !== settings) return;
  const bounds = settings.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) settings.close();
});

document.querySelector('#open-focus').addEventListener('click', () => {
  focusDialog.showModal();
  revealControls();
});
focusDialog.addEventListener('close', revealControls);
focusSetup.addEventListener('submit', (event) => {
  event.preventDefault();
  if (focusSession || !focusDuration.checkValidity()) return;

  const duration = focusDuration.valueAsNumber * 60000;
  focusSession = { endsAt: Date.now() + duration, remaining: duration };
  if (focusChime.checked && window.AudioContext) {
    try {
      const audio = new AudioContext();
      focusSession.audio = audio;
      void audio.resume().catch(() => {});
    } catch {
      // The visual completion notice still works if audio is unavailable.
    }
  }
  focusDialog.close();
  renderFocusControls();
});
toggleFocus.addEventListener('click', () => {
  const now = Date.now();
  if (focusSession.endsAt === null) {
    focusSession.endsAt = now + focusSession.remaining;
  } else {
    focusSession.remaining = focusSession.endsAt - now;
    focusSession.endsAt = null;
  }
  renderFocusControls();
});
document.querySelector('#end-focus').addEventListener('click', () => endFocus());

fullscreen.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
  fullscreen.setAttribute('aria-label', label);
  fullscreen.title = `${label} (F)`;
  revealControls();
});
document.addEventListener('keydown', (event) => {
  revealControls();
  if (event.key.toLowerCase() === 'f' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !settings.open && !focusDialog.open) {
    event.preventDefault();
    void toggleFullscreen();
  }
});
document.addEventListener('pointermove', revealControls, { passive: true });
document.addEventListener('pointerdown', revealControls, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tick(false);
  void syncWakeLock();
});
window.addEventListener('pageshow', () => {
  tick(false);
  void syncWakeLock();
});
window.addEventListener('focus', () => {
  tick(false);
  void syncWakeLock();
});

applyPreferences();
revealControls();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('./service-worker.js').catch((error) => {
    console.warn('Offline launch is unavailable.', error);
  });
}
