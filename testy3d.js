// Testy in real 3D: a glossy vinyl-toy mascot rendered with three.js.
// Loaded lazily after the page is idle; the CSS Testy in index.html stays as the fallback.
// Reads live state (gaze, emotion, mouth, hops, blink, running) from window.testy.state().
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const D2R = Math.PI / 180;

function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => r.addColorStop(o, col));
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function idCardTexture() {
  // a bold, high-contrast badge (drawn at 2x so it stays crisp at small sizes)
  const W = 640, H = 500, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  g.fillStyle = '#0b1222'; rr(0, 0, W, H, 44); g.fill();                       // dark frame
  g.fillStyle = '#ffffff'; rr(14, 14, W - 28, H - 28, 34); g.fill();
  const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, '#06b6d4'); grd.addColorStop(1, '#7c3aed');
  g.save(); rr(14, 14, W - 28, 120, 34); g.clip(); g.fillStyle = grd; g.fillRect(14, 14, W - 28, 120); g.restore();
  g.fillStyle = '#ffffff'; g.font = '800 54px ui-monospace,Menlo,monospace'; g.fillText('QA DEPT', 48, 96);
  g.beginPath(); g.arc(W - 70, 74, 22, 0, 7); g.fillStyle = '#34d399'; g.fill();  // "active" light
  g.fillStyle = '#ffe4dc'; rr(44, 166, 190, 230, 24); g.fill();                  // photo
  g.fillStyle = '#f9967a'; g.beginPath(); g.arc(139, 262, 62, 0, 7); g.fill(); g.beginPath(); g.ellipse(139, 398, 86, 64, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#1c0f0c'; g.beginPath(); g.ellipse(116, 268, 11, 15, 0, 0, 7); g.ellipse(162, 268, 11, 15, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(120, 262, 4.5, 0, 7); g.arc(166, 262, 4.5, 0, 7); g.fill();
  g.fillStyle = '#0b1222'; g.font = '900 104px ui-sans-serif,system-ui,sans-serif'; g.fillText('TESTY', 262, 262);
  g.fillStyle = '#0e7490'; g.font = '800 48px ui-monospace,Menlo,monospace'; g.fillText('QA BOT', 266, 326);
  g.fillStyle = '#475569'; g.font = '700 36px ui-monospace,Menlo,monospace'; g.fillText('ID 0042 ✓', 266, 378);
  g.fillStyle = '#0b1222'; let x = 266; while (x < W - 48) { const w = [4, 8, 3, 10, 5][x % 5]; g.fillRect(x, 400, w, 54); x += w + 6; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function starShape(R, r, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r : R; i ? s.lineTo(Math.cos(a) * d, Math.sin(a) * d) : s.moveTo(Math.cos(a) * d, Math.sin(a) * d); }
  s.closePath(); return s;
}
function heartShape(k) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(-0.2 * k, -0.62 * k, -k, -0.25 * k, -k, 0.22 * k);
  s.bezierCurveTo(-k, 0.72 * k, -0.42 * k, 0.95 * k, 0, 0.5 * k);
  s.bezierCurveTo(0.42 * k, 0.95 * k, k, 0.72 * k, k, 0.22 * k);
  s.bezierCurveTo(k, -0.25 * k, 0.2 * k, -0.62 * k, 0, -0.9 * k);
  return s;
}
const extrude = (shape, depth = 0.05) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4, curveSegments: 28 });
  g.center(); return g;
};

export function mount(bd, api) {
  const W = 156, H = 184;
  const cv = document.createElement('canvas');
  cv.className = 'b-gl'; cv.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch (e) { return false; }
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 50);
  cam.position.set(0, 0.5, 9.6); cam.lookAt(0, 0.28, 0);

  // lights: warm key, soft fill, and the site's cyan + violet as rim lights so Testy belongs on the page
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b3a4a, 0.5));
  const key = new THREE.DirectionalLight(0xfff0e4, 2.3); key.position.set(-3, 4, 5); scene.add(key);
  const rimC = new THREE.DirectionalLight(0x67e8f9, 2.4); rimC.position.set(4.5, 1.5, -3); scene.add(rimC);
  const rimV = new THREE.DirectionalLight(0xa78bfa, 1.6); rimV.position.set(-4.5, 0.6, -3); scene.add(rimV);

  // materials
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xffa58c, roughness: 0.4, clearcoat: 0.65, clearcoatRoughness: 0.25,
    sheen: 0.7, sheenColor: new THREE.Color(0xffdbe4), sheenRoughness: 0.45, emissive: 0x45101c, emissiveIntensity: 0.2 });
  const irisMat = new THREE.MeshPhysicalMaterial({ color: 0x9a5a3c, roughness: 0.12, clearcoat: 1, emissive: 0x3a1a08, emissiveIntensity: 0.4 });
  const earPink = new THREE.MeshPhysicalMaterial({ color: 0xffb3c7, roughness: 0.35, clearcoat: 0.6 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x1f110d, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x3a1a14, roughness: 0.45 });
  const mouthIn = new THREE.MeshStandardMaterial({ color: 0x6e2219, roughness: 0.6, side: THREE.DoubleSide });
  const tongue = new THREE.MeshStandardMaterial({ color: 0xff8fa3, roughness: 0.5, side: THREE.DoubleSide });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc93c, roughness: 0.25, clearcoat: 1, emissive: 0x7a4f00, emissiveIntensity: 0.45 });
  const pink = new THREE.MeshPhysicalMaterial({ color: 0xff4f87, roughness: 0.25, clearcoat: 1, emissive: 0x6b0f2e, emissiveIntensity: 0.4 });
  const lilac = new THREE.MeshPhysicalMaterial({ color: 0xb7a6ff, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15 });
  const led = new THREE.MeshBasicMaterial({ color: 0x8ff3ff });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x22d3ee, toneMapped: false });
  const tearMat = new THREE.MeshPhysicalMaterial({ color: 0xa5e9ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 });
  const blushMat = new THREE.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(255,120,150,.95)'], [1, 'rgba(255,120,150,0)']]), transparent: true, depthWrite: false });

  const sph = (r, ws = 40, hs = 28) => new THREE.SphereGeometry(r, ws, hs);
  const mesh = (g, m) => new THREE.Mesh(g, m);
  const tube = (pts, r, m) => {
    const v = pts.map(p => new THREE.Vector3(p[0], p[1], p[2] || 0)), grp = new THREE.Group();
    grp.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v), 48, r, 10, false), m));
    [v[0], v[v.length - 1]].forEach(e => { const cap = mesh(sph(r, 10, 8), m); cap.position.copy(e); grp.add(cap); });
    return grp;
  };
  const seg = (x1, y1, x2, y2, r, m) => {
    const L = Math.hypot(x2 - x1, y2 - y1), s = mesh(new THREE.CapsuleGeometry(r, L, 6, 12), m);
    s.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0); s.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2; return s;
  };

  // ---------- character (chibi: big head, small soft body) ----------
  const rig = new THREE.Group(); scene.add(rig);
  const shadow = mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.64; scene.add(shadow);

  const bodyG = new THREE.Group(); rig.add(bodyG);
  const body = mesh(sph(0.52, 48, 32), skin); body.scale.set(1, 0.92, 0.9); body.position.y = -0.98; bodyG.add(body);
  const feet = [-1, 1].map(s => { const f = mesh(sph(0.23), skin); f.scale.set(1, 0.55, 1.2); f.position.set(s * 0.26, -1.5, 0.1); bodyG.add(f); return f; });
  const arms = [-1, 1].map(s => {
    const piv = new THREE.Group(); piv.position.set(s * 0.5, -0.76, 0.02);
    const a = mesh(sph(0.17), skin); a.scale.set(0.9, 1.25, 0.9); a.position.y = -0.19; piv.add(a);
    piv.rotation.z = s * 0.55; bodyG.add(piv); return piv;
  });

  // ID card on a lanyard, hinged at the neck so it can swing
  const cardPiv = new THREE.Group(); cardPiv.position.set(0, -0.54, 0.44); bodyG.add(cardPiv);
  const cardTex = idCardTexture(), edge = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
  // the printed face is unlit and not tone-mapped, so its colours stay true instead of washing out
  const card = mesh(new THREE.BoxGeometry(0.7, 0.55, 0.035), [edge, edge, edge, edge,
    new THREE.MeshBasicMaterial({ map: cardTex, toneMapped: false }), edge]);
  card.position.set(0, -0.36, 0.12); card.rotation.x = -0.2; cardPiv.add(card);
  const clip = mesh(new THREE.BoxGeometry(0.12, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 }));
  clip.position.set(0, -0.07, 0.11); cardPiv.add(clip);
  [-1, 1].forEach(s => cardPiv.add(tube([[s * 0.05, -0.06, 0.12], [s * 0.24, 0.12, 0.03], [s * 0.38, 0.32, -0.2]], 0.038, cyan)));

  // head
  const headPiv = new THREE.Group(); headPiv.position.y = 0.44; rig.add(headPiv);
  const HA = 1.04, HB = 0.95, HC = 0.97;
  const head = mesh(sph(1, 64, 48), skin); head.scale.set(HA, HB, HC); headPiv.add(head);
  const onFace = (obj, x, y, lift = 0) => {
    const z = HC * Math.sqrt(Math.max(0, 1 - (x / HA) ** 2 - (y / HB) ** 2));
    const n = new THREE.Vector3(x / (HA * HA), y / (HB * HB), z / (HC * HC)).normalize();
    obj.position.set(x, y, z).addScaledVector(n, lift);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    headPiv.add(obj); return obj;
  };

  // headphones (QA support bot) with a cyan LED on each cup
  [-1, 1].forEach(s => {
    const cup = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.15, 36), lilac); cup.rotation.z = Math.PI / 2; cup.position.set(s * 1.02, 0.02, -0.02); headPiv.add(cup);
    const l = mesh(sph(0.045, 12, 10), led); l.position.set(s * 1.12, 0.02, -0.02); headPiv.add(l);
  });
  const band = mesh(new THREE.TorusGeometry(1.08, 0.05, 14, 64, Math.PI), lilac); band.position.y = 0.02; band.rotation.x = -0.32; headPiv.add(band);

  // antenna with a spinning star, on a spring
  const antPiv = new THREE.Group(); antPiv.position.set(0, 0.9, 0.12); headPiv.add(antPiv);
  const stalk = mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 12), skin); stalk.position.y = 0.2; antPiv.add(stalk);
  const star = mesh(extrude(starShape(0.17, 0.075), 0.05), gold); star.position.y = 0.5; antPiv.add(star);

  // eyes: every emotion is its own little 3D shape inside an eye slot
  const eyes = [-1, 1].map(s => {
    const slot = onFace(new THREE.Group(), s * 0.41, -0.13, 0.005);
    const normal = new THREE.Group(); slot.add(normal);
    const ball = mesh(sph(0.255, 40, 30), eyeMat); ball.scale.set(1, 1.2, 0.44); normal.add(ball);
    const iris = mesh(sph(0.14, 28, 18), irisMat); iris.scale.set(1.3, 0.72, 0.42); iris.position.set(0, -0.12, 0.062); normal.add(iris);
    const h1 = mesh(sph(0.075, 18, 14), white); h1.position.set(0.08, 0.125, 0.1); normal.add(h1);
    const h2 = mesh(sph(0.033, 12, 10), white); h2.position.set(-0.075, -0.1, 0.1); normal.add(h2);
    const h3 = mesh(sph(0.018, 10, 8), white); h3.position.set(0.1, -0.04, 0.1); normal.add(h3);
    const arc = mesh(new THREE.TorusGeometry(0.15, 0.042, 12, 32, Math.PI), eyeMat); arc.position.y = -0.04; slot.add(arc);
    const st = mesh(extrude(starShape(0.21, 0.095), 0.05), gold); slot.add(st);
    const ht = mesh(extrude(heartShape(0.19), 0.05), pink); slot.add(ht);
    const chev = new THREE.Group();
    chev.add(seg(s * 0.1, 0.12, -s * 0.1, 0, 0.045, eyeMat), seg(-s * 0.1, 0, s * 0.1, -0.12, 0.045, eyeMat)); slot.add(chev); // > <
    return { slot, normal, arc, st, ht, chev, s };
  });
  const tear = mesh(sph(0.065, 16, 12), tearMat); tear.scale.set(1, 1.35, 1); eyes[0].slot.add(tear);

  // cheeks
  const cheeks = [-1, 1].map(s => { const c = onFace(mesh(new THREE.CircleGeometry(0.18, 32), blushMat), s * 0.64, -0.36, 0.012); c.scale.set(1.4, 0.85, 1); return c; });

  // mouth shapes
  const mSlot = onFace(new THREE.Group(), 0, -0.4, 0.012);
  const mSmile = tube([[-0.12, 0.025], [-0.06, -0.038], [0, 0.008], [0.06, -0.038], [0.12, 0.025]], 0.022, lineMat);
  const openShape = new THREE.Shape(); openShape.moveTo(-0.15, 0.03); openShape.quadraticCurveTo(0, -0.27, 0.15, 0.03); openShape.lineTo(-0.15, 0.03);
  const mOpen = new THREE.Group();
  mOpen.add(mesh(new THREE.ShapeGeometry(openShape, 24), mouthIn));
  const tShape = new THREE.Shape(); tShape.moveTo(-0.07, -0.07); tShape.quadraticCurveTo(0, -0.17, 0.07, -0.07); tShape.quadraticCurveTo(0, -0.04, -0.07, -0.07);
  const tg = mesh(new THREE.ShapeGeometry(tShape, 16), tongue); tg.position.z = 0.003; mOpen.add(tg);
  mOpen.add(tube([[-0.15, 0.03], [0, 0.035], [0.15, 0.03]], 0.018, lineMat));
  const mO = new THREE.Group(); mO.add(mesh(new THREE.TorusGeometry(0.055, 0.022, 10, 28), lineMat)); const oIn = mesh(new THREE.CircleGeometry(0.05, 20), mouthIn); oIn.position.z = -0.004; mO.add(oIn);
  const mFrown = tube([[-0.11, -0.05], [0, 0.02], [0.11, -0.05]], 0.024, lineMat);
  const mHmm = tube([[-0.08, -0.01], [0.02, 0.015], [0.1, -0.005]], 0.022, lineMat);
  [mSmile, mOpen, mO, mFrown, mHmm].forEach(m => mSlot.add(m));

  // ---------- emotion → which shapes are visible ----------
  let shownKey = '';
  function showEmo(emo, happy, talkingOpen, sleep) {
    const e = sleep && !emo ? 'sleep' : emo || (happy ? 'happy' : '');
    const k = e + '|' + talkingOpen; if (k === shownKey) return; shownKey = k;
    eyes.forEach(E => {
      const arc = e === 'happy' || e === 'sleep' || (e === 'wink' && E.s < 0);
      E.arc.rotation.z = e === 'sleep' ? Math.PI : 0; E.arc.position.y = e === 'sleep' ? 0.06 : -0.04;
      E.arc.visible = arc; E.st.visible = e === 'excited'; E.ht.visible = e === 'love'; E.chev.visible = e === 'laugh';
      E.normal.visible = !arc && !E.st.visible && !E.ht.visible && !E.chev.visible;
      E.slot.rotation.z = e === 'sad' ? -E.s * 0.28 : 0;
    });
    tear.visible = e === 'sad';
    const open = e === 'excited' || e === 'love' || e === 'laugh' || talkingOpen;
    mOpen.visible = open; mO.visible = !open && (e === 'listen' || e === 'sleep'); mFrown.visible = !open && e === 'sad'; mHmm.visible = !open && e === 'think';
    mSmile.visible = !open && !mO.visible && !mFrown.visible && !mHmm.visible;
  }

  // ---------- animation ----------
  let lastDraw = 0, raf = 0, t0 = performance.now(), lastHops = api.state().hops, hopT = -9, waveUntil = 0, lastEmo = '', lastHappy = false;
  let lastTw = api.state().twirls, twT = -9, doze = 0, yawV = 0, pitchV = 0;
  let antA = 0, antV = 0, antB = 0, antW = 0, cardA = 0, cardV = 0, pYaw = 0, pPitch = 0, blink = 1, yawS = 0, pitchS = 0, mouthS = 0, jog = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const S = api.state(), t = (now - t0) / 1000, calm = S.reduce;
    // hop when the page asks for one
    if (S.hops !== lastHops) { lastHops = S.hops; hopT = t; }
    const hp = (t - hopT) / 0.55;
    let hy = 0, sq = 1;
    if (hp >= 0 && hp < 1 && !calm) { hy = Math.sin(hp * Math.PI) * 0.34; sq = hp < 0.15 ? 1 - hp * 0.6 : hp > 0.85 ? 1 - (1 - hp) * 0.6 : 1 + Math.sin(hp * Math.PI) * 0.05; }
    // little jog on the spot while the visitor scrolls fast
    jog += ((S.running && !calm ? 1 : 0) - jog) * 0.15;
    const bob = calm ? 0 : Math.sin(t * 2.1) * 0.035 + jog * Math.abs(Math.sin(t * 13)) * 0.12;
    feet.forEach((f, i) => { f.position.y = -1.5 + jog * Math.max(0, Math.sin(t * 13 + i * Math.PI)) * 0.14; });
    const sad = S.emo === 'sad';
    rig.position.y = hy + bob - (sad ? 0.07 : 0);
    rig.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
    rig.rotation.z = S.emo === 'laugh' && !calm ? Math.sin(t * 38) * 0.06 : rig.rotation.z * 0.85 + jog * Math.sin(t * 13) * 0.012;
    shadow.scale.setScalar(1 - hy * 0.9);

    // gaze: smooth the page's yaw / pitch (degrees), add a curious head tilt when listening
    yawV = (yawV + (S.yaw * D2R - yawS) * 0.11) * 0.74; yawS += yawV;
    pitchV = (pitchV + (S.pitch * D2R - pitchS) * 0.11) * 0.74; pitchS += pitchV;
    doze += ((S.sleep ? 1 : 0) - doze) * 0.06;
    headPiv.rotation.set(-pitchS * 0.95 * (1 - doze) + doze * (0.32 + Math.sin(t * 1.6) * 0.04), yawS * (1 - doze), -yawS * 0.12 + doze * 0.22 + (S.emo === 'listen' ? 0.16 : S.emo === 'think' ? -0.12 : 0));
    if (S.twirls !== lastTw) { lastTw = S.twirls; twT = t; }
    const tw = Math.min(1, (t - twT) / 0.8); rig.rotation.y = tw < 1 ? (1 - Math.pow(1 - tw, 3)) * Math.PI * 2 : 0;
    bodyG.rotation.y = yawS * 0.25;
    const up = Math.max(0, -S.gy - 0.35), lean = calm ? 0 : 1;
    bodyG.rotation.z = -S.gx * 0.16 * lean; rig.rotation.x = -up * 0.18 * lean;
    rig.scale.y *= 1 + up * 0.07 * lean; rig.position.y += up * 0.12 * lean;
    eyes.forEach(E => { E.normal.position.set(S.gx * 0.05, -S.gy * 0.04, 0); });

    // springs: the antenna and ID card lag behind head and body motion
    const dY = yawS - pYaw, dP = pitchS - pPitch; pYaw = yawS; pPitch = pitchS;
    antV += -antA * 0.22 - antV * 0.14 - dY * 2.2 - (hp > 0 && hp < 1 ? Math.cos(hp * Math.PI) * 0.01 : 0) - jog * Math.cos(t * 13) * 0.004; antA += antV;
    antW += -antB * 0.22 - antW * 0.14 + dP * 2.2; antB += antW;
    antPiv.rotation.set(calm ? 0 : antB, 0, calm ? 0 : antA);
    cardV += -cardA * 0.12 - cardV * 0.1 - dY * 1.4 + (hp > 0 && hp < 1 ? -Math.cos(hp * Math.PI) * 0.012 : 0) + jog * Math.sin(t * 13) * 0.006; cardA += cardV;
    cardPiv.rotation.z = calm ? 0 : cardA; cardPiv.rotation.x = calm ? 0 : Math.abs(cardA) * -0.4;
    star.rotation.y += calm ? 0 : S.emo === 'excited' || S.emo === 'listen' ? 0.14 : 0.025;
    star.scale.setScalar(S.emo === 'excited' ? 1.25 : 1);

    // arms: wave on hello / hover / excitement / love; pump while jogging
    if ((S.emo !== lastEmo && /excited|love|happy|wink/.test(S.emo)) || (S.happy && !lastHappy)) waveUntil = t + 1.5;
    lastEmo = S.emo; lastHappy = S.happy;
    const waving = t < waveUntil && !calm, w = Math.sin(t * 14) * 0.35, pump = jog * Math.sin(t * 13) * 0.5;
    const reach = calm || S.sleep ? 0 : Math.max(0, Math.abs(S.gx) - 0.5) / 0.5, rR = S.gx > 0 ? reach : 0, rL = S.gx < 0 ? reach : 0;
    arms[1].rotation.z += ((waving ? 2.3 + w : 0.55 + pump + rR * 1.25) - arms[1].rotation.z) * 0.22;
    arms[0].rotation.z += (((waving && S.emo === 'excited') ? -2.3 - w : -0.55 + pump - rL * 1.25) - arms[0].rotation.z) * 0.22;

    // blink
    blink += ((S.blink ? 0.08 : 1) - blink) * 0.5;
    eyes.forEach(E => { E.normal.scale.y = (S.emo === 'think' && E.s > 0 ? 0.45 : S.emo === 'listen' ? 1.12 : 1) * blink; E.normal.scale.x = S.emo === 'listen' ? 1.08 : 1; });
    eyes.forEach(E => { const pulse = 1 + Math.sin(t * 9) * 0.08; E.st.scale.setScalar(pulse); E.ht.scale.setScalar(1 + Math.max(0, Math.sin(t * 11)) * 0.15); E.st.rotation.z = Math.sin(t * 4) * 0.25; });
    // tear falls and fades in a loop
    const tp = (t % 1.4) / 1.4; tear.position.set(0.03, -0.16 - tp * 0.32, 0.06); tearMat.opacity = tp < 0.2 ? tp * 4.5 : 0.9 * (1 - (tp - 0.2) / 0.8);

    // mouth: talking opens it with the voice
    mouthS += (S.mouth - mouthS) * 0.45;
    showEmo(S.emo, S.happy, S.talking && mouthS > 0.25, S.sleep);
    mSlot.scale.set(1 + mouthS * 0.12 + (S.near ? 0.12 : 0), 1 + mouthS * 0.9 + (S.near ? 0.15 : 0), 1);
    const blushOn = S.near || S.happy || /love|excited|laugh/.test(S.emo);
    cheeks.forEach(c => { c.material.opacity += ((blushOn ? 1 : 0.6) - c.material.opacity) * 0.1; });

    if (now - lastDraw >= 32) { lastDraw = now; renderer.render(scene, cam); }   // draw at ~30 fps; motion still updates every frame
  }
  bd.appendChild(cv);
  const run = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', run);
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); bd.classList.remove('g3d'); });
  run();
  return true;
}
