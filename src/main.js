import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import './style.css';

const WEAPONS = [
  {
    id: 'shotgun',
    name: 'M12 HAGELGEVÄR',
    shortName: 'M12',
    mode: 'PUMP',
    magazine: 8,
    reserve: 40,
    damage: 17,
    pellets: 10,
    spread: 0.045,
    range: 82,
    fireInterval: 0.78,
    reloadDuration: 1.65,
    automatic: false,
    recoil: 0.082,
    color: 0x383a37
  },
  {
    id: 'ak5',
    name: 'AK5-C AUTOMATKARBIN',
    shortName: 'AK5-C',
    mode: 'AUTO',
    magazine: 30,
    reserve: 180,
    damage: 28,
    pellets: 1,
    spread: 0.008,
    range: 150,
    fireInterval: 0.092,
    reloadDuration: 2.05,
    automatic: true,
    recoil: 0.022,
    color: 0x38443c
  },
  {
    id: 'car15',
    name: 'CAR-15 KOMPAKT',
    shortName: 'CAR-15',
    mode: 'AUTO',
    magazine: 30,
    reserve: 210,
    damage: 21,
    pellets: 1,
    spread: 0.012,
    range: 120,
    fireInterval: 0.073,
    reloadDuration: 1.72,
    automatic: true,
    recoil: 0.016,
    color: 0x252a2d
  }
];

const DRONE_TYPES = {
  scout: { hp: 58, speed: 10.5, scale: 0.82, score: 120, damage: 24, color: 0x2b3236 },
  strike: { hp: 92, speed: 8.4, scale: 1, score: 190, damage: 34, color: 0x303532 },
  armored: { hp: 155, speed: 6.5, scale: 1.18, score: 320, damage: 46, color: 0x434744 }
};

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.humOscillator = null;
    this.humGain = null;
  }

  async start() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.52;
      this.master.connect(this.ctx.destination);
      this.createDroneHum();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  createDroneHum() {
    this.humOscillator = this.ctx.createOscillator();
    this.humOscillator.type = 'sawtooth';
    this.humOscillator.frequency.value = 88;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 330;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0;
    this.humOscillator.connect(filter).connect(this.humGain).connect(this.master);
    this.humOscillator.start();
  }

  tone(frequency, duration, type = 'sine', volume = 0.12, slide = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration);
  }

  noise(duration, volume, cutoff = 1400) {
    if (!this.ctx) return;
    const length = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  gunshot(weapon) {
    if (weapon.id === 'shotgun') {
      this.noise(0.28, 0.7, 1050);
      this.tone(88, 0.2, 'triangle', 0.32, -48);
      window.setTimeout(() => this.tone(420, 0.045, 'square', 0.08, -120), 180);
    } else {
      this.noise(0.1, 0.48, 1900);
      this.tone(weapon.id === 'ak5' ? 120 : 145, 0.09, 'square', 0.22, -70);
    }
  }

  hit(critical = false) {
    this.tone(critical ? 920 : 650, 0.045, 'square', 0.08, -120);
  }

  explosion() {
    this.noise(0.55, 0.78, 720);
    this.tone(64, 0.48, 'sine', 0.4, -30);
  }

  reload() {
    this.tone(520, 0.045, 'square', 0.07, -100);
    window.setTimeout(() => this.tone(740, 0.06, 'square', 0.06, -80), 460);
  }

  dryFire() {
    this.tone(260, 0.035, 'square', 0.08, -60);
  }

  updateHum(threats, proximity) {
    if (!this.ctx || !this.humGain) return;
    const now = this.ctx.currentTime;
    this.humGain.gain.cancelScheduledValues(now);
    this.humGain.gain.linearRampToValueAtTime(threats ? 0.018 + proximity * 0.08 : 0, now + 0.15);
    this.humOscillator.frequency.linearRampToValueAtTime(82 + proximity * 70, now + 0.15);
  }
}

class Drone {
  constructor(game, type, position) {
    this.game = game;
    this.type = type;
    this.stats = DRONE_TYPES[type];
    this.hp = this.stats.hp;
    this.maxHp = this.hp;
    this.alive = true;
    this.age = Math.random() * 3;
    this.phase = Math.random() * Math.PI * 2;
    this.velocity = new THREE.Vector3();
    this.group = this.createModel();
    this.group.position.copy(position);
    this.group.scale.setScalar(this.stats.scale);
    game.scene.add(this.group);
  }

  createModel() {
    const group = new THREE.Group();
    const carbon = new THREE.MeshStandardMaterial({ color: this.stats.color, roughness: 0.62, metalness: 0.34 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x15191b, roughness: 0.38, metalness: 0.78 });
    const propMaterial = new THREE.MeshStandardMaterial({ color: 0x090b0c, roughness: 0.28, metalness: 0.65, transparent: true, opacity: 0.72 });
    const batteryMaterial = new THREE.MeshStandardMaterial({ color: 0x4d3d2d, roughness: 0.85, metalness: 0.06 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.52), carbon);
    body.castShadow = true;
    group.add(body);

    const camera = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 8), new THREE.MeshStandardMaterial({ color: 0x080b0c, metalness: 0.78, roughness: 0.13 }));
    camera.position.set(0, -0.025, -0.31);
    group.add(camera);

    const cameraGlass = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0x172d34, roughness: 0.08, metalness: 0.4, clearcoat: 1 }));
    cameraGlass.position.set(0, -0.025, -0.39);
    group.add(cameraGlass);

    const battery = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.17, 0.32), batteryMaterial);
    battery.position.y = 0.18;
    battery.castShadow = true;
    group.add(battery);

    this.rotors = [];
    const armGeometry = new THREE.CylinderGeometry(0.035, 0.045, 1.05, 8);
    const motorGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.09, 12);
    const propGeometry = new THREE.BoxGeometry(0.8, 0.018, 0.07);
    const corners = [
      [-0.48, -0.44, -0.42],
      [0.48, 0.44, -0.42],
      [-0.48, 0.44, 0.42],
      [0.48, -0.44, 0.42]
    ];

    corners.forEach(([x, angleSign, z], index) => {
      const arm = new THREE.Mesh(armGeometry, carbon);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = angleSign * 0.72;
      arm.position.set(x * 0.54, 0, z * 0.54);
      arm.castShadow = true;
      group.add(arm);

      const motor = new THREE.Mesh(motorGeometry, metal);
      motor.position.set(x, 0.02, z);
      motor.castShadow = true;
      group.add(motor);

      const prop = new THREE.Mesh(propGeometry, propMaterial);
      prop.position.set(x, 0.09, z);
      prop.rotation.y = index * 0.8;
      group.add(prop);
      this.rotors.push(prop);
    });

    const ledMaterial = new THREE.MeshBasicMaterial({ color: this.type === 'armored' ? 0xffad33 : 0xff312e });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), ledMaterial);
    led.position.set(0.3, 0, 0.28);
    group.add(led);

    group.traverse((child) => {
      if (child.isMesh) child.userData.drone = this;
    });
    return group;
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    this.rotors.forEach((rotor, index) => { rotor.rotation.y += dt * (index % 2 ? -86 : 86); });

    const player = this.game.camera.position;
    const toPlayer = player.clone().sub(this.group.position);
    const distance = toPlayer.length();
    const desired = toPlayer.normalize().multiplyScalar(this.stats.speed * (distance < 22 ? 1.18 : 1));
    const lateral = new THREE.Vector3(-desired.z, 0, desired.x).normalize();
    desired.addScaledVector(lateral, Math.sin(this.age * 2.4 + this.phase) * 1.5);
    desired.y += Math.sin(this.age * 3.2 + this.phase) * 0.8;
    if (distance < 32) desired.y -= 1.2;

    // Håll drönarna isär och styr dem runt fasta objekt i stället för genom dem.
    const separation = new THREE.Vector3();
    this.game.drones.forEach((other) => {
      if (other === this || !other.alive) return;
      const offset = this.group.position.clone().sub(other.group.position);
      const spacing = offset.length();
      if (spacing > 0.001 && spacing < 1.8 * this.stats.scale) {
        separation.addScaledVector(offset.normalize(), (1.8 * this.stats.scale - spacing) * 3.2);
      }
    });
    desired.add(separation);
    desired.add(this.game.getDroneAvoidance(this.group.position, desired, 0.62 * this.stats.scale));

    this.velocity.lerp(desired, 1 - Math.exp(-dt * 2.8));
    const movement = this.game.resolveDroneMovement(
      this.group.position,
      this.velocity.clone().multiplyScalar(dt),
      0.62 * this.stats.scale
    );
    this.group.position.copy(movement.position);
    if (movement.collided) this.velocity.y = Math.max(this.velocity.y, this.stats.speed * 0.42);
    this.group.position.y = Math.max(1.35, this.group.position.y);

    const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
    this.group.rotation.y = lerp(this.group.rotation.y, targetRotation, dt * 4.5);
    this.group.rotation.z = clamp(-this.velocity.x * 0.035, -0.3, 0.3);
    this.group.rotation.x = clamp(this.velocity.y * 0.03, -0.2, 0.2);

    const currentDistance = this.group.position.distanceTo(player);
    if (currentDistance < 2.25 && this.game.hasClearLineOfSight(this.group.position, player)) {
      this.alive = false;
      this.game.droneDetonation(this, this.stats.damage);
    }
  }

  takeDamage(amount, point) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.game.spawnImpact(point, this.hp <= 0 ? 0xff7b32 : 0xffd17a);
    if (this.hp <= 0) {
      this.alive = false;
      this.game.destroyDrone(this);
      return true;
    }
    return false;
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.group.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material.dispose();
    });
  }
}

class FPVDownGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87959a);
    this.scene.fog = new THREE.FogExp2(0x89979a, 0.0085);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 420);
    this.camera.position.set(0, 1.72, 14);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.55, 0.88);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.audio = new AudioEngine();
    this.keys = new Set();
    this.obstacles = [];
    this.solidMeshes = [];
    this.drones = [];
    this.effects = [];
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
    this.pointerLocked = false;
    this.mouseDown = false;
    this.state = 'START';
    this.yaw = 0;
    this.pitch = -0.04;
    this.bobTime = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.recoil = 0;
    this.health = 100;
    this.armor = 50;
    this.score = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.wave = 0;
    this.waveTotal = 0;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.spawnTimer = 0;
    this.waveBreakTimer = 0;
    this.currentWeapon = 0;
    this.weaponStates = WEAPONS.map((weapon) => ({ ammo: weapon.magazine, reserve: weapon.reserve }));
    this.fireCooldown = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.notificationTimer = 0;
    this.muzzleTimer = 0;
    this.radarContext = document.getElementById('radar-canvas').getContext('2d');

    this.cacheDom();
    this.bindEvents();
  }

  cacheDom() {
    this.dom = {
      loading: document.getElementById('loading-screen'),
      loadingState: document.getElementById('loading-state'),
      start: document.getElementById('start-screen'),
      pause: document.getElementById('pause-screen'),
      gameover: document.getElementById('gameover-screen'),
      notification: document.getElementById('notification'),
      hint: document.getElementById('interaction-hint'),
      crosshair: document.getElementById('crosshair'),
      damage: document.getElementById('damage-vignette'),
      hit: document.getElementById('hit-marker'),
      waveLabel: document.getElementById('wave-label'),
      mission: document.getElementById('mission-text'),
      waveFill: document.getElementById('wave-progress-fill'),
      threats: document.getElementById('threat-count'),
      health: document.getElementById('health-value'),
      healthFill: document.getElementById('health-fill'),
      armor: document.getElementById('armor-value'),
      armorFill: document.getElementById('armor-fill'),
      fireMode: document.getElementById('fire-mode'),
      weaponName: document.getElementById('weapon-name'),
      ammo: document.getElementById('ammo-current'),
      reserve: document.getElementById('ammo-reserve'),
      reloadFill: document.getElementById('reload-fill'),
      score: document.getElementById('score-value'),
      finalScore: document.getElementById('final-score'),
      finalKills: document.getElementById('final-kills'),
      finalWave: document.getElementById('final-wave'),
      finalAccuracy: document.getElementById('final-accuracy')
    };
    this.gameUi = [...document.querySelectorAll('.game-ui')];
    this.weaponButtons = [...document.querySelectorAll('.weapon-slots button')];
  }

  async init() {
    this.dom.loadingState.textContent = 'Laddar realistisk terräng…';
    await this.createWorld();
    this.dom.loadingState.textContent = 'Kalibrerar vapensystem…';
    this.createWeaponView();
    this.updateHUD();
    this.animate();
    window.setTimeout(() => {
      this.dom.loading.classList.add('fade');
      window.setTimeout(() => this.dom.loading.classList.add('hidden'), 700);
    }, 500);
  }

  async createWorld() {
    const hemi = new THREE.HemisphereLight(0xdde9ed, 0x39402f, 2.25);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffefd3, 3.7);
    sun.position.set(-38, 64, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -85;
    sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85;
    sun.shadow.camera.bottom = -85;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 180;
    sun.shadow.bias = -0.00012;
    this.scene.add(sun);

    const textureLoader = new THREE.TextureLoader();
    let groundTexture;
    try {
      groundTexture = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}assets/ground-training.png`);
      groundTexture.colorSpace = THREE.SRGBColorSpace;
      groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
      groundTexture.repeat.set(18, 18);
      groundTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    } catch {
      groundTexture = null;
    }

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: groundTexture ? 0xc5c3b3 : 0x575743,
      map: groundTexture,
      roughness: 0.97,
      metalness: 0.01
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 1, 1), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.createGrass();
    this.createRocks();
    this.createDefensivePosition();
    this.createPerimeter();
    this.createSkyDetails();
  }

  seededRandom(index) {
    const value = Math.sin(index * 91.173 + 7.21) * 43758.5453;
    return value - Math.floor(value);
  }

  createGrass() {
    const count = 1150;
    const geometry = new THREE.PlaneGeometry(0.12, 0.55);
    geometry.translate(0, 0.275, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x58603c, roughness: 1, side: THREE.DoubleSide, alphaTest: 0.25 });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i += 1) {
      const radius = 8 + this.seededRandom(i * 3) * 130;
      const angle = this.seededRandom(i * 3 + 1) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      dummy.rotation.y = this.seededRandom(i * 3 + 2) * Math.PI;
      const scale = 0.55 + this.seededRandom(i * 7) * 0.9;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  createRocks() {
    const geometry = new THREE.DodecahedronGeometry(0.35, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x565a53, roughness: 0.94, metalness: 0.02 });
    const mesh = new THREE.InstancedMesh(geometry, material, 110);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 110; i += 1) {
      const radius = 18 + this.seededRandom(i * 4) * 105;
      const angle = this.seededRandom(i * 4 + 1) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * radius, 0.12, Math.sin(angle) * radius);
      dummy.rotation.set(this.seededRandom(i) * 2, this.seededRandom(i + 9) * 3, this.seededRandom(i + 15) * 2);
      const scale = 0.35 + this.seededRandom(i * 4 + 3) * 1.4;
      dummy.scale.set(scale, scale * 0.6, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  addObstacle(mesh, padding = 0.45) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh).expandByScalar(padding);
    this.obstacles.push(box);
    mesh.traverse((child) => {
      if (child.isMesh) this.solidMeshes.push(child);
    });
  }

  addColliderBox(min, max, padding = 0) {
    const box = new THREE.Box3(min.clone(), max.clone());
    if (padding > 0) box.expandByScalar(padding);
    this.obstacles.push(box);
    return box;
  }

  playerCollidesAt(position, radius = 0.43) {
    const feetY = position.y - 1.72;
    const headY = position.y + 0.08;
    return this.obstacles.some((box) => {
      if (headY <= box.min.y || feetY >= box.max.y) return false;
      const closestX = clamp(position.x, box.min.x, box.max.x);
      const closestZ = clamp(position.z, box.min.z, box.max.z);
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      return dx * dx + dz * dz < radius * radius;
    });
  }

  sphereCollidesAt(position, radius) {
    const closest = new THREE.Vector3();
    return this.obstacles.some((box) => {
      box.clampPoint(position, closest);
      return closest.distanceToSquared(position) < radius * radius;
    });
  }

  resolvePlayerMovement(start, delta, radius = 0.43) {
    const position = start.clone();
    const steps = Math.max(1, Math.ceil(delta.length() / 0.16));
    const step = delta.clone().divideScalar(steps);

    for (let index = 0; index < steps; index += 1) {
      const nextX = position.clone();
      nextX.x += step.x;
      if (!this.playerCollidesAt(nextX, radius)) position.x = nextX.x;

      const nextZ = position.clone();
      nextZ.z += step.z;
      if (!this.playerCollidesAt(nextZ, radius)) position.z = nextZ.z;
    }

    position.x = clamp(position.x, -54, 54);
    position.z = clamp(position.z, -54, 54);
    position.y = 1.72;
    return position;
  }

  getDroneAvoidance(position, desiredVelocity, radius) {
    const speed = desiredVelocity.length();
    if (speed < 0.001) return new THREE.Vector3();
    const probe = position.clone().addScaledVector(desiredVelocity.clone().normalize(), Math.min(3.2, speed * 0.36));
    const avoidance = new THREE.Vector3();
    const closest = new THREE.Vector3();

    this.obstacles.forEach((box) => {
      box.clampPoint(probe, closest);
      const clearance = closest.distanceTo(probe);
      if (clearance >= radius + 0.9) return;
      const center = box.getCenter(new THREE.Vector3());
      const away = position.clone().sub(center);
      away.y = 0;
      if (away.lengthSq() < 0.01) away.set(-desiredVelocity.z, 0, desiredVelocity.x);
      away.normalize();
      const strength = 1 - clearance / (radius + 0.9);
      avoidance.addScaledVector(away, speed * strength * 1.35);
      avoidance.y += speed * strength * 1.65;
    });

    return avoidance;
  }

  resolveDroneMovement(start, delta, radius) {
    const position = start.clone();
    let collided = false;
    const steps = Math.max(1, Math.ceil(delta.length() / Math.max(0.14, radius * 0.4)));
    const step = delta.clone().divideScalar(steps);

    for (let index = 0; index < steps; index += 1) {
      const next = position.clone().add(step);
      if (!this.sphereCollidesAt(next, radius)) {
        position.copy(next);
        continue;
      }

      collided = true;
      const climb = position.clone();
      climb.y += Math.max(0.16, step.length() * 0.9);
      if (!this.sphereCollidesAt(climb, radius)) {
        position.copy(climb);
        continue;
      }

      // Om uppvägen är blockerad får drönaren glida längs hindret.
      const slideX = position.clone();
      slideX.x += step.x;
      if (!this.sphereCollidesAt(slideX, radius)) position.x = slideX.x;
      const slideZ = position.clone();
      slideZ.z += step.z;
      if (!this.sphereCollidesAt(slideZ, radius)) position.z = slideZ.z;
      const slideY = position.clone();
      slideY.y += Math.max(step.y, 0.1);
      if (!this.sphereCollidesAt(slideY, radius)) position.y = slideY.y;
    }

    return { position, collided };
  }

  hasClearLineOfSight(from, to) {
    const direction = to.clone().sub(from);
    const distance = direction.length();
    if (distance < 0.001) return true;
    const ray = new THREE.Ray(from, direction.normalize());
    const hit = new THREE.Vector3();
    return !this.obstacles.some((box) => {
      const intersection = ray.intersectBox(box, hit);
      return intersection && intersection.distanceTo(from) < distance - 0.12;
    });
  }

  createDefensivePosition() {
    const concrete = new THREE.MeshStandardMaterial({ color: 0x77796f, roughness: 0.93, metalness: 0.02 });
    const sand = new THREE.MeshStandardMaterial({ color: 0x70664d, roughness: 1 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x3b4547, roughness: 0.55, metalness: 0.65 });

    const barrierPositions = [
      [-8, 0.8, -2, 0.16], [8, 0.8, -2, -0.16], [-12, 0.8, 8, 0.65], [12, 0.8, 8, -0.65],
      [-4.7, 0.8, -9.5, 0], [4.7, 0.8, -9.5, 0]
    ];
    barrierPositions.forEach(([x, y, z, rotation]) => {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.6, 0.65), concrete);
      barrier.position.set(x, y, z);
      barrier.rotation.y = rotation;
      this.addObstacle(barrier, 0.25);
    });

    const sandbagGeometry = new THREE.CapsuleGeometry(0.22, 0.72, 4, 8);
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < 13; i += 1) {
        const bag = new THREE.Mesh(sandbagGeometry, sand);
        bag.rotation.z = Math.PI / 2;
        bag.rotation.y = 0.04 * Math.sin(i);
        bag.position.set(-5.4 + i * 0.9, 0.25 + row * 0.38, -5.2 + row * 0.03);
        bag.castShadow = true;
        bag.receiveShadow = true;
        this.scene.add(bag);
        this.solidMeshes.push(bag);
      }
    }
    this.addColliderBox(
      new THREE.Vector3(-6.1, 0, -5.68),
      new THREE.Vector3(6.1, 1.04, -4.72),
      0.05
    );

    const container = new THREE.Mesh(new THREE.BoxGeometry(6.1, 2.75, 2.55), new THREE.MeshStandardMaterial({ color: 0x4b5a52, roughness: 0.68, metalness: 0.42 }));
    container.position.set(-17, 1.38, -15);
    container.rotation.y = 0.18;
    this.addObstacle(container, 0.2);
    for (let x = -2.6; x <= 2.6; x += 0.43) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.055, 2.62, 2.62), steel);
      rib.position.copy(container.position);
      rib.position.x += Math.cos(container.rotation.y) * x;
      rib.position.z -= Math.sin(container.rotation.y) * x;
      rib.rotation.copy(container.rotation);
      this.scene.add(rib);
    }

    const tower = new THREE.Group();
    tower.position.set(18, 0, -18);
    const postGeometry = new THREE.BoxGeometry(0.18, 7, 0.18);
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => {
      const post = new THREE.Mesh(postGeometry, steel);
      post.position.set(x, 3.5, z);
      post.castShadow = true;
      tower.add(post);
    });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.24, 3.6), steel);
    platform.position.y = 6.15;
    platform.castShadow = true;
    tower.add(platform);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 3), new THREE.MeshStandardMaterial({ color: 0x61675f, roughness: 0.76, metalness: 0.24 }));
    cabin.position.y = 7.1;
    cabin.castShadow = true;
    tower.add(cabin);
    this.addObstacle(tower, 0.08);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 7, 8), steel);
    antenna.position.set(0, 3.5, -3);
    antenna.castShadow = true;
    this.addObstacle(antenna, 0.18);
  }

  createPerimeter() {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 1 });
    const pineMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x263e2f, roughness: 0.98 }),
      new THREE.MeshStandardMaterial({ color: 0x304a36, roughness: 0.98 })
    ];
    for (let i = 0; i < 95; i += 1) {
      const radius = 67 + this.seededRandom(i * 5) * 64;
      const angle = this.seededRandom(i * 5 + 1) * Math.PI * 2;
      const height = 4.5 + this.seededRandom(i * 5 + 2) * 8;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, height * 0.58, 7), trunkMaterial);
      trunk.position.y = height * 0.29;
      trunk.castShadow = true;
      tree.add(trunk);
      for (let layer = 0; layer < 3; layer += 1) {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(height * (0.21 - layer * 0.025), height * 0.38, 8), pineMaterials[i % 2]);
        crown.position.y = height * (0.48 + layer * 0.17);
        crown.castShadow = true;
        tree.add(crown);
      }
      tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      tree.rotation.y = this.seededRandom(i * 5 + 3) * Math.PI;
      this.scene.add(tree);
    }

    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x73736b, roughness: 0.94 });
    [[-58, -40, 12, 5, 9], [55, -48, 16, 7, 8], [-62, 40, 10, 4, 14]].forEach(([x, z, w, h, d], index) => {
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterial);
      building.position.set(x, h / 2, z);
      building.rotation.y = index * 0.4 - 0.2;
      building.castShadow = true;
      building.receiveShadow = true;
      this.addObstacle(building, 0.15);
    });
  }

  createSkyDetails() {
    const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xe7ecec, transparent: true, opacity: 0.12, depthWrite: false });
    for (let i = 0; i < 18; i += 1) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(7 + this.seededRandom(i) * 7, 12, 6), cloudMaterial.clone());
      const angle = this.seededRandom(i + 40) * Math.PI * 2;
      const radius = 80 + this.seededRandom(i + 60) * 80;
      cloud.position.set(Math.cos(angle) * radius, 28 + this.seededRandom(i + 20) * 26, Math.sin(angle) * radius);
      cloud.scale.y = 0.16;
      cloud.scale.z = 1.6;
      this.scene.add(cloud);
    }
  }

  createWeaponView() {
    this.weaponRig = new THREE.Group();
    this.camera.add(this.weaponRig);
    this.weaponLight = new THREE.PointLight(0xe8f1ed, 1.9, 3.2, 1.4);
    this.weaponLight.position.set(0.2, 0.05, -0.35);
    this.camera.add(this.weaponLight);
    this.muzzleLight = new THREE.PointLight(0xffa640, 0, 4.5, 2);
    this.camera.add(this.muzzleLight);
    this.setWeaponModel();
  }

  createAK5CModel() {
    const model = new THREE.Group();
    const olive = new THREE.MeshStandardMaterial({ color: 0x354536, roughness: 0.66, metalness: 0.18 });
    const oliveDark = new THREE.MeshStandardMaterial({ color: 0x253228, roughness: 0.78, metalness: 0.12 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x15191a, roughness: 0.34, metalness: 0.82 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x171a18, roughness: 0.94, metalness: 0.02 });
    const magazine = new THREE.MeshPhysicalMaterial({
      color: 0x4b493b,
      roughness: 0.48,
      metalness: 0.02,
      transparent: true,
      opacity: 0.82,
      transmission: 0.05
    });
    const lens = new THREE.MeshPhysicalMaterial({
      color: 0x7d1e13,
      emissive: 0x330400,
      emissiveIntensity: 0.35,
      roughness: 0.06,
      metalness: 0.25,
      clearcoat: 1
    });

    const addMesh = (geometry, material, position, rotation = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      model.add(mesh);
      return mesh;
    };

    // Övre och undre låda med den kantiga FN FNC/AK5-profilen.
    addMesh(new RoundedBoxGeometry(0.22, 0.18, 0.58, 3, 0.025), steel, [0, 0.035, -0.13]);
    addMesh(new RoundedBoxGeometry(0.205, 0.15, 0.34, 3, 0.022), olive, [0, -0.09, -0.02]);
    addMesh(new THREE.BoxGeometry(0.238, 0.025, 0.55), steel, [0, 0.14, -0.16]);

    // Det kraftiga gröna C-handskyddet och dess Picatinny-skenor.
    addMesh(new RoundedBoxGeometry(0.29, 0.235, 0.48, 4, 0.035), olive, [0, 0.005, -0.61]);
    addMesh(new THREE.BoxGeometry(0.27, 0.025, 0.49), steel, [0, 0.143, -0.61]);
    for (let index = 0; index < 7; index += 1) {
      const z = -0.405 - index * 0.067;
      addMesh(new THREE.BoxGeometry(0.31, 0.032, 0.028), steel, [0, 0.165, z]);
      addMesh(new THREE.BoxGeometry(0.315, 0.035, 0.032), steel, [0, -0.015, z], [0, 0, Math.PI / 2]);
    }
    for (const side of [-1, 1]) {
      for (let index = 0; index < 3; index += 1) {
        addMesh(new THREE.BoxGeometry(0.016, 0.07, 0.07), oliveDark, [side * 0.151, 0, -0.48 - index * 0.13]);
      }
    }

    // Kort 350 mm-pipa, gasblock och karakteristisk slitsad flamdämpare.
    addMesh(new THREE.CylinderGeometry(0.024, 0.029, 0.63, 14), steel, [0, 0.015, -1.01], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.CylinderGeometry(0.05, 0.055, 0.11, 12), steel, [0, 0.015, -0.78], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.BoxGeometry(0.055, 0.14, 0.075), steel, [0, 0.085, -0.82]);
    addMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 12), steel, [0, 0.015, -1.34], [Math.PI / 2, 0, 0]);
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI / 2;
      addMesh(
        new THREE.BoxGeometry(0.012, 0.075, 0.105),
        rubber,
        [Math.cos(angle) * 0.036, 0.015 + Math.sin(angle) * 0.036, -1.365],
        [0, 0, angle]
      );
    }

    // Justerbart axelstöd med två skenor och hög kindstödslinje.
    for (const x of [-0.065, 0.065]) {
      addMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.52, 8), steel, [x, 0.045, 0.49], [Math.PI / 2, 0, 0]);
    }
    addMesh(new RoundedBoxGeometry(0.205, 0.31, 0.11, 3, 0.025), olive, [0, -0.005, 0.77], [-0.08, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.216, 0.33, 0.035, 3, 0.012), rubber, [0, -0.01, 0.833], [-0.08, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.16, 0.075, 0.35, 3, 0.022), oliveDark, [0, 0.145, 0.46], [-0.04, 0, 0]);

    // Pistolgrepp, varbygel och vertikalt framgrepp.
    addMesh(new RoundedBoxGeometry(0.125, 0.32, 0.15, 3, 0.022), oliveDark, [0, -0.235, 0.095], [-0.19, 0, 0]);
    addMesh(new THREE.TorusGeometry(0.07, 0.011, 6, 16, Math.PI), steel, [0, -0.17, -0.04], [0, Math.PI / 2, Math.PI / 2]);
    addMesh(new RoundedBoxGeometry(0.105, 0.31, 0.12, 3, 0.025), oliveDark, [0, -0.255, -0.58], [0.06, 0, 0]);
    for (let index = 0; index < 4; index += 1) {
      addMesh(new THREE.BoxGeometry(0.112, 0.018, 0.124), rubber, [0, -0.14 - index * 0.055, -0.58]);
    }

    // Böjt, halvtransparent 30-skottsmagasin med förstärkningsribbor.
    const magazineGroup = new THREE.Group();
    magazineGroup.position.set(0, -0.205, -0.11);
    const segments = [
      { y: -0.02, z: 0, angle: -0.03 },
      { y: -0.115, z: 0.012, angle: -0.08 },
      { y: -0.21, z: 0.034, angle: -0.14 }
    ];
    segments.forEach((segment, index) => {
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.13, 0.17, 3, 0.018), magazine);
      body.position.set(0, segment.y, segment.z);
      body.rotation.x = segment.angle;
      magazineGroup.add(body);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.018, 0.178), oliveDark);
      rib.position.set(0, segment.y - 0.035, segment.z - 0.004);
      rib.rotation.x = segment.angle;
      magazineGroup.add(rib);
      if (index === 2) body.scale.set(0.94, 1, 0.94);
    });
    model.add(magazineGroup);

    // Aimpoint-liknande rödpunktsikte på toppskenan.
    addMesh(new RoundedBoxGeometry(0.13, 0.055, 0.24, 3, 0.014), steel, [0, 0.185, -0.12]);
    addMesh(new THREE.CylinderGeometry(0.064, 0.064, 0.22, 16), steel, [0, 0.258, -0.12], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 18), lens, [0, 0.258, -0.235], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.BoxGeometry(0.055, 0.06, 0.06), steel, [0.075, 0.285, -0.12]);

    // Reglage och detaljer som bryter upp den enkla lådformen.
    addMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.075, 8), steel, [0.145, 0.055, -0.11], [0, 0, Math.PI / 2]);
    addMesh(new THREE.BoxGeometry(0.035, 0.055, 0.12), steel, [-0.12, 0.02, 0.04]);
    addMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.27, 8), steel, [-0.126, 0.005, -0.52], [Math.PI / 2, 0, 0]);

    return model;
  }

  setWeaponModel() {
    if (this.weaponModel) {
      this.weaponRig.remove(this.weaponModel);
      this.weaponModel.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
    }

    const weapon = WEAPONS[this.currentWeapon];
    const group = new THREE.Group();
    let muzzleZ = -0.92;
    if (weapon.id === 'ak5') {
      group.add(this.createAK5CModel());
      muzzleZ = -1.43;
    } else {
      const gun = new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.34, metalness: 0.72 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x111416, roughness: 0.48, metalness: 0.55 });
      const grip = new THREE.MeshStandardMaterial({ color: 0x252723, roughness: 0.92, metalness: 0.04 });
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.17, weapon.id === 'shotgun' ? 0.64 : 0.56), gun);
      receiver.position.z = -0.16;
      group.add(receiver);
      const barrelLength = weapon.id === 'shotgun' ? 0.86 : 0.65;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.031, barrelLength, 12), dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.015, -0.54 - barrelLength * 0.35);
      group.add(barrel);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.19, 0.37), grip);
      stock.position.set(0, -0.005, 0.34);
      stock.rotation.x = -0.12;
      group.add(stock);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.29, 0.14), grip);
      handle.position.set(0, -0.19, 0.06);
      handle.rotation.x = -0.2;
      group.add(handle);
      if (weapon.id === 'shotgun') {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.32), grip);
        pump.position.set(0, -0.035, -0.49);
        group.add(pump);
        muzzleZ -= 0.17;
      } else {
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.32, 0.16), dark);
        mag.position.set(0, -0.21, -0.13);
        group.add(mag);
        const sight = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.18), dark);
        sight.position.set(0, 0.13, -0.21);
        group.add(sight);
      }
    }

    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0 });
    this.muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.34, 7), flashMaterial);
    this.muzzleFlash.rotation.x = -Math.PI / 2;
    this.muzzleFlash.position.set(0, 0.015, muzzleZ);
    group.add(this.muzzleFlash);

    group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    this.weaponModel = group;
    this.weaponRig.add(group);
    this.weaponRig.position.set(0.36, -0.31, -0.69);
    this.weaponRig.rotation.set(-0.04, -0.035, -0.015);
    this.updateHUD();
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'KeyR') this.startReload();
      if (event.code === 'Digit1') this.switchWeapon(0);
      if (event.code === 'Digit2') this.switchWeapon(1);
      if (event.code === 'Digit3') this.switchWeapon(2);
    });
    document.addEventListener('keyup', (event) => this.keys.delete(event.code));
    document.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked || this.state !== 'PLAYING') return;
      this.yaw -= event.movementX * 0.0018;
      this.pitch -= event.movementY * 0.00165;
      this.pitch = clamp(this.pitch, -1.35, 1.25);
      this.swayX = clamp(this.swayX + event.movementX * 0.0002, -0.032, 0.032);
      this.swayY = clamp(this.swayY + event.movementY * 0.00018, -0.025, 0.025);
    });
    document.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || this.state !== 'PLAYING') return;
      if (!this.pointerLocked) {
        this.canvas.requestPointerLock();
        return;
      }
      this.mouseDown = true;
      this.tryFire();
    });
    document.addEventListener('mouseup', (event) => { if (event.button === 0) this.mouseDown = false; });
    document.addEventListener('wheel', (event) => {
      if (this.state !== 'PLAYING') return;
      const next = (this.currentWeapon + (event.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length;
      this.switchWeapon(next);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());

    document.getElementById('start-button').addEventListener('click', () => this.startGame());
    document.getElementById('resume-button').addEventListener('click', () => this.canvas.requestPointerLock());
    document.getElementById('restart-button').addEventListener('click', () => this.restartGame());
    this.weaponButtons.forEach((button) => button.addEventListener('click', () => this.switchWeapon(Number(button.dataset.weapon))));
  }

  async startGame() {
    await this.audio.start();
    this.dom.start.classList.add('hidden');
    this.gameUi.forEach((element) => element.classList.remove('hidden'));
    this.dom.crosshair.classList.add('visible');
    this.state = 'PLAYING';
    this.startWave(1);
    this.canvas.requestPointerLock();
  }

  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (this.pointerLocked) {
      if (this.state === 'PAUSED') this.state = 'PLAYING';
      this.dom.pause.classList.add('hidden');
      this.dom.hint.classList.add('hidden');
      this.dom.crosshair.classList.add('visible');
      this.clock.getDelta();
    } else if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.mouseDown = false;
      this.dom.pause.classList.remove('hidden');
      this.dom.hint.classList.remove('hidden');
      this.dom.crosshair.classList.remove('visible');
    }
  }

  restartGame() {
    this.drones.forEach((drone) => drone.dispose());
    this.drones = [];
    this.effects.forEach((effect) => this.scene.remove(effect.mesh));
    this.effects = [];
    this.tracers.forEach((tracer) => this.scene.remove(tracer.line));
    this.tracers = [];
    this.health = 100;
    this.armor = 50;
    this.score = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.wave = 0;
    this.waveKills = 0;
    this.weaponStates = WEAPONS.map((weapon) => ({ ammo: weapon.magazine, reserve: weapon.reserve }));
    this.currentWeapon = 0;
    this.camera.position.set(0, 1.72, 14);
    this.yaw = 0;
    this.pitch = -0.04;
    this.state = 'PLAYING';
    this.dom.gameover.classList.add('hidden');
    this.dom.crosshair.classList.add('visible');
    this.setWeaponModel();
    this.startWave(1);
    this.canvas.requestPointerLock();
  }

  startWave(number) {
    this.wave = number;
    this.waveTotal = 4 + number * 2;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.spawnTimer = 0.5;
    this.waveBreakTimer = 0;
    this.dom.mission.textContent = 'HÅLL SEKTORN';
    this.showNotification(`VÅG ${String(number).padStart(2, '0')} · INKOMMANDE FPV-HOT`);
    this.updateHUD();
  }

  spawnDrone() {
    let type = 'scout';
    const roll = Math.random();
    if (this.wave >= 4 && roll > 0.78) type = 'armored';
    else if (this.wave >= 2 && roll > 0.45) type = 'strike';

    let position = null;
    const radius = 0.72 * DRONE_TYPES[type].scale;
    for (let attempt = 0; attempt < 8 && !position; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 62 + Math.random() * 34;
      const altitude = 7 + Math.random() * 13;
      const candidate = this.camera.position.clone().add(new THREE.Vector3(Math.sin(angle) * distance, 0, Math.cos(angle) * distance));
      candidate.y = altitude;
      if (!this.sphereCollidesAt(candidate, radius)) position = candidate;
    }
    if (!position) position = new THREE.Vector3(0, 24, -82);
    this.drones.push(new Drone(this, type, position));
  }

  switchWeapon(index) {
    if (index === this.currentWeapon || index < 0 || index >= WEAPONS.length || this.state === 'GAMEOVER') return;
    this.currentWeapon = index;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0.18;
    this.setWeaponModel();
    this.showNotification(WEAPONS[index].name);
    this.audio.tone(430, 0.045, 'square', 0.06, 90);
  }

  startReload() {
    if (this.state !== 'PLAYING' || this.isReloading) return;
    const weapon = WEAPONS[this.currentWeapon];
    const state = this.weaponStates[this.currentWeapon];
    if (state.ammo >= weapon.magazine || state.reserve <= 0) return;
    this.isReloading = true;
    this.reloadTimer = weapon.reloadDuration;
    this.audio.reload();
    this.showNotification('LADDAR OM');
  }

  finishReload() {
    const weapon = WEAPONS[this.currentWeapon];
    const state = this.weaponStates[this.currentWeapon];
    const needed = weapon.magazine - state.ammo;
    const loaded = Math.min(needed, state.reserve);
    state.ammo += loaded;
    state.reserve -= loaded;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.updateHUD();
  }

  tryFire() {
    if (this.state !== 'PLAYING' || this.fireCooldown > 0 || this.isReloading) return;
    const weapon = WEAPONS[this.currentWeapon];
    const state = this.weaponStates[this.currentWeapon];
    if (state.ammo <= 0) {
      this.audio.dryFire();
      this.fireCooldown = 0.25;
      if (state.reserve > 0) this.startReload();
      return;
    }

    state.ammo -= 1;
    this.shots += 1;
    this.fireCooldown = weapon.fireInterval;
    this.recoil = Math.min(0.16, this.recoil + weapon.recoil);
    this.pitch = clamp(this.pitch + weapon.recoil * (0.16 + Math.random() * 0.16), -1.35, 1.25);
    this.muzzleTimer = 0.045;
    this.audio.gunshot(weapon);

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const damageByDrone = new Map();
    const hitMeshes = this.drones.filter((drone) => drone.alive).flatMap((drone) => {
      const meshes = [];
      drone.group.traverse((child) => { if (child.isMesh) meshes.push(child); });
      return meshes;
    });
    const shotTargets = [...hitMeshes, ...this.solidMeshes];

    for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
      const direction = forward.clone()
        .addScaledVector(right, (Math.random() - 0.5) * weapon.spread)
        .addScaledVector(up, (Math.random() - 0.5) * weapon.spread)
        .normalize();
      this.raycaster.set(origin, direction);
      this.raycaster.far = weapon.range;
      const intersections = this.raycaster.intersectObjects(shotTargets, false);
      let pelletEnd = origin.clone().addScaledVector(direction, weapon.range);
      if (intersections.length > 0) {
        const hit = intersections[0];
        pelletEnd = hit.point.clone();
        const drone = hit.object.userData.drone;
        if (drone) damageByDrone.set(drone, (damageByDrone.get(drone) || 0) + weapon.damage);
        else if (pellet === 0) this.spawnImpact(hit.point, 0xd8c7a8);
      }
      if (pellet === 0) this.spawnTracer(origin, pelletEnd);
    }

    if (damageByDrone.size > 0) {
      this.hits += 1;
      let destroyed = false;
      damageByDrone.forEach((damage, drone) => {
        const point = drone.group.position.clone();
        destroyed = drone.takeDamage(damage, point) || destroyed;
      });
      this.showHitMarker(destroyed);
      this.audio.hit(destroyed);
    }

    if (state.ammo === 0 && state.reserve > 0) window.setTimeout(() => this.startReload(), weapon.fireInterval * 700);
    this.updateHUD();
  }

  spawnTracer(origin, target) {
    const start = origin.clone().add(new THREE.Vector3(0.22, -0.17, -0.34).applyQuaternion(this.camera.quaternion));
    const geometry = new THREE.BufferGeometry().setFromPoints([start, target]);
    const material = new THREE.LineBasicMaterial({ color: 0xffcf78, transparent: true, opacity: 0.65 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.055, maxLife: 0.055 });
  }

  spawnImpact(position, color) {
    for (let i = 0; i < 7; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.025 + Math.random() * 0.025, 5, 4), material);
      mesh.position.copy(position);
      this.scene.add(mesh);
      this.effects.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
        life: 0.28 + Math.random() * 0.16,
        gravity: 3
      });
    }
  }

  spawnExplosion(position) {
    const flash = new THREE.PointLight(0xff5c24, 12, 16, 2);
    flash.position.copy(position);
    this.scene.add(flash);
    this.effects.push({ mesh: flash, velocity: new THREE.Vector3(), life: 0.22, gravity: 0, light: true });
    const colors = [0xffcf55, 0xff6729, 0x303537];
    for (let i = 0; i < 34; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.055 + Math.random() * 0.11, 6, 5), material);
      mesh.position.copy(position);
      this.scene.add(mesh);
      this.effects.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 11, (Math.random() - 0.2) * 9, (Math.random() - 0.5) * 11),
        life: 0.5 + Math.random() * 0.7,
        gravity: 5.5
      });
    }
  }

  destroyDrone(drone) {
    this.score += drone.stats.score;
    this.kills += 1;
    this.waveKills += 1;
    this.spawnExplosion(drone.group.position.clone());
    this.audio.explosion();
    this.updateHUD();
  }

  droneDetonation(drone, damage) {
    this.spawnExplosion(drone.group.position.clone());
    this.audio.explosion();
    this.damagePlayer(damage);
  }

  damagePlayer(amount) {
    const absorbed = Math.min(this.armor, Math.round(amount * 0.55));
    this.armor -= absorbed;
    this.health = Math.max(0, this.health - (amount - absorbed));
    this.dom.damage.classList.remove('flash');
    void this.dom.damage.offsetWidth;
    this.dom.damage.classList.add('flash');
    this.updateHUD();
    if (this.health <= 0) this.gameOver();
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.mouseDown = false;
    document.exitPointerLock?.();
    this.dom.pause.classList.add('hidden');
    this.dom.hint.classList.add('hidden');
    this.dom.crosshair.classList.remove('visible');
    this.dom.finalScore.textContent = this.score.toLocaleString('sv-SE');
    this.dom.finalKills.textContent = this.kills;
    this.dom.finalWave.textContent = this.wave;
    this.dom.finalAccuracy.textContent = `${this.shots ? Math.round((this.hits / this.shots) * 100) : 0}%`;
    this.dom.gameover.classList.remove('hidden');
  }

  showHitMarker(destroyed) {
    this.dom.hit.querySelectorAll('i').forEach((line) => { line.style.background = destroyed ? '#ffb23e' : '#fff'; });
    this.dom.hit.classList.remove('show');
    void this.dom.hit.offsetWidth;
    this.dom.hit.classList.add('show');
  }

  showNotification(text, duration = 2.2) {
    this.dom.notification.textContent = text;
    this.dom.notification.classList.add('show');
    this.notificationTimer = duration;
  }

  updateMovement(dt) {
    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.z -= 1;
    if (this.keys.has('KeyS')) move.z += 1;
    if (this.keys.has('KeyA')) move.x -= 1;
    if (this.keys.has('KeyD')) move.x += 1;
    if (move.lengthSq() === 0) {
      this.bobTime += dt * 2;
      return;
    }
    move.normalize();
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 9.2 : 5.6;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const delta = forward.multiplyScalar(-move.z).add(right.multiplyScalar(move.x)).multiplyScalar(speed * dt);
    this.camera.position.copy(this.resolvePlayerMovement(this.camera.position, delta));
    this.bobTime += dt * (speed > 7 ? 13 : 9);
  }

  updateWeapon(dt) {
    const weapon = WEAPONS[this.currentWeapon];
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.mouseDown && weapon.automatic) this.tryFire();
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    this.recoil = lerp(this.recoil, 0, 1 - Math.exp(-dt * 13));
    this.swayX = lerp(this.swayX, 0, 1 - Math.exp(-dt * 7));
    this.swayY = lerp(this.swayY, 0, 1 - Math.exp(-dt * 7));
    const moving = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((key) => this.keys.has(key));
    const bob = moving ? 1 : 0.25;
    this.weaponRig.position.x = 0.36 + Math.sin(this.bobTime) * 0.008 * bob + this.swayX;
    this.weaponRig.position.y = -0.31 + Math.abs(Math.cos(this.bobTime * 0.5)) * 0.009 * bob - this.swayY - this.recoil * 0.26;
    this.weaponRig.position.z = -0.69 + this.recoil;
    this.weaponRig.rotation.z = -0.015 + Math.sin(this.bobTime * 0.5) * 0.006 * bob;
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      this.muzzleFlash.material.opacity = Math.random() * 0.85 + 0.15;
      this.muzzleFlash.rotation.z = Math.random() * Math.PI;
      this.muzzleLight.intensity = 6 + Math.random() * 7;
      const muzzlePosition = new THREE.Vector3(0.26, -0.17, -1).applyMatrix4(this.camera.matrixWorld);
      this.muzzleLight.position.copy(this.camera.worldToLocal(muzzlePosition));
    } else {
      this.muzzleFlash.material.opacity = 0;
      this.muzzleLight.intensity = 0;
    }
  }

  updateDrones(dt) {
    if (this.waveSpawned < this.waveTotal) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnDrone();
        this.waveSpawned += 1;
        this.spawnTimer = Math.max(0.45, 1.45 - this.wave * 0.065) + Math.random() * 0.45;
      }
    }

    this.drones.forEach((drone) => drone.update(dt));
    const removed = this.drones.filter((drone) => !drone.alive);
    this.drones = this.drones.filter((drone) => drone.alive);
    removed.forEach((drone) => drone.dispose());

    if (this.waveSpawned >= this.waveTotal && this.drones.length === 0) {
      if (this.waveBreakTimer <= 0) {
        this.waveBreakTimer = 4.5;
        this.dom.mission.textContent = 'SEKTOR TILLFÄLLIGT SÄKRAD';
        this.showNotification(`VÅG ${String(this.wave).padStart(2, '0')} SLUTFÖRD · +${this.wave * 250} POÄNG`, 3.5);
        this.score += this.wave * 250;
      } else {
        this.waveBreakTimer -= dt;
        if (this.waveBreakTimer <= 0) this.startWave(this.wave + 1);
      }
    }

    const nearest = this.drones.reduce((distance, drone) => Math.min(distance, drone.group.position.distanceTo(this.camera.position)), 120);
    this.audio.updateHum(this.drones.length, clamp(1 - nearest / 80, 0, 1));
  }

  updateEffects(dt) {
    this.effects.forEach((effect) => {
      effect.life -= dt;
      if (effect.light) {
        effect.mesh.intensity *= 0.84;
      } else {
        effect.velocity.y -= effect.gravity * dt;
        effect.mesh.position.addScaledVector(effect.velocity, dt);
        effect.mesh.material.opacity = clamp(effect.life * 2, 0, 1);
        effect.mesh.scale.multiplyScalar(1 + dt * 1.4);
      }
    });
    const expiredEffects = this.effects.filter((effect) => effect.life <= 0);
    this.effects = this.effects.filter((effect) => effect.life > 0);
    expiredEffects.forEach((effect) => {
      this.scene.remove(effect.mesh);
      if (!effect.light) {
        effect.mesh.geometry.dispose();
        effect.mesh.material.dispose();
      }
    });

    this.tracers.forEach((tracer) => {
      tracer.life -= dt;
      tracer.line.material.opacity = clamp(tracer.life / tracer.maxLife, 0, 1);
    });
    const expiredTracers = this.tracers.filter((tracer) => tracer.life <= 0);
    this.tracers = this.tracers.filter((tracer) => tracer.life > 0);
    expiredTracers.forEach((tracer) => {
      this.scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      tracer.line.material.dispose();
    });
  }

  updateHUD() {
    const weapon = WEAPONS[this.currentWeapon];
    const weaponState = this.weaponStates[this.currentWeapon];
    this.dom.waveLabel.textContent = `VÅG ${String(Math.max(1, this.wave)).padStart(2, '0')}`;
    this.dom.waveFill.style.width = `${this.waveTotal ? clamp((this.waveKills / this.waveTotal) * 100, 0, 100) : 0}%`;
    this.dom.threats.textContent = String(this.drones.length).padStart(2, '0');
    this.dom.health.textContent = Math.ceil(this.health);
    this.dom.healthFill.style.width = `${this.health}%`;
    this.dom.armor.textContent = Math.ceil(this.armor);
    this.dom.armorFill.style.width = `${this.armor * 2}%`;
    this.dom.fireMode.textContent = weapon.mode;
    this.dom.weaponName.textContent = weapon.name;
    this.dom.ammo.textContent = String(weaponState.ammo).padStart(2, '0');
    this.dom.reserve.textContent = String(weaponState.reserve).padStart(3, '0');
    this.dom.score.textContent = String(this.score).padStart(6, '0');
    this.weaponButtons.forEach((button, index) => button.classList.toggle('active', index === this.currentWeapon));
  }

  drawRadar() {
    const ctx = this.radarContext;
    const width = ctx.canvas.width;
    const center = width / 2;
    ctx.clearRect(0, 0, width, width);
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(32, 69, 72, .42)');
    gradient.addColorStop(1, 'rgba(3, 12, 15, .82)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(123, 217, 232, .17)';
    ctx.lineWidth = 1;
    [0.32, 0.64, 0.94].forEach((ratio) => {
      ctx.beginPath();
      ctx.arc(center, center, center * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(center, 8); ctx.lineTo(center, width - 8);
    ctx.moveTo(8, center); ctx.lineTo(width - 8, center);
    ctx.stroke();

    const sweep = (performance.now() * 0.00065) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(123, 217, 232, .55)';
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + Math.sin(sweep) * (center - 8), center - Math.cos(sweep) * (center - 8));
    ctx.stroke();

    this.drones.forEach((drone) => {
      const dx = drone.group.position.x - this.camera.position.x;
      const dz = drone.group.position.z - this.camera.position.z;
      const cos = Math.cos(-this.yaw);
      const sin = Math.sin(-this.yaw);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      const scale = (center - 12) / 120;
      const x = center + clamp(rx * scale, -center + 12, center - 12);
      const y = center + clamp(rz * scale, -center + 12, center - 12);
      ctx.fillStyle = drone.type === 'armored' ? '#ffb23e' : '#ff5149';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(x, y, drone.type === 'armored' ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e6f3f5';
    ctx.beginPath();
    ctx.moveTo(center, center - 6);
    ctx.lineTo(center - 4, center + 5);
    ctx.lineTo(center + 4, center + 5);
    ctx.closePath();
    ctx.fill();
  }

  update(dt) {
    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) this.dom.notification.classList.remove('show');
    }
    if (this.state !== 'PLAYING') return;
    this.updateMovement(dt);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.updateWeapon(dt);
    this.updateDrones(dt);
    this.updateEffects(dt);
    if (this.isReloading) {
      const weapon = WEAPONS[this.currentWeapon];
      this.dom.reloadFill.style.width = `${clamp((1 - this.reloadTimer / weapon.reloadDuration) * 100, 0, 100)}%`;
    } else {
      this.dom.reloadFill.style.width = '0%';
    }
    this.updateHUD();
    this.drawRadar();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.composer.render();
  }
}

const game = new FPVDownGame();
window.game = game;
game.init().catch((error) => {
  console.error(error);
  document.getElementById('loading-state').textContent = 'Kunde inte starta 3D-motorn. Kontrollera WebGL-stöd.';
});
