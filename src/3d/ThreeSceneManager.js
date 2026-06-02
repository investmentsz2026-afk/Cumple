import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

export class ThreeSceneManager {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    // Scene variables
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();
    this.animationFrameId = null;

    // Groups
    this.cakeGroup = new THREE.Group();
    this.spaceGroup = new THREE.Group();
    this.starsGroup = new THREE.Group();
    this.warpLinesGroup = new THREE.Group();
    this.photosGroup = new THREE.Group();

    // 3D Objects refs
    this.flames = [];
    this.candleLights = [];
    this.candles = [];
    this.cakePointLight = null;
    this.smokeParticles = [];
    this.saturnMesh = null;
    this.photoMeshes = [];
    this.twinklingStarGroups = [];
    this.constellationLines = null;
    this.constellationStars = null;
    this.nebulaMeshes = [];
    this.distantPlanets = [];

    // Saturn specific details from 'saturno' folder (Restoring the circular text ring)
    this.textRingGroup = null;
    this.objetosTextoAnillo = [];
    this.falling3DHearts = [];
    this.cachedHeartGeom = null;

    // State
    this.photoTexturesLoaded = false;
    this.phase = 'welcome';
    this.micVolume = 0;
    this.blowProgress = 0;
    this.starSpeed = 0.05;
    this.warpSpeed = 0;
    this.stars = null;
    this.isPhotoZoomed = false;
    this.zoomedPhotoIndex = null;
    
    // Auto-generated 16 polaroid orbits populated dynamically
    this.photoOrbits = [];

    // Async Font Loading for circular text ring (loaded from local folder)
    this.font = null;
    this.fontLoader = new FontLoader();
    this.fontLoader.load(
      '/gentilis_regular.typeface.json',
      (loadedFont) => {
        this.font = loadedFont;
        if (this.saturnMesh) {
          this.rebuildTextRing();
        }
      },
      undefined,
      (err) => console.warn('Failed to load gentilis typeface font, using sphere fallbacks:', err)
    );

    // Bindings
    this.onResize = this.onResize.bind(this);
    this.onClick = this.onClick.bind(this);
    this.animate = this.animate.bind(this);

    // Run setup
    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Create Scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // transparent background so CSS cosmic gradient shows through
    this.scene.fog = new THREE.FogExp2(0x06030c, 0.012); // romantic deep violet fog

    // 2. Create Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 3, 7.5);
    this.camera.lookAt(0, 0.5, 0);

    // 3. Create Renderer with transparency enabled
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0); // transparent background!
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Disable shadows on mobile to improve page load speed and rendering performance significantly
    const isMobile = window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // 4. Create OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.4;
    this.controls.enableZoom = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.15;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 140;
    this.controls.enabled = false; // Disabled until Saturn phase

    // Add Groups to Scene
    this.scene.add(this.cakeGroup);
    this.scene.add(this.spaceGroup);
    this.scene.add(this.starsGroup);
    this.scene.add(this.warpLinesGroup);
    this.spaceGroup.add(this.photosGroup);

    // Lights Setup
    const ambientLight = new THREE.AmbientLight(0x333355, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(10, 20, 15);
    if (!isMobile) {
      dirLight.castShadow = true;
      dirLight.shadow.bias = -0.001;
    }
    this.scene.add(dirLight);

    // Saturn pink light accents - make it much brighter for vibrant glow
    const pinkPointLight = new THREE.PointLight(0xff66cc, 2.5, 80);
    pinkPointLight.position.set(0, 5, 12);
    this.spaceGroup.add(pinkPointLight);

    // Dedicated white point light to create a powerful, glossy specular highlight on the planet surface
    const whitePointLight = new THREE.PointLight(0xffffff, 3.2, 50);
    whitePointLight.position.set(-6, 8, 10);
    this.spaceGroup.add(whitePointLight);

    const backLight = new THREE.DirectionalLight(0x4466aa, 0.7);
    backLight.position.set(-8, -8, -8);
    this.spaceGroup.add(backLight);

    // Build Cake immediately so the welcome screen is interactive instantly
    this.buildCake();

    // Defer building heavy space assets to a background timeout to keep initial page load instant
    setTimeout(() => {
      if (!this.renderer) return; // Check if the component was destroyed
      this.buildStars();
      this.buildWarpLines();
      this.buildSaturn();
      this.buildPhotos();

      // If we already transitioned to lyrics/wish phase, start preloading textures
      if (this.phase !== 'welcome') {
        this.photoTexturesLoaded = false;
        this.loadPhotoTextures();
      }
    }, 1200);

    // Hide space and warp groups initially
    this.spaceGroup.visible = false;
    this.warpLinesGroup.visible = false;

    // Event Listeners
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('click', this.onClick);

    // Start loop
    this.animate();
  }

  // ==========================================
  // BUILD METHODS
  // ==========================================

  createCircleGlowTexture(size = 32, innerOpacity = 1.0, outerOpacity = 0.0) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(255, 255, 255, ${innerOpacity})`);
    grad.addColorStop(0.3, `rgba(255, 255, 255, ${innerOpacity * 0.7})`);
    grad.addColorStop(1, `rgba(255, 255, 255, ${outerOpacity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  createCrossFlareTexture(size = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    
    // Draw vertical/horizontal glow line
    const gradX = ctx.createLinearGradient(0, half, size, half);
    gradX.addColorStop(0, 'rgba(255,255,255,0)');
    gradX.addColorStop(0.5, 'rgba(255,255,255,1)');
    gradX.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradX;
    ctx.fillRect(0, half - 1.5, size, 3);

    const gradY = ctx.createLinearGradient(half, 0, half, size);
    gradY.addColorStop(0, 'rgba(255,255,255,0)');
    gradY.addColorStop(0.5, 'rgba(255,255,255,1)');
    gradY.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradY;
    ctx.fillRect(half - 1.5, 0, 3, size);

    // Draw central glow circle
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half / 3);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(half, half, half / 3, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  createNebulaTexture(colorHex1, colorHex2) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    const half = 256;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, colorHex1);
    grad.addColorStop(0.4, colorHex2);
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 3; i++) {
      const cx = 150 + Math.random() * 212;
      const cy = 150 + Math.random() * 212;
      const r = 100 + Math.random() * 150;
      const subGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      subGrad.addColorStop(0, colorHex1);
      subGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
      ctx.fillStyle = subGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
  }

  buildStars() {
    // Clear the starsGroup just in case
    while(this.starsGroup.children.length > 0){
      const obj = this.starsGroup.children[0];
      this.starsGroup.remove(obj);
    }

    // 1. CAPA 1: Estrellas Fijas del Fondo (Fijas e infinitas)
    const fixedStarCount = 2500;
    const fixedGeom = new THREE.BufferGeometry();
    const fixedPositions = new Float32Array(fixedStarCount * 3);
    const fixedColors = new Float32Array(fixedStarCount * 3);

    for (let i = 0; i < fixedStarCount; i++) {
      const radius = 130 + Math.random() * 70;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      fixedPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      fixedPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      fixedPositions[i * 3 + 2] = radius * Math.cos(phi);

      // Light blue, soft purple, white
      const r = Math.random();
      if (r > 0.8) {
        fixedColors[i * 3] = 0.75;
        fixedColors[i * 3 + 1] = 0.85;
        fixedColors[i * 3 + 2] = 1.0;
      } else if (r > 0.6) {
        fixedColors[i * 3] = 0.9;
        fixedColors[i * 3 + 1] = 0.8;
        fixedColors[i * 3 + 2] = 0.95;
      } else {
        fixedColors[i * 3] = 1.0;
        fixedColors[i * 3 + 1] = 1.0;
        fixedColors[i * 3 + 2] = 1.0;
      }
    }

    fixedGeom.setAttribute('position', new THREE.BufferAttribute(fixedPositions, 3));
    fixedGeom.setAttribute('color', new THREE.BufferAttribute(fixedColors, 3));

    const fixedTexture = this.createCircleGlowTexture(16, 0.9, 0);
    const fixedMaterial = new THREE.PointsMaterial({
      size: 0.8,
      map: fixedTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    this.stars = new THREE.Points(fixedGeom, fixedMaterial);
    this.starsGroup.add(this.stars);

    // 2. CAPA 2: Estrellas Titilantes Multicolores (Pulsantes e independientes)
    this.twinklingStarGroups = [];
    const twinklingConfig = [
      { color: 0xffbb44, size: 2.0, frequency: 1.8, phase: 0, count: 200 },    // Oro
      { color: 0xff44aa, size: 2.4, frequency: 2.6, phase: Math.PI / 2, count: 200 }, // Rosa
      { color: 0x33ddff, size: 1.8, frequency: 3.2, phase: Math.PI, count: 200 },    // Cian
      { color: 0xa844ff, size: 2.2, frequency: 1.4, phase: Math.PI * 1.5, count: 200 } // Violeta
    ];

    twinklingConfig.forEach((cfg) => {
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(cfg.count * 3);
      for (let i = 0; i < cfg.count; i++) {
        const radius = 95 + Math.random() * 45;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = radius * Math.cos(phi);
      }
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      
      const starTex = this.createCircleGlowTexture(32, 1.0, 0);
      const mat = new THREE.PointsMaterial({
        color: cfg.color,
        size: cfg.size,
        map: starTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      });

      const points = new THREE.Points(geom, mat);
      this.starsGroup.add(points);
      this.twinklingStarGroups.push({
        mesh: points,
        baseSize: cfg.size,
        frequency: cfg.frequency,
        phase: cfg.phase
      });
    });

    // 3. CAPA 3: Estrellas Nodos de Constelación (Grandes, con destellos cruzados)
    const constellationStarCount = 80;
    const constelGeom = new THREE.BufferGeometry();
    const constelPositions = new Float32Array(constellationStarCount * 3);
    const starCoords = [];

    for (let i = 0; i < constellationStarCount; i++) {
      const radius = 100 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      constelPositions[i * 3] = x;
      constelPositions[i * 3 + 1] = y;
      constelPositions[i * 3 + 2] = z;

      starCoords.push(new THREE.Vector3(x, y, z));
    }
    constelGeom.setAttribute('position', new THREE.BufferAttribute(constelPositions, 3));

    const flareTex = this.createCrossFlareTexture(32);
    const constelMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 3.2,
      map: flareTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    this.constellationStars = new THREE.Points(constelGeom, constelMaterial);
    this.starsGroup.add(this.constellationStars);

    // 4. LÍNEAS DE CONSTELACIÓN (Conexión sutil y pulsante entre nodos)
    const lineIndices = [];
    const maxDist = 26;
    const minDist = 12;

    for (let i = 0; i < constellationStarCount; i++) {
      let connections = 0;
      for (let j = i + 1; j < constellationStarCount; j++) {
        if (connections >= 2) break;
        const d = starCoords[i].distanceTo(starCoords[j]);
        if (d >= minDist && d <= maxDist) {
          lineIndices.push(starCoords[i].x, starCoords[i].y, starCoords[i].z);
          lineIndices.push(starCoords[j].x, starCoords[j].y, starCoords[j].z);
          connections++;
        }
      }
    }

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(lineIndices, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    this.constellationLines = new THREE.LineSegments(lineGeom, lineMaterial);
    this.starsGroup.add(this.constellationLines);

    // 5. NEBULOSAS TRIDIMENSIONALES (Paralaje profundo en 3D)
    this.nebulaMeshes = [];
    const nebulaGeom = new THREE.PlaneGeometry(300, 300);
    const nebulaConfigs = [
      { color1: 'rgba(0, 180, 255, 0.18)', color2: 'rgba(0, 50, 180, 0.03)', z: -160, x: -30, y: 20 },
      { color1: 'rgba(0, 230, 220, 0.16)', color2: 'rgba(10, 30, 120, 0.02)', z: -180, x: 50, y: -40 },
      { color1: 'rgba(30, 100, 255, 0.15)', color2: 'rgba(0, 10, 80, 0.02)', z: -150, x: -70, y: -50 },
      { color1: 'rgba(100, 200, 255, 0.14)', color2: 'rgba(0, 128, 128, 0.02)', z: -170, x: 40, y: 60 }
    ];

    nebulaConfigs.forEach((cfg) => {
      const tex = this.createNebulaTexture(cfg.color1, cfg.color2);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0, // Starts completely hidden in welcome phase
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false
      });
      const mesh = new THREE.Mesh(nebulaGeom, mat);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.rotation.z = Math.random() * Math.PI * 2;
      this.starsGroup.add(mesh);
      this.nebulaMeshes.push(mesh);
    });

    // 6. EXOPLANETAS LEJANOS
    this.distantPlanets = [];
    
    // Planet A: Ice Planet (Cian con anillo helado)
    const planetAGroup = new THREE.Group();
    const sphereGeomA = new THREE.SphereGeometry(0.6, 32, 32);
    const matA = new THREE.MeshPhongMaterial({
      color: 0x88ddff,
      shininess: 90,
      specular: 0xffffff,
      emissive: 0x112233,
      fog: false
    });
    const sphereA = new THREE.Mesh(sphereGeomA, matA);
    planetAGroup.add(sphereA);

    const ringGeomA = new THREE.RingGeometry(0.8, 1.1, 32);
    const ringMatA = new THREE.MeshBasicMaterial({
      color: 0xbbecff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    const ringA = new THREE.Mesh(ringGeomA, ringMatA);
    ringA.rotation.x = Math.PI / 2.3;
    planetAGroup.add(ringA);
    planetAGroup.position.set(70, 30, -90);
    this.starsGroup.add(planetAGroup);
    this.distantPlanets.push({ group: planetAGroup, rotSpeed: 0.4, orbitSpeed: 0.01 });

    // Planet B: Warm Gaseous Planet (Anaranjado cálido con doble anillo)
    const planetBGroup = new THREE.Group();
    const sphereGeomB = new THREE.SphereGeometry(0.8, 32, 32);
    const matB = new THREE.MeshPhongMaterial({
      color: 0xffaa66,
      shininess: 50,
      specular: 0xffffff,
      emissive: 0x221100,
      fog: false
    });
    const sphereB = new THREE.Mesh(sphereGeomB, matB);
    planetBGroup.add(sphereB);

    const ringGeomB = new THREE.RingGeometry(1.0, 1.4, 32);
    const ringMatB = new THREE.MeshBasicMaterial({
      color: 0xffddaa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    const ringB = new THREE.Mesh(ringGeomB, ringMatB);
    ringB.rotation.x = Math.PI / 2.5;
    planetBGroup.add(ringB);
    planetBGroup.position.set(-85, -20, -75);
    this.starsGroup.add(planetBGroup);
    this.distantPlanets.push({ group: planetBGroup, rotSpeed: 0.25, orbitSpeed: 0.008 });

    // Planet C: Violet Glow Planet (Lila brillante con mini atmósfera)
    const planetCGroup = new THREE.Group();
    const sphereGeomC = new THREE.SphereGeometry(0.7, 32, 32);
    const matC = new THREE.MeshPhongMaterial({
      color: 0xb566ff,
      shininess: 110,
      specular: 0xffaaff,
      emissive: 0x330055,
      fog: false
    });
    const sphereC = new THREE.Mesh(sphereGeomC, matC);
    planetCGroup.add(sphereC);

    const atmosGeomC = new THREE.SphereGeometry(0.85, 16, 16);
    const atmosMatC = new THREE.MeshBasicMaterial({
      color: 0xd899ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      fog: false
    });
    const atmosC = new THREE.Mesh(atmosGeomC, atmosMatC);
    planetCGroup.add(atmosC);
    planetCGroup.position.set(50, -45, -100);
    this.starsGroup.add(planetCGroup);
    this.distantPlanets.push({ group: planetCGroup, rotSpeed: 0.6, orbitSpeed: 0.012 });

    // Initialize all exoplanets to scale 0.01 so they start hidden
    this.distantPlanets.forEach(p => p.group.scale.set(0.01, 0.01, 0.01));
  }

  buildWarpLines() {
    const lineCount = 350;
    const positions = [];
    const colors = [];

    for (let i = 0; i < lineCount; i++) {
      const radius = 3 + Math.random() * 15;
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const zStart = -60 + Math.random() * 120;
      const length = 6 + Math.random() * 12;

      positions.push(x, y, zStart);
      positions.push(x, y, zStart - length);

      colors.push(0.1, 0.3, 0.8);
      colors.push(0.9, 0.5, 0.8);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      fog: false
    });

    this.warpLines = new THREE.LineSegments(geometry, material);
    this.warpLinesGroup.add(this.warpLines);
  }

  buildCake() {
    const platterGeom = new THREE.CylinderGeometry(2.3, 2.5, 0.15, 64);
    const platterMat = new THREE.MeshStandardMaterial({
      color: 0xe5c158,
      roughness: 0.15,
      metalness: 0.85
    });
    const platter = new THREE.Mesh(platterGeom, platterMat);
    platter.position.y = -0.075;
    platter.receiveShadow = true;
    platter.castShadow = true;
    this.cakeGroup.add(platter);

    const baseGeom = new THREE.CylinderGeometry(0.8, 1.2, 0.4, 32);
    const baseStand = new THREE.Mesh(baseGeom, platterMat);
    baseStand.position.y = -0.35;
    baseStand.castShadow = true;
    this.cakeGroup.add(baseStand);

    const tier1Geom = new THREE.CylinderGeometry(1.9, 1.9, 1.1, 64);
    const tier1Mat = new THREE.MeshStandardMaterial({
      color: 0x4a2e1d,
      roughness: 0.9
    });
    const tier1 = new THREE.Mesh(tier1Geom, tier1Mat);
    tier1.position.y = 0.55;
    tier1.castShadow = true;
    tier1.receiveShadow = true;
    this.cakeGroup.add(tier1);

    const tier2Geom = new THREE.CylinderGeometry(1.3, 1.3, 0.9, 64);
    const tier2Mat = new THREE.MeshStandardMaterial({
      color: 0xff8da1,
      roughness: 0.7
    });
    const tier2 = new THREE.Mesh(tier2Geom, tier2Mat);
    tier2.position.y = 1.55;
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    this.cakeGroup.add(tier2);

    const creamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });

    const count1 = 28;
    const r1 = 1.9;
    for (let i = 0; i < count1; i++) {
      const angle = (i / count1) * Math.PI * 2;
      const creamGeom = new THREE.SphereGeometry(0.12, 12, 12);
      creamGeom.scale(1, 1.4, 1);
      const cream = new THREE.Mesh(creamGeom, creamMat);
      cream.position.set(Math.cos(angle) * r1, 1.1, Math.sin(angle) * r1);
      cream.rotation.z = -angle;
      cream.castShadow = true;
      this.cakeGroup.add(cream);
    }

    const count2 = 18;
    const r2 = 1.3;
    for (let i = 0; i < count2; i++) {
      const angle = (i / count2) * Math.PI * 2;
      const creamGeom = new THREE.SphereGeometry(0.1, 12, 12);
      creamGeom.scale(1, 1.3, 1);
      const cream = new THREE.Mesh(creamGeom, creamMat);
      cream.position.set(Math.cos(angle) * r2, 2.0, Math.sin(angle) * r2);
      cream.rotation.z = -angle;
      cream.castShadow = true;
      this.cakeGroup.add(cream);
    }

    const colors = [0xff5e84, 0xf5c665, 0x4d94ff, 0xa1e3a1, 0xffffff];
    const sprinkleGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8);
    for (let i = 0; i < 45; i++) {
      const r = Math.random() * 1.15;
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const color = colors[Math.floor(Math.random() * colors.length)];

      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
      const sprinkle = new THREE.Mesh(sprinkleGeom, mat);
      sprinkle.position.set(x, 2.02, z);
      sprinkle.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      sprinkle.castShadow = true;
      this.cakeGroup.add(sprinkle);
    }

    const candleCanvas = document.createElement('canvas');
    candleCanvas.width = 64;
    candleCanvas.height = 128;
    const cCtx = candleCanvas.getContext('2d');
    cCtx.fillStyle = '#ffffff';
    cCtx.fillRect(0, 0, 64, 128);
    cCtx.fillStyle = '#ff5e84';
    cCtx.rotate(Math.PI / 6);
    for (let i = -100; i < 150; i += 20) {
      cCtx.fillRect(i, -100, 8, 300);
    }
    const candleTexture = new THREE.CanvasTexture(candleCanvas);
    candleTexture.wrapS = THREE.RepeatWrapping;
    candleTexture.wrapT = THREE.RepeatWrapping;
    candleTexture.repeat.set(1, 2);

    const candleGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 16);
    const candleMat = new THREE.MeshStandardMaterial({ map: candleTexture, roughness: 0.4 });
    const wickGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8);
    const wickMat = new THREE.MeshBasicMaterial({ color: 0x222222 });

    const candlePositions = [
      { x: -0.6, z: -0.6 },
      { x: 0.6, z: -0.6 },
      { x: -0.6, z: 0.6 },
      { x: 0.6, z: 0.6 }
    ];

    candlePositions.forEach((pos, idx) => {
      const candle = new THREE.Mesh(candleGeom, candleMat);
      candle.position.set(pos.x, 2.35, pos.z);
      candle.castShadow = true;
      this.cakeGroup.add(candle);
      this.candles.push(candle);

      const wick = new THREE.Mesh(wickGeom, wickMat);
      wick.position.set(pos.x, 2.72, pos.z);
      this.cakeGroup.add(wick);

      const flameGroup = new THREE.Group();
      flameGroup.position.set(pos.x, 2.82, pos.z);

      const outerFlameGeom = new THREE.ConeGeometry(0.12, 0.35, 16);
      outerFlameGeom.translate(0, 0.175, 0);
      const outerFlameMat = new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const outerFlame = new THREE.Mesh(outerFlameGeom, outerFlameMat);
      flameGroup.add(outerFlame);

      const innerFlameGeom = new THREE.ConeGeometry(0.06, 0.2, 16);
      innerFlameGeom.translate(0, 0.1, 0);
      const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
      const innerFlame = new THREE.Mesh(innerFlameGeom, innerFlameMat);
      flameGroup.add(innerFlame);

      this.cakeGroup.add(flameGroup);
      this.flames.push(flameGroup);
    });

    this.cakePointLight = new THREE.PointLight(0xffb74d, 2.2, 12, 1.5);
    this.cakePointLight.position.set(0, 3.2, 0);
    this.cakePointLight.castShadow = true;
    this.cakePointLight.shadow.bias = -0.003;
    this.cakePointLight.shadow.mapSize.width = 1024;
    this.cakePointLight.shadow.mapSize.height = 1024;
    this.cakeGroup.add(this.cakePointLight);

    this.cakeGroup.position.y = -6;
    this.cakeGroup.scale.set(0.01, 0.01, 0.01);
  }

  createGlowPlanetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base background gradient: vibrant glowing pink-purple cosmic marble
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#ff1493'); // deep hot pink
    grad.addColorStop(0.2, '#ff66cc'); // hot pink
    grad.addColorStop(0.4, '#e066ff'); // bright medium orchid
    grad.addColorStop(0.6, '#b230ff'); // bright purple
    grad.addColorStop(0.8, '#ff99ff'); // light pink
    grad.addColorStop(1.0, '#ffffff'); // pure white glowing band
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Draw wavy marble veins (pure glowing white and intense magenta)
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      const yOffset = 30 + Math.random() * 450;
      ctx.moveTo(0, yOffset);
      for (let x = 0; x <= 1024; x += 16) {
        const wave = Math.sin(x * 0.015 + i * 1.8) * 40 + Math.cos(x * 0.008) * 20;
        ctx.lineTo(x, yOffset + wave);
      }
      ctx.lineTo(1024, 512);
      ctx.lineTo(0, 512);
      ctx.closePath();
      
      const waveGrad = ctx.createLinearGradient(0, yOffset - 40, 0, yOffset + 120);
      if (i % 3 === 0) {
        waveGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)'); // highly visible bright white band
        waveGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else if (i % 3 === 1) {
        waveGrad.addColorStop(0, 'rgba(255, 20, 147, 0.5)'); // intense hot pink band
        waveGrad.addColorStop(1, 'rgba(255, 20, 147, 0)');
      } else {
        waveGrad.addColorStop(0, 'rgba(224, 102, 255, 0.45)'); // lavender glow band
        waveGrad.addColorStop(1, 'rgba(224, 102, 255, 0)');
      }
      ctx.fillStyle = waveGrad;
      ctx.fill();
    }

    // Add extra organic glowing spots
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const rad = 80 + Math.random() * 180;
      const radGrad = ctx.createRadialGradient(x, y, 0, x, y, rad);
      radGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      radGrad.addColorStop(0.3, 'rgba(255, 105, 180, 0.3)');
      radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  buildSaturn() {
    const planetGeom = new THREE.SphereGeometry(4, 128, 128);

    // MeshPhongMaterial is highly responsive to specular and emissive lights without environment maps
    const saturnMaterial = new THREE.MeshPhongMaterial({
      map: this.createGlowPlanetTexture(),
      shininess: 150,              // Sharp specular highlights
      specular: new THREE.Color(0xffffff), // Pure white reflections
      emissive: new THREE.Color(0xff33aa), // Intense hot pink/magenta emissive glow
      emissiveIntensity: 0.65,     // High glow so it is never dark or dull
      transparent: false,
      depthWrite: true,
      depthTest: true
    });

    this.saturnMesh = new THREE.Mesh(planetGeom, saturnMaterial);
    this.saturnMesh.castShadow = true;
    this.saturnMesh.receiveShadow = true;
    this.saturnMesh.renderOrder = 1; 
    this.spaceGroup.add(this.saturnMesh);

    // Glowing pink/violet outer atmospheric glow (additive blending, larger radius and opacity)
    const atmosferaGeom = new THREE.SphereGeometry(4.40, 64, 64);
    const atmosferaMat = new THREE.MeshPhongMaterial({
      color: 0xff33cc,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true
    });
    const atmosfera = new THREE.Mesh(atmosferaGeom, atmosferaMat);
    atmosfera.renderOrder = 2;
    this.saturnMesh.add(atmosfera);

    // Glowing Concentric Rings (Additive Blending)
    const innerRingGeom = new THREE.RingGeometry(4.7, 4.9, 64);
    const middleRingGeom = new THREE.RingGeometry(6.6, 6.8, 64);
    const outerRingGeom = new THREE.RingGeometry(8.5, 8.7, 64);

    const ringMatOptions = {
      color: 0xffebff,
      emissive: 0xff55ff,
      emissiveIntensity: 2.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true
    };

    const ringMaterial = new THREE.MeshPhongMaterial(ringMatOptions);

    const ring1 = new THREE.Mesh(innerRingGeom, ringMaterial);
    ring1.rotation.x = Math.PI / 2;
    ring1.receiveShadow = true;
    ring1.castShadow = true;
    ring1.renderOrder = 3;
    this.spaceGroup.add(ring1);

    const ring2 = new THREE.Mesh(middleRingGeom, ringMaterial);
    ring2.rotation.x = Math.PI / 2;
    ring2.receiveShadow = true;
    ring2.castShadow = true;
    ring2.renderOrder = 3;
    this.spaceGroup.add(ring2);

    const ring3 = new THREE.Mesh(outerRingGeom, ringMaterial);
    ring3.rotation.x = Math.PI / 2;
    ring3.receiveShadow = true;
    ring3.castShadow = true;
    ring3.renderOrder = 3;
    this.spaceGroup.add(ring3);

    this.rebuildTextRing();
    this.buildFloatingParticulasEspacio();

    this.spaceGroup.rotation.z = 0.25;
    this.spaceGroup.rotation.x = 0.35;
  }

  rebuildTextRing() {
    if (this.textRingGroup) {
      this.spaceGroup.remove(this.textRingGroup);
      this.textRingGroup.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }

    this.textRingGroup = new THREE.Group();
    this.spaceGroup.add(this.textRingGroup);
    this.objetosTextoAnillo = [];

    const radio = 7;
    const textoAnillo = "TE AMO CON TODO MI CORAZÓN Y ALMA PARA SIEMPRE MI AMOR ETERNO";
    const totalLetras = textoAnillo.length;
    const pasoAngulo = (Math.PI * 2) / totalLetras;

    if (this.font) {
      for (let i = 0; i < totalLetras; i++) {
        const letra = textoAnillo[i];
        if (letra === ' ') continue;

        const geom = new TextGeometry(letra, {
          font: this.font,
          size: 0.36,
          depth: 0.005, // FLAT, "sin altura" (extremely thin extrusion)
          curveSegments: 4,
          bevelEnabled: false
        });
        geom.center();

        const mat = new THREE.MeshPhongMaterial({
          color: 0xffccff,
          emissive: 0x550044,
          specular: 0xffaaff,
          shininess: 100,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          depthTest: true,
          fog: false
        });

        const mesh = new THREE.Mesh(geom, mat);
        const angulo = -i * pasoAngulo;
        mesh.position.set(Math.cos(angulo) * radio, 0, Math.sin(angulo) * radio);

        // Position it flat on the ring plane, tangent to the circle
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.y = 0;
        mesh.rotation.z = angulo - Math.PI / 2;
        mesh.renderOrder = 4; // Higher renderOrder for transparent pass sorting

        this.textRingGroup.add(mesh);
        this.objetosTextoAnillo.push(mesh);
      }
    } else {
      for (let i = 0; i < totalLetras * 1.5; i++) {
        const geom = new THREE.SphereGeometry(0.08, 8, 8);
        const mat = new THREE.MeshPhongMaterial({
          color: 0xffccff,
          emissive: 0x550044,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          depthTest: true,
          fog: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        const angulo = (i / (totalLetras * 1.5)) * Math.PI * 2;
        mesh.position.set(Math.cos(angulo) * radio, 0, Math.sin(angulo) * radio);
        mesh.renderOrder = 4;
        
        this.textRingGroup.add(mesh);
        this.objetosTextoAnillo.push(mesh);
      }
    }
  }

  buildFloatingParticulasEspacio() {
    const cantidadParticulas = 1200;
    const geometry = new THREE.BufferGeometry();
    const posiciones = new Float32Array(cantidadParticulas * 3);
    const colores = new Float32Array(cantidadParticulas * 3);

    for (let i = 0; i < cantidadParticulas * 3; i += 3) {
      posiciones[i] = (Math.random() - 0.5) * 160;
      posiciones[i + 1] = (Math.random() - 0.5) * 160;
      posiciones[i + 2] = (Math.random() - 0.5) * 160;

      colores[i] = Math.random() * 0.5 + 0.5;
      colores[i + 1] = Math.random() * 0.3 + 0.3;
      colores[i + 2] = Math.random() * 0.7 + 0.3;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colores, 3));

    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      fog: false
    });

    const particulas = new THREE.Points(geometry, material);
    this.spaceGroup.add(particulas);
  }

  buildPhotos() {
    const loader = new THREE.TextureLoader();

    // 16 user-provided images from the public directory (img1.jpeg - img16.jpeg)
    const baseImages = Array.from({ length: 16 }, (_, i) => `/img${i + 1}.jpeg`);
    
    // Quadruple the list of 16 images to make 64 cards
    const textures = [...baseImages, ...baseImages, ...baseImages, ...baseImages];
    
    // Randomize/shuffle the textures using Fisher-Yates algorithm
    for (let i = textures.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [textures[i], textures[j]] = [textures[j], textures[i]];
    }

    const photoCount = textures.length;
    const titles = ['Momentos', 'Sonrisas', 'Abrazos', 'Felices', 'Juntos', 'Tú y Yo', 'Recuerdos', 'Amor', 'Mi Reina', 'Mi Vida', 'Mi Tesoro', 'Hermosa', 'Te Amo', 'Por Siempre', 'Risas', 'Dulzura'];

    this.photoOrbits = [];
    
    // Distribute 64 photos into 4 clean concentric flat orbits (16 photos per orbit)
    const photosPerOrbit = 16;
    const orbits = [
      { radius: 10.8, speed: 0.08, offset: 0 },
      { radius: 13.6, speed: 0.065, offset: Math.PI / 16 },
      { radius: 16.4, speed: 0.05, offset: Math.PI / 8 },
      { radius: 19.2, speed: 0.038, offset: Math.PI / 4 }
    ];

    for (let i = 0; i < photoCount; i++) {
      const orbitIndex = Math.floor(i / photosPerOrbit);
      const orbitConfig = orbits[orbitIndex];
      const photoIndexInOrbit = i % photosPerOrbit;
      
      // Calculate evenly spaced starting angle to prevent overlapping
      const angle = (photoIndexInOrbit / photosPerOrbit) * Math.PI * 2 + orbitConfig.offset;
      const radius = orbitConfig.radius;
      const speed = orbitConfig.speed;
      const inclination = 0.0; // Completely flat, parallel to Saturn's rings

      const textureUrl = textures[i];
      const imgMatch = textureUrl.match(/img(\d+)\./);
      const imgNum = imgMatch ? parseInt(imgMatch[1], 10) : (i % 16 + 1);
      const title = `${titles[(imgNum - 1) % titles.length]} #${imgNum}`;

      this.photoOrbits.push({ radius, speed, angle, inclination, textureUrl, title });
    }

    this.photoOrbits.forEach((orbit, index) => {
      const photoGroup = new THREE.Group();

      const frameGeom = new THREE.PlaneGeometry(1.6, 2.0);
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0xfdfdfd,
        roughness: 0.45,
        side: THREE.DoubleSide,
        fog: false
      });
      const frame = new THREE.Mesh(frameGeom, frameMat);
      frame.castShadow = true;
      frame.receiveShadow = true;
      photoGroup.add(frame);

      const photoGeom = new THREE.PlaneGeometry(1.44, 1.44);
      const photoMat = new THREE.MeshBasicMaterial({
        color: 0x181822,
        side: THREE.DoubleSide,
        fog: false
      });

      const photoMesh = new THREE.Mesh(photoGeom, photoMat);
      photoMesh.position.set(0, 0.15, 0.012);
      photoGroup.add(photoMesh);

      photoGroup.userData = { index, orbit, isZoomed: false };

      this.photosGroup.add(photoGroup);
      this.photoMeshes.push(photoGroup);
    });
  }

  loadPhotoTextures() {
    if (this.photoTexturesLoaded) return;
    this.photoTexturesLoaded = true;

    const loader = new THREE.TextureLoader();
    this.photoMeshes.forEach((photoGroup) => {
      const photoMesh = photoGroup.children[1];
      const orbit = photoGroup.userData.orbit;

      loader.load(
        orbit.textureUrl,
        (texture) => {
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          photoMesh.material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            fog: false
          });
          if (this.renderer && this.renderer.initTexture) {
            this.renderer.initTexture(texture);
          }
        },
        undefined,
        (err) => console.error('Failed to load photo texture:', orbit.textureUrl)
      );
    });
  }

  // ==========================================
  // CLICK SPAWNERS & AUTOMATIC RAIN (3D HEARTS)
  // ==========================================

  spawnSingle3DHeart(randomY = false) {
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0);
    heartShape.bezierCurveTo(0, 0.3, 0.3, 0.6, 0.6, 0.6);
    heartShape.bezierCurveTo(1.0, 0.6, 1.0, 0.2, 1.0, -0.1);
    heartShape.bezierCurveTo(1.0, -0.6, 0.4, -1.0, 0, -1.5);
    heartShape.bezierCurveTo(-0.4, -1.0, -1.0, -0.6, -1.0, -0.1);
    heartShape.bezierCurveTo(-1.0, 0.2, -1.0, 0.6, -0.6, 0.6);
    heartShape.bezierCurveTo(-0.3, 0.6, 0, 0.3, 0, 0);

    const extrudeSettings = {
      depth: 0.1,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04
    };

    if (!this.cachedHeartGeom) {
      const geom = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
      geom.scale(0.16, 0.16, 0.16);
      geom.rotateX(Math.PI);
      geom.center();
      this.cachedHeartGeom = geom;
    }

    const colors = [0xff5e84, 0xff8da1, 0xff1493, 0xff69b4, 0xffccff];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const mat = new THREE.MeshPhongMaterial({
      color: color,
      emissive: 0x550022,
      specular: 0xffaaff,
      shininess: 30
    });

    const mesh = new THREE.Mesh(this.cachedHeartGeom, mat);
    
    const x = (Math.random() - 0.5) * 35;
    const y = randomY ? (Math.random() - 0.5) * 20 : 10 + Math.random() * 2;
    const z = (Math.random() - 0.5) * 35;
    mesh.position.set(x, y, z);
    
    this.scene.add(mesh);
    
    this.falling3DHearts.push({
      mesh,
      speed: 1.8 + Math.random() * 2.2,
      rotSpeed: 0.5 + Math.random() * 1.5
    });
  }

  spawn3DHearts() {
    const spawnCount = 10;
    for (let i = 0; i < spawnCount; i++) {
      this.spawnSingle3DHeart(false);
    }
  }

  // ==========================================
  // PHASE CONTROL & TRANSITIONS
  // ==========================================

  setPhase(phase) {
    this.phase = phase;

    switch (phase) {
      case 'welcome':
        // Hide space group and warp lines
        this.spaceGroup.visible = false;
        this.warpLinesGroup.visible = false;
        
        // Reset and show cake group
        this.cakeGroup.visible = true;
        this.cakeGroup.position.set(0, -6, 0); // start below
        this.cakeGroup.scale.set(0.01, 0.01, 0.01); // start small

        // Reset candles & flames
        this.flames.forEach((flame) => {
          flame.visible = true;
          flame.scale.set(1, 1, 1);
        });
        if (this.cakePointLight) {
          this.cakePointLight.intensity = 2.2;
        }

        // Reset camera and controls
        if (this.controls) {
          this.controls.enabled = false;
          this.controls.target.set(0, 0.5, 0);
        }
        this.camera.position.set(0, 3, 7.5);
        this.camera.lookAt(0, 0.5, 0);

        // Clear any falling 3D hearts from the scene
        this.falling3DHearts.forEach(heart => {
          this.scene.remove(heart.mesh);
        });
        this.falling3DHearts = [];
        
        // Reset nebulas and exoplanets scale
        if (this.nebulaMeshes) {
          this.nebulaMeshes.forEach(mesh => {
            if (mesh.material) mesh.material.opacity = 0;
          });
        }
        if (this.distantPlanets) {
          this.distantPlanets.forEach(p => p.group.scale.set(0.01, 0.01, 0.01));
        }

        // Animate cake entrance
        gsap.to(this.cakeGroup.scale, {
          x: 0.65,
          y: 0.65,
          z: 0.65,
          duration: 2.2,
          ease: 'elastic.out(1, 0.75)'
        });
        gsap.to(this.cakeGroup.position, {
          y: -0.8,
          duration: 2.0,
          ease: 'power3.out'
        });
        break;

      case 'lyrics':
      case 'wish':
        this.loadPhotoTextures();
        break;

      case 'mic_active':
        this.loadPhotoTextures();
        break;

      case 'transition':
        this.loadPhotoTextures();
        this.performCinematicTransition();
        break;

      case 'saturn':
        this.loadPhotoTextures();
        this.spaceGroup.visible = true;
        this.warpLinesGroup.visible = false;
        
        if (this.controls) {
          this.controls.enabled = true;
        }

        // Spawn 25 hearts immediately across the view
        for (let i = 0; i < 25; i++) {
          this.spawnSingle3DHeart(true);
        }
        break;

      default:
        break;
    }
  }

  updateVolume(volume) {
    this.micVolume = volume;
    if (this.phase === 'mic_active' && this.cakePointLight) {
      const progressFactor = Math.max(0, 1 - ((this.blowProgress || 0) / 100));
      const baseIntensity = 2.2 * progressFactor;
      const targetIntensity = baseIntensity + volume * 5.0 * progressFactor;
      gsap.to(this.cakePointLight, { intensity: targetIntensity, duration: 0.05 });

      this.flames.forEach((flame) => {
        const targetScaleX = (1 + volume * 1.5) * progressFactor;
        const targetScaleY = (1 - volume * 0.4) * progressFactor;
        gsap.to(flame.scale, {
          x: targetScaleX,
          z: targetScaleX,
          y: targetScaleY,
          duration: 0.05
        });
      });
    }
  }

  updateBlowProgress(blowProgress) {
    this.blowProgress = blowProgress;
    
    // Dynamically shrink the flames and dim the light as the blow progress increases
    if (this.phase === 'mic_active') {
      const progressFactor = Math.max(0, 1 - (blowProgress / 100));
      
      if (this.cakePointLight) {
        // Dim the base intensity (from 2.2 down to 0) as progress increases
        const baseIntensity = 2.2 * progressFactor;
        const targetIntensity = baseIntensity + this.micVolume * 5.0 * progressFactor;
        gsap.to(this.cakePointLight, { intensity: targetIntensity, duration: 0.05 });
      }

      this.flames.forEach((flame) => {
        // Shrink the flames to 0 as progress goes to 100
        const targetScaleX = (1 + this.micVolume * 1.5) * progressFactor;
        const targetScaleY = (1 - this.micVolume * 0.4) * progressFactor;
        gsap.to(flame.scale, {
          x: targetScaleX,
          z: targetScaleX,
          y: targetScaleY,
          duration: 0.05
        });
      });
    }
  }

  blowOutCandles() {
    if (this.flames.length === 0) return;

    this.flames.forEach((flame, idx) => {
      gsap.to(flame.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.6,
        ease: 'power3.in',
        onComplete: () => {
          flame.visible = false;
        }
      });

      const candlePos = this.candles[idx].position.clone();
      this.spawnSmoke(new THREE.Vector3(candlePos.x, candlePos.y + 0.35, candlePos.z));
    });

    gsap.to(this.cakePointLight, {
      intensity: 0,
      duration: 1.0,
      ease: 'power2.out'
    });

    if (this.callbacks.onBlowComplete) {
      this.callbacks.onBlowComplete();
    }
  }

  spawnSmoke(position) {
    const particleCount = 20;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    const sizes = [];

    for (let i = 0; i < particleCount; i++) {
      positions.push(position.x, position.y, position.z);
      velocities.push(
        (Math.random() - 0.5) * 0.15,
        0.2 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.15
      );
      sizes.push(0.05 + Math.random() * 0.12);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(230, 230, 230, 0.45)');
    grad.addColorStop(0.3, 'rgba(200, 200, 200, 0.2)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const smokeTexture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.25,
      map: smokeTexture,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    this.smokeParticles.push({
      mesh: particles,
      velocities,
      sizes,
      age: 0,
      maxAge: 2.0
    });
  }

  performCinematicTransition() {
    this.warpLinesGroup.visible = true;
    const warpLinesMaterial = this.warpLines.material;
    warpLinesMaterial.opacity = 0;

    gsap.to(this.cakeGroup.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 2.0,
      ease: 'power2.inOut',
      onComplete: () => {
        this.cakeGroup.visible = false;
      }
    });

    gsap.to(warpLinesMaterial, {
      opacity: 0.9,
      duration: 1.5
    });

    const timeline = gsap.timeline({
      onComplete: () => {
        if (this.callbacks.onTransitionComplete) {
          this.callbacks.onTransitionComplete();
        }
      }
    });

    const aspect = this.container.clientWidth / this.container.clientHeight;
    const targetZ = aspect < 1.0 ? 32 / aspect : 32;
    const targetY = aspect < 1.0 ? 12 / aspect : 12;

    timeline.to(this.camera.position, {
      x: 0,
      y: targetY,
      z: targetZ,
      duration: 4.5,
      ease: 'power3.inOut'
    }, 0);

    timeline.to(this, {
      warpSpeed: 3.5,
      duration: 2.2,
      ease: 'power2.in'
    }, 0);

    timeline.to(this, {
      warpSpeed: 0,
      duration: 2.0,
      ease: 'power2.out',
      onStart: () => {
        this.spaceGroup.visible = true;
        this.spaceGroup.scale.set(0.01, 0.01, 0.01);
        gsap.to(this.spaceGroup.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 2.5,
          ease: 'power2.out'
        });

        // Fade in the cyan/blue 3D nebulas
        if (this.nebulaMeshes) {
          this.nebulaMeshes.forEach((mesh) => {
            gsap.to(mesh.material, {
              opacity: 1.0,
              duration: 3.0,
              ease: 'power2.out'
            });
          });
        }

        // Scale up the exoplanets in the background
        if (this.distantPlanets) {
          this.distantPlanets.forEach((p) => {
            gsap.to(p.group.scale, {
              x: 1,
              y: 1,
              z: 1,
              duration: 3.5,
              ease: 'power2.out'
            });
          });
        }
      }
    }, 2.5);

    timeline.to(warpLinesMaterial, {
      opacity: 0,
      duration: 1.5
    }, 3.0);
  }

  // ==========================================
  // RAYCASTING & INTERACTION
  // ==========================================

  onClick(event) {
    if (this.phase !== 'saturn') return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    const intersects = raycaster.intersectObjects(this.photosGroup.children, true);

    if (intersects.length > 0) {
      let currentObj = intersects[0].object;
      while (currentObj && currentObj !== this.scene) {
        if (currentObj.userData && currentObj.userData.index !== undefined) {
          this.selectPhoto(currentObj);
          break;
        }
        currentObj = currentObj.parent;
      }
    }
  }

  selectPhoto(photoGroup) {
    if (this.isPhotoZoomed) return;

    const index = photoGroup.userData.index;
    this.isPhotoZoomed = true;
    this.zoomedPhotoIndex = index;

    if (this.callbacks.onPhotoSelect) {
      this.callbacks.onPhotoSelect(this.photoOrbits[index]);
    }

    const offsetZ = 3.0; 
    const targetPos = new THREE.Vector3();
    photoGroup.getWorldPosition(targetPos);

    const camTargetPos = targetPos.clone().add(new THREE.Vector3(0, 0, offsetZ));

    gsap.killTweensOf(this.camera.position);

    this.prevCameraPos = this.camera.position.clone();
    this.prevCameraTarget = new THREE.Vector3(0, 0, 0);

    if (this.controls) {
      this.controls.enabled = false;
    }

    gsap.to(this.camera.position, {
      x: camTargetPos.x,
      y: camTargetPos.y,
      z: camTargetPos.z,
      duration: 1.5,
      ease: 'power3.out'
    });

    const lookTarget = targetPos.clone();
    const dummyLook = new THREE.Object3D();
    dummyLook.position.copy(this.prevCameraTarget);
    this.scene.add(dummyLook);

    gsap.to(dummyLook.position, {
      x: lookTarget.x,
      y: lookTarget.y,
      z: lookTarget.z,
      duration: 1.5,
      ease: 'power3.out',
      onUpdate: () => {
        this.camera.lookAt(dummyLook.position);
      },
      onComplete: () => {
        this.scene.remove(dummyLook);
      }
    });
  }

  resetPhotoZoom() {
    if (!this.isPhotoZoomed) return;

    const aspect = this.container.clientWidth / this.container.clientHeight;
    const targetZ = aspect < 1.0 ? 32 / aspect : 32;
    const targetY = aspect < 1.0 ? 12 / aspect : 12;

    gsap.to(this.camera.position, {
      x: 0,
      y: targetY,
      z: targetZ,
      duration: 1.5,
      ease: 'power3.out',
      onComplete: () => {
        this.isPhotoZoomed = false;
        this.zoomedPhotoIndex = null;
        if (this.controls) {
          this.controls.enabled = true;
        }
      }
    });

    const dummyLook = new THREE.Object3D();
    const photoGroup = this.photoMeshes[this.zoomedPhotoIndex];
    const photoPos = new THREE.Vector3();
    photoGroup.getWorldPosition(photoPos);
    dummyLook.position.copy(photoPos);
    this.scene.add(dummyLook);

    gsap.to(dummyLook.position, {
      x: 0,
      y: 0,
      z: 0,
      duration: 1.5,
      ease: 'power3.out',
      onUpdate: () => {
        this.camera.lookAt(dummyLook.position);
      },
      onComplete: () => {
        this.scene.remove(dummyLook);
      }
    });
  }

  // ==========================================
  // TICK LOOP & RENDER
  // ==========================================

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Gentle Welcome/Lyrics Camera pan
    if (this.phase === 'welcome' || this.phase === 'lyrics' || this.phase === 'wish' || this.phase === 'mic_active') {
      this.camera.position.x = Math.sin(elapsedTime * 0.12) * 2.0;
      this.camera.position.z = 7.0 + Math.cos(elapsedTime * 0.08) * 1.0;
      this.camera.lookAt(0, 0.8, 0);

      this.flames.forEach((flame, index) => {
        const wiggleSpeed = 16 + index * 2;
        flame.rotation.x = Math.sin(elapsedTime * wiggleSpeed) * 0.06;
        flame.rotation.z = Math.cos(elapsedTime * (wiggleSpeed - 2)) * 0.06;
        const scaleWiggle = 0.95 + Math.sin(elapsedTime * 25 + index) * 0.05;
        flame.scale.set(scaleWiggle, scaleWiggle, scaleWiggle);
      });

      if (this.cakePointLight && this.phase !== 'mic_active') {
        this.cakePointLight.intensity = 2.2 + Math.sin(elapsedTime * 35) * 0.2 + Math.random() * 0.15;
      }
    }

    // 2. Stars, Constellations, Nebulas, and Exoplanets animation
    if (this.starsGroup) {
      this.starsGroup.rotation.y = elapsedTime * 0.005;

      // Twinkling stars animation
      if (this.twinklingStarGroups) {
        this.twinklingStarGroups.forEach((g) => {
          if (g.mesh && g.mesh.material) {
            // Pulse size between 65% and 135% of baseSize
            g.mesh.material.size = g.baseSize * (0.65 + Math.sin(elapsedTime * g.frequency + g.phase) * 0.35);
          }
        });
      }

      // Constellation nodes pulsing
      if (this.constellationStars && this.constellationStars.material) {
        this.constellationStars.material.size = 3.2 * (0.75 + Math.cos(elapsedTime * 2.2) * 0.25);
      }

      // Constellation lines breathing
      if (this.constellationLines && this.constellationLines.material) {
        this.constellationLines.material.opacity = 0.07 + Math.sin(elapsedTime * 1.5) * 0.05;
      }

      // Slowly rotate 3D nebula planes on their Z axis for deep swirling effect
      if (this.nebulaMeshes) {
        this.nebulaMeshes.forEach((mesh, idx) => {
          mesh.rotation.z += (idx % 2 === 0 ? 0.012 : -0.009) * deltaTime;
        });
      }

      // Update distant exoplanets
      if (this.distantPlanets) {
        this.distantPlanets.forEach((p) => {
          // Orbit rotation in background
          p.group.rotation.y += p.rotSpeed * deltaTime;
          // Very gentle vertical wave-like bobbing
          p.group.position.y += Math.sin(elapsedTime * p.rotSpeed * 2.0) * 0.05 * deltaTime * 60;
        });
      }

      // Warp speed lines during cinematic transition (safety check for deferred loading)
      if (this.warpLines && this.warpSpeed > 0 && this.phase === 'transition') {
        const linePositions = this.warpLines.geometry.attributes.position.array;
        const lineCount = linePositions.length / 3;

        for (let i = 0; i < lineCount; i += 2) {
          linePositions[i * 3 + 2] += this.warpSpeed * 22 * deltaTime;
          linePositions[(i + 1) * 3 + 2] += this.warpSpeed * 22 * deltaTime;

          if (linePositions[i * 3 + 2] > 60) {
            linePositions[i * 3 + 2] = -60;
            linePositions[(i + 1) * 3 + 2] = -65;
          }
        }
        this.warpLines.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 3. Smoke Particles Update
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const smokeObj = this.smokeParticles[i];
      smokeObj.age += deltaTime;

      if (smokeObj.age >= smokeObj.maxAge) {
        this.scene.remove(smokeObj.mesh);
        smokeObj.mesh.geometry.dispose();
        smokeObj.mesh.material.dispose();
        this.smokeParticles.splice(i, 1);
      } else {
        const positions = smokeObj.mesh.geometry.attributes.position.array;
        const count = positions.length / 3;

        for (let j = 0; j < count; j++) {
          positions[j * 3] += smokeObj.velocities[j * 3] * deltaTime;
          positions[j * 3 + 1] += smokeObj.velocities[j * 3 + 1] * deltaTime;
          positions[j * 3 + 2] += smokeObj.velocities[j * 3 + 2] * deltaTime;

          smokeObj.velocities[j * 3] *= 0.95;
          smokeObj.velocities[j * 3 + 2] *= 0.95;
        }

        smokeObj.mesh.geometry.attributes.position.needsUpdate = true;
        smokeObj.mesh.material.opacity = (1.0 - (smokeObj.age / smokeObj.maxAge)) * 0.7;
      }
    }

    // 4. Automatic & Click-triggered falling 3D Hearts rain
    if (this.phase === 'saturn') {
      if (Math.random() < 0.04 && this.falling3DHearts.length < 45) {
        this.spawnSingle3DHeart(false);
      }
    }

    for (let i = this.falling3DHearts.length - 1; i >= 0; i--) {
      const heart = this.falling3DHearts[i];
      heart.mesh.position.y -= heart.speed * deltaTime;
      heart.mesh.rotation.x += heart.rotSpeed * deltaTime;
      heart.mesh.rotation.y += heart.rotSpeed * 0.5 * deltaTime;

      if (heart.mesh.position.y < -12) {
        this.scene.remove(heart.mesh);
        this.falling3DHearts.splice(i, 1);
      }
    }

    // 5. Saturn Space Phase Animation
    if (this.phase === 'saturn' || (this.spaceGroup.visible && this.phase === 'transition')) {
      const camPos = this.camera.position;

      // Slow rotation of Saturn planet (from saturno folder index.html)
      if (this.saturnMesh && (!this.controls || !this.controls.enabled)) {
        this.saturnMesh.rotation.y += 0.0015;
      }

      // Rotate the entire text ring group around Saturn
      if (this.textRingGroup) {
        this.textRingGroup.rotation.y += 0.001;
      }

      // Rotate and bob the circular text ring around Saturn
      this.objetosTextoAnillo.forEach((obj, i) => {
        // Wave-like vertical bobbing in local space of textRingGroup
        obj.position.y = Math.sin(elapsedTime * 2.0 + i * 0.15) * 0.15;
        
        // Distance scale and opacity checks using world coordinates
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);
        const dist = camPos.distanceTo(worldPos);

        // Distance scale adjustment to prevent letters from looking huge when close
        const referenceDist = 32.0;
        let scaleFactor = Math.min(1.0, dist / referenceDist);
        if (dist < 18) {
          scaleFactor = (dist / referenceDist) * 0.65;
        }
        obj.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Soft opacity fade-out in extreme close-ups
        let targetOpacity = 0.95;
        if (dist < 10) {
          targetOpacity = Math.max(0, (dist - 6) / 4) * 0.95;
        }
        if (obj.material) {
          obj.material.opacity = targetOpacity;
        }
      });

      // Orbiting Polaroid Photos
      if (this.photoMeshes.length > 0) {
        this.photoOrbits.forEach((orbit, index) => {
          const photoMesh = this.photoMeshes[index];

          if (!this.isPhotoZoomed) {
            orbit.angle += orbit.speed * deltaTime;
          }

          const x = Math.cos(orbit.angle) * orbit.radius;
          const z = Math.sin(orbit.angle) * orbit.radius;
          const y = Math.sin(orbit.angle) * orbit.radius * Math.sin(orbit.inclination);

          if (!this.isPhotoZoomed || this.zoomedPhotoIndex !== index) {
            photoMesh.position.set(x, y, z);
            photoMesh.lookAt(camPos);
            photoMesh.rotation.z += Math.sin(elapsedTime * 1.5 + index) * 0.001;
          }
        });
      }

      // Update OrbitControls if enabled
      if (this.controls && this.controls.enabled) {
        this.controls.update();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('click', this.onClick);
      this.container.removeChild(this.renderer.domElement);
    }
    cancelAnimationFrame(this.animationFrameId);

    // Remove falling hearts
    this.falling3DHearts.forEach(h => this.scene.remove(h.mesh));
    this.falling3DHearts = [];

    // Dispose geometries, materials, and textures
    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        } else {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    });
  }
}
