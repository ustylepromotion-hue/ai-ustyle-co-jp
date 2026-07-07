/* =============================================
   main.js — Three.js Hero + GSAP + interactions
   ============================================= */

/* ---------- GSAP SETUP ---------- */
if(window.gsap && window.ScrollTrigger){
  gsap.registerPlugin(ScrollTrigger);
}

/* ---------- CUSTOM CURSOR ---------- */
const dot = document.getElementById('cursorDot');
const ring = document.getElementById('cursorRing');
let mx = window.innerWidth/2, my = window.innerHeight/2;
let rx = mx, ry = my;

if(dot && ring){
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  });
  (function animRing(){
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(animRing);
  })();
}

/* ---------- PAGE PROGRESS ---------- */
const progress = document.getElementById('pageProgress');
function updatePageProgress(){
  if(!progress) return;
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const pct = window.scrollY / scrollable * 100;
  progress.style.width = Math.min(Math.max(pct, 0), 100) + '%';
}
window.addEventListener('scroll', updatePageProgress, {passive:true});

/* ---------- HEADER ---------- */
const header = document.getElementById('header');
function updateHeaderState(){
  if(!header) return;
  header.classList.toggle('scrolled', window.scrollY > 60);
}
window.addEventListener('scroll', updateHeaderState, {passive:true});

/* ---------- HAMBURGER / OFFCANVAS ---------- */
const hamburger = document.getElementById('hamburger');
const offcanvas = document.getElementById('offcanvas');
if(hamburger && offcanvas){
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    offcanvas.classList.toggle('active');
    document.body.classList.toggle('no-scroll');
  });
  document.querySelectorAll('.offcanvas-link').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('active');
      offcanvas.classList.remove('active');
      document.body.classList.remove('no-scroll');
    });
  });
}

/* ---------- DATA STREAM CHARS ---------- */
(function spawnDataChars(){
  const container = document.getElementById('heroDataStream');
  if(!container) return;
  const chars = '01アイウエオカキAIMLAPI//{}[]<>∑∫λ∇◆▲⬡'.split('');
  const columns = Math.floor(window.innerWidth / (window.innerWidth < 768 ? 42 : 28));
  for(let i=0; i<columns; i++){
    if(Math.random() > 0.55) continue;
    const el = document.createElement('span');
    el.className = 'data-char';
    el.textContent = chars[Math.floor(Math.random()*chars.length)];
    el.style.left = (i * 28 + Math.random()*14) + 'px';
    el.style.animationDuration = (6 + Math.random()*14) + 's';
    el.style.animationDelay = (Math.random()*12) + 's';
    el.style.fontSize = (.55 + Math.random()*.35) + 'rem';
    el.style.opacity = (.12 + Math.random()*.25);
    container.appendChild(el);
  }
})();

/* ---------- THREE.JS HERO (DRAMATIC) ---------- */
(function initHero(){
  const canvas = document.getElementById('heroCanvas');
  if(!canvas || !window.THREE) return;
  const T = THREE;
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x07090e, 0.018);

  const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x07090e, 1);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  const camera = new T.PerspectiveCamera(65, canvas.clientWidth/canvas.clientHeight, 0.1, 300);
  camera.position.set(0, 2, 22);

  /* ── 1. PARTICLES (500) with color variation ── */
  const COUNT = window.innerWidth < 768 ? 260 : 500;
  const pPos = new Float32Array(COUNT*3);
  const pCol = new Float32Array(COUNT*3);
  const pVel = [];
  const palette = [
    new T.Color(0x3b82f6),
    new T.Color(0x0ea5e9),
    new T.Color(0x60a5fa),
    new T.Color(0xffffff),
    new T.Color(0x93c5fd),
  ];
  for(let i=0;i<COUNT;i++){
    pPos[i*3]   = (Math.random()-.5)*55;
    pPos[i*3+1] = (Math.random()-.5)*30;
    pPos[i*3+2] = (Math.random()-.5)*20;
    const c = palette[Math.floor(Math.random()*palette.length)];
    pCol[i*3]=c.r; pCol[i*3+1]=c.g; pCol[i*3+2]=c.b;
    pVel.push({x:(Math.random()-.5)*.014, y:(Math.random()-.5)*.009, z:(Math.random()-.5)*.006});
  }
  const pGeo = new T.BufferGeometry();
  pGeo.setAttribute('position', new T.BufferAttribute(pPos,3));
  pGeo.setAttribute('color',    new T.BufferAttribute(pCol,3));
  const pMat = new T.PointsMaterial({size:.28, vertexColors:true, transparent:true, opacity:.85, sizeAttenuation:true});
  scene.add(new T.Points(pGeo, pMat));

  /* ── 2. CONNECTION LINES ── */
  const MAX_LINES = 6000;
  const lPos = new Float32Array(MAX_LINES*6);
  const lGeo = new T.BufferGeometry();
  lGeo.setAttribute('position', new T.BufferAttribute(lPos,3));
  const lMesh = new T.LineSegments(lGeo, new T.LineBasicMaterial({
    color:0x3b82f6, transparent:true, opacity:.10
  }));
  scene.add(lMesh);

  /* ── 3. WIREFRAME ICOSAHEDRON ── */
  const icoGeo = new T.IcosahedronGeometry(6.5, 1);
  const icoEdges = new T.EdgesGeometry(icoGeo);
  const icoMat = new T.LineBasicMaterial({color:0x3b82f6, transparent:true, opacity:.18});
  const ico = new T.LineSegments(icoEdges, icoMat);
  ico.position.set(10, 1, -5);
  scene.add(ico);

  /* ── 4. INNER GLOWING SPHERE ── */
  const coreGeo = new T.SphereGeometry(1.2, 32, 32);
  const coreMat = new T.MeshBasicMaterial({color:0x60a5fa, transparent:true, opacity:.55});
  const core = new T.Mesh(coreGeo, coreMat);
  core.position.set(10, 1, -5);
  scene.add(core);

  /* ── 5. OUTER GLOW HALO ── */
  const haloGeo = new T.SphereGeometry(2.4, 32, 32);
  const haloMat = new T.MeshBasicMaterial({color:0x3b82f6, transparent:true, opacity:.06, side:T.BackSide});
  const halo = new T.Mesh(haloGeo, haloMat);
  halo.position.copy(core.position);
  scene.add(halo);

  /* ── 6. ORBIT RINGS around ico ── */
  function makeRing(radius, tilt, col){
    const g = new T.TorusGeometry(radius, 0.018, 6, 80);
    const m = new T.MeshBasicMaterial({color:col, transparent:true, opacity:.25});
    const mesh = new T.Mesh(g,m);
    mesh.rotation.x = tilt;
    mesh.position.copy(core.position);
    scene.add(mesh);
    return mesh;
  }
  const ring1 = makeRing(3.5, Math.PI*0.3, 0x3b82f6);
  const ring2 = makeRing(4.8, Math.PI*0.6, 0x0ea5e9);
  const ring3 = makeRing(6.0, Math.PI*0.1, 0x60a5fa);

  /* ── 7. PERSPECTIVE GRID FLOOR ── */
  const grid = new T.GridHelper(100, 50, 0x1d4ed8, 0x1e3a5f);
  grid.position.y = -11;
  grid.material.opacity = 0.12;
  grid.material.transparent = true;
  scene.add(grid);

  /* ── 8. SHOOTING DATA LINES ── */
  const shooters = [];
  function makeShooter(){
    const g = new T.BufferGeometry();
    const pts = [new T.Vector3(0,0,0), new T.Vector3(0,0,0)];
    g.setFromPoints(pts);
    const m = new T.LineBasicMaterial({color:0x7dd3fc, transparent:true, opacity:.7});
    const line = new T.Line(g,m);
    const angle = Math.random()*Math.PI*2;
    const speed = 0.35 + Math.random()*0.4;
    scene.add(line);
    return {
      line, speed, angle,
      x: (Math.random()-.5)*50,
      y: (Math.random()-.5)*22,
      z: (Math.random()-.5)*10,
      life: 0, maxLife: 40 + Math.random()*60,
      tailLen: 2.5 + Math.random()*3
    };
  }
  for(let i=0;i<(window.innerWidth < 768 ? 6 : 12);i++) shooters.push(makeShooter());

  function resetShooter(s){
    s.x = (Math.random()-.5)*55;
    s.y = (Math.random()-.5)*28;
    s.z = (Math.random()-.5)*12;
    s.angle = Math.random()*Math.PI*2;
    s.life = 0;
    s.maxLife = 40 + Math.random()*60;
    s.speed = 0.35 + Math.random()*0.4;
    s.tailLen = 2.5 + Math.random()*3;
  }

  /* ── Mouse ── */
  let mNX=0, mNY=0, tRX=0, tRY=0, cRX=0, cRY=0;
  document.addEventListener('mousemove', e=>{
    mNX = (e.clientX/window.innerWidth-.5);
    mNY = (e.clientY/window.innerHeight-.5);
    tRY = mNX * .4;
    tRX = mNY * -.18;
  });

  window.addEventListener('resize', ()=>{
    const w=canvas.clientWidth, h=canvas.clientHeight;
    camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h);
  });

  const THRESH = 8;
  let frame = 0;
  const clock = new T.Clock();

  function animate(){
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    frame++;

    /* particles move */
    for(let i=0;i<COUNT;i++){
      pPos[i*3]   += pVel[i].x;
      pPos[i*3+1] += pVel[i].y;
      pPos[i*3+2] += pVel[i].z;
      if(Math.abs(pPos[i*3])   > 27) pVel[i].x*=-1;
      if(Math.abs(pPos[i*3+1]) > 15) pVel[i].y*=-1;
      if(Math.abs(pPos[i*3+2]) > 10) pVel[i].z*=-1;
    }
    pGeo.attributes.position.needsUpdate = true;

    /* connections every 3 frames */
    if(frame%3===0){
      let li=0;
      for(let i=0;i<COUNT;i++){
        for(let j=i+1;j<COUNT;j++){
          const dx=pPos[i*3]-pPos[j*3], dy=pPos[i*3+1]-pPos[j*3+1], dz=pPos[i*3+2]-pPos[j*3+2];
          const d=dx*dx+dy*dy+dz*dz;
          if(d<THRESH*THRESH && li<MAX_LINES*6-6){
            lPos[li++]=pPos[i*3]; lPos[li++]=pPos[i*3+1]; lPos[li++]=pPos[i*3+2];
            lPos[li++]=pPos[j*3]; lPos[li++]=pPos[j*3+1]; lPos[li++]=pPos[j*3+2];
          }
        }
      }
      lGeo.attributes.position.needsUpdate=true;
      lGeo.setDrawRange(0,li/3);
    }

    /* icosahedron + rings rotate */
    ico.rotation.x = t*0.18;
    ico.rotation.y = t*0.12;
    ring1.rotation.z = t*0.4;
    ring2.rotation.z = -t*0.25;
    ring3.rotation.x = t*0.18 + Math.PI*0.3;

    /* core pulse */
    const pulse = 1 + Math.sin(t*2.4)*.12;
    core.scale.setScalar(pulse);
    coreMat.opacity = 0.45 + Math.sin(t*2.4)*.18;
    halo.scale.setScalar(1 + Math.sin(t*1.8)*.18);

    /* shooters */
    shooters.forEach(s => {
      s.life++;
      if(s.life > s.maxLife){ resetShooter(s); return; }
      s.x += Math.cos(s.angle)*s.speed;
      s.y += Math.sin(s.angle)*s.speed*.3;
      const pts = s.line.geometry.attributes.position;
      pts.setXYZ(0, s.x, s.y, s.z);
      pts.setXYZ(1, s.x - Math.cos(s.angle)*s.tailLen, s.y - Math.sin(s.angle)*s.tailLen*.3, s.z);
      pts.needsUpdate=true;
      const prog = s.life/s.maxLife;
      s.line.material.opacity = prog<.2 ? prog*3.5 : prog>.75 ? (1-prog)*4 : .8;
    });

    /* camera bob */
    camera.position.y = 2 + Math.sin(t*.4)*.4;

    /* mouse parallax */
    cRX += (tRX - cRX)*.05;
    cRY += (tRY - cRY)*.05;
    scene.rotation.x = cRX;
    scene.rotation.y = cRY;

    /* grid slow drift */
    grid.rotation.y = t*0.005;

    renderer.render(scene, camera);
  }
  animate();
})();

/* ---------- HERO STAT COUNTERS ---------- */
function animCounter(el){
  const target = parseInt(el.dataset.target);
  let current = 0;
  const step = target / 60;
  const id = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current);
    if(current >= target) clearInterval(id);
  }, 18);
}
const statsObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(e.isIntersecting){
      document.querySelectorAll('.stat-num').forEach(animCounter);
      statsObserver.disconnect();
    }
  });
});
const statsEl = document.querySelector('.hero-stats');
if(statsEl) statsObserver.observe(statsEl);

/* ---------- REVEAL ANIMATIONS ---------- */
const revealEls = Array.from(document.querySelectorAll('.reveal-up, .reveal-left'));
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(e.isIntersecting){
      e.target.classList.add('revealed');
      revealObserver.unobserve(e.target);
    }
  });
}, {rootMargin:'0px 0px -8% 0px', threshold:.08});

function revealVisibleElements(){
  const bottom = window.innerHeight * 1.04;
  revealEls.forEach(el => {
    const r = el.getBoundingClientRect();
    if(r.top < bottom && r.bottom > -20){
      el.classList.add('revealed');
      revealObserver.unobserve(el);
    }
  });
}

revealEls.forEach(el => revealObserver.observe(el));

/* ---------- STATEMENT LIGHT-UP ---------- */
const stLines = document.querySelectorAll('.st-line');
const stObserver = new IntersectionObserver(entries => {
  entries.forEach(e => e.target.classList.toggle('lit', e.isIntersecting));
}, {rootMargin:'-30% 0px -30% 0px', threshold:.5});
stLines.forEach(l => stObserver.observe(l));

/* ---------- SOLUTIONS TICKER ---------- */
(function initTicker(){
  const track = document.getElementById('tickerTrack');
  if(!track) return;
  const wrap = track.parentElement;
  let offset = 0;
  let isDragging = false, startX = 0, dragOffset = 0;
  const speed = 0.6;
  let animId;
  let paused = false;

  const loopWidth = () => {
    const cards = track.querySelectorAll('.ticker-card');
    const half = Math.floor(cards.length / 2);
    let w = 0;
    for(let i=0;i<half;i++) w += cards[i].getBoundingClientRect().width + 24;
    return w;
  };

  let lw = 0;
  function tick(){
    animId = requestAnimationFrame(tick);
    if(isDragging || paused) return;
    if(!lw) lw = loopWidth();
    offset += speed;
    if(offset >= lw) offset -= lw;
    track.style.transform = `translate3d(${-offset}px,0,0)`;
  }
  tick();

  wrap.addEventListener('mouseenter', () => { paused = true; });
  wrap.addEventListener('mouseleave', () => { paused = false; });

  wrap.addEventListener('mousedown', e => {
    isDragging = true; startX = e.clientX; dragOffset = offset;
    wrap.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if(!isDragging) return;
    if(!lw) lw = loopWidth();
    offset = ((dragOffset - (e.clientX - startX)) % lw + lw) % lw;
    track.style.transform = `translate3d(${-offset}px,0,0)`;
  });
  window.addEventListener('mouseup', () => {
    isDragging = false; wrap.style.cursor = 'grab';
  });
})();

/* ---------- STEP POLYGON BIG BANG CANVASES ---------- */
(function initStepCanvases(){
  if(!window.THREE) return;
  const T = THREE;
  const clock = new T.Clock();

  function makeRenderer(canvas, w, h){
    const r = new T.WebGLRenderer({canvas, antialias:true, alpha:false});
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.setClearColor(0x020408, 1);
    r.setSize(w || canvas.clientWidth || 300, h || canvas.clientHeight || 160);
    return r;
  }

  function bindResize(canvas, renderer, camera, isOrtho){
    new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if(!w || !h) return;
      renderer.setSize(w, h);
      if(isOrtho){
        camera.left=-w/2; camera.right=w/2;
        camera.top=h/2; camera.bottom=-h/2;
      } else {
        camera.aspect = w/h;
      }
      camera.updateProjectionMatrix();
    }).observe(canvas);
  }

  /* ═══════════════════════════════════════════
     STEP 01 — BIG BANG EXPLOSION
     粒子が中心から爆発し拡散、引力で揺れ続ける
  ═══════════════════════════════════════════ */
  (function step1(){
    const canvas = document.getElementById('stepCanvas1');
    if(!canvas) return;
    const W = canvas.clientWidth || 300, H = canvas.clientHeight || 160;
    const renderer = makeRenderer(canvas, W, H);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(60, W/H, 0.1, 300);
    camera.position.z = 12;
    bindResize(canvas, renderer, camera, false);

    const COUNT = 280;
    const positions = new Float32Array(COUNT * 3);
    const velocities = [];
    const origins = [];
    // Colors: deep blue → cyan → white burst
    const colors = new Float32Array(COUNT * 3);
    const colPalette = [
      [0.23, 0.51, 0.96], // #3b82f6
      [0.06, 0.65, 0.91], // #0ea5e9
      [0.58, 0.77, 0.99], // #93c5fd
      [1.0,  1.0,  1.0],  // white
    ];

    for(let i = 0; i < COUNT; i++){
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const speed = 0.08 + Math.random() * 0.25;
      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.sin(phi) * Math.sin(theta) * speed;
      const vz = Math.cos(phi) * speed * 0.3;
      velocities.push({vx, vy, vz, ox:0, oy:0, oz:0, life: Math.random()});
      origins.push({x:0, y:0, z:0});
      positions[i*3] = (Math.random()-0.5)*0.5;
      positions[i*3+1] = (Math.random()-0.5)*0.5;
      positions[i*3+2] = (Math.random()-0.5)*0.2;
      const c = colPalette[Math.floor(Math.random() * colPalette.length)];
      colors[i*3] = c[0]; colors[i*3+1] = c[1]; colors[i*3+2] = c[2];
    }

    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new T.BufferAttribute(colors, 3));
    const mat = new T.PointsMaterial({size: 0.18, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true});
    scene.add(new T.Points(geo, mat));

    // Connection lines for nearest particles
    const MAX_L = 2000;
    const lPos = new Float32Array(MAX_L * 6);
    const lGeo = new T.BufferGeometry();
    lGeo.setAttribute('position', new T.BufferAttribute(lPos, 3));
    const lLines = new T.LineSegments(lGeo, new T.LineBasicMaterial({color: 0x3b82f6, transparent: true, opacity: 0.08}));
    scene.add(lLines);

    // Shockwave ring
    const ringGeo = new T.TorusGeometry(0.1, 0.01, 6, 60);
    const ringMat = new T.MeshBasicMaterial({color: 0x60a5fa, transparent: true, opacity: 0.8});
    const ring = new T.Mesh(ringGeo, ringMat);
    scene.add(ring);

    let frame = 0;
    (function loop(){
      requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      frame++;

      // Expand particles outward, then drift
      const pos = geo.attributes.position.array;
      const MAXR = 8;
      for(let i = 0; i < COUNT; i++){
        const v = velocities[i];
        v.life += 0.004;
        pos[i*3]   += v.vx * (1 - Math.min(v.life, 1) * 0.85);
        pos[i*3+1] += v.vy * (1 - Math.min(v.life, 1) * 0.85);
        pos[i*3+2] += v.vz;
        // Wrap
        const r = Math.sqrt(pos[i*3]**2 + pos[i*3+1]**2);
        if(r > MAXR){
          pos[i*3] = (Math.random()-0.5)*0.4;
          pos[i*3+1] = (Math.random()-0.5)*0.4;
          pos[i*3+2] = (Math.random()-0.5)*0.2;
          velocities[i].life = 0;
        }
      }
      geo.attributes.position.needsUpdate = true;

      // Lines between close particles
      if(frame % 2 === 0){
        let li = 0;
        for(let i = 0; i < COUNT && li < MAX_L*6-6; i++){
          for(let j = i+1; j < COUNT && li < MAX_L*6-6; j++){
            const dx = pos[i*3]-pos[j*3], dy = pos[i*3+1]-pos[j*3+1];
            const d2 = dx*dx + dy*dy;
            if(d2 < 4){
              lPos[li++]=pos[i*3]; lPos[li++]=pos[i*3+1]; lPos[li++]=pos[i*3+2];
              lPos[li++]=pos[j*3]; lPos[li++]=pos[j*3+1]; lPos[li++]=pos[j*3+2];
            }
          }
        }
        lGeo.attributes.position.needsUpdate = true;
        lGeo.setDrawRange(0, li/3);
      }

      // Shockwave ring expands and resets
      const rScale = ((t * 0.9) % 3) * 3;
      ring.scale.setScalar(rScale + 0.1);
      ringMat.opacity = Math.max(0, 0.8 - rScale/9);
      ring.rotation.x = t * 0.2;

      // Slow scene rotation
      scene.rotation.y = Math.sin(t * 0.15) * 0.3;
      scene.rotation.x = Math.cos(t * 0.1) * 0.1;

      renderer.render(scene, camera);
    })();
  })();

  /* ═══════════════════════════════════════════
     STEP 02 — VORTEX COLLAPSE (セキュア構築)
     螺旋を描きながら中心に収束するポリゴン群
  ═══════════════════════════════════════════ */
  (function step2(){
    const canvas = document.getElementById('stepCanvas2');
    if(!canvas) return;
    const W = canvas.clientWidth || 300, H = canvas.clientHeight || 160;
    const renderer = makeRenderer(canvas, W, H);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(55, W/H, 0.1, 200);
    camera.position.set(0, 0, 10);
    bindResize(canvas, renderer, camera, false);

    // Central octahedron — the secure core
    const coreGeo = new T.OctahedronGeometry(1.2, 0);
    const coreEdges = new T.EdgesGeometry(coreGeo);
    const coreMesh = new T.LineSegments(coreEdges,
      new T.LineBasicMaterial({color: 0x10b981, transparent: true, opacity: 0.85}));
    scene.add(coreMesh);

    const solidCore = new T.Mesh(
      new T.OctahedronGeometry(0.9, 0),
      new T.MeshBasicMaterial({color: 0x064e3b, transparent: true, opacity: 0.6})
    );
    scene.add(solidCore);

    // Orbiting shield fragments
    const FRAG = 60;
    const fragPositions = new Float32Array(FRAG * 3);
    const fragAngles = [];
    const fragRadii = [];
    const fragSpeeds = [];
    for(let i = 0; i < FRAG; i++){
      const angle = (i / FRAG) * Math.PI * 2;
      const radius = 2.5 + (i % 3) * 1.2;
      const speed  = 0.4 + Math.random() * 0.3;
      fragAngles.push(angle);
      fragRadii.push(radius);
      fragSpeeds.push(speed * (i % 2 === 0 ? 1 : -0.7));
      fragPositions[i*3]   = Math.cos(angle) * radius;
      fragPositions[i*3+1] = Math.sin(angle) * radius * 0.4;
      fragPositions[i*3+2] = Math.sin(i * 0.8) * 1.5;
    }
    const fragGeo = new T.BufferGeometry();
    fragGeo.setAttribute('position', new T.BufferAttribute(fragPositions, 3));
    scene.add(new T.Points(fragGeo, new T.PointsMaterial({color: 0x10b981, size: 0.14, transparent: true, opacity: 0.75})));

    // Three orbit rings
    [[3.2, 0.3, 0x10b981, 0.35], [4.5, 0.6, 0x06b6d4, 0.2], [2.0, 0.1, 0x34d399, 0.28]].forEach(([r, tilt, col, op]) => {
      const m = new T.Mesh(
        new T.TorusGeometry(r, 0.02, 6, 80),
        new T.MeshBasicMaterial({color: col, transparent: true, opacity: op})
      );
      m.rotation.x = tilt * Math.PI;
      scene.add(m);
    });

    // Vortex line spiral
    const SPIRALPTS = 120;
    const spiralPos = new Float32Array(SPIRALPTS * 3);
    const spiralGeo = new T.BufferGeometry();
    spiralGeo.setAttribute('position', new T.BufferAttribute(spiralPos, 3));
    scene.add(new T.Line(spiralGeo, new T.LineBasicMaterial({color: 0x10b981, transparent: true, opacity: 0.22})));

    (function loop(){
      requestAnimationFrame(loop);
      const t = clock.getElapsedTime();

      // Core rotates
      coreMesh.rotation.x = t * 0.35;
      coreMesh.rotation.y = t * 0.22;
      solidCore.rotation.x = -t * 0.3;
      solidCore.rotation.y = t * 0.2;

      // Core pulse
      const pulse = 1 + Math.sin(t * 2.8) * 0.1;
      coreMesh.scale.setScalar(pulse);

      // Orbit fragments spiral inward/outward
      const fp = fragGeo.attributes.position.array;
      for(let i = 0; i < FRAG; i++){
        fragAngles[i] += fragSpeeds[i] * 0.018;
        const wobble = Math.sin(t * 1.2 + i * 0.5) * 0.3;
        fp[i*3]   = Math.cos(fragAngles[i]) * (fragRadii[i] + wobble);
        fp[i*3+1] = Math.sin(fragAngles[i]) * (fragRadii[i] + wobble) * 0.4;
        fp[i*3+2] = Math.sin(fragAngles[i] * 2 + t) * 1.2;
      }
      fragGeo.attributes.position.needsUpdate = true;

      // Update spiral
      for(let i = 0; i < SPIRALPTS; i++){
        const angle = (i / SPIRALPTS) * Math.PI * 6 + t * 0.5;
        const radius = (i / SPIRALPTS) * 4.5;
        spiralPos[i*3]   = Math.cos(angle) * radius;
        spiralPos[i*3+1] = Math.sin(angle) * radius * 0.35;
        spiralPos[i*3+2] = (i / SPIRALPTS) * 2 - 1;
      }
      spiralGeo.attributes.position.needsUpdate = true;

      scene.rotation.y = t * 0.04;
      renderer.render(scene, camera);
    })();
  })();

  /* ═══════════════════════════════════════════
     STEP 03 — ORGANIC GROWTH NETWORK (定着・伴走)
     樹木のように枝分かれしながら成長するネットワーク
  ═══════════════════════════════════════════ */
  (function step3(){
    const canvas = document.getElementById('stepCanvas3');
    if(!canvas) return;
    const W = canvas.clientWidth || 300, H = canvas.clientHeight || 160;
    const renderer = makeRenderer(canvas, W, H);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(55, W/H, 0.1, 200);
    camera.position.set(0, 0, 11);
    bindResize(canvas, renderer, camera, false);

    // Torus knot — organic complexity
    const tkGeo = new T.TorusKnotGeometry(2.0, 0.35, 120, 14);
    const tkEdge = new T.EdgesGeometry(tkGeo);
    const tkMesh = new T.LineSegments(tkEdge,
      new T.LineBasicMaterial({color: 0xa855f7, transparent: true, opacity: 0.45}));
    scene.add(tkMesh);

    // Pulsing core
    const coreGeo = new T.SphereGeometry(0.5, 20, 20);
    const coreMesh = new T.Mesh(coreGeo,
      new T.MeshBasicMaterial({color: 0xc084fc, transparent: true, opacity: 0.85}));
    scene.add(coreMesh);

    // Halo
    const haloMesh = new T.Mesh(
      new T.SphereGeometry(0.9, 20, 20),
      new T.MeshBasicMaterial({color: 0xa855f7, transparent: true, opacity: 0.08, side: T.BackSide})
    );
    scene.add(haloMesh);

    // Orbiting particles — growth nodes
    const NODES = 50;
    const nodePos = new Float32Array(NODES * 3);
    const nodeAngles = Array.from({length: NODES}, (_, i) => (i / NODES) * Math.PI * 2);
    const nodeSpeeds = Array.from({length: NODES}, () => 0.15 + Math.random() * 0.25);
    const nodeRadii  = Array.from({length: NODES}, () => 2.5 + Math.random() * 2.5);
    const nodeGeo = new T.BufferGeometry();
    nodeGeo.setAttribute('position', new T.BufferAttribute(nodePos, 3));
    scene.add(new T.Points(nodeGeo,
      new T.PointsMaterial({color: 0xd8b4fe, size: 0.13, transparent: true, opacity: 0.8})));

    // Connection lines between nodes
    const MAX_NL = 1000;
    const nlPos = new Float32Array(MAX_NL * 6);
    const nlGeo = new T.BufferGeometry();
    nlGeo.setAttribute('position', new T.BufferAttribute(nlPos, 3));
    scene.add(new T.LineSegments(nlGeo,
      new T.LineBasicMaterial({color: 0xa855f7, transparent: true, opacity: 0.12})));

    let frame = 0;
    (function loop(){
      requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      frame++;

      // Rotate torus knot
      tkMesh.rotation.x = t * 0.12;
      tkMesh.rotation.y = t * 0.08;

      // Core pulse
      const pulse = 1 + Math.sin(t * 2.2) * 0.18;
      coreMesh.scale.setScalar(pulse);
      haloMesh.scale.setScalar(1 + Math.sin(t * 1.6) * 0.25);

      // Move growth nodes
      const np = nodeGeo.attributes.position.array;
      for(let i = 0; i < NODES; i++){
        nodeAngles[i] += nodeSpeeds[i] * 0.015;
        const r = nodeRadii[i] + Math.sin(t * 0.8 + i * 0.7) * 0.5;
        np[i*3]   = Math.cos(nodeAngles[i]) * r;
        np[i*3+1] = Math.sin(nodeAngles[i]) * r * 0.5 + Math.sin(t * 0.5 + i * 0.4) * 0.4;
        np[i*3+2] = Math.sin(nodeAngles[i] * 1.5) * 1.5;
      }
      nodeGeo.attributes.position.needsUpdate = true;

      // Update connections
      if(frame % 3 === 0){
        let li = 0;
        for(let i = 0; i < NODES && li < MAX_NL*6-6; i++){
          for(let j = i+1; j < NODES && li < MAX_NL*6-6; j++){
            const dx = np[i*3]-np[j*3], dy = np[i*3+1]-np[j*3+1];
            if(dx*dx+dy*dy < 5){
              nlPos[li++]=np[i*3]; nlPos[li++]=np[i*3+1]; nlPos[li++]=np[i*3+2];
              nlPos[li++]=np[j*3]; nlPos[li++]=np[j*3+1]; nlPos[li++]=np[j*3+2];
            }
          }
        }
        nlGeo.attributes.position.needsUpdate = true;
        nlGeo.setDrawRange(0, li/3);
      }

      scene.rotation.y = Math.sin(t * 0.18) * 0.35;
      renderer.render(scene, camera);
    })();
  })();
})();

/* ---------- PROCESS STICKY (scroll-based) ---------- */
(function initProcess(){
  const stepsContainer = document.getElementById('processSteps');
  const steps = Array.from(document.querySelectorAll('.process-step'));
  const stepImages = steps.map(s => s.querySelector('.step-image'));
  const fillEl = document.getElementById('timelineFill');
  if(!steps.length) return;

  const isDesktop = () => window.innerWidth > 1024;

  // Fade-in latch: each step's creative fades in once and stays.
  // Detached from `active` so the canvas never re-hides on scroll wobble.
  const seenObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('seen');
        seenObs.unobserve(e.target);
      }
    });
  }, {rootMargin:'0px 0px -8% 0px', threshold:0});
  steps.forEach(s => seenObs.observe(s));

  // Independent per-step image fade-in. Each image now lives inside its own
  // .process-step (third grid column) and sticks beside its own content,
  // so the visual position itself is bound to the step's scroll location.
  // Active toggle is purely per-step — no cross-coupling between images.
  if(stepImages.some(Boolean)){
    const imageObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const idx = steps.indexOf(e.target);
        if(idx === -1 || !stepImages[idx]) return;
        stepImages[idx].classList.toggle('active', e.isIntersecting);
      });
    }, {rootMargin:'0px 0px -22% 0px', threshold:0.12});
    steps.forEach(s => imageObs.observe(s));
  }

  // Active highlight (text/dot/badge).
  let currentActive = -1;
  const activate = (index) => {
    if(currentActive === index) return;
    currentActive = index;
    steps.forEach((s,i) => s.classList.toggle('active', i === index));
  };

  const updateTimeline = () => {
    if(!fillEl || !stepsContainer) return;
    if(!isDesktop()){ fillEl.style.height = '0%'; return; }
    const rect = stepsContainer.getBoundingClientRect();
    const total = Math.max(1, stepsContainer.offsetHeight - window.innerHeight * .4);
    const scrolled = Math.max(0, -rect.top + window.innerHeight * .4);
    fillEl.style.height = Math.min(100, scrolled/total*100) + '%';
  };

  // Stable detection: pick the LAST step whose top has crossed the trigger.
  // Monotonic in scroll direction, so adjacent steps can't ping-pong.
  const updateActive = () => {
    if(!isDesktop()) return;
    const trigger = window.innerHeight * 0.5;
    let active = 0;
    for(let i = 0; i < steps.length; i++){
      const r = steps[i].getBoundingClientRect();
      if(r.top <= trigger) active = i;
      else break;
    }
    activate(active);
  };

  if(!isDesktop()){
    steps.forEach(s => s.classList.add('active','seen'));
    stepImages.forEach(img => { if(img) img.classList.add('active'); });
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){
          const idx = steps.indexOf(e.target);
          if(idx !== -1) activate(idx);
        }
      });
    }, {rootMargin:'-30% 0px -30% 0px', threshold:0});
    steps.forEach(s => obs.observe(s));
  } else {
    activate(0);
    let ticking = false;
    const onScroll = () => {
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateActive();
        updateTimeline();
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, {passive:true});
    updateActive();
    updateTimeline();
  }
})();

/* ---------- GSAP PARALLAX (hero scroll) ---------- */
(function initParallax(){
  if(!window.gsap || !window.ScrollTrigger) return;
  const hero = document.getElementById('hero');
  if(!hero) return;
  // Canvas だけゆっくり上に動かす（セクション自体は動かさない）
  gsap.to('#heroCanvas', {
    yPercent: -18,
    ease:'none',
    scrollTrigger:{trigger:hero, start:'top top', end:'bottom top', scrub:true, invalidateOnRefresh:true}
  });
  gsap.to('.hero-content', {
    yPercent: -12,
    opacity: 0,
    ease:'none',
    scrollTrigger:{
      trigger:hero, start:'50% top', end:'bottom top', scrub:true, invalidateOnRefresh:true,
      onLeaveBack: () => gsap.set('.hero-content', {opacity:1, yPercent:0})
    }
  });
  gsap.to('.hero-grid-overlay', {
    yPercent: -10,
    ease:'none',
    scrollTrigger:{trigger:hero, start:'top top', end:'bottom top', scrub:true, invalidateOnRefresh:true}
  });
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();

/* ---------- MOBILE RELOAD / BFCache RESYNC ---------- */
function resyncViewportState(){
  updateHeaderState();
  updatePageProgress();
  revealVisibleElements();
  if(window.ScrollTrigger) ScrollTrigger.refresh();
}
window.addEventListener('load', () => requestAnimationFrame(resyncViewportState));
window.addEventListener('pageshow', () => requestAnimationFrame(resyncViewportState));
window.addEventListener('orientationchange', () => {
  setTimeout(resyncViewportState, 250);
});

/* ---------- CONTACT FORM (confirm → send) ---------- */
const form = document.getElementById('contactForm');
if(form){
  const endpoint = form.action;
  const confirmPanel = document.getElementById('contactConfirm');
  const confirmStatus = document.getElementById('confirmStatus');
  const sendBtn = document.getElementById('confirmSend');
  const editBtn = document.getElementById('confirmEdit');

  const fields = {
    name:    { sel: 'input[name="お名前"]',    out: 'cf-name',    fallback: '（未入力）' },
    company: { sel: 'input[name="会社名"]',    out: 'cf-company', fallback: '（未入力）' },
    email:   { sel: 'input[name="email"]',     out: 'cf-email',   fallback: '（未入力）' },
    message: { sel: 'textarea[name="ご相談内容"]', out: 'cf-message', fallback: '（未入力）' }
  };

  const showForm = () => {
    confirmPanel.hidden = true;
    form.hidden = false;
    if(confirmStatus) confirmStatus.textContent = '';
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'この内容で送信する <span class="btn-arrow">→</span>';
    sendBtn.style.background = '';
  };

  const showConfirm = () => {
    Object.values(fields).forEach(({sel, out, fallback}) => {
      const el = form.querySelector(sel);
      const out_el = document.getElementById(out);
      if(!el || !out_el) return;
      const v = (el.value || '').trim();
      out_el.textContent = v || fallback;
      out_el.classList.toggle('confirm-empty', !v);
    });
    form.hidden = true;
    confirmPanel.hidden = false;
    confirmPanel.scrollIntoView({behavior:'smooth', block:'start'});
  };

  // First submit: validate via native HTML5, then show confirm panel instead of sending.
  form.addEventListener('submit', e => {
    e.preventDefault();
    if(!form.reportValidity()) return;
    // Sync CC field with user email so they receive a copy.
    const userEmail = form.querySelector('input[name="email"]').value.trim();
    const ccField = form.querySelector('#ccField');
    if(ccField) ccField.value = userEmail;
    showConfirm();
  });

  if(editBtn){
    editBtn.addEventListener('click', () => { showForm(); form.scrollIntoView({behavior:'smooth', block:'start'}); });
  }

  if(sendBtn){
    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true;
      sendBtn.textContent = '送信中...';
      if(confirmStatus) confirmStatus.innerHTML = '';

      const data = {};
      Object.values(fields).forEach(({sel, out}) => {
        const el = form.querySelector(sel);
        if(el) data[out.replace('cf-','')] = el.value.trim();
      });
      data['email'] = form.querySelector('input[name="email"]').value.trim();

      try {
        const userEmail = form.querySelector('input[name="email"]').value.trim();
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            access_key: 'b306ae84-ca12-4231-a6e9-d3fd0b4eee73',
            subject:  '【お問い合わせ】株式会社ユースタイル',
            from_name:'U-STYLE LP',
            name:    form.querySelector('input[name="お名前"]').value.trim(),
            company: form.querySelector('input[name="会社名"]').value.trim(),
            email:   userEmail,
            message: form.querySelector('textarea[name="ご相談内容"]').value.trim(),
            replyto: userEmail,
            cc:      userEmail,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if(!res.ok || payload.success === false) {
          const e = new Error(payload.message || 'HTTP ' + res.status);
          e.detail = payload.detail || null;
          e.raw = payload.raw || null;
          e.http_status = payload.http_status !== undefined ? payload.http_status : res.status;
          e.access_key_set = payload.access_key_set !== undefined ? payload.access_key_set : '—';
          throw e;
        }

        sendBtn.textContent = '送信しました ✓';
        sendBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
        if(confirmStatus) confirmStatus.textContent = 'お問い合わせを受け付けました。担当者よりご連絡いたします。';
        setTimeout(() => { form.reset(); showForm(); }, 4500);

      } catch(err) {
        sendBtn.disabled = false;
        sendBtn.textContent = '再試行する';
        sendBtn.style.background = 'linear-gradient(135deg,#ef4444,#b91c1c)';
        console.error('[contact form]', err);
        if(confirmStatus){
          confirmStatus.innerHTML =
            '<strong style="color:#f87171">送信に失敗しました。</strong>' +
            '<details style="margin-top:.5rem"><summary style="cursor:pointer;font-size:.8rem;color:rgba(240,244,248,.6)">エラーログ</summary>' +
            '<pre style="font-size:.72rem;margin-top:.4rem;white-space:pre-wrap;color:rgba(240,244,248,.55)">' +
            'message       : ' + (err.message||'—') + '\n' +
            'detail        : ' + (err.detail||'—') + '\n' +
            'http_status   : ' + (err.http_status||'—') + '\n' +
            'access_key_set: ' + err.access_key_set + '\n' +
            'raw           : ' + (err.raw||'—') + '\n' +
            'endpoint      : ' + endpoint + '\n' +
            'time          : ' + new Date().toISOString() +
            '</pre></details>' +
            '<p style="margin-top:.7rem;font-size:.88rem">LINEでのご相談もご利用ください。</p>';
        }
      }
    });
  }

  // Input focus glow
  form.querySelectorAll('input,textarea').forEach(el => {
    el.addEventListener('focus', () => {
      el.parentElement.style.setProperty('--glow','1');
    });
  });
}

/* ---------- SMOOTH ANCHOR SCROLL ---------- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if(!id || id==='#') return;
    const target = document.querySelector(id);
    if(!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight : 0);
    window.scrollTo({top, behavior:'smooth'});
  });
});

/* ---------- USE CASE: SAVE & RESTORE SCROLL POSITION ---------- */
document.querySelectorAll('[data-save-scroll]').forEach(el => {
  el.addEventListener('click', () => {
    sessionStorage.setItem('returnScroll', JSON.stringify({
      path: location.pathname,
      y: window.scrollY
    }));
  });
});
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.addEventListener('pageshow', (e) => {
  const raw = sessionStorage.getItem('returnScroll');
  if (raw === null) return;
  let data;
  try { data = JSON.parse(raw); } catch { sessionStorage.removeItem('returnScroll'); return; }
  // Restore only when returning to the exact page that saved the position,
  // and only if there's no in-page hash target.
  if (location.hash || data.path !== location.pathname) {
    return; // leave entry intact — user may still navigate back to the saved page later
  }
  const y = parseInt(data.y, 10);
  if (Number.isFinite(y) && y > 0) {
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
  sessionStorage.removeItem('returnScroll');
});
