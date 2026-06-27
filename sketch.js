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
  sound: false,
  volume: 0.6,
  auto: false,
  autoPos: false,
  autoStep: 0.18,
  holdTime: 6,
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
let orbitPeriod = 0;
let hideUI = false;
let audioCtx = null;

let baseRGB = { r: 255, g: 40, b: 40 };
function refreshColor() {
  const c = color(params.color);
  baseRGB = { r: red(c), g: green(c), b: blue(c) };
}

let pane = null;

const PRESETS = {
  'Triangulo classico': { sides: 3, beams: 1, bounces: 130, rainbow: false, color: '#ff2828', glow: 1.0 },
  'Estrela arco-iris':   { sides: 5, beams: 6, bounces: 160, rainbow: true,  hueSpeed: 12, glow: 1.1 },
  'Hexagono gelo':       { sides: 6, beams: 3, bounces: 320, rainbow: false, color: '#28a0ff', glow: 0.9 },
  'Octogono neon':       { sides: 8, beams: 4, bounces: 240, rainbow: true,  hueSpeed: 8,  glow: 1.2 },
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  beamLayer = createGraphics(width, height);
  fxLayer = createGraphics(width, height);
  buildTriangle();
  emitter = { pos: triCentroid() };
  refreshColor();
  setupPane();
  fireShot(createVector(0.85, -0.5));
}

function setupPane() {
  if (typeof Pane === 'undefined') { setTimeout(setupPane, 50); return; }
  pane = new Pane({ title: 'Controles' });

  const refire = () => { if (centerDir) fireShot(centerDir); };

  // --- Presets ---
  const fPre = pane.addFolder({ title: 'Presets', expanded: false });
  const opts = {};
  for (const k of Object.keys(PRESETS)) opts[k] = k;
  fPre.addBinding(params, 'preset', { label: 'Preset', options: opts })
    .on('change', () => applyPreset(params.preset));
  fPre.addButton({ title: 'Surpreenda-me' }).on('click', surprise);

  // --- Geometria ---
  const fGeo = pane.addFolder({ title: 'Geometria' });
  fGeo.addBinding(params, 'sides', { min: 3, max: 12, step: 1, label: 'Lados' })
    .on('change', () => { buildTriangle(); emitter.pos = triCentroid(); refire(); });
  fGeo.addBinding(params, 'beams', { min: 1, max: 8, step: 1, label: 'Feixes' })
    .on('change', refire);

  // --- Animação ---
  const fAnim = pane.addFolder({ title: 'Animacao' });
  fAnim.addBinding(params, 'speed', { min: 0.005, max: 0.4, step: 0.005, label: 'Velocidade' });
  fAnim.addBinding(params, 'bounces', { min: 2, max: 1200, step: 1, label: 'Reflexoes' })
    .on('change', refire);

  // --- Visual ---
  const fVis = pane.addFolder({ title: 'Visual' });
  fVis.addBinding(params, 'glow', { min: 0, max: 2, step: 0.05, label: 'Brilho' });
  fVis.addBinding(params, 'color', { label: 'Cor' })
    .on('change', () => { refreshColor(); refire(); });
  fVis.addBinding(params, 'rainbow', { label: 'Arco-iris' }).on('change', refire);
  fVis.addBinding(params, 'hueSpeed', { min: 1, max: 60, step: 1, label: 'Matiz/refl' })
    .on('change', refire);

  // --- Áudio ---
  const fAud = pane.addFolder({ title: 'Audio' });
  fAud.addBinding(params, 'sound', { label: 'Som' })
    .on('change', () => { if (params.sound) ensureAudio(); });
  fAud.addBinding(params, 'volume', { min: 0, max: 1, step: 0.05, label: 'Volume' });

  // --- Automático ---
  const fAuto = pane.addFolder({ title: 'Automatico' });
  fAuto.addBinding(params, 'auto', { label: 'Girar' });
  fAuto.addBinding(params, 'autoPos', { label: 'Posicionar' });
  fAuto.addBinding(params, 'autoStep', { min: 0.02, max: 0.6, step: 0.01, label: 'Passo giro' });
  fAuto.addBinding(params, 'holdTime', { min: 1, max: 15, step: 0.5, label: 'Pausa (s)' });

  // --- Ações ---
  const fAct = pane.addFolder({ title: 'Acoes' });
  fAct.addButton({ title: 'Novo feixe aleatorio' }).on('click', () => {
    const a = random(TWO_PI);
    fireShot(createVector(cos(a), sin(a)));
  });
  fAct.addButton({ title: 'Limpar' }).on('click', () => beamLayer.clear());

  // --- Exportar ---
  const fExp = pane.addFolder({ title: 'Exportar' });
  fExp.addButton({ title: 'Salvar PNG' }).on('click', exportPNG);
  fExp.addButton({ title: 'Gravar GIF (3s)' }).on('click', () => saveGif('laser', 3));
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

function surprise() {
  params.sides = floor(random(3, 9));
  params.beams = floor(random(1, 7));
  params.bounces = floor(random(140, 380));
  params.glow = random(0.8, 1.4);
  params.rainbow = random() < 0.5;
  if (!params.rainbow) params.color = rgbToHex(hsv(random(360), random(0.7, 1), 1));
  else params.hueSpeed = floor(random(6, 24));
  refreshColor();
  buildTriangle();

  const c = triCentroid();
  const v = tri[floor(random(tri.length))];
  emitter.pos = p5.Vector.lerp(c, v, random(0, 0.45));

  let dir = createVector(1, 0);
  for (let i = 0; i < 40; i++) {
    const a = random(TWO_PI);
    dir = createVector(cos(a), sin(a));
    const period = detectOrbit(emitter.pos, dir, min(params.bounces, 600));
    if (period === 0 || period > 30) break;
  }
  if (pane) pane.refresh();
  fireShot(dir);
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
}

//  Geometria
function buildTriangle() {
  const cx = width / 2, cy = height / 2;
  const R = min(width, height) * 0.42;
  const n = max(3, floor(params.sides));
  tri = [];
  for (let i = 0; i < n; i++) {
    const a = -HALF_PI + i * TWO_PI / n;
    tri.push(createVector(cx + R * cos(a), cy + R * sin(a)));
  }
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

function draw() {
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
  drawTriangleTo(fxLayer);
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
  if (params.glow > 0) {
    ctx.save();
    ctx.filter = 'blur(' + (params.glow * 7) + 'px)';
    image(fxLayer, 0, 0);
    ctx.restore();
  }
  push();
  blendMode(ADD);
  image(fxLayer, 0, 0);
  pop();

  if (!hideUI) {
    drawEmitter();
    drawHUD(dir);
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
  const off = b ? b.hueOff : 0;
  if (params.rainbow) return hsv(s.idx * params.hueSpeed + off, 1, 1);
  if (beams.length > 1) return hsv(off, 1, 1);
  return baseRGB;
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

function drawTriangleTo(g) {
  g.push();
  g.noFill();
  g.stroke(baseRGB.r * 0.6, baseRGB.g * 0.6, baseRGB.b * 0.6);
  g.strokeWeight(2);
  g.beginShape();
  for (const v of tri) g.vertex(v.x, v.y);
  g.endShape(CLOSE);
  g.pop();
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
    const remain = max(0, (holdUntil - millis()) / 1000);
    fill(255, 200, 90);
    textAlign(LEFT, CENTER);
    text('proximo em ' + remain.toFixed(1) + 's  (salve agora!)', bx, by + bh + 48);
  }

  fill(150);
  textAlign(LEFT, BOTTOM);
  textStyle(NORMAL);
  textSize(13);
  pop();
}

//  Interação
function isHover(v) {
  return dist(mouseX, mouseY, v.x, v.y) < 18;
}

function mousePressed(event) {
  if (event && event.target && event.target.closest &&
      event.target.closest('.tp-dfwv')) return;
  if (params.sound) ensureAudio();
  if (isHover(emitter.pos)) {
    movingSource = true;
  } else {
    fireShot(createVector(mouseX - emitter.pos.x, mouseY - emitter.pos.y));
  }
}

function mouseDragged() {
  if (movingSource) {
    emitter.pos.set(mouseX, mouseY);
    clampInside(emitter.pos);
  }
}

function mouseReleased() {
  movingSource = false;
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
