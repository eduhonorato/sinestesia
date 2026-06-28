const EPS = 1e-6;
const NUDGE = 0.01;

const params = {
  sides: 3,
  beams: 1,
  speed: 0.05,
  bounces: 90,
  glow: 1.0,
  color: '#ff2828',
  rainbow: false,
  hueSpeed: 12,
  preset: 'Triangulo classico',
  windowMode: false,
  imgPalette: false,
  sound: false,
  volume: 0.6,
  reactive: false,
  beatSens: 1.2,
  bloomReact: 0.3,
  auto: false,
  autoPos: false,
  autoStep: 0.18,
  holdTime: 6,
  outputAspect: 'Livre',
  reactRegen: true,
  regenEvery: 2,
  reactMotion: false,
  motionAmt: 0.3,
};

let tri = [];
let emitter;
let centerDir = null;

let beams = [];

let beamLayer;
let fxLayer;

let movingSource = false;
let autoAngle = 0;
let wasShooting = false;
let holdUntil = 0;
let autoPaused = false;
let orbitPeriod = 0;
let hideUI = false;
let showHelp = false;
let vjMode = false;
let cleanOutput = false;
let vjRole = null;
let ipc = null;
let lastSyncSnap = '';
const SYNC_KEYS = ['sides', 'beams', 'speed', 'bounces', 'glow', 'color',
  'rainbow', 'hueSpeed', 'imgPalette', 'auto', 'autoPos', 'autoStep',
  'holdTime', 'outputAspect', 'windowMode',
  'reactive', 'beatSens', 'bloomReact', 'reactRegen', 'regenEvery',
  'reactMotion', 'motionAmt'];
let audioCtx = null;

// imagem-paleta
let paletteImg = null;
let fileInput = null;
let polyBB = { minx: 0, miny: 0, maxx: 1, maxy: 1 };

let fft = null;
let audioStream = null;
let sourceNode = null;
let audioInputs = [];
let currentDeviceId = null;
let reactReady = false;
let reactStarting = false;
let lastBeat = 0;
let glowBoost = 0;
let bassHist = [];
let fAud = null;
let fReact = null;
let deviceBlade = null;
let beatCount = 0;
let motionAngle = 0;
let beatPulse = 0;

let baseRGB = { r: 255, g: 40, b: 40 };
function refreshColor() {
  const c = color(params.color);
  baseRGB = { r: red(c), g: green(c), b: blue(c) };
}

let pane = null;
let reactPane = null;
let reactHost = null;

let mirrorImg = null;
let mirrorCanvas = null;
let mirrorCtx = null;

const PRESETS = {
  'Triangulo classico': { sides: 3, beams: 1, bounces: 130, rainbow: false, color: '#ff2828', glow: 1.0 },
  'Estrela arco-iris':   { sides: 5, beams: 6, bounces: 160, rainbow: true,  hueSpeed: 12, glow: 1.1 },
  'Hexagono gelo':       { sides: 6, beams: 3, bounces: 320, rainbow: false, color: '#28a0ff', glow: 0.9 },
  'Octogono neon':       { sides: 8, beams: 4, bounces: 240, rainbow: true,  hueSpeed: 8,  glow: 1.2 },
};

function setup() {
  pixelDensity(min(displayDensity(), 2));
  createCanvas(windowWidth, windowHeight);
  beamLayer = createGraphics(width, height);
  fxLayer = createGraphics(width, height);
  buildTriangle();
  emitter = { pos: triCentroid() };
  refreshColor();
  fileInput = createFileInput(handleFile);
  fileInput.hide();
  setupVJLink();
  setupPane();
  fireShot(createVector(0.85, -0.5));
}

function setupVJLink() {
  let qp;
  try { qp = new URLSearchParams(window.location.search); } catch (e) { return; }
  cleanOutput = qp.has('clean');
  vjRole = qp.get('role');

  ipc = (typeof window !== 'undefined' && window.vjBridge) ? window.vjBridge : null;
  if (!ipc) return;

  params.auto = true;

  if (vjRole === 'output') {
    ipc.on('vj-params', (data) => applyRemoteParams(data));
    setupMirrorSender();
  } else if (vjRole === 'controller') {
    setInterval(broadcastParams, 150);
    ipc.on('vj-frame', (url) => {
      if (!mirrorImg) mirrorImg = new Image();
      mirrorImg.src = url;
    });
  }
}

function setupMirrorSender() {
  mirrorCanvas = document.createElement('canvas');
  mirrorCanvas.width = 1280;
  mirrorCanvas.height = 720;
  mirrorCtx = mirrorCanvas.getContext('2d');
  mirrorCtx.imageSmoothingEnabled = true;
  mirrorCtx.imageSmoothingQuality = 'high';
}

function broadcastParams() {
  const obj = {};
  for (const k of SYNC_KEYS) obj[k] = params[k];
  const snap = JSON.stringify(obj);
  if (snap === lastSyncSnap) return;
  lastSyncSnap = snap;
  ipc.send('vj-params', obj);
}

function applyRemoteParams(data) {
  if (!data) return;
  const before = SYNC_KEYS.map((k) => params[k]).join('|');
  for (const k of SYNC_KEYS) if (data[k] !== undefined) params[k] = data[k];
  refreshColor();
  buildTriangle();
  emitter.pos = triCentroid();

  if (vjRole === 'output') {
    if (params.reactive && !reactReady && !reactStarting) startReactive();
    else if (!params.reactive && reactReady) stopReactive();
  }

  const after = SYNC_KEYS.map((k) => params[k]).join('|');
  if (before !== after && centerDir) fireShot(centerDir);
}

function setupPane() {
  if (typeof Pane === 'undefined') { setTimeout(setupPane, 50); return; }
  pane = new Pane({ title: 'Controles' });
  if (cleanOutput && pane.element) pane.element.style.display = 'none';

  // em telas estreitas as pastas comecam recolhidas p/ nao cobrir a arte
  const small = window.innerWidth < 720;
  const exp = !small;

  const refire = () => { if (centerDir) fireShot(centerDir); };

  // --- Presets ---
  const fPre = pane.addFolder({ title: 'Presets', expanded: false });
  const opts = {};
  for (const k of Object.keys(PRESETS)) opts[k] = k;
  fPre.addBinding(params, 'preset', { label: 'Preset', options: opts })
    .on('change', () => applyPreset(params.preset));
  fPre.addButton({ title: 'Surpreenda-me' }).on('click', surprise);

  // --- Geometria ---
  const fGeo = pane.addFolder({ title: 'Geometria', expanded: exp });
  fGeo.addBinding(params, 'windowMode', { label: 'Janela inteira' })
    .on('change', () => { buildTriangle(); emitter.pos = triCentroid(); refire(); });
  fGeo.addBinding(params, 'sides', { min: 3, max: 12, step: 1, label: 'Lados' })
    .on('change', () => { buildTriangle(); emitter.pos = triCentroid(); refire(); });
  fGeo.addBinding(params, 'beams', { min: 1, max: 8, step: 1, label: 'Feixes' })
    .on('change', refire);

  // --- Animação ---
  const fAnim = pane.addFolder({ title: 'Animacao', expanded: exp });
  fAnim.addBinding(params, 'speed', { min: 0.005, max: 0.4, step: 0.005, label: 'Velocidade' });
  fAnim.addBinding(params, 'bounces', { min: 2, max: 1200, step: 1, label: 'Reflexoes' })
    .on('change', refire);

  // --- Visual ---
  const fVis = pane.addFolder({ title: 'Visual', expanded: exp });
  fVis.addBinding(params, 'glow', { min: 0, max: 2, step: 0.05, label: 'Brilho' });
  fVis.addBinding(params, 'color', { label: 'Cor' })
    .on('change', () => { refreshColor(); refire(); });
  fVis.addBinding(params, 'rainbow', { label: 'Arco-iris' }).on('change', refire);
  fVis.addBinding(params, 'hueSpeed', { min: 1, max: 60, step: 1, label: 'Matiz/refl' })
    .on('change', refire);
  fVis.addBinding(params, 'imgPalette', { label: 'Usar imagem' }).on('change', refire);
  fVis.addButton({ title: 'Carregar imagem...' }).on('click', () => fileInput.elt.click());

  // --- Áudio ---
  fAud = pane.addFolder({ title: 'Audio', expanded: exp });
  fAud.addBinding(params, 'reactive', { label: 'Reage ao som' })
    .on('change', () => {
      if (vjRole !== 'controller') {
        if (params.reactive) startReactive(); else stopReactive();
      }
      updateReactPaneVisibility();
    });
  fAud.addBinding(params, 'sound', { label: 'Pings de reflexao' })
    .on('change', () => { if (params.sound) ensureAudio(); });
  fAud.addBinding(params, 'volume', { min: 0, max: 1, step: 0.05, label: 'Volume pings' });

  setupReactPane();

  // --- Automático ---
  const fAuto = pane.addFolder({ title: 'Automatico', expanded: exp });
  fAuto.addBinding(params, 'auto', { label: 'Girar' });
  fAuto.addBinding(params, 'autoPos', { label: 'Posicionar' });
  fAuto.addBinding(params, 'autoStep', { min: 0.02, max: 0.6, step: 0.01, label: 'Passo giro' });
  fAuto.addBinding(params, 'holdTime', { min: 1, max: 15, step: 0.5, label: 'Pausa (s)' });

  // --- Ações ---
  const fAct = pane.addFolder({ title: 'Acoes', expanded: exp });
  fAct.addButton({ title: 'Novo feixe aleatorio' }).on('click', () => {
    const a = random(TWO_PI);
    fireShot(createVector(cos(a), sin(a)));
  });
  fAct.addButton({ title: 'Limpar' }).on('click', () => beamLayer.clear());

  // --- Saída (VJ) ---
  const fOut = pane.addFolder({ title: 'Saida (VJ)', expanded: exp });
  fOut.addBinding(params, 'outputAspect', {
    label: 'Aspecto',
    options: { Livre: 'Livre', '16:9': '16:9', '9:16': '9:16', '1:1': '1:1', '4:3': '4:3' },
  }).on('change', () => { buildTriangle(); emitter.pos = triCentroid(); if (centerDir) fireShot(centerDir); });
  fOut.addButton({ title: 'Modo VJ - tela cheia (tecla V)' }).on('click', () => setVJ(!vjMode));

  // --- Exportar ---
  const fExp = pane.addFolder({ title: 'Exportar', expanded: exp });
  fExp.addButton({ title: 'Salvar PNG' }).on('click', exportPNG);
  fExp.addButton({ title: 'Gravar GIF (3s)' }).on('click', () => saveGif('laser', 3));

  layoutPanes();
}

// ajusta largura/posicao dos panes conforme a tela (responsivo p/ mobile)
function layoutPanes() {
  const W = window.innerWidth, H = window.innerHeight;
  const small = W < 720;
  const mainWrap = document.querySelector('.tp-dfwv');
  const paneW = small ? Math.max(180, Math.min(240, W - 16)) : 256;

  if (mainWrap) {
    mainWrap.style.width = paneW + 'px';
    mainWrap.style.maxHeight = (H - 16) + 'px';
    mainWrap.style.overflowY = 'auto';
  }
  if (reactHost) {
    reactHost.style.maxHeight = (H - 16) + 'px';
    reactHost.style.overflowY = 'auto';
    reactHost.style.width = (small ? paneW : 256) + 'px';
    if (small) {
      // sem espaco lado a lado: joga o pane reativo p/ o canto inferior esquerdo
      reactHost.style.right = 'auto';
      reactHost.style.left = '8px';
      reactHost.style.top = 'auto';
      reactHost.style.bottom = '8px';
    } else {
      reactHost.style.left = 'auto';
      reactHost.style.bottom = 'auto';
      reactHost.style.right = (paneW + 24) + 'px';
      reactHost.style.top = '8px';
    }
  }
}

// pane secundario com as configs de reacao ao som
function setupReactPane() {
  reactHost = document.createElement('div');
  reactHost.style.cssText =
    'position:fixed; top:8px; right:280px; width:256px; z-index:1000; display:none;';
  document.body.appendChild(reactHost);

  reactPane = new Pane({ title: 'Reage ao som', container: reactHost });
  reactPane.addBinding(params, 'reactRegen', { label: 'Gerar nova na batida' });
  reactPane.addBinding(params, 'beatSens', { min: 0.3, max: 3, step: 0.1, label: 'Detectar batida' });
  reactPane.addBinding(params, 'bloomReact', { min: 0, max: 3, step: 0.1, label: 'Brilho pulsa' });
  reactPane.addBinding(params, 'regenEvery', { min: 1, max: 8, step: 1, label: 'A cada N batidas' });
  reactPane.addBinding(params, 'reactMotion', { label: 'Mover imagem' });
  reactPane.addBinding(params, 'motionAmt', { min: 0, max: 1.5, step: 0.05, label: 'Forca do movimento' });

  if (vjRole !== 'controller') {
    reactPane.addButton({ title: 'Atualizar dispositivos de audio' }).on('click', async () => {
      if (!reactReady) { startReactive(); return; }
      try { await ensureAudioInputs(); buildDeviceList(); }
      catch (e) { console.warn('nao consegui listar dispositivos:', e); }
    });
  }

  fReact = reactPane;
  updateReactPaneVisibility();
}

function updateReactPaneVisibility() {
  if (!reactHost) return;
  const show = params.reactive && !cleanOutput && !vjMode;
  reactHost.style.display = show ? '' : 'none';
}

function handleFile(file) {
  if (file.type !== 'image') return;
  loadImage(file.data, (img) => {
    img.loadPixels();
    paletteImg = img;
    params.imgPalette = true;
    if (pane) pane.refresh();
    if (centerDir) fireShot(centerDir);
  });
}

function hex2(n) { return constrain(round(n), 0, 255).toString(16).padStart(2, '0'); }
function rgbToHex(c) { return '#' + hex2(c.r) + hex2(c.g) + hex2(c.b); }

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.assign(params, p);
  refreshColor();
  buildTriangle();
  emitter.pos = triCentroid();
  if (pane) pane.refresh();
  fireShot(centerDir || createVector(0.85, -0.5));
}

const SURPRISE_MAX_SEGS = 300;

function placeEmitterRandom() {
  const c = triCentroid();
  if (random() < 0.5) {
    emitter.pos = c.copy();
  } else {
    const v = tri[floor(random(tri.length))];
    emitter.pos = p5.Vector.lerp(c, v, random(0.08, 0.4));
  }
}

function fireCleanOrbit() {
  const cands = [];
  for (let i = 0; i < 360; i++) {
    const a = random(TWO_PI);
    const d = createVector(cos(a), sin(a));
    const period = detectOrbit(emitter.pos, d, 800);
    if (period >= 4) cands.push({ d, period });
  }

  const segBudget = floor(SURPRISE_MAX_SEGS / max(1, floor(params.beams)));

  let dir, period;
  if (cands.length) {
    const target = random(8, segBudget);
    cands.sort((p, q) => abs(p.period - target) - abs(q.period - target));
    dir = cands[0].d;
    period = cands[0].period;
  } else {
    const a = random(TWO_PI);
    dir = createVector(cos(a), sin(a));
    period = segBudget;
  }

  params.bounces = constrain(min(period, segBudget), 8, SURPRISE_MAX_SEGS);

  const total = params.bounces * max(1, floor(params.beams));
  params.glow = constrain(map(total, 40, SURPRISE_MAX_SEGS, 1.1, 0.6), 0.6, 1.1);

  fireShot(dir);
}

function surprise() {
  params.sides = floor(random(3, 9));
  params.beams = floor(random(1, 6));
  params.rainbow = random() < 0.6;
  if (!params.rainbow) params.color = rgbToHex(hsv(random(360), random(0.7, 1), 1));
  else params.hueSpeed = floor(random(6, 24));
  refreshColor();
  buildTriangle();
  placeEmitterRandom();
  fireCleanOrbit();
  if (pane) pane.refresh();
}

function exportPNG() {
  hideUI = true;
  requestAnimationFrame(() => {
    saveCanvas('laser-' + frameCount, 'png');
    hideUI = false;
  });
}

function windowResized() {
  const old = triCentroid();
  const dPos = p5.Vector.sub(emitter.pos, old);
  resizeCanvas(windowWidth, windowHeight);
  beamLayer = createGraphics(width, height);
  fxLayer = createGraphics(width, height);
  buildTriangle();
  emitter.pos = p5.Vector.add(triCentroid(), dPos);
  clampInside(emitter.pos);
  if (centerDir) fireShot(centerDir);
  layoutPanes();
}

//  Geometria
function stageRect() {
  const a = params.outputAspect;
  if (a === 'Livre') return { x: 0, y: 0, w: width, h: height };
  const [rw, rh] = a.split(':').map(Number);
  let w = width, h = width * rh / rw;
  if (h > height) { h = height; w = height * rw / rh; }
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

function buildTriangle() {
  const st = stageRect();
  tri = [];
  if (params.windowMode) {
    const m = 2;
    const x0 = st.x + m, y0 = st.y + m;
    const x1 = st.x + st.w - m, y1 = st.y + st.h - m;
    tri.push(createVector(x0, y0));
    tri.push(createVector(x1, y0));
    tri.push(createVector(x1, y1));
    tri.push(createVector(x0, y1));
  } else {
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    const R = min(st.w, st.h) * 0.42;
    const n = max(3, floor(params.sides));
    for (let i = 0; i < n; i++) {
      const a = -HALF_PI + i * TWO_PI / n;
      tri.push(createVector(cx + R * cos(a), cy + R * sin(a)));
    }
  }
  computePolyBB();
}

function computePolyBB() {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const v of tri) {
    minx = min(minx, v.x); miny = min(miny, v.y);
    maxx = max(maxx, v.x); maxy = max(maxy, v.y);
  }
  polyBB = { minx, miny, maxx, maxy };
}

function triCentroid() {
  let x = 0, y = 0;
  for (const v of tri) { x += v.x; y += v.y; }
  return createVector(x / tri.length, y / tri.length);
}

function triangleWalls() {
  const walls = [];
  for (let i = 0; i < tri.length; i++) {
    walls.push({ a: tri[i], b: tri[(i + 1) % tri.length] });
  }
  return walls;
}

//  Física
function raySegmentIntersect(origin, dir, a, b) {
  const e = p5.Vector.sub(b, a);
  const denom = dir.x * e.y - dir.y * e.x;
  if (abs(denom) < EPS) return null;
  const diff = p5.Vector.sub(a, origin);
  const t = (diff.x * e.y - diff.y * e.x) / denom;
  const u = (diff.x * dir.y - diff.y * dir.x) / denom;
  if (t <= EPS || u < -EPS || u > 1 + EPS) return null;
  const point = createVector(origin.x + dir.x * t, origin.y + dir.y * t);
  const normal = createVector(-e.y, e.x).normalize();
  return { point, t, normal };
}

function reflect(dir, normal) {
  const d = dir.dot(normal);
  return createVector(dir.x - 2 * d * normal.x, dir.y - 2 * d * normal.y);
}

function computeBeamPath(origin, dir, bounces) {
  const walls = triangleWalls();
  const out = [origin.copy()];
  let cur = origin.copy();
  let d = dir.copy().normalize();
  for (let i = 0; i < bounces; i++) {
    let best = null, bestW = -1;
    for (let wi = 0; wi < walls.length; wi++) {
      const hit = raySegmentIntersect(cur, d, walls[wi].a, walls[wi].b);
      if (hit && (best === null || hit.t < best.t)) { best = hit; bestW = wi; }
    }
    if (!best) break;
    const pt = best.point.copy();
    pt.wall = bestW;
    out.push(pt);
    d = reflect(d, best.normal).normalize();
    cur = createVector(best.point.x + d.x * NUDGE, best.point.y + d.y * NUDGE);
  }
  return out;
}

function fireShot(dir) {
  if (dir.magSq() < EPS) dir = createVector(1, 0);
  centerDir = dir.copy().normalize();
  const n = max(1, floor(params.beams));
  beamLayer.clear();
  beams = [];
  for (let k = 0; k < n; k++) {
    beams.push({
      dir: centerDir.copy().rotate(TWO_PI * k / n),
      t: 0,
      hueOff: 360 * k / n,
      sounded: 0,
      path: [],
      total: 0,
      head: 0,
    });
  }
  orbitPeriod = detectOrbit(emitter.pos, centerDir, min(params.bounces, 600));
}

function anyShooting() {
  return beams.some((b) => b.t < 1);
}

function randomInteriorPos() {
  const c = triCentroid();
  const v = tri[floor(random(tri.length))];
  return p5.Vector.lerp(c, v, random(0, 0.5));
}

function updateAuto() {
  const shootingNow = anyShooting();
  if (wasShooting && !shootingNow) {
    holdUntil = millis() + params.holdTime * 1000;
  }
  wasShooting = shootingNow;

  if (params.reactive && reactReady && millis() - lastBeat < 3000) return;
  if (autoPaused) return;
  if (!(params.auto || params.autoPos) || shootingNow) return;
  if (millis() < holdUntil) return;

  let dir = centerDir ? centerDir.copy() : createVector(0.85, -0.5);
  if (params.auto) {
    autoAngle += params.autoStep;
    dir = createVector(cos(autoAngle), sin(autoAngle));
  }
  if (params.autoPos) {
    emitter.pos = randomInteriorPos();
  }
  fireShot(dir);
}

function detectOrbit(origin, dir, maxCheck) {
  const walls = triangleWalls();
  let cur = origin.copy();
  let d = dir.copy().normalize();
  let firstPoint = null, firstInDir = null;
  for (let i = 0; i < maxCheck; i++) {
    let best = null;
    for (const w of walls) {
      const hit = raySegmentIntersect(cur, d, w.a, w.b);
      if (hit && (best === null || hit.t < best.t)) best = hit;
    }
    if (!best) return 0;
    const inDir = d.copy();
    if (firstPoint === null) {
      firstPoint = best.point.copy();
      firstInDir = inDir;
    } else if (dist(best.point.x, best.point.y, firstPoint.x, firstPoint.y) < 2 &&
               inDir.dot(firstInDir) > 0.9995) {
      return i;
    }
    d = reflect(d, best.normal).normalize();
    cur = createVector(best.point.x + d.x * NUDGE, best.point.y + d.y * NUDGE);
  }
  return 0;
}

async function startReactive() {
  if (reactStarting || reactReady) return;
  reactStarting = true;
  try {
    const ac = (typeof getAudioContext === 'function') ? getAudioContext() : null;
    if (!ac) throw new Error('AudioContext indisponivel (p5.sound nao carregou)');
    if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) { /* segue */ } }

    await ensureAudioInputs();
    await openAudioInput(pickPreferredDevice(), ac);
    buildDeviceList();
    reactReady = true;
  } catch (e) {
    console.warn('reativo falhou:', e);
    params.reactive = false;
    reactReady = false;
    if (pane) pane.refresh();
  } finally {
    reactStarting = false;
  }
}

function stopReactive() {
  reactReady = false;
  if (sourceNode) { try { sourceNode.disconnect(); } catch (e) { /* ignore */ } sourceNode = null; }
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
}

async function ensureAudioInputs() {
  let devs = await navigator.mediaDevices.enumerateDevices();
  if (!devs.some((d) => d.kind === 'audioinput' && d.label)) {
    const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
    tmp.getTracks().forEach((t) => t.stop());
    devs = await navigator.mediaDevices.enumerateDevices();
  }
  audioInputs = devs.filter((d) => d.kind === 'audioinput')
    .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Entrada' }));
}

function pickPreferredDevice() {
  if (currentDeviceId) return currentDeviceId;
  const vb = audioInputs.find((d) => /cable|vb-audio|voicemeeter/i.test(d.label));
  return vb ? vb.deviceId : (audioInputs[0] && audioInputs[0].deviceId) || null;
}

async function openAudioInput(deviceId, ac) {
  if (sourceNode) { try { sourceNode.disconnect(); } catch (e) { /* ignore */ } sourceNode = null; }
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
  const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (deviceId) audio.deviceId = { exact: deviceId };
  audioStream = await navigator.mediaDevices.getUserMedia({ audio });

  const track = audioStream.getAudioTracks()[0];
  currentDeviceId = deviceId || (track && track.getSettings().deviceId) || null;

  sourceNode = ac.createMediaStreamSource(audioStream);
  if (!fft) fft = new p5.FFT(0.8, 1024);
  fft.setInput(sourceNode);
  bassHist = [];
}

function buildDeviceList() {
  if (!fReact) return;
  if (deviceBlade) { try { deviceBlade.dispose(); } catch (e) { /* ignore */ } }
  const options = audioInputs.map((d) => ({ text: d.label, value: d.deviceId }));
  if (options.length === 0) return;
  deviceBlade = fReact.addBlade({
    view: 'list', label: 'Entrada', options,
    value: currentDeviceId || options[0].value,
  });
  deviceBlade.on('change', async (ev) => {
    try { await openAudioInput(ev.value, getAudioContext()); }
    catch (e) { console.warn('troca de entrada falhou:', e); }
  });
}

// nivel (RMS) a partir do waveform do FFT
function fftLevel() {
  const w = fft.waveform();
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i] * w[i];
  return Math.sqrt(s / w.length);
}

function updateReactive() {
  beatPulse = lerp(beatPulse, 0, 0.08);
  if (!params.reactive || !reactReady || !fft) { glowBoost = lerp(glowBoost, 0, 0.2); return; }
  try {
    fft.analyze();
    const level = fftLevel();
    const bass = fft.getEnergy('bass');
    const target = map(level, 0, 0.3, 0, 1.8, true) * params.bloomReact;
    glowBoost = lerp(glowBoost, target, 0.25);
    if (detectBeat(bass)) onBeat();
  } catch (e) {
    console.warn('reativo falhou:', e);
    reactReady = false;
    glowBoost = 0;
  }
}

const BASS_HIST = 43;
function detectBeat(bass) {
  bassHist.push(bass);
  if (bassHist.length > BASS_HIST) bassHist.shift();
  if (bassHist.length < 12) return false;

  let mean = 0;
  for (const v of bassHist) mean += v;
  mean /= bassHist.length;
  let varc = 0;
  for (const v of bassHist) varc += (v - mean) * (v - mean);
  const std = sqrt(varc / bassHist.length);

  const k = map(params.beatSens, 0.3, 3, 2.4, 0.3, true);
  const now = millis();
  if (bass > mean + k * std && bass > mean * 1.08 && bass > 15 &&
      now - lastBeat > 160) {
    lastBeat = now;
    return true;
  }
  return false;
}

function onBeat() {
  beatPulse = 1;
  if (!params.reactRegen) return;

  beatCount++;
  if (beatCount < max(1, floor(params.regenEvery))) return;
  beatCount = 0;

  if (random() < 0.5) { params.sides = floor(random(3, 9)); buildTriangle(); }
  if (random() < 0.5) params.beams = floor(random(1, 6));
  if (random() < 0.35) params.rainbow = random() < 0.6;
  if (params.rainbow) params.hueSpeed = floor(random(6, 24));
  else { params.color = rgbToHex(hsv(random(360), random(0.7, 1), 1)); refreshColor(); }
  placeEmitterRandom();
  fireCleanOrbit();
  if (pane) pane.refresh();
}

function draw() {
  if (vjRole === 'controller') { drawMirror(); return; }

  if (vjMode && !fullscreen()) setVJ(false);
  updateReactive();
  updateAuto();

  const dir = centerDir || createVector(1, 0);

  for (const b of beams) {
    if (b.t >= 1) continue;
    b.path = computeBeamPath(emitter.pos, b.dir, params.bounces);
    b.total = pathLength(b.path);
    const prevHead = b.t * b.total;
    b.t += params.speed;
    if (b.t >= 1) b.t = 1;
    b.head = b.t * b.total;
    drawBeamSegs(beamLayer, segmentsBetween(b.path, prevHead, b.head), b);
    if (params.sound) playReflections(b);
  }

  fxLayer.clear();
  fxLayer.push();
  fxLayer.blendMode(ADD);
  fxLayer.image(beamLayer, 0, 0);
  fxLayer.pop();
  for (const b of beams) {
    if (b.t >= 1) continue;
    const liveSegs = segmentsBetween(b.path, 0, b.head);
    drawBeamSegs(fxLayer, liveSegs, b);
    drawTip(fxLayer, liveSegs);
  }

  background(0);
  const ctx = drawingContext;
  const inten = constrain(glowBoost + beatPulse, 0, 2);
  const glowAmt = params.glow + glowBoost + beatPulse * 0.7;

  push();
  if (params.reactMotion && params.motionAmt > 0) {
    const cx = width / 2, cy = height / 2;
    motionAngle += (0.003 + inten * 0.012) * params.motionAmt;
    const breath = 1 + (0.03 * sin(frameCount * 0.04) + 0.2 * inten) * params.motionAmt;
    translate(cx, cy);
    rotate(motionAngle);
    scale(breath);
    translate(-cx, -cy);
  }

  drawTriangleMain();

  if (glowAmt > 0) {
    ctx.save();
    ctx.filter = 'blur(' + (glowAmt * 7) + 'px)';
    image(fxLayer, 0, 0);
    ctx.restore();
  }
  blendMode(ADD);
  image(fxLayer, 0, 0);
  if (glowAmt > 0 && inten > 0.6) {
    ctx.save();
    ctx.filter = 'blur(' + (glowAmt * 14) + 'px)';
    image(fxLayer, 0, 0);
    ctx.restore();
  }
  pop();

  drawLetterbox();

  if (!hideUI && !vjMode && !cleanOutput) {
    drawEmitter();
    drawHUD(dir);
    if (showHelp) drawHelp();
  }

  sendMirrorFrame();
}

function sendMirrorFrame() {
  if (vjRole !== 'output' || !ipc || !mirrorCtx) return;
  if (frameCount % 3 !== 0) return;
  try {
    mirrorCtx.drawImage(drawingContext.canvas, 0, 0,
      mirrorCanvas.width, mirrorCanvas.height);
    ipc.send('vj-frame', mirrorCanvas.toDataURL('image/jpeg', 0.82));
  } catch (e) { /* nunca deixar o espelho travar o frame */ }
}

function drawMirror() {
  background(0);
  if (!mirrorImg || !mirrorImg.complete || !mirrorImg.naturalWidth) {
    fill(150);
    textAlign(CENTER, CENTER);
    textSize(16);
    text('aguardando a saida (Resolume)...', width / 2, height / 2);
    return;
  }
  const ar = mirrorImg.naturalWidth / mirrorImg.naturalHeight;
  let w = width, h = width / ar;
  if (h > height) { h = height; w = height * ar; }
  drawingContext.drawImage(mirrorImg, (width - w) / 2, (height - h) / 2, w, h);
}

function drawLetterbox() {
  const st = stageRect();
  if (st.x === 0 && st.y === 0) return;
  noStroke();
  fill(0);
  if (st.x > 0) {
    rect(0, 0, st.x, height);
    rect(st.x + st.w, 0, width - (st.x + st.w), height);
  }
  if (st.y > 0) {
    rect(0, 0, width, st.y);
    rect(0, st.y + st.h, width, height - (st.y + st.h));
  }
}

function pathLength(p) {
  let len = 0;
  for (let i = 1; i < p.length; i++) len += dist(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y);
  return len;
}


//  Áudio
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playPing(freq, vol) {
  try {
    ensureAudio();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch (e) {
    /* nunca deixar o áudio abortar o frame */
  }
}

const PENTA = [0, 3, 5, 7, 10];

function playReflections(b) {
  const p = b.path;
  let passed = 0, acc = 0;
  for (let i = 1; i < p.length; i++) {
    acc += dist(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y);
    if (acc <= b.head) passed = i; else break;
  }
  let plays = 0;
  while (b.sounded < passed && plays < 4) {
    b.sounded++;
    const pt = p[b.sounded];
    const w = pt && pt.wall != null ? pt.wall : 0;
    const freq = 220 * Math.pow(2, PENTA[w % PENTA.length] / 12);
    const vol = map(b.sounded, 1, max(2, p.length), 0.16, 0.04) * params.volume;
    playPing(freq, vol);
    plays++;
  }
}

function segmentsBetween(p, dFrom, dTo) {
  const segs = [];
  if (dTo <= dFrom || p.length < 2) return segs;
  const totalSegs = p.length - 1;
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    const segLen = dist(a.x, a.y, b.x, b.y);
    const segStart = acc, segEnd = acc + segLen;
    acc = segEnd;
    if (segEnd < dFrom) continue;
    if (segStart > dTo) break;
    const lo = max(dFrom, segStart), hi = min(dTo, segEnd);
    const u0 = segLen > EPS ? (lo - segStart) / segLen : 0;
    const u1 = segLen > EPS ? (hi - segStart) / segLen : 1;
    segs.push({
      x1: lerp(a.x, b.x, u0), y1: lerp(a.y, b.y, u0),
      x2: lerp(a.x, b.x, u1), y2: lerp(a.y, b.y, u1),
      fade: map(i, 1, totalSegs, 1, 0.3),
      idx: i,
    });
  }
  return segs;
}

//  Render
function hsv(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, gg = 0, b = 0;
  if (h < 60) { r = c; gg = x; }
  else if (h < 120) { r = x; gg = c; }
  else if (h < 180) { gg = c; b = x; }
  else if (h < 240) { gg = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: (r + m) * 255, g: (gg + m) * 255, b: (b + m) * 255 };
}

function segBaseColor(s, b) {
  if (params.imgPalette && paletteImg) {
    return samplePalette((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2);
  }
  const off = b ? b.hueOff : 0;
  if (params.rainbow) return hsv(s.idx * params.hueSpeed + off, 1, 1);
  if (beams.length > 1) return hsv(off, 1, 1);
  return baseRGB;
}

function samplePalette(x, y) {
  const bb = polyBB;
  const u = constrain((x - bb.minx) / max(1, bb.maxx - bb.minx), 0, 1);
  const v = constrain((y - bb.miny) / max(1, bb.maxy - bb.miny), 0, 1);
  const ix = floor(u * (paletteImg.width - 1));
  const iy = floor(v * (paletteImg.height - 1));
  const idx = 4 * (iy * paletteImg.width + ix);
  const px = paletteImg.pixels;
  return { r: px[idx], g: px[idx + 1], b: px[idx + 2] };
}

function drawBeamSegs(g, segs, b) {
  if (segs.length === 0) return;
  g.push();
  g.blendMode(ADD);
  g.strokeCap(ROUND);
  for (const s of segs) {
    const base = segBaseColor(s, b);
    const t = 0.55 * s.fade;
    const cr = lerp(base.r, 255, t), cg = lerp(base.g, 255, t), cb = lerp(base.b, 255, t);
    g.stroke(base.r, base.g, base.b, 45 * s.fade);
    g.strokeWeight(4);
    g.line(s.x1, s.y1, s.x2, s.y2);
    g.stroke(cr, cg, cb, 230 * s.fade);
    g.strokeWeight(1.3);
    g.line(s.x1, s.y1, s.x2, s.y2);
  }
  g.pop();
}

function drawTip(g, segs) {
  if (segs.length === 0) return;
  const tip = segs[segs.length - 1];
  g.push();
  g.blendMode(ADD);
  g.noStroke();
  g.fill(255, 235, 235);
  g.circle(tip.x2, tip.y2, 7);
  g.pop();
}

function drawTriangleMain() {
  push();
  noFill();
  stroke(baseRGB.r * 0.6, baseRGB.g * 0.6, baseRGB.b * 0.6);
  strokeWeight(2);
  beginShape();
  for (const v of tri) vertex(v.x, v.y);
  endShape(CLOSE);
  pop();
}

function drawEmitter() {
  push();
  const hot = isHover(emitter.pos) || movingSource;
  noStroke();
  fill(baseRGB.r, baseRGB.g, baseRGB.b);
  circle(emitter.pos.x, emitter.pos.y, hot ? 20 : 16);
  stroke(255);
  strokeWeight(2);
  noFill();
  circle(emitter.pos.x, emitter.pos.y, hot ? 20 : 16);
  noStroke();
  fill(255, 230, 230);
  circle(emitter.pos.x, emitter.pos.y, 6);
  pop();
}

function drawHUD(dir) {
  push();
  let deg = degrees(atan2(-dir.y, dir.x));
  if (deg < 0) deg += 360;
  const label = deg.toFixed(1) + '°';

  const bx = 24, by = 24, bw = 150, bh = 64;
  noStroke();
  fill(15);
  rect(bx, by, bw, bh, 8);
  stroke(60);
  strokeWeight(2);
  noFill();
  rect(bx, by, bw, bh, 8);

  noStroke();
  fill(baseRGB.r, baseRGB.g, baseRGB.b);
  textAlign(RIGHT, CENTER);
  textStyle(BOLD);
  textSize(34);
  text(label, bx + bw - 16, by + bh / 2 + 2);

  // status da órbita
  textAlign(LEFT, CENTER);
  textSize(13);
  if (orbitPeriod > 0) {
    fill(120, 255, 160);
    text('CICLO FECHADO\n' + orbitPeriod + ' saltos', bx, by + bh + 22);
  } else {
    fill(110);
    text('orbita aberta', bx, by + bh + 16);
  }

  if ((params.auto || params.autoPos) && !anyShooting()) {
    textAlign(LEFT, CENTER);
    if (autoPaused) {
      fill(255, 120, 120);
      text('AUTO PAUSADO (espaco)', bx, by + bh + 48);
    } else {
      const remain = max(0, (holdUntil - millis()) / 1000);
      fill(255, 200, 90);
      text('proximo em ' + remain.toFixed(1) + 's  (salve agora!)', bx, by + bh + 48);
    }
  }

  if (params.reactive) {
    textAlign(LEFT, CENTER);
    const my = by + bh + 72;
    if (!reactReady) {
      fill(255, 120, 120);
      text('AUDIO: aguardando permissao / sinal...', bx, my);
    } else {
      const lvl = constrain(glowBoost / (params.bloomReact || 1), 0, 1);
      fill(120, 200, 255);
      text('AUDIO ativo', bx, my);
      noStroke();
      fill(40);
      rect(bx + 80, my - 5, 80, 10, 3);
      fill(120, 200, 255);
      rect(bx + 80, my - 5, 80 * lvl, 10, 3);
      fill(255, 80, 80, 255 * beatPulse);
      circle(bx + 175, my, 8 + 6 * beatPulse);
    }
  }

  fill(130);
  textAlign(LEFT, BOTTOM);
  textStyle(NORMAL);
  textSize(13);
  text('toque dispara  |  arraste ●  |  painel ↗', 24, height - 18);
  pop();
}

// overlay com a lista de atalhos (tecla H)
function drawHelp() {
  push();
  const lines = [
    'ATALHOS',
    'S  salvar PNG',
    'G  gravar GIF (3s)',
    'N  novo feixe aleatorio',
    'R  surpreenda-me',
    'C  limpar teia',
    'espaco  pausar/continuar auto',
    'F  tela cheia',
    'V  modo VJ (sem UI, p/ captura)',
    'setas ↑/↓  reflexoes',
    'H  fecha esta ajuda',
  ];
  const w = 320, h = 24 + lines.length * 24;
  const x = 24, y = height - h - 60;
  noStroke();
  fill(0, 200);
  rect(x, y, w, h, 10);
  stroke(80);
  strokeWeight(1);
  noFill();
  rect(x, y, w, h, 10);
  noStroke();
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  for (let i = 0; i < lines.length; i++) {
    fill(i === 0 ? color(255, 80, 80) : color(210));
    textStyle(i === 0 ? BOLD : NORMAL);
    textSize(i === 0 ? 15 : 13);
    text(lines[i], x + 18, y + 14 + i * 24);
  }
  pop();
}

//  Interação
function isHover(v) {
  return dist(mouseX, mouseY, v.x, v.y) < 18;
}

// clique/toque esta sobre algum pane? (nao deve disparar feixe)
function overUI(event) {
  const t = event && event.target;
  if (!t || !t.closest) return false;
  return !!t.closest('.tp-dfwv') || (reactHost && reactHost.contains(t));
}

function pointerPress() {
  if (params.sound) ensureAudio();
  if (isHover(emitter.pos)) {
    movingSource = true;
  } else {
    fireShot(createVector(mouseX - emitter.pos.x, mouseY - emitter.pos.y));
  }
}

function pointerDrag() {
  if (movingSource) {
    emitter.pos.set(mouseX, mouseY);
    clampInside(emitter.pos);
  }
}

function mousePressed(event) {
  if (overUI(event)) return;
  pointerPress();
}

function mouseDragged() { pointerDrag(); }

function mouseReleased() { movingSource = false; }

function touchStarted(event) {
  if (overUI(event)) return true;
  pointerPress();
  return false;
}

function touchMoved(event) {
  if (overUI(event)) return true;
  pointerDrag();
  return false;
}

function touchEnded(event) {
  if (overUI(event)) return true;
  movingSource = false;
  return false;
}

function setVJ(on) {
  vjMode = on;
  const el = (pane && pane.element) || document.querySelector('.tp-dfwv');
  if (el) el.style.display = on ? 'none' : '';
  updateReactPaneVisibility();
  if (on) { noCursor(); fullscreen(true); }
  else { cursor(); fullscreen(false); }
}

function keyPressed() {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;

  const k = (key || '').toLowerCase();
  if (k === 's') { exportPNG(); }
  else if (k === 'g') { saveGif('laser', 3); }
  else if (k === 'n') { const a = random(TWO_PI); fireShot(createVector(cos(a), sin(a))); }
  else if (k === 'r') { surprise(); }
  else if (k === 'c') { beamLayer.clear(); }
  else if (k === 'f') { fullscreen(!fullscreen()); }
  else if (k === 'v') { setVJ(!vjMode); }
  else if (k === 'h') { showHelp = !showHelp; }
  else if (key === ' ') { autoPaused = !autoPaused; }
  else if (keyCode === UP_ARROW) {
    params.bounces = min(params.bounces + 10, 1200);
    if (pane) pane.refresh();
    if (centerDir) fireShot(centerDir);
  } else if (keyCode === DOWN_ARROW) {
    params.bounces = max(params.bounces - 10, 2);
    if (pane) pane.refresh();
    if (centerDir) fireShot(centerDir);
  } else {
    return;
  }
  return false;
}

function pointInPolygon(p) {
  let hasNeg = false, hasPos = false;
  for (let i = 0; i < tri.length; i++) {
    const a = tri[i], b = tri[(i + 1) % tri.length];
    const d = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
    if (d < 0) hasNeg = true;
    if (d > 0) hasPos = true;
  }
  return !(hasNeg && hasPos);
}

function clampInside(pt) {
  if (pointInPolygon(pt)) return;
  const c = triCentroid();
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    const test = p5.Vector.lerp(c, pt, m);
    if (pointInPolygon(test)) lo = m;
    else hi = m;
  }
  const inside = p5.Vector.lerp(c, pt, lo * 0.96);
  pt.set(inside.x, inside.y);
}
