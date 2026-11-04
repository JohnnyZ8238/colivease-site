// Landing hero: a showcase deck of real 3D roommate cards on a dark stage.
//  - Cards: bevelled bodies with chrome edges that reflect a rainbow studio, holographic foil that shifts with the
//    viewing angle and the pointer, and a glowing neon outline (bloom).
//  - Each card is a window (stencil portal) into a little studio behind it with a saturated backdrop and floating
//    shapes, so tilting a card shows real depth.
//  - The roommates are original vinyl-toy busts (big rounded head, bead eyes, rounded nose, sculpted hair, ribbed
//    turtleneck), modelled here from primitives. When a card flips to the front, its roommate pops forward out of
//    the window with a burst of sparkles.
//  - A mirror floor (Reflector) and bloom (UnrealBloomPass) when the three.js add-ons are available.
// Built on three r128 (global THREE).
const DECK_PEOPLE = [
  { name: "Maya", age: 24, job: "Student, Midtown", match: 92, why: "same areas, budget fits", tags: ["Student", "$800-1,100", "Moves in Jan"],
    skin: "#F4C7A5", hair: "#2A1A14", style: "bob", top: "#3E6BFF", bg: ["#FFB3C6", "#FF6F91"] },
  { name: "Leo", age: 26, job: "Working, North York", match: 88, why: "budget fits, same move-in month", tags: ["Working", "$900-1,200", "Moves in Feb"],
    skin: "#DDA27A", hair: "#1C1716", style: "quiff", extra: "headphones", top: "#FF8A3D", bg: ["#A9C6FF", "#4F7BFF"] },
  { name: "Aisha", age: 23, job: "Working, Scarborough", match: 90, why: "same area, same move-in month", tags: ["Working", "$700-1,000", "Moves in Mar"],
    skin: "#8A5638", hair: "#17100D", style: "curly", top: "#FFD84D", bg: ["#9BEAC4", "#22A866"] },
  { name: "Kenji", age: 25, job: "Working, Downtown", match: 86, why: "both working, budget fits", tags: ["Working", "$1,100-1,500", "Moves in Jan"],
    skin: "#F2C9A2", hair: "#22222A", style: "swoop", extra: "glasses", top: "#2E3A59", bg: ["#FFE09A", "#FFB12E"] },
  { name: "Sofia", age: 22, job: "Student, York University", match: 89, why: "both students, shared language", tags: ["Student", "$700-1,000", "Moves in Sep"],
    skin: "#E8B48D", hair: "#6B3F22", style: "bun", top: "#FF6F91", bg: ["#D2C3FF", "#8A63FF"] },
  { name: "Noah", age: 27, job: "Working, East End", match: 87, why: "same areas, same move-in month", tags: ["Working", "$900-1,200", "Moves in Feb"],
    skin: "#C4865F", hair: "#3A271C", style: "beanie", hat: "#FFD84D", beard: true, top: "#22A866", bg: ["#FFC1A8", "#FF7A59"] },
];

// Ages are only ever shown as a wide band.
function ageBand(age) {
  const b = [[18, 24], [25, 34], [35, 44], [45, 54], [55, 64]].find(([lo, hi]) => age >= lo && age <= hi);
  return b ? `${b[0]}-${b[1]}` : age < 18 ? "18-24" : "65+";
}

// Async: the scene is built in slices (one card at a time, then the post-processing, then the shader warm-up) with a
// yield to the main thread between them, so building it never blocks input as one long task.
const deckYield = () => new Promise((ok) => (window.scheduler && scheduler.yield ? scheduler.yield().then(ok) : setTimeout(ok, 0)));
async function createDeckScene(THREE, canvas, { people = DECK_PEOPLE, mascotSvg = "", onActive, reduced = false } = {}) {
  const lite = window.innerWidth < 720 || (navigator.hardwareConcurrency || 8) <= 4;
  const post = Boolean(THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass && THREE.ShaderPass && THREE.GammaCorrectionShader);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !post, alpha: false, stencil: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.5)); // capped: the bloom pass costs per pixel
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const col = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = aniso;
    return t;
  };

  const scene = new THREE.Scene();
  scene.background = canvasTex(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.28, 10, w * 0.5, h * 0.45, w * 0.8);
    g.addColorStop(0, "#2346B8");
    g.addColorStop(0.45, "#0E1F66");
    g.addColorStop(1, "#050B26");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  const CAM = new THREE.Vector3(0, 0.12, 5.3);
  camera.position.copy(CAM);

  // Studio environment for reflections: soft white strips over rainbow bands; it's what makes the chrome edges and
  // the glossy toys shimmer as they turn.
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const tex = canvasTex(1024, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      ["#1B2B7A", "#6E9BFF", "#FF7AC8", "#FFD27A", "#7CF0D0", "#6E9BFF", "#B98CFF", "#1B2B7A"].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const v = ctx.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgba(255,255,255,0.35)");
      v.addColorStop(0.5, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(5,10,40,0.8)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      for (const [x, y, ww, hh] of [[0.18, 0.18, 0.12, 0.05], [0.55, 0.12, 0.2, 0.06], [0.82, 0.3, 0.06, 0.2], [0.35, 0.4, 0.05, 0.12]]) ctx.fillRect(x * w, y * h, ww * w, hh * h);
    });
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
    scene.environment = pmrem.fromScene(envScene, 0.035).texture;
    pmrem.dispose();
  }
  scene.add(new THREE.HemisphereLight(col("#DCE4FF"), col("#1A2350"), 0.45));
  const key = new THREE.DirectionalLight(col("#ffffff"), 0.7);
  key.position.set(2.2, 3.4, 5);
  scene.add(key);
  const rimL = new THREE.DirectionalLight(col("#7FB2FF"), 1.15);
  rimL.position.set(-4, 2.2, -2.5);
  scene.add(rimL);
  const rimR = new THREE.DirectionalLight(col("#FF8FD0"), 0.9);
  rimR.position.set(4, 1.6, -2.5);
  scene.add(rimR);
  const glint = new THREE.PointLight(col("#ffffff"), 0.5, 7);
  glint.position.set(0.6, 0.8, 2.4);
  scene.add(glint);

  // ---- shapes ------------------------------------------------------------------------------------------------------
  const W = 1, H = 1.4, D = 0.035, BEVEL = 0.012;
  const WIN = { x: 0.42, top: 0.62, bottom: -0.16, r: 0.075 }; // the window into each card's studio
  function roundedPath(P, w, h, r, cx = 0, cy = 0) {
    const x = cx - w / 2, y = cy - h / 2;
    P.moveTo(x + r, y);
    P.lineTo(x + w - r, y);
    P.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    P.lineTo(x + w, y + h - r);
    P.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    P.lineTo(x + r, y + h);
    P.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    P.lineTo(x, y + r);
    P.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return P;
  }
  const winH = WIN.top - WIN.bottom, winCY = (WIN.top + WIN.bottom) / 2;
  const windowPath = () => roundedPath(new THREE.Path(), WIN.x * 2, winH, WIN.r, 0, winCY);
  const windowShape = () => roundedPath(new THREE.Shape(), WIN.x * 2, winH, WIN.r, 0, winCY);
  const cardShape = (w, h, r, hole) => {
    const s = roundedPath(new THREE.Shape(), w, h, r);
    if (hole) s.holes.push(windowPath());
    return s;
  };
  const uvByPosition = (geo) => {
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / W + 0.5, p.getY(i) / H + 0.5);
    return geo;
  };
  const bodyGeo = new THREE.ExtrudeGeometry(cardShape(W - 0.024, H - 0.024, 0.088, true), {
    depth: D, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: 0.012, bevelSegments: 4, curveSegments: 14,
  });
  bodyGeo.translate(0, 0, -D / 2);
  const frontGeo = uvByPosition(new THREE.ShapeGeometry(cardShape(W - 0.05, H - 0.05, 0.075, true), 14));
  const backGeo = uvByPosition(new THREE.ShapeGeometry(cardShape(W - 0.05, H - 0.05, 0.075, false), 14));
  const maskGeo = new THREE.ShapeGeometry(windowShape(), 14);
  const rimShape = roundedPath(new THREE.Shape(), W + 0.055, H + 0.055, 0.115);
  rimShape.holes.push(roundedPath(new THREE.Path(), W - 0.012, H - 0.012, 0.085));
  const rimGeo = new THREE.ShapeGeometry(rimShape, 16);
  const FACE_Z = D / 2 + BEVEL + 0.002;
  const chrome = new THREE.MeshPhysicalMaterial({ color: col("#F3F6FF"), metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4 });

  // ---- shaders: holographic foil and the neon outline -----------------------------------------------------------------
  const SPECTRUM = "vec3 spectrum(float h){ return 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67))); }";
  const holoMat = (strength) =>
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uStrength: { value: strength } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; uniform vec2 uPointer; uniform float uStrength; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        ${SPECTRUM}
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          float tilt = 1.0 - clamp(dot(vN, vV), 0.0, 1.0);
          float h = vUv.x * 0.8 + vUv.y * 1.2 + tilt * 2.6 + uPointer.x * 0.5 - uPointer.y * 0.3 + uTime * 0.05;
          vec3 c = spectrum(h);
          float band = smoothstep(0.55, 0.95, sin((vUv.x * 0.8 + vUv.y) * 16.0 + tilt * 18.0 + uPointer.x * 4.0 + uTime * 0.6) * 0.5 + 0.5);
          vec2 cell = floor(vUv * vec2(70.0, 98.0));
          float tw = step(0.982, hash(cell)) * pow(0.5 + 0.5 * sin(uTime * 3.0 + hash(cell + 7.1) * 40.0), 3.0);
          float a = (0.06 + 0.3 * band) * uStrength;
          gl_FragColor = vec4(c * a + vec3(tw) * 1.4 * uStrength, 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  const rimMat = () =>
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGlow: { value: 0.6 } },
      vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uTime; uniform float uGlow; varying vec2 vP; ${SPECTRUM}
        void main(){ float a = atan(vP.y, vP.x) / 6.28318; gl_FragColor = vec4(spectrum(a + uTime * 0.12) * uGlow, 1.0); }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

  // ---- card art --------------------------------------------------------------------------------------------------------
  const TW = 512, TH = Math.round(512 * (H / W));
  const display = "Fredoka, Poppins, system-ui, sans-serif";
  const body = "Poppins, system-ui, sans-serif";
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const PANEL_Y = Math.round(TH * ((H / 2 - WIN.bottom) / H) + 18);
  function drawFront(ctx, p) {
    ctx.clearRect(0, 0, TW, TH);
    // Pearl frame around the window.
    const g = ctx.createLinearGradient(0, 0, TW, TH);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.5, "#E6ECFF");
    g.addColorStop(1, "#CBD7FF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TW, TH);
    const py = PANEL_Y;
    ctx.fillStyle = "#0B2255";
    ctx.font = `600 50px ${display}`;
    ctx.textBaseline = "alphabetic";
    const nameText = `${p.name}, ${ageBand(p.age)}`;
    ctx.fillText(nameText, 40, py + 52);
    const tx = 40 + ctx.measureText(nameText).width + 24, ty = py + 35;
    ctx.fillStyle = "#22C55E";
    ctx.beginPath();
    ctx.arc(tx, ty, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(tx - 7, ty);
    ctx.lineTo(tx - 2, ty + 5);
    ctx.lineTo(tx + 7, ty - 5);
    ctx.stroke();
    const rx = TW - 84, ry = py + 44;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(11,34,85,0.1)";
    ctx.beginPath();
    ctx.arc(rx, ry, 34, 0, Math.PI * 2);
    ctx.stroke();
    const ring = ctx.createLinearGradient(rx - 34, ry - 34, rx + 34, ry + 34);
    ring.addColorStop(0, "#6E9BFF");
    ring.addColorStop(1, "#2865FF");
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(rx, ry, 34, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.match) / 100);
    ctx.stroke();
    ctx.fillStyle = "#0B2255";
    ctx.textAlign = "center";
    ctx.font = `600 24px ${display}`;
    ctx.fillText(`${p.match}%`, rx, ry + 9);
    ctx.fillStyle = "#2865FF";
    ctx.font = `600 13px ${body}`;
    ctx.fillText("MATCH", rx, ry + 60);
    ctx.textAlign = "left";
    ctx.fillStyle = "#4A5A78";
    ctx.font = `500 21px ${body}`;
    let job = p.job;
    while (ctx.measureText(job).width > TW - 40 - 140 && job.length > 4) job = job.slice(0, -2).trimEnd() + "…";
    ctx.fillText(job, 40, py + 90);
    let x = 40;
    ctx.font = `500 19px ${body}`;
    for (const tag of p.tags) {
      const w = ctx.measureText(tag).width + 30;
      if (x + w > TW - 36) break;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      rr(ctx, x, py + 118, w, 38, 19);
      ctx.fill();
      ctx.fillStyle = "#2B4BB8";
      ctx.fillText(tag, x + 15, py + 144);
      x += w + 10;
    }
  }
  let mascotImg = null;
  function drawBack(ctx) {
    ctx.clearRect(0, 0, TW, TH);
    const g = ctx.createLinearGradient(0, 0, TW, TH);
    g.addColorStop(0, "#5D8BFF");
    g.addColorStop(0.5, "#1F4FE0");
    g.addColorStop(1, "#0C2A8F");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TW, TH);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    for (let r = 40; r < TW; r += 36) {
      ctx.beginPath();
      ctx.arc(TW / 2, TH * 0.4, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    rr(ctx, 24, 24, TW - 48, TH - 48, 34);
    ctx.stroke();
    if (mascotImg) {
      const w = TW * 0.6, h = (w * mascotImg.height) / mascotImg.width;
      ctx.drawImage(mascotImg, (TW - w) / 2, TH * 0.4 - h / 2, w, h);
    }
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `600 36px ${display}`;
    ctx.fillText("Your next roommate", TW / 2, TH * 0.77);
    ctx.font = `500 18px ${body}`;
    ctx.globalAlpha = 0.75;
    ctx.fillText("Tap to flip", TW / 2, TH * 0.77 + 38);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
  const makeLiveTexture = (draw) => {
    const c = document.createElement("canvas");
    c.width = TW;
    c.height = TH;
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = aniso;
    const redraw = () => {
      draw(c.getContext("2d"));
      tex.needsUpdate = true;
    };
    redraw();
    return { tex, redraw };
  };
  const back = makeLiveTexture(drawBack);
  const backMat = new THREE.MeshPhysicalMaterial({ map: back.tex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6 });
  if (mascotSvg) {
    const svg = mascotSvg
      .replace(/fill="#2865FF"/g, 'fill="#FFFFFF"')
      .replace(/(<g class="m-door"><path d="[^"]*" )fill="#fff"/, '$1fill="#2865FF"')
      .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" ');
    const img = new Image();
    img.onload = () => {
      mascotImg = img;
      back.redraw();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // ---- studio behind each window (drawn only through the window: stencil) ---------------------------------------------
  const stencilled = (m, ref) => {
    m.stencilWrite = true;
    m.stencilRef = ref;
    m.stencilFunc = THREE.EqualStencilFunc;
    m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp;
    return m;
  };
  function makeStudio(p, ref) {
    const g = new THREE.Group();
    const add = (mesh) => {
      mesh.renderOrder = -1;
      stencilled(mesh.material, ref);
      g.add(mesh);
      return mesh;
    };
    const depth = 0.75, w = 1.05, h = 1.0, y0 = WIN.bottom;
    const box = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), new THREE.MeshStandardMaterial({ color: col(p.bg[1]), roughness: 0.9, side: THREE.BackSide, envMapIntensity: 0.3 })));
    box.position.set(0, y0 + h / 2, -depth / 2);
    // Backdrop: a soft spotlight on a saturated sweep.
    const wall = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: canvasTex(256, 256, (ctx, cw, chh) => {
        const r = ctx.createRadialGradient(cw * 0.5, chh * 0.42, 6, cw * 0.5, chh * 0.5, cw * 0.75);
        r.addColorStop(0, p.bg[0]);
        r.addColorStop(1, p.bg[1]);
        ctx.fillStyle = r;
        ctx.fillRect(0, 0, cw, chh);
      }),
    })));
    wall.position.set(0, y0 + h / 2, -depth + 0.002);
    const floorM = add(new THREE.Mesh(new THREE.PlaneGeometry(w, depth), new THREE.MeshStandardMaterial({ color: col(p.bg[1]), roughness: 0.55, metalness: 0.1, envMapIntensity: 0.5 })));
    floorM.rotation.x = -Math.PI / 2;
    floorM.position.set(0, y0 + 0.001, -depth / 2);
    // Floating glossy shapes at different depths for parallax.
    const gloss = (hex) => new THREE.MeshPhysicalMaterial({ color: col(hex), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1 });
    const floaters = [];
    const shapes = [
      [new THREE.SphereGeometry(0.05, 24, 16), "#FFFFFF", -0.3, 0.46, -0.42],
      [new THREE.TorusGeometry(0.055, 0.02, 16, 40), p.bg[0], 0.31, 0.42, -0.3],
      [new THREE.SphereGeometry(0.032, 20, 14), p.top, 0.3, 0.05, -0.5],
      [new THREE.IcosahedronGeometry(0.04, 0), "#FFFFFF", -0.32, 0.08, -0.55],
    ];
    for (const [geo, c, x, y, z] of shapes) {
      const m = add(new THREE.Mesh(geo, gloss(c)));
      m.position.set(x, y, z);
      floaters.push({ m, y, ph: Math.random() * 6.28 });
    }
    return { g, floaters };
  }
  function makeMask(ref) {
    const m = new THREE.Mesh(maskGeo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    Object.assign(m.material, {
      stencilWrite: true, stencilRef: ref, stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp,
    });
    m.renderOrder = -2;
    m.position.z = FACE_Z;
    return m;
  }

  // ---- vinyl-toy roommates ----------------------------------------------------------------------------------------------
  const sphere = (r, ws = 32, hs = 24) => new THREE.SphereGeometry(r, ws, hs);
  function deform(geo, fn) {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      fn(v);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const HEAD_R = 0.2;
  const headShape = (v) => {
    v.y *= 1.07;
    // Fuller cheeks and jaw, like a vinyl toy.
    const k = Math.exp(-Math.pow(v.y + 0.075, 2) / 0.0045);
    v.x *= 1 + 0.07 * k;
    v.z *= 1 + 0.05 * k;
  };
  const headGeo = deform(sphere(HEAD_R, 64, 48), headShape);
  function makeCharacter(p) {
    const M = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: col(hex), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.55, ...o });
    const skin = M(p.skin, { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.35 });
    const hair = M(p.hair, { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9, side: THREE.DoubleSide });
    const knit = M(p.top, { roughness: 0.75, clearcoat: 0, envMapIntensity: 0.3 });
    const ink = M("#0E1024", { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 });
    const root = new THREE.Group();
    const fig = new THREE.Group();
    root.add(fig);
    // Bust: rounded shoulders in the turtleneck colour.
    const prof = [[0, 0], [0.22, 0], [0.24, 0.045], [0.236, 0.115], [0.2, 0.172], [0.13, 0.205], [0.075, 0.215], [0, 0.216]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const bust = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), knit);
    bust.scale.z = 0.72;
    fig.add(bust);
    // Ribbed turtleneck.
    const ribbed = (geo, n, amt) => deform(geo, (v) => {
      const a = Math.atan2(v.z, v.x);
      const s = 1 + amt * Math.cos(a * n);
      v.x *= s;
      v.z *= s;
    });
    const neck = new THREE.Mesh(ribbed(new THREE.CylinderGeometry(0.083, 0.095, 0.11, 72, 1, true), 22, 0.035), knit);
    neck.position.y = 0.262;
    fig.add(neck);
    const fold = new THREE.Mesh(ribbed(new THREE.TorusGeometry(0.088, 0.03, 16, 72), 22, 0.03), knit);
    fold.rotation.x = Math.PI / 2;
    fold.position.y = 0.3;
    fig.add(fold);
    // Head.
    const head = new THREE.Group();
    head.position.y = 0.3 + HEAD_R * 1.0;
    fig.add(head);
    head.add(new THREE.Mesh(headGeo, skin));
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(sphere(0.046, 20, 16), skin);
      ear.scale.set(0.42, 1, 0.72);
      ear.position.set(s * 0.198, -0.03, -0.005);
      head.add(ear);
    }
    const nose = new THREE.Mesh(sphere(0.043, 28, 20), skin);
    nose.scale.set(1, 0.84, 0.86);
    nose.position.set(0, -0.045, 0.198);
    head.add(nose);
    const eyes = [-1, 1].map((s) => {
      const e = new THREE.Group();
      e.position.set(s * 0.083, 0.012, 0.181);
      e.rotation.y = s * 0.42;
      const bead = new THREE.Mesh(sphere(0.022, 20, 16), ink);
      bead.scale.set(1, 1.32, 0.6);
      e.add(bead);
      head.add(e);
      return e;
    });
    for (const s of [-1, 1]) {
      const brow = new THREE.Mesh(sphere(0.022, 16, 12), M(p.hair, { roughness: 0.4 }));
      brow.scale.set(1.55, 0.42, 0.5);
      brow.position.set(s * 0.085, 0.07, 0.182);
      brow.rotation.set(0, s * 0.42, s * -0.14);
      head.add(brow);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0068, 10, 24, Math.PI), M("#5A1E24", { roughness: 0.3 }));
    mouth.position.set(0, -0.103, 0.183);
    mouth.rotation.set(-0.35, 0, Math.PI);
    head.add(mouth);
    for (const s of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), new THREE.MeshBasicMaterial({ color: col("#FF6F8A"), transparent: true, opacity: 0.2, depthWrite: false }));
      blush.position.set(s * 0.122, -0.068, 0.172);
      blush.rotation.set(0.15, s * 0.62, 0);
      head.add(blush);
    }
    // Sculpted hair.
    const hairCap = (tilt = -0.4, r = 0.214, len = 0.55) => {
      const cap = new THREE.Mesh(deform(new THREE.SphereGeometry(r, 56, 28, 0, Math.PI * 2, 0, Math.PI * len), (v) => (v.y *= 1.07)), hair);
      cap.rotation.x = tilt;
      head.add(cap);
      return cap;
    };
    const chunk = (r, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(sphere(r, 28, 20), hair);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.set(rx, ry, rz);
      head.add(m);
      return m;
    };
    let bun = null;
    if ("bob" === p.style) {
      hairCap(-0.32, 0.218, 0.56);
      chunk(0.216, 0, -0.035, -0.045, 1.08, 1.04, 0.96);
      for (const s of [-1, 1]) chunk(0.1, s * 0.168, -0.085, 0.06, 0.4, 1.25, 0.75, 0, 0, s * 0.06);
      for (const [x, rz] of [[-0.095, 0.32], [0.0, 0], [0.095, -0.32]]) chunk(0.085, x, 0.122, 0.158, 1.12, 0.4, 0.55, -0.5, 0, rz);
    } else if ("quiff" === p.style) {
      hairCap(-0.55, 0.214, 0.52);
      chunk(0.1, 0.02, 0.19, 0.1, 1.45, 0.62, 0.95, -0.2, 0, -0.18);
      chunk(0.07, -0.08, 0.18, 0.12, 1.1, 0.55, 0.8, -0.3, 0, 0.3);
    } else if ("curly" === p.style) {
      const n = 46;
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 1.2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const a = i * 2.39996;
        const z = Math.cos(a) * r;
        if (y < 0.28 && z > 0.45) continue;
        chunk(0.066 + (i % 3) * 0.007, Math.sin(a) * r * 0.232, y * 0.235 + 0.03, z * 0.232 - 0.012, 1, 1, 1);
      }
    } else if ("swoop" === p.style) {
      hairCap(-0.52, 0.214, 0.52);
      chunk(0.12, 0.06, 0.17, 0.11, 1.55, 0.58, 0.9, -0.15, 0, -0.32);
    } else if ("bun" === p.style) {
      hairCap(-0.36, 0.216, 0.55);
      for (const s of [-1, 1]) chunk(0.09, s * 0.075, 0.15, 0.13, 1.25, 0.5, 0.6, -0.3, 0, s * -0.45);
      bun = chunk(0.088, 0, 0.255, -0.06, 1, 0.92, 1);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 10, 32), M("#FFD84D"));
      tie.position.set(0, 0.2, -0.045);
      tie.rotation.x = Math.PI / 2 - 0.35;
      head.add(tie);
    } else if ("beanie" === p.style) {
      const hatM = M(p.hat, { roughness: 0.85, clearcoat: 0, envMapIntensity: 0.25 });
      const hat = new THREE.Mesh(ribbed(new THREE.SphereGeometry(0.226, 64, 28, 0, Math.PI * 2, 0, Math.PI * 0.52), 28, 0.018), hatM);
      hat.scale.set(1, 1.18, 1);
      hat.rotation.x = -0.22;
      hat.position.y = 0.025;
      head.add(hat);
      const brim = new THREE.Mesh(ribbed(new THREE.TorusGeometry(0.218, 0.04, 14, 72), 40, 0.02), hatM);
      brim.rotation.x = Math.PI / 2 - 0.22;
      brim.position.y = 0.04;
      head.add(brim);
    }
    if (p.beard) {
      const beard = new THREE.Mesh(deform(new THREE.SphereGeometry(0.212, 48, 24, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.6, Math.PI * 0.33), headShape), hair);
      beard.rotation.y = 0;
      head.add(beard);
      for (const s of [-1, 1]) chunk(0.034, s * 0.03, -0.083, 0.192, 1.35, 0.55, 0.6, 0, 0, s * 0.3);
    }
    if ("glasses" === p.extra) {
      const frame = M("#111327", { roughness: 0.15, clearcoat: 1, envMapIntensity: 1 });
      for (const s of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, 12, 40), frame);
        ring.position.set(s * 0.083, 0.012, 0.205);
        ring.rotation.y = s * 0.32;
        head.add(ring);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.17, 8), frame);
        arm.rotation.x = Math.PI / 2;
        arm.position.set(s * 0.155, 0.02, 0.11);
        arm.rotation.z = s * 0.12;
        head.add(arm);
      }
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), frame);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.025, 0.218);
      head.add(bridge);
    }
    if ("headphones" === p.extra) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 12, 48, Math.PI), M("#F4F6FF", { roughness: 0.2, clearcoat: 1 }));
      head.add(band);
      for (const s of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 32), M("#FF4D6D", { roughness: 0.2, clearcoat: 1 }));
        cup.rotation.z = Math.PI / 2;
        cup.position.set(s * 0.225, -0.015, 0);
        head.add(cup);
      }
    }
    return { root, fig, head, eyes, bun };
  }

  // ---- the deck -------------------------------------------------------------------------------------------------------
  const deck = new THREE.Group();
  scene.add(deck);
  const pickables = [];
  const holos = [];
  const spring = (v) => ({ x: v, v: 0, t: v });
  const cards = [];
  for (let i = 0; i < people.length; i++) cards.push(await deckYield().then(() => ((p, i) => {
    const ref = i + 1;
    const group = new THREE.Group();
    const bodyMesh = new THREE.Mesh(bodyGeo, chrome);
    group.add(bodyMesh);
    const front = makeLiveTexture((ctx) => drawFront(ctx, p));
    const frontMesh = new THREE.Mesh(frontGeo, new THREE.MeshPhysicalMaterial({ map: front.tex, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.15 }));
    frontMesh.position.z = FACE_Z;
    group.add(frontMesh);
    const frontHolo = new THREE.Mesh(frontGeo, holoMat(0.28));
    frontHolo.position.z = FACE_Z + 0.001;
    group.add(frontHolo);
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.z = -FACE_Z;
    backMesh.rotation.y = Math.PI;
    group.add(backMesh);
    const backHolo = new THREE.Mesh(backGeo, holoMat(1));
    backHolo.position.z = -FACE_Z - 0.001;
    backHolo.rotation.y = Math.PI;
    group.add(backHolo);
    holos.push(frontHolo.material, backHolo.material);
    const rim = new THREE.Mesh(rimGeo, rimMat());
    group.add(rim);
    const mask = makeMask(ref);
    group.add(mask);
    const studio = makeStudio(p, ref);
    group.add(studio.g);
    const ch = makeCharacter(p);
    ch.root.position.set(0, WIN.bottom - 0.07, -0.5);
    ch.root.scale.setScalar(0.0001);
    group.add(ch.root);
    for (const m of [bodyMesh, frontMesh, backMesh]) {
      m.userData.index = i;
      pickables.push(m);
    }
    deck.add(group);
    return {
      p, group, front, ch, rim, mask, studio,
      s: { x: spring(0), y: spring(0), z: spring(-2), ry: spring(Math.PI), rz: spring(0), pop: spring(0) },
      arrivedAt: -10, isActive: false, burstDone: false,
    };
  })(people[i], i)));
  await deckYield();

  // Mirror floor, faded into the stage.
  const FLOOR_Y = -0.98;
  let mirror = null;
  if (THREE.Reflector && !lite) {
    mirror = new THREE.Reflector(new THREE.PlaneGeometry(9, 5), { clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0x5d6788 });
    mirror.getRenderTarget().stencilBuffer = true;
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(0, FLOOR_Y, -0.6);
    scene.add(mirror);
  }
  {
    const fade = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({
      map: canvasTex(256, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, h, 0, 0);
        g.addColorStop(0, "rgba(5,11,38,1)");
        g.addColorStop(0.35, "rgba(8,18,70,0.55)");
        g.addColorStop(0.62, "rgba(10,24,90,0.35)");
        g.addColorStop(1, "rgba(5,11,38,1)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }),
      transparent: true,
      depthWrite: false,
      opacity: mirror ? 1 : 0.0,
    }));
    fade.rotation.x = -Math.PI / 2;
    fade.position.set(0, FLOOR_Y + 0.002, -0.6);
    scene.add(fade);
    // Glow behind the deck.
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({
      map: canvasTex(256, 256, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
        g.addColorStop(0, "rgba(110,155,255,0.55)");
        g.addColorStop(1, "rgba(110,155,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    glow.position.set(0, 0.1, -2.6);
    scene.add(glow);
  }

  // Sparkles: a slow drift behind the deck, plus a burst when a roommate pops out.
  const sparkTex = canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.8)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }, false);
  const drift = (() => {
    const n = 70, pos = new Float32Array(n * 3), seed = [];
    for (let i = 0; i < n; i++) seed.push([Math.random() * 5 - 2.5, Math.random() * 3, -1.4 - Math.random() * 1.6, 0.05 + Math.random() * 0.1, Math.random() * 6.28]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05, map: sparkTex, color: col("#9DB8FF"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    return { geo, pos, seed };
  })();
  const burst = (() => {
    const n = 110, pos = new Float32Array(n * 3), colr = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      vel.push(new THREE.Vector3());
      const c = new THREE.Color().setHSL(i / n, 0.9, 0.7).convertSRGBToLinear();
      colr.set([c.r * 2, c.g * 2, c.b * 2], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colr, 3));
    const mat = new THREE.PointsMaterial({ size: 0.06, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return { geo, pos, vel, mat, age: 9 };
  })();
  function fireBurst(card) {
    const o = new THREE.Vector3(0, winCY + 0.05, FACE_Z + 0.1);
    card.group.localToWorld(o);
    for (let i = 0; i < burst.vel.length; i++) {
      const a = Math.random() * Math.PI * 2, up = Math.random();
      burst.vel[i].set(Math.cos(a) * (0.8 + Math.random() * 1.4), Math.sin(a) * (0.8 + Math.random() * 1.2) + up * 0.6, 0.4 + Math.random() * 1.2);
      burst.pos.set([o.x + Math.cos(a) * 0.3, o.y + Math.sin(a) * 0.35, o.z], i * 3);
    }
    burst.age = 0;
  }

  // ---- layout --------------------------------------------------------------------------------------------------------
  function pose(o) {
    const a = Math.abs(o), s = Math.sign(o);
    if (0 === a) return { x: 0, y: 0.02, z: 0.55, ry: 0, rz: 0 };
    if (1 === a) return { x: s * 1.0, y: -0.03, z: -0.45, ry: Math.PI - s * 0.55, rz: -s * 0.05 };
    if (2 === a) return { x: s * 1.66, y: -0.07, z: -1.25, ry: Math.PI - s * 0.8, rz: -s * 0.09 };
    return { x: 0, y: 0.04, z: -2, ry: Math.PI, rz: 0 };
  }
  const n = cards.length;
  let active = 0, t = 0;
  function layout() {
    cards.forEach((c, i) => {
      let o = (i - active + n) % n;
      if (o > n / 2) o -= n;
      const target = pose(o);
      c.s.x.t = target.x;
      c.s.y.t = target.y;
      c.s.z.t = target.z;
      c.s.rz.t = target.rz;
      c.s.ry.t = target.ry + Math.round((c.s.ry.x - target.ry) / (Math.PI * 2)) * Math.PI * 2;
      if (0 === o && !c.isActive) {
        c.arrivedAt = t;
        c.burstDone = false;
      }
      c.isActive = 0 === o;
    });
    onActive?.(active, people[active]);
  }
  function step(sp, k, damp, dt) {
    sp.v += (sp.t - sp.x) * k * dt;
    sp.v *= Math.exp(-damp * dt);
    sp.x += sp.v * dt;
  }

  await deckYield();
  // ---- post-processing ---------------------------------------------------------------------------------------------------
  let composer = null, bloom = null;
  if (post) {
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: true };
    const rt = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget
      ? Object.assign(new THREE.WebGLMultisampleRenderTarget(4, 4, opts), { samples: 4 })
      : new THREE.WebGLRenderTarget(4, 4, opts);
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(4, 4), 0.62, 0.5, 0.985);
    composer.addPass(bloom);
    composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  }

  // ---- pointer, picking, sizing -----------------------------------------------------------------------------------------
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.index : -1;
  }
  let camZ = CAM.z;
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const pr = renderer.getPixelRatio();
    if (canvas.width === Math.round(w * pr) && canvas.height === Math.round(h * pr)) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camZ = CAM.z * Math.max(1, 1.05 / camera.aspect);
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      bloom.resolution.set(w * (lite ? 0.5 : 1), h * (lite ? 0.5 : 1));
    }
  }

  // ---- animation ---------------------------------------------------------------------------------------------------------
  function animate(dt) {
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 4);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 4);
    camera.position.set(CAM.x + pointer.sx * 0.35, CAM.y - pointer.sy * 0.18, camZ);
    camera.lookAt(0, 0.02, 0);
    deck.rotation.y = pointer.sx * 0.12 + Math.sin(t * 0.45) * 0.03;
    deck.rotation.x = -pointer.sy * 0.06;
    deck.position.y = Math.sin(t * 0.9) * 0.025;
    glint.position.set(0.6 + pointer.sx * 1.4, 0.8 - pointer.sy * 0.7, 2.4);
    for (const m of holos) {
      m.uniforms.uTime.value = t;
      m.uniforms.uPointer.value.set(pointer.sx, pointer.sy);
    }
    for (const c of cards) {
      const s = c.s;
      for (const k of ["x", "y", "z", "rz"]) step(s[k], 55, 10.5, dt);
      step(s.ry, 46, 9.2, dt);
      c.group.position.set(s.x.x, s.y.x, s.z.x);
      c.group.rotation.set(0, s.ry.x, s.rz.x);
      const facingFront = Math.cos(s.ry.x) > 0.02;
      c.studio.g.visible = facingFront;
      c.mask.visible = facingFront;
      c.rim.material.uniforms.uTime.value = t;
      c.rim.material.uniforms.uGlow.value += ((c.isActive ? 1.15 : 0.5) - c.rim.material.uniforms.uGlow.value) * Math.min(1, dt * 4);
      for (const f of c.studio.floaters) {
        f.m.position.y = f.y + Math.sin(t * 1.3 + f.ph) * 0.025;
        f.m.rotation.set(t * 0.6 + f.ph, t * 0.8, 0);
      }
      // The roommate pops forward out of the window once the card faces you.
      const ready = c.isActive && Math.abs(s.ry.x - s.ry.t) < 0.3;
      s.pop.t = ready ? 1 : 0;
      step(s.pop, ready ? 120 : 220, ready ? 9 : 22, dt);
      const pop = s.pop.x;
      const ch = c.ch;
      ch.root.visible = (c.isActive || pop > 0.02) && facingFront;
      if (!ch.root.visible) continue;
      const k = Math.max(0, pop);
      ch.root.position.z = -0.5 + 0.33 * pop;
      ch.root.scale.setScalar(Math.max(0.0001, 0.84 + 0.28 * k));
      if (ready && !c.burstDone && pop > 0.55) {
        c.burstDone = true;
        fireBurst(c);
      }
      const since = t - c.arrivedAt;
      // Idle: a happy hop on arrival, then breathing; head follows the pointer; blinks.
      const hop = since > 0.6 && since < 1.5 ? Math.sin(((since - 0.6) / 0.9) * Math.PI * 2) * Math.exp(-(since - 0.6) * 2) : 0;
      ch.fig.position.y = Math.max(0, hop) * 0.06 + Math.sin(t * 2) * 0.004;
      ch.fig.scale.set(1 + Math.min(0, hop) * -0.06, 1 + Math.min(0, hop) * 0.08, 1);
      ch.fig.rotation.z = Math.sin(t * 1.1) * 0.025;
      ch.head.rotation.y += (pointer.sx * 0.5 - ch.head.rotation.y) * Math.min(1, dt * 5);
      ch.head.rotation.x += (pointer.sy * 0.28 - ch.head.rotation.x) * Math.min(1, dt * 5);
      ch.head.rotation.z = Math.sin(t * 1.5) * 0.05;
      const bp = (t + c.p.age * 0.37) % 3.4;
      const blink = bp < 0.14 ? 1 - Math.sin((bp / 0.14) * Math.PI) * 0.92 : 1;
      ch.eyes.forEach((e) => (e.scale.y = blink));
      if (ch.bun) ch.bun.rotation.z = Math.sin(t * 2.2) * 0.08;
    }
    for (let i = 0; i < drift.seed.length; i++) {
      const [x, y, z, sp, ph] = drift.seed[i];
      drift.pos[i * 3] = x + Math.sin(t * 0.6 + ph) * 0.1;
      drift.pos[i * 3 + 1] = ((y + t * sp) % 3) - 1.1;
      drift.pos[i * 3 + 2] = z;
    }
    drift.geo.attributes.position.needsUpdate = true;
    if (burst.age < 2) {
      burst.age += dt;
      for (let i = 0; i < burst.vel.length; i++) {
        const v = burst.vel[i];
        v.multiplyScalar(Math.exp(-2.6 * dt));
        v.y -= 1.2 * dt;
        burst.pos[i * 3] += v.x * dt;
        burst.pos[i * 3 + 1] += v.y * dt;
        burst.pos[i * 3 + 2] += v.z * dt;
      }
      burst.geo.attributes.position.needsUpdate = true;
      burst.mat.opacity = Math.max(0, 1 - burst.age / 1.4);
    }
  }

  // Frame rate: 60 fps while something is happening (pointer, a card moving, a flip), 30 fps while the deck only idles.
  let raf = 0, last = null, running = false, drawn = 0, pokedAt = 0;
  const poke = () => (pokedAt = performance.now());
  function render() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
  function frame(now) {
    const fps = now - pokedAt < 2500 ? 60 : 30;
    if (drawn && now - drawn < 1000 / fps - 4) { raf = requestAnimationFrame(frame); return; }
    drawn = now;
    fit();
    const dt = null == last ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    animate(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  // Card art once the web fonts are in; warm up every shader before anything moves.
  document.fonts?.ready.then(() => cards.forEach((c) => c.front.redraw()));
  layout();
  cards.forEach((c) => {
    for (const k of ["x", "y", "z", "rz"]) c.s[k].x = c.s[k].t;
    c.s.ry.x = c.s.ry.t + (c.isActive ? Math.PI : 0); // the first card starts face down and flips in
  });
  fit();
  cards.forEach((c) => {
    c.ch.root.visible = true;
    c.ch.root.scale.setScalar(1);
  });
  await deckYield();
  renderer.compile(scene, camera);
  await deckYield();
  animate(0);
  render();
  poke();
  if (reduced) cards.forEach((c) => (c.s.ry.x = c.s.ry.t));

  return {
    get active() {
      return active;
    },
    get running() {
      return running;
    },
    go(i) {
      poke();
      active = ((i % n) + n) % n;
      layout();
    },
    next() {
      this.go(active + 1);
    },
    flip() {
      poke();
      const c = cards[active];
      c.isActive = !c.isActive;
      c.s.ry.t += Math.PI;
      if (c.isActive) {
        c.arrivedAt = t;
        c.burstDone = false;
      }
    },
    pick,
    setPointer(x, y) {
      if (Math.abs(x - pointer.x) + Math.abs(y - pointer.y) > 0.002) poke();
      pointer.x = Math.max(-1, Math.min(1, x));
      pointer.y = Math.max(-1, Math.min(1, y));
    },
    play() {
      if (running) return;
      running = true;
      last = null;
      drawn = 0;
      poke();
      raf = requestAnimationFrame(frame);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    // Frees everything the GPU holds for the deck: geometries, materials, their textures, the post-processing
    // targets and the context itself.
    dispose() {
      this.pause();
      const seen = new Set();
      const drop = (o) => { if (o && !seen.has(o) && "function" === typeof o.dispose) { seen.add(o); o.dispose(); } };
      scene.traverse((o) => {
        drop(o.geometry);
        for (const m of [].concat(o.material || [])) {
          for (const v of Object.values(m)) if (v && v.isTexture) drop(v);
          if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) drop(u.value);
          drop(m);
        }
      });
      if (scene.background && scene.background.isTexture) drop(scene.background);
      if (scene.environment) drop(scene.environment);
      if (composer) {
        drop(composer.renderTarget1);
        drop(composer.renderTarget2);
        for (const p of composer.passes || []) drop(p);
      }
      if (mirror) drop(mirror.getRenderTarget && mirror.getRenderTarget());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
