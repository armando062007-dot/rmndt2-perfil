const audio = document.querySelector('#audio');
const music = document.querySelector('#profile-music');
const share = document.querySelector('#share-profile');
const toast = document.querySelector('#toast');
let toastTimer;

function typeBio() {
  const bio = document.querySelector('.bio');
  if (!bio) return;
  const phrases = Array.from(bio.querySelectorAll('.bio-copy'), copy => Array.from(copy.textContent.trim()))
    .filter(letters => letters.length);
  if (phrases.length < 2) return;
  const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  const typed = document.createElement('span');
  typed.className = 'bio-typed';
  typed.setAttribute('aria-hidden', 'true');
  let phrase = 0;
  let position = 0;
  let deleting = false;
  let timer;

  function schedule(delay) {
    timer = window.setTimeout(tick, delay);
  }

  function tick() {
    const letters = phrases[phrase];
    position += deleting ? -1 : 1;
    typed.textContent = letters.slice(0, position).join('');
    if (!deleting && position === letters.length) {
      deleting = true;
      schedule(2700);
    } else if (deleting && position === 0) {
      deleting = false;
      phrase = (phrase + 1) % phrases.length;
      schedule(320);
    } else {
      schedule(deleting ? 24 : 40);
    }
  }

  function syncMotion() {
    window.clearTimeout(timer);
    if (preference?.matches) {
      bio.classList.remove('bio--typing');
      typed.remove();
      return;
    }
    phrase = 0;
    position = 0;
    deleting = false;
    typed.textContent = '';
    bio.append(typed);
    bio.classList.add('bio--typing');
    schedule(160);
  }

  preference?.addEventListener?.('change', syncMotion);
  syncMotion();
}

typeBio();

function setupBackground() {
  const video = document.querySelector('#background-video');
  if (!video) return;
  const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function play() {
    if (!video.hasAttribute('src')) video.src = video.dataset.src;
    video.muted = true;
    void video.play().catch(() => {});
  }

  video.addEventListener('loadeddata', () => video.parentElement.classList.add('has-video'));
  video.addEventListener('playing', () => video.parentElement.classList.add('has-video'));
  video.addEventListener('error', () => video.parentElement.classList.remove('has-video'));
  preference?.addEventListener?.('change', event => {
    if (event.matches) video.pause();
    else play();
  });
  if (!preference?.matches) play();
}

setupBackground();

function setupSections() {
  const nav = document.querySelector('.section-nav');
  if (!nav) return;
  const sections = Array.from(nav.querySelectorAll('a[href^="#"]'), dot => ({
    dot,
    section: document.getElementById(dot.hash.slice(1)),
  })).filter(({ section }) => section);
  if (!sections.length) return;

  let scheduled = false;
  let active;
  function update() {
    scheduled = false;
    let visible = sections[0].dot;
    for (const { dot, section } of sections) {
      if (section.getBoundingClientRect().top <= window.innerHeight / 2) visible = dot;
    }
    if (visible === active) return;
    for (const { dot } of sections) dot.removeAttribute('aria-current');
    visible.setAttribute('aria-current', 'location');
    active = visible;
  }
  function queueUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  }
  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate);
  window.addEventListener('pageshow', queueUpdate);
  update();
}

setupSections();

function announce(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toastTimer = window.setTimeout(() => { toast.textContent = ''; }, 4300);
}

async function setupVisits() {
  const button = document.querySelector('#visit-count');
  const total = document.querySelector('#visit-total');
  if (!button || !total) return;
  button.addEventListener('click', () => announce('Visitas desde la activación del contador. Cada navegador cuenta una vez; no es un conteo exacto de personas.'));
  try {
    const headers = { 'Content-Type': 'application/json' };
    try {
      let visitor = localStorage.getItem('rmndt2-visitor') || document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('rmndt2-visitor-id='))?.slice('rmndt2-visitor-id='.length);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitor || '')) {
        visitor = crypto.randomUUID();
      }
      visitor = visitor.toLowerCase();
      localStorage.setItem('rmndt2-visitor', visitor);
      document.cookie = `rmndt2-visitor-id=${visitor}; Path=/; Max-Age=31536000; Secure; SameSite=Lax`;
      headers['X-Visitor-Id'] = visitor;
    } catch { /* The server cookie remains a fallback when storage is blocked. */ }
    const response = await fetch('/api/visits', {
      method: 'POST', credentials: 'same-origin',
      headers, body: '{}',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Contador no disponible');
    const data = await response.json();
    if (!Number.isSafeInteger(data.total) || data.total < 0) throw new Error('Total inválido');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.visitorId || '')) {
      try {
        localStorage.setItem('rmndt2-visitor', data.visitorId);
        document.cookie = `rmndt2-visitor-id=${data.visitorId}; Path=/; Max-Age=31536000; Secure; SameSite=Lax`;
      } catch { /* Storage may be disabled by the visitor. */ }
    }
    total.textContent = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(data.total);
    button.setAttribute('aria-label', `${data.total} visitas. Información del contador`);
    button.title = `${new Intl.NumberFormat('es-MX').format(data.total)} visitas · Una por navegador`;
  } catch {
    total.textContent = '—';
    button.setAttribute('aria-label', 'Contador de visitas temporalmente no disponible');
    button.title = 'Contador temporalmente no disponible';
  }
}

void setupVisits();

share.addEventListener('click', async () => {
  const url = new URL(location.pathname, location.origin).href;
  if (navigator.share) {
    try { await navigator.share({ title: document.title, url }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    announce('Enlace copiado');
  } catch {
    const field = document.createElement('input');
    field.value = url;
    field.readOnly = true;
    field.setAttribute('aria-label', 'Dirección del perfil');
    toast.replaceChildren(field);
    field.focus();
    field.select();
  }
});

function syncMusic() {
  const playing = !music.paused && !music.ended;
  const label = playing ? 'Pausar música' : 'Reproducir música';
  audio.setAttribute('aria-label', label);
  audio.title = label;
  audio.querySelector('use').setAttribute('href', playing ? '#music-pause' : '#music-play');
}

if (audio && music) {
  music.volume = 0.35;
  const gestureEvents = ['click', 'touchend', 'keydown'];
  let automaticStart = true;
  for (const event of ['play', 'pause', 'ended', 'error']) music.addEventListener(event, syncMusic);

  function stopWaitingForGesture() {
    automaticStart = false;
    for (const event of gestureEvents) document.removeEventListener(event, playOnFirstGesture, true);
    music.removeEventListener('canplay', tryAutomaticStart);
  }

  function playOnFirstGesture(event) {
    if (!event.isTrusted || event.composedPath().includes(audio)) return;
    tryAutomaticStart();
  }

  function tryAutomaticStart() {
    if (!automaticStart) return;
    void music.play().catch(error => {
      if (!['NotAllowedError', 'AbortError'].includes(error.name)) stopWaitingForGesture();
    });
  }

  for (const event of gestureEvents) document.addEventListener(event, playOnFirstGesture, true);
  music.addEventListener('canplay', tryAutomaticStart);
  music.addEventListener('playing', stopWaitingForGesture, { once: true });
  tryAutomaticStart();

  audio.addEventListener('click', async () => {
    stopWaitingForGesture();
    if (!music.paused) {
      music.pause();
      return;
    }
    try { await music.play(); }
    catch (error) {
      if (error.name !== 'AbortError') announce('No se pudo reproducir la música. Inténtalo de nuevo.');
    }
    syncMusic();
  });
}
