import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as CANNON from "cannon-es";

// ---------------------------------------------------------------------------
// Dimensions (scene units). The drum spins around the x axis.
// ---------------------------------------------------------------------------
const R = 2.6;            // inner radius of the drum
const L = 2.8;            // length of the drum along its axle
const BALL_R = 0.26;
const SIDES = 18;         // the drum wall is an 18-sided prism of bars
const WALL_T = 0.3;       // physics thickness of the wall (thick = no tunnelling)
const BASE_Y = -R - 0.95; // top of the wooden base
const TAU = Math.PI * 2;

const DRAW_SPIN = 2.8;    // rad/s while drawing
const CRANK_SPIN = 3.0;   // rad/s while the crank is held
const PRESENT_SCALE = 2.8;

const COLORS = ["#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#3a86ff", "#8338ec", "#ff006e", "#06d6a0", "#fb5607"];
const colorFor = (n) => COLORS[Math.min(8, Math.floor((n - 1) / 10))];

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0c0e1c");
scene.fog = new THREE.Fog("#0c0e1c", 24, 48);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(7, 4.6, 12.5);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, -1.3, 1.6);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 24;
controls.maxPolarAngle = Math.PI * 0.52;

scene.add(new THREE.HemisphereLight("#cfd8ff", "#2a2030", 0.7));

const key = new THREE.DirectionalLight("#fff3e0", 2.4);
key.position.set(6, 12, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.02;
scene.add(key);

const rim = new THREE.DirectionalLight("#7aa2ff", 0.9);
rim.position.set(-8, 5, -6);
scene.add(rim);

// A warm light that follows the ball being drawn, so it lights up its neighbours.
const glow = new THREE.PointLight("#ffd27a", 0, 3.5, 2);
scene.add(glow);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: "#151729", roughness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = BASE_Y - 0.3;
floor.receiveShadow = true;
scene.add(floor);

// ---------------------------------------------------------------------------
// Materials and small helpers
// ---------------------------------------------------------------------------
const chrome = new THREE.MeshStandardMaterial({ color: "#dfe3ec", metalness: 1, roughness: 0.2 });
const brass = new THREE.MeshStandardMaterial({ color: "#d4a64a", metalness: 1, roughness: 0.3 });
const wood = new THREE.MeshStandardMaterial({ color: "#6b3f22", roughness: 0.65 });
const red = new THREE.MeshStandardMaterial({ color: "#b3202a", roughness: 0.35 });
const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder running from point a to point b. */
function rod(a, b, radius, material, segments = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), segments), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Stand, base and the tray the drawn balls sit in (static)
// ---------------------------------------------------------------------------
const base = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.3, 10.8), wood);
base.position.set(0, BASE_Y - 0.15, 1.7);
base.castShadow = base.receiveShadow = true;
scene.add(base);

for (const xs of [-(L / 2 + 0.6), L / 2 + 0.6]) {
  const top = v3(xs, 0, 0);
  scene.add(rod(v3(xs, BASE_Y, -1.6), top, 0.09, brass));
  scene.add(rod(v3(xs, BASE_Y, 1.6), top, 0.09, brass));
  scene.add(rod(v3(xs, BASE_Y / 2, -0.8), v3(xs, BASE_Y / 2, 0.8), 0.06, brass));
  scene.add(rod(v3(xs - 0.14, 0, 0), v3(xs + 0.14, 0, 0), 0.2, chrome, 20));
}

/** Where the i-th drawn ball sits in the tray: 6 rows of 15 in front of the cage. */
function slotPosition(i) {
  return v3(-3.5 + (i % 15) * 0.5, BASE_Y + 0.19, R + 1.1 + Math.floor(i / 15) * 0.55);
}

const holders = new THREE.InstancedMesh(new THREE.TorusGeometry(0.21, 0.035, 8, 24), brass, 90);
{
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  for (let i = 0; i < 90; i++) {
    const p = slotPosition(i);
    m.compose(v3(p.x, BASE_Y + 0.035, p.z), q, new THREE.Vector3(1, 1, 1));
    holders.setMatrixAt(i, m);
  }
  holders.receiveShadow = true;
  scene.add(holders);
}

// ---------------------------------------------------------------------------
// The drum (visual): bars, rings, end spokes, baffles, axle and crank
// ---------------------------------------------------------------------------
const cage = new THREE.Group();
scene.add(cage);
const barR = R + 0.04;

{
  const barGeo = new THREE.CylinderGeometry(0.03, 0.03, L, 8);
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * TAU;
    const bar = new THREE.Mesh(barGeo, chrome);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, Math.cos(a) * barR, Math.sin(a) * barR);
    bar.castShadow = true;
    cage.add(bar);
  }

  for (const x of [-L / 2, -L / 6, L / 6, L / 2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(barR, 0.045, 8, 96), brass);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    ring.castShadow = true;
    cage.add(ring);
  }

  const glass = new THREE.MeshPhysicalMaterial({
    color: "#cfe3ff", transparent: true, opacity: 0.07, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
  });
  for (const s of [-1, 1]) {
    const x = (s * L) / 2;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      cage.add(rod(v3(x, 0, 0), v3(x, Math.cos(a) * barR, Math.sin(a) * barR), 0.025, chrome, 6));
    }
    cage.add(rod(v3(x - 0.08, 0, 0), v3(x + 0.08, 0, 0), 0.28, brass, 24));
    const pane = new THREE.Mesh(new THREE.CircleGeometry(barR, 64), glass);
    pane.rotation.y = Math.PI / 2;
    pane.position.x = x;
    cage.add(pane);
  }

  // Baffles that lift and tumble the balls.
  const baffleGeo = new THREE.BoxGeometry(L, 0.5, 0.05);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + TAU / 8;
    const baffle = new THREE.Mesh(baffleGeo, chrome);
    baffle.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    baffle.position.set(0, Math.cos(a) * (R - 0.25), Math.sin(a) * (R - 0.25));
    baffle.castShadow = true;
    cage.add(baffle);
  }

  // Axle stubs and the crank (they turn with the drum).
  cage.add(rod(v3(-L / 2, 0, 0), v3(-(L / 2 + 0.85), 0, 0), 0.08, chrome));
  cage.add(rod(v3(L / 2, 0, 0), v3(L / 2 + 1.1, 0, 0), 0.08, chrome));
  const cx = L / 2 + 1.0;
  cage.add(rod(v3(cx, 0, 0), v3(cx, 1.1, 0), 0.06, chrome));
  cage.add(rod(v3(cx, 1.1, 0), v3(cx + 0.55, 1.1, 0), 0.11, red, 16));
}

// ---------------------------------------------------------------------------
// Physics world: the drum is a kinematic body we spin; the balls are dynamic.
// ---------------------------------------------------------------------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 12;
world.allowSleep = false;

const ballMat = new CANNON.Material("ball");
const cageMat = new CANNON.Material("cage");
world.addContactMaterial(new CANNON.ContactMaterial(ballMat, ballMat, { friction: 0.04, restitution: 0.55 }));
world.addContactMaterial(new CANNON.ContactMaterial(ballMat, cageMat, { friction: 0.12, restitution: 0.45 }));

const cageBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: cageMat });
{
  const xAxis = new CANNON.Vec3(1, 0, 0);
  const segHalfWidth = R * Math.tan(Math.PI / SIDES) * 1.15;
  const d = R + WALL_T / 2;
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * TAU;
    cageBody.addShape(
      new CANNON.Box(new CANNON.Vec3(L / 2 + WALL_T, WALL_T / 2, segHalfWidth)),
      new CANNON.Vec3(0, Math.cos(a) * d, Math.sin(a) * d),
      new CANNON.Quaternion().setFromAxisAngle(xAxis, a)
    );
  }
  for (const s of [-1, 1]) {
    cageBody.addShape(
      new CANNON.Box(new CANNON.Vec3(WALL_T / 2, R + WALL_T, R + WALL_T)),
      new CANNON.Vec3(s * (L / 2 + WALL_T / 2), 0, 0)
    );
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + TAU / 8;
    cageBody.addShape(
      new CANNON.Box(new CANNON.Vec3(L / 2, 0.25, 0.05)),
      new CANNON.Vec3(0, Math.cos(a) * (R - 0.25), Math.sin(a) * (R - 0.25)),
      new CANNON.Quaternion().setFromAxisAngle(xAxis, a)
    );
  }
}
world.addBody(cageBody);

/** Free spots inside the drum on a loose grid, lowest first. */
function spawnPoints() {
  const pts = [];
  const step = BALL_R * 2.15;
  const lim = R - 0.65; // stay clear of the baffles
  for (let y = -lim; y <= lim; y += step) {
    for (let z = -lim; z <= lim; z += step) {
      if (y * y + z * z > lim * lim) continue;
      for (let x = -L / 2 + BALL_R + 0.08; x <= L / 2 - BALL_R - 0.08; x += step) {
        pts.push(new CANNON.Vec3(x + (Math.random() - 0.5) * 0.04, y, z));
      }
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// The 90 balls
// ---------------------------------------------------------------------------
/** True for numbers that read as another ball upside down (6/9, 18/81, …): those get underlined. */
function needsUnderline(n) {
  const flip = { 0: "0", 1: "1", 6: "9", 8: "8", 9: "6" };
  let r = "";
  for (const d of String(n)) {
    if (!(d in flip)) return false;
    r = flip[d] + r;
  }
  const m = Number(r);
  return r[0] !== "0" && m !== n && m >= 1 && m <= 90;
}

function ballTexture(n) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = colorFor(n);
  g.fillRect(0, 0, 512, 256);
  // The number is printed twice, on opposite sides (u = 0.25 faces +z, u = 0.75 faces -z).
  for (const cx of [128, 384]) {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(cx, 128, 74, 0, TAU);
    g.fill();
    g.fillStyle = "#16161f";
    g.font = `800 ${n > 9 ? 82 : 96}px system-ui, "Segoe UI", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), cx, 134);
    if (needsUnderline(n)) g.fillRect(cx - 28, 178, 56, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const ballGeo = new THREE.SphereGeometry(BALL_R, 40, 20);
const ballShape = new CANNON.Sphere(BALL_R);
const balls = [];
const ballByMesh = new Map();

for (let n = 1; n <= 90; n++) {
  const tex = ballTexture(n);
  const mesh = new THREE.Mesh(
    ballGeo,
    // The emissive map is the ball's own texture, so lighting it up brightens its real colours.
    new THREE.MeshPhysicalMaterial({
      map: tex, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08,
      emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0,
    })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const body = new CANNON.Body({ mass: 1, shape: ballShape, material: ballMat, linearDamping: 0.04, angularDamping: 0.08 });
  const ball = { n, mesh, body, inCage: true };
  balls.push(ball);
  ballByMesh.set(mesh, ball);
}

// ---------------------------------------------------------------------------
// Tweens
// ---------------------------------------------------------------------------
const tweens = new Set();
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

function tween(ms, fn, ease = easeInOut) {
  return new Promise((resolve) => tweens.add({ t0: performance.now(), ms, fn, ease, resolve }));
}
const wait = (ms) => tween(ms, () => {});

function waitUntil(cond, ms) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => (cond() || performance.now() - t0 > ms ? resolve() : requestAnimationFrame(check));
    check();
  });
}

function runTweens(now) {
  for (const tw of tweens) {
    const k = Math.min(1, (now - tw.t0) / tw.ms);
    tw.fn(tw.ease(k));
    if (k >= 1) {
      tweens.delete(tw);
      tw.resolve();
    }
  }
}

const dummy = new THREE.Object3D();
/** Orientation that turns a ball's printed number (local +z) towards the camera. */
function faceCamera(pos) {
  dummy.position.copy(pos);
  dummy.lookAt(camera.position);
  return dummy.quaternion.clone();
}

// ---------------------------------------------------------------------------
// Game state, HUD
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const lastBallEl = $("lastBall");
const drawBtn = $("drawBtn");
const crankBtn = $("crankBtn");
const shakeBtn = $("shakeBtn");
const resetBtn = $("resetBtn");
const speedInput = $("speed");

let state = { drawn: [], last: null, remaining: 90 };
let busy = false;
let cranking = false;
let drawing = false;   // the draw sequence controls the drum speed
let drawOmega = 0;
let omega = 0;
let suction = null;    // { body, target } while the drawn ball is pulled to the top
let litBall = null;

function setStatus(text, error = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", error);
}

function idleStatus() {
  setStatus(state.remaining ? `${state.remaining} balls in the cage` : "All 90 balls are out. Start a new game.");
}

function updateButtons() {
  drawBtn.disabled = busy || state.remaining === 0;
  resetBtn.disabled = busy;
}

function renderHud(pop = false) {
  $("drawnCount").textContent = state.drawn.length;
  const last = state.last;
  lastBallEl.classList.toggle("empty", last == null);
  lastBallEl.querySelector("span").textContent = last ?? "–";
  if (last != null) lastBallEl.style.setProperty("--ball", colorFor(last));
  else lastBallEl.style.removeProperty("--ball");
  if (pop) {
    lastBallEl.classList.remove("pop");
    void lastBallEl.offsetWidth;
    lastBallEl.classList.add("pop");
  }
  const history = $("history");
  history.innerHTML = "";
  for (const n of state.drawn.slice(0, -1).slice(-10).reverse()) {
    const li = document.createElement("li");
    li.textContent = n;
    li.style.setProperty("--ball", colorFor(n));
    history.appendChild(li);
  }
  updateButtons();
}

function lightUp(ball) {
  if (litBall && litBall !== ball) litBall.mesh.material.emissiveIntensity = 0;
  litBall = ball;
}

function unlight() {
  if (litBall) litBall.mesh.material.emissiveIntensity = 0;
  litBall = null;
  glow.intensity = 0;
}

// ---------------------------------------------------------------------------
// Drawing a ball
// ---------------------------------------------------------------------------
async function postJson(url) {
  const res = await fetch(url, { method: "POST" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

world.addEventListener("preStep", () => {
  if (!suction) return;
  // A damped spring that pulls the chosen ball up to the top of the drum,
  // shouldering the other balls out of the way.
  const { body: b, target: t } = suction;
  const k = 70;
  const c = 9;
  b.force.x += b.mass * (k * (t.x - b.position.x) - c * b.velocity.x);
  b.force.y += b.mass * (k * (t.y - b.position.y) - c * b.velocity.y - world.gravity.y);
  b.force.z += b.mass * (k * (t.z - b.position.z) - c * b.velocity.z);
});

/** Lift the ball out through the top of the drum, show it off, then set it in its tray slot. */
async function extract(ball, slotIndex, onPresent) {
  if (ball.inCage) {
    world.removeBody(ball.body);
    ball.inCage = false;
  }
  suction = null;

  const mesh = ball.mesh;
  const start = mesh.position.clone();
  const present = camera.position.clone().lerp(controls.target, 0.5);
  const out = new THREE.CatmullRomCurve3([start, v3(0, R - 0.2, 0), v3(0, R + 0.8, 0.4), present]);
  const q0 = mesh.quaternion.clone();
  const q1 = faceCamera(present);
  await tween(1300, (k) => {
    mesh.position.copy(out.getPoint(k));
    mesh.scale.setScalar(1 + k * (PRESENT_SCALE - 1));
    mesh.quaternion.slerpQuaternions(q0, q1, k);
  });

  onPresent();
  await tween(1600, (k) => {
    mesh.position.y = present.y + Math.sin(k * Math.PI * 2) * 0.08;
    mesh.quaternion.copy(faceCamera(mesh.position));
  }, (k) => k);

  const slot = slotPosition(slotIndex);
  const from = mesh.position.clone();
  const mid = from.clone().lerp(slot, 0.5);
  mid.y = Math.max(from.y, slot.y) + 1.2;
  const down = new THREE.CatmullRomCurve3([from, mid, slot]);
  const qa = mesh.quaternion.clone();
  const qb = faceCamera(slot);
  await tween(1100, (k) => {
    mesh.position.copy(down.getPoint(k));
    mesh.scale.setScalar(PRESENT_SCALE + k * (1 - PRESENT_SCALE));
    mesh.quaternion.slerpQuaternions(qa, qb, k);
  });
}

async function draw() {
  if (busy || state.remaining === 0) return;
  busy = true;
  updateButtons();
  setStatus("Spinning…");

  // Ask the server for the ball straight away; the spin is just theatre.
  const request = postJson("/api/draw");
  request.catch(() => {});

  drawing = true;
  drawOmega = omega;
  try {
    const from = omega;
    await tween(700, (k) => (drawOmega = from + (DRAW_SPIN - from) * k));
    await wait(2300);
    const result = await request;

    setStatus("Slowing down…");
    await tween(1400, (k) => (drawOmega = DRAW_SPIN * (1 - k)), easeOut);

    const ball = balls[result.number - 1];
    setStatus(`Here comes the ball…`);
    lightUp(ball);
    if (ball.inCage) {
      suction = { body: ball.body, target: new CANNON.Vec3(0, R - 0.85, 0) };
      await waitUntil(() => ball.body.position.distanceTo(suction.target) < 0.25, 2200);
    }

    await extract(ball, result.drawn.length - 1, () => {
      state = result;
      renderHud(true);
      setStatus(`Ball ${result.number}!`);
    });
  } catch (err) {
    setStatus(err.message || "Draw failed", true);
  } finally {
    suction = null;
    drawing = false;
    busy = false;
    updateButtons();
  }
}

async function newGame() {
  if (busy) return;
  if (!confirm("Start a new game? All drawn balls go back in the cage.")) return;
  busy = true;
  updateButtons();
  try {
    state = await postJson("/api/reset");
    unlight();
    renderHud();
    setStatus("Returning the balls…");
    const out = balls.filter((b) => !b.inCage);
    const pts = spawnPoints().reverse(); // top of the drum first
    await Promise.all(
      out.map(async (b, i) => {
        await wait(i * 25);
        const from = b.mesh.position.clone();
        const p = pts[i % pts.length];
        const to = v3(p.x, p.y, p.z);
        const mid = from.clone().lerp(to, 0.5);
        mid.y += 3;
        const path = new THREE.CatmullRomCurve3([from, mid, to]);
        await tween(700, (k) => b.mesh.position.copy(path.getPoint(k)));
        b.mesh.scale.setScalar(1);
        b.body.position.copy(p);
        b.body.velocity.setZero();
        b.body.angularVelocity.setZero();
        world.addBody(b.body);
        b.inCage = true;
      })
    );
    idleStatus();
  } catch (err) {
    setStatus(err.message || "Reset failed", true);
  } finally {
    busy = false;
    updateButtons();
  }
}

function shake() {
  for (const b of balls) {
    if (!b.inCage || b.body === suction?.body) continue;
    b.body.applyImpulse(new CANNON.Vec3((Math.random() - 0.5) * 5, 4 + Math.random() * 7, (Math.random() - 0.5) * 5));
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
drawBtn.addEventListener("click", draw);
shakeBtn.addEventListener("click", shake);
resetBtn.addEventListener("click", newGame);

const setCrank = (on) => {
  cranking = on;
  crankBtn.classList.toggle("active", on);
};
crankBtn.addEventListener("pointerdown", (e) => {
  crankBtn.setPointerCapture(e.pointerId);
  setCrank(true);
});
for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) crankBtn.addEventListener(ev, () => setCrank(false));

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    setCrank(true);
  } else if (e.code === "Enter" && !(e.target instanceof HTMLButtonElement)) {
    draw();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") setCrank(false);
});
window.addEventListener("blur", () => setCrank(false));

// Click (not drag) a ball in the cage to flick it.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

function ballUnderPointer(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const meshes = balls.filter((b) => b.inCage).map((b) => b.mesh);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  return hit ? ballByMesh.get(hit.object) : null;
}

canvas.addEventListener("pointerdown", (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const ball = ballUnderPointer(e);
  if (!ball || ball.body === suction?.body) return;
  const d = raycaster.ray.direction;
  ball.body.applyImpulse(new CANNON.Vec3(d.x * 5, 7 + Math.random() * 3, d.z * 5));
});
canvas.addEventListener("pointermove", (e) => {
  if (e.buttons) return;
  canvas.style.cursor = ballUnderPointer(e) ? "pointer" : "grab";
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  runTweens(now);

  if (drawing) {
    omega = drawOmega;
  } else {
    const target = cranking ? CRANK_SPIN : Number(speedInput.value);
    omega += (target - omega) * Math.min(1, dt * (cranking ? 2.5 : 1.5));
  }
  cageBody.angularVelocity.set(omega, 0, 0);

  world.step(1 / 120, dt, 8);

  cage.quaternion.copy(cageBody.quaternion);
  for (const b of balls) {
    if (!b.inCage) continue;
    const p = b.body.position;
    // Safety net: anything that ever escapes the drum goes back to the middle.
    if (Math.abs(p.x) > L / 2 + 0.3 || p.y * p.y + p.z * p.z > (R + 0.4) ** 2) {
      p.set(0, 0, 0);
      b.body.velocity.setZero();
    }
    b.mesh.position.copy(p);
    b.mesh.quaternion.copy(b.body.quaternion);
  }

  if (litBall) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
    litBall.mesh.material.emissiveIntensity = 0.15 + 0.35 * pulse;
    glow.position.copy(litBall.mesh.position);
    glow.intensity = litBall.inCage || busy ? 2.5 + 3 * pulse : 0.8 + pulse;
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Start: restore the saved game, fill the drum, go.
// ---------------------------------------------------------------------------
async function start() {
  try {
    state = await fetch("/api/state").then((r) => r.json());
  } catch {
    setStatus("Can't reach the server", true);
  }

  const drawn = new Set(state.drawn);
  state.drawn.forEach((n, i) => {
    const b = balls[n - 1];
    b.inCage = false;
    b.mesh.position.copy(slotPosition(i));
    b.mesh.quaternion.copy(faceCamera(b.mesh.position));
  });

  const pts = spawnPoints();
  let j = 0;
  for (const b of balls) {
    if (drawn.has(b.n)) continue;
    b.body.position.copy(pts[j++]);
    b.body.quaternion.setFromEuler(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
    world.addBody(b.body);
  }

  if (state.last != null) lightUp(balls[state.last - 1]);
  renderHud();
  if (!statusEl.classList.contains("error")) idleStatus();
  requestAnimationFrame(frame);
}

start();
