import * as THREE from 'three';
import { CollisionWorld } from './collision.js';
import { createSky, SKY_COLORS } from './sky.js';
import { concreteTextures, corrugatedTextures, woodTextures, fabricTextures, plasterTextures, rockTexture } from './textures.js';

const { smoothstep } = THREE.MathUtils;

// Höjd för terrängen. Spelområdet (r < 85 m) är helt plant så att kollision,
// drönarhöjd och spelarens ögonhöjd är oförändrade; kullar höjer sig utanför.
export function terrainHeight(x, z) {
  const radius = Math.hypot(x, z);
  const ramp = smoothstep(radius, 85, 175);
  if (ramp <= 0) return 0;
  const hills = 0.5
    + 0.28 * Math.sin(x * 0.021 + 1.3) * Math.sin(z * 0.019 + 0.4)
    + 0.16 * Math.sin(x * 0.053 - z * 0.041 + 2.1)
    + 0.06 * Math.sin(x * 0.13 + 0.7) * Math.cos(z * 0.11);
  return ramp * (4 + hills * 22);
}

export class World extends CollisionWorld {
  constructor(scene, renderer) {
    super(scene);
    this.renderer = renderer;
    this.time = 0;
  }

  async create() {
    const sunDirection = new THREE.Vector3(-0.62, 0.52, 0.58).normalize();
    this.createAtmosphere(sunDirection);

    const hemi = new THREE.HemisphereLight(0xcfe0ee, 0x4a4632, 0.75);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe6c4, 3.4);
    sun.position.copy(sunDirection).multiplyScalar(90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -85;
    sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85;
    sun.shadow.camera.bottom = -85;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.00018;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.sun = sun;

    this.textures = {
      concrete: concreteTextures(),
      fabric: fabricTextures(),
      wood: woodTextures(),
      rock: rockTexture()
    };

    await this.createGround();
    this.createGrass();
    this.createRocks();
    this.createBushes();
    this.createDefensivePosition();
    this.createPerimeter();
  }

  createAtmosphere(sunDirection) {
    this.sky = createSky(sunDirection);
    this.scene.add(this.sky);
    this.scene.background = new THREE.Color(SKY_COLORS.horizon);
    this.scene.fog = new THREE.FogExp2(SKY_COLORS.horizon, 0.0062);

    // Bildbaserad belysning från himlen ger metaller och glas trovärdiga reflexer.
    if (this.renderer?.isWebGLRenderer) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      const envSky = createSky(sunDirection);
      envSky.material.uniforms.time.value = 0;
      envScene.add(envSky);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 16), new THREE.MeshBasicMaterial({ color: 0x5b5744 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2;
      envScene.add(ground);
      this.environment = pmrem.fromScene(envScene, 0.02);
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = 0.85;
      envSky.geometry.dispose();
      envSky.material.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      pmrem.dispose();
    }
  }

  update(dt, camera) {
    this.time += dt;
    if (!this.sky) return;
    this.sky.position.copy(camera.position);
    this.sky.material.uniforms.time.value = this.time;
  }

  seededRandom(index) {
    const value = Math.sin(index * 91.173 + 7.21) * 43758.5453;
    return value - Math.floor(value);
  }

  async createGround() {
    const textureLoader = new THREE.TextureLoader();
    let groundTexture;
    try {
      groundTexture = await textureLoader.loadAsync(`${import.meta.env.BASE_URL}assets/ground-training.png`);
      groundTexture.colorSpace = THREE.SRGBColorSpace;
      groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
      groundTexture.repeat.set(44, 44);
      groundTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    } catch {
      groundTexture = null;
    }

    const size = 720;
    const geometry = new THREE.PlaneGeometry(size, size, 180, 180);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const dry = new THREE.Color(0xc9b994);
    const lush = new THREE.Color(0x8f9f62);
    const dark = new THREE.Color(0x77735d);
    const color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setY(i, terrainHeight(x, z));
      // Storskalig färgvariation bryter upp texturens upprepning.
      const patch = 0.5 + 0.3 * Math.sin(x * 0.045 + Math.sin(z * 0.03) * 2) * Math.cos(z * 0.052 - 0.8)
        + 0.2 * Math.sin(x * 0.11 + z * 0.09);
      const wear = Math.exp(-Math.hypot(x, z + 2) / 16);
      color.copy(lush).lerp(dry, THREE.MathUtils.clamp(patch, 0, 1));
      color.lerp(dark, wear * 0.55);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: groundTexture ? 0xffffff : 0x6a6a50,
      map: groundTexture,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0
    });
    const ground = new THREE.Mesh(geometry, groundMaterial);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  createGrass() {
    // Tuva av sju avsmalnande strån med mörk bas och ljus topp.
    const blades = 7;
    const positions = [];
    const colors = [];
    const base = new THREE.Color(0x2c3418);
    const tip = new THREE.Color(0xb3b06a);
    for (let b = 0; b < blades; b++) {
      const angle = (b / blades) * Math.PI * 2 + this.seededRandom(b) * 0.6;
      const lean = 0.06 + this.seededRandom(b + 20) * 0.1;
      const height = 0.14 + this.seededRandom(b + 40) * 0.14;
      const width = 0.018;
      const ox = Math.cos(angle) * 0.06;
      const oz = Math.sin(angle) * 0.06;
      const px = -Math.sin(angle) * width;
      const pz = Math.cos(angle) * width;
      const midX = ox + Math.cos(angle) * lean * 0.4;
      const midZ = oz + Math.sin(angle) * lean * 0.4;
      const tipX = ox + Math.cos(angle) * lean;
      const tipZ = oz + Math.sin(angle) * lean;
      const quad = [
        [ox - px, 0, oz - pz], [ox + px, 0, oz + pz], [midX + px * 0.6, height * 0.55, midZ + pz * 0.6],
        [ox - px, 0, oz - pz], [midX + px * 0.6, height * 0.55, midZ + pz * 0.6], [midX - px * 0.6, height * 0.55, midZ - pz * 0.6],
        [midX - px * 0.6, height * 0.55, midZ - pz * 0.6], [midX + px * 0.6, height * 0.55, midZ + pz * 0.6], [tipX, height, tipZ]
      ];
      for (const vertex of quad) {
        positions.push(...vertex);
        const t = vertex[1] / height;
        const c = base.clone().lerp(tip, Math.pow(t, 0.8));
        colors.push(c.r, c.g, c.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // Uppåtriktade normaler ger gräset samma ljussättning som marken.
    const normals = new Float32Array(positions.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    const count = 9000;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    const green = new THREE.Color(0x9fb07a);
    const straw = new THREE.Color(0xe0cf9a);
    for (let i = 0; i < count; i += 1) {
      const radius = 3 + Math.pow(this.seededRandom(i * 3), 0.8) * 150;
      const angle = this.seededRandom(i * 3 + 1) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      dummy.position.set(x, terrainHeight(x, z), z);
      dummy.rotation.set(0, this.seededRandom(i * 3 + 2) * Math.PI * 2, 0);
      const scale = 0.6 + this.seededRandom(i * 7) * 1.1;
      dummy.scale.set(scale, scale * (0.8 + this.seededRandom(i * 11) * 0.5), scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tint.copy(green).lerp(straw, this.seededRandom(i * 13));
      mesh.setColorAt(i, tint);
    }
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  displacedBlob(detail, amount, seed) {
    const geometry = new THREE.IcosahedronGeometry(1, detail);
    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);
      const n = Math.sin(vertex.x * 3.1 + seed) * Math.sin(vertex.y * 2.7 + seed * 1.7) * Math.sin(vertex.z * 3.4 + seed * 0.6);
      vertex.multiplyScalar(1 + n * amount);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  createRocks() {
    const geometry = this.displacedBlob(1, 0.35, 2.3);
    const material = new THREE.MeshStandardMaterial({ map: this.textures.rock, roughness: 0.92, metalness: 0, flatShading: true });
    const count = 130;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const radius = 18 + this.seededRandom(i * 4) * 140;
      const angle = this.seededRandom(i * 4 + 1) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.18 + Math.pow(this.seededRandom(i * 4 + 3), 2.5) * 1.1;
      dummy.position.set(x, terrainHeight(x, z) + scale * 0.15, z);
      dummy.rotation.set(this.seededRandom(i) * 2, this.seededRandom(i + 9) * 3, this.seededRandom(i + 15) * 2);
      dummy.scale.set(scale * 1.2, scale * 0.65, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tint.setScalar(0.75 + this.seededRandom(i * 17) * 0.35);
      mesh.setColorAt(i, tint);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  createBushes() {
    const geometry = this.displacedBlob(2, 0.22, 5.1);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    const count = 170;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    const palette = [new THREE.Color(0x3e4f2a), new THREE.Color(0x56602f), new THREE.Color(0x34452c), new THREE.Color(0x6b6a35)];
    for (let i = 0; i < count; i += 1) {
      const radius = 32 + this.seededRandom(i * 6) * 120;
      const angle = this.seededRandom(i * 6 + 1) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.5 + this.seededRandom(i * 6 + 2) * 1.2;
      dummy.position.set(x, terrainHeight(x, z) + scale * 0.25, z);
      dummy.rotation.set(0, this.seededRandom(i * 6 + 3) * Math.PI, 0);
      dummy.scale.set(scale * 1.3, scale * 0.8, scale * 1.1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tint.copy(palette[i % palette.length]).multiplyScalar(0.85 + this.seededRandom(i * 9) * 0.3);
      mesh.setColorAt(i, tint);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  jerseyBarrierGeometry(length, height) {
    // Betongbarriär med klassisk New Jersey-profil.
    const shape = new THREE.Shape();
    const profile = [[-0.33, 0], [0.33, 0], [0.33, 0.09], [0.24, 0.32], [0.12, height - 0.04], [0.09, height], [-0.09, height], [-0.12, height - 0.04], [-0.24, 0.32], [-0.33, 0.09]];
    shape.moveTo(...profile[0]);
    profile.slice(1).forEach(point => shape.lineTo(...point));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 1 });
    geometry.translate(0, -height / 2, -length / 2);
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }

  createDefensivePosition() {
    const { concrete: concreteTex, fabric: fabricTex, wood: woodTex } = this.textures;
    const concrete = new THREE.MeshStandardMaterial({ color: 0xffffff, map: concreteTex.map, bumpMap: concreteTex.bumpMap, bumpScale: 1.4, roughness: 0.92, metalness: 0 });
    concrete.map.repeat.set(0.38, 0.38);
    concrete.bumpMap.repeat.set(0.38, 0.38);
    const sand = new THREE.MeshStandardMaterial({ color: 0xffffff, map: fabricTex.map, bumpMap: fabricTex.bumpMap, bumpScale: 1.2, roughness: 1 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x4a5250, roughness: 0.5, metalness: 0.75 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x272c2c, roughness: 0.45, metalness: 0.8 });

    const barrierGeometry = this.jerseyBarrierGeometry(5.2, 1.6);
    const barrierPositions = [
      [-8, 0.8, -2, 0.16], [8, 0.8, -2, -0.16], [-12, 0.8, 8, 0.65], [12, 0.8, 8, -0.65],
      [-4.7, 0.8, -9.5, 0], [4.7, 0.8, -9.5, 0]
    ];
    barrierPositions.forEach(([x, y, z, rotation]) => {
      const barrier = new THREE.Mesh(barrierGeometry, concrete);
      barrier.position.set(x, y, z);
      barrier.rotation.y = rotation;
      this.addObstacle(barrier, 0.25);
    });

    const sandbagGeometry = new THREE.CapsuleGeometry(0.22, 0.72, 4, 10);
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < 13; i += 1) {
        const bag = new THREE.Mesh(sandbagGeometry, sand);
        bag.rotation.z = Math.PI / 2;
        bag.rotation.y = 0.04 * Math.sin(i * 1.7 + row);
        bag.scale.set(1, 1 + 0.06 * Math.sin(i * 2.3 + row * 4), 1.18);
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

    this.createContainer(new THREE.Vector3(-17, 1.38, -15), 0.18, '#4f5e4a');
    this.createTower(steel, darkSteel);

    const antenna = new THREE.Group();
    antenna.position.set(0, 0, -3);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 7, 8), steel);
    mast.position.y = 3.5;
    antenna.add(mast);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.18, 10), darkSteel);
    base.position.y = 0.09;
    antenna.add(base);
    for (let i = 0; i < 3; i++) {
      const element = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), steel);
      element.rotation.z = Math.PI / 2;
      element.rotation.y = i * Math.PI / 3;
      element.position.y = 6.2 + i * 0.25;
      antenna.add(element);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff2a1a, emissiveIntensity: 4 }));
    beacon.position.y = 7.05;
    antenna.add(beacon);
    this.addObstacle(antenna, 0.18);
    antenna.traverse(child => { if (child.isMesh) child.castShadow = true; });

    // Lådor och fat vid containern och tornet.
    const wood = new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTex.map, bumpMap: woodTex.bumpMap, bumpScale: 1.5, roughness: 0.85 });
    const crateGeometry = new THREE.BoxGeometry(1.1, 0.9, 1.1);
    [[-13.2, 0.45, -14.2, 0.3], [-13.4, 1.35, -14.1, 0.6], [-12.1, 0.45, -15.3, 0.1], [15.6, 0.45, -16.2, -0.2]].forEach(([x, y, z, r]) => {
      const crate = new THREE.Mesh(crateGeometry, wood);
      crate.position.set(x, y, z);
      crate.rotation.y = r;
      this.addObstacle(crate, 0.12);
    });
    const barrelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16);
    const barrelColors = [0x3f5236, 0x7a3d23, 0x3f5236];
    [[-20.3, -12.6], [-20.9, -13.3], [20.6, -15.6]].forEach(([x, z], index) => {
      const barrelMaterial = new THREE.MeshStandardMaterial({ color: barrelColors[index], roughness: 0.55, metalness: 0.45 });
      const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
      barrel.position.set(x, 0.45, z);
      for (const y of [-0.22, 0.22]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.018, 6, 20), barrelMaterial);
        hoop.rotation.x = Math.PI / 2;
        hoop.position.y = y;
        barrel.add(hoop);
      }
      this.addObstacle(barrel, 0.1);
    });
  }

  createContainer(position, rotation, paint) {
    const { map, bumpMap } = corrugatedTextures(paint, 18);
    const material = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 2.2, roughness: 0.62, metalness: 0.35 });
    const container = new THREE.Mesh(new THREE.BoxGeometry(6.1, 2.75, 2.55), material);
    container.position.copy(position);
    container.rotation.y = rotation;
    const frame = new THREE.MeshStandardMaterial({ color: 0x2f3530, roughness: 0.55, metalness: 0.55 });
    const edgeGeometry = new THREE.BoxGeometry(0.12, 2.8, 0.12);
    for (const x of [-3.03, 3.03]) {
      for (const z of [-1.25, 1.25]) {
        const edge = new THREE.Mesh(edgeGeometry, frame);
        edge.position.set(x, 0, z);
        container.add(edge);
      }
      // Dörrarnas låsstänger på kortsidan.
      if (x > 0) {
        for (const z of [-0.85, -0.3, 0.3, 0.85]) {
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.5, 6), frame);
          bar.position.set(x + 0.06, 0, z);
          container.add(bar);
        }
      }
    }
    this.addObstacle(container, 0.2);
    container.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  }

  createTower(steel, darkSteel) {
    const tower = new THREE.Group();
    tower.position.set(18, 0, -18);
    const postGeometry = new THREE.BoxGeometry(0.18, 7, 0.18);
    const corners = [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]];
    corners.forEach(([x, z]) => {
      const post = new THREE.Mesh(postGeometry, steel);
      post.position.set(x, 3.5, z);
      tower.add(post);
    });
    // Kryssförband mellan benen.
    const braceLength = Math.hypot(2.8, 2.9);
    const braceGeometry = new THREE.BoxGeometry(0.06, braceLength, 0.06);
    for (let side = 0; side < 4; side++) {
      const [ax, az] = corners[side];
      const [bx, bz] = corners[(side + 1) % 4];
      for (const level of [0, 1]) {
        for (const direction of [-1, 1]) {
          const brace = new THREE.Mesh(braceGeometry, darkSteel);
          brace.position.set((ax + bx) / 2, 1.6 + level * 2.9, (az + bz) / 2);
          brace.rotation.y = Math.atan2(bx - ax, bz - az);
          brace.rotateX(direction * Math.atan2(2.8, 2.9));
          tower.add(brace);
        }
      }
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 3.8), darkSteel);
    platform.position.y = 6.1;
    tower.add(platform);
    const { map, bumpMap } = corrugatedTextures('#6b6f63', 12);
    const cabinMaterial = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 1.5, roughness: 0.7, metalness: 0.3 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 3), cabinMaterial);
    cabin.position.y = 7.1;
    tower.add(cabin);
    const glass = new THREE.MeshStandardMaterial({ color: 0x111a1e, roughness: 0.08, metalness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.04), glass);
      const angle = i * Math.PI / 2;
      pane.position.set(Math.sin(angle) * 1.51, 7.35, Math.cos(angle) * 1.51);
      pane.rotation.y = angle;
      tower.add(pane);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.14, 3.5), darkSteel);
    roof.position.y = 8.07;
    tower.add(roof);
    const ladder = new THREE.Group();
    for (const x of [-0.22, 0.22]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 6.1, 0.04), steel);
      rail.position.set(x, 3.05, 0);
      ladder.add(rail);
    }
    for (let y = 0.3; y < 6; y += 0.35) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 0.03), steel);
      rung.position.y = y;
      ladder.add(rung);
    }
    ladder.position.set(0, 0, 1.55);
    tower.add(ladder);
    this.addObstacle(tower, 0.08);
    tower.traverse(child => { if (child.isMesh) child.castShadow = true; });
  }

  createBuilding([x, z, w, h, d], index, materials) {
    const building = new THREE.Group();
    building.position.set(x, 0, z);
    building.rotation.y = index * 0.4 - 0.2;

    const wallMap = materials.plaster.map.clone();
    const wallBump = materials.plaster.bumpMap.clone();
    wallMap.repeat.set(w / 5, h / 5);
    wallBump.repeat.copy(wallMap.repeat);
    wallMap.needsUpdate = wallBump.needsUpdate = true;
    const wall = new THREE.MeshStandardMaterial({ map: wallMap, bumpMap: wallBump, bumpScale: 1.2, roughness: 0.93 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    body.position.y = h / 2;
    building.add(body);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.6, d + 0.12), materials.concrete);
    plinth.position.y = 0.3;
    building.add(plinth);

    // Sadeltak i korrugerad plåt.
    const roofHeight = Math.min(2.4, d * 0.28);
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-d / 2 - 0.45, 0);
    roofShape.lineTo(d / 2 + 0.45, 0);
    roofShape.lineTo(0, roofHeight);
    roofShape.closePath();
    const roofGeometry = new THREE.ExtrudeGeometry(roofShape, { depth: w + 0.5, bevelEnabled: false });
    roofGeometry.translate(0, 0, -(w + 0.5) / 2);
    roofGeometry.rotateY(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeometry, materials.roof);
    roof.position.y = h;
    building.add(roof);
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-d / 2, 0);
    gableShape.lineTo(d / 2, 0);
    gableShape.lineTo(0, roofHeight - 0.3);
    gableShape.closePath();
    const gableGeometry = new THREE.ShapeGeometry(gableShape);
    for (const side of [-1, 1]) {
      const gable = new THREE.Mesh(gableGeometry, wall);
      gable.position.set(side * (w / 2 + 0.001), h, 0);
      gable.rotation.y = side * Math.PI / 2;
      building.add(gable);
    }

    // Fönster längs långsidorna, en eller två våningar.
    const floors = h > 5.5 ? 2 : 1;
    const columns = Math.max(2, Math.floor(w / 3.2));
    for (const side of [-1, 1]) {
      for (let floor = 0; floor < floors; floor++) {
        for (let c = 0; c < columns; c++) {
          const wx = -w / 2 + (c + 0.5) * (w / columns);
          const wy = floors === 1 ? h * 0.58 : 1.9 + floor * (h * 0.48);
          const boarded = this.seededRandom(index * 31 + c * 7 + floor * 3 + side) > 0.72;
          const frame = new THREE.Mesh(materials.frameGeometry, materials.frame);
          frame.position.set(wx, wy, side * (d / 2 + 0.02));
          building.add(frame);
          const pane = new THREE.Mesh(materials.paneGeometry, boarded ? materials.boards : materials.glass);
          pane.position.set(wx, wy, side * (d / 2 + 0.05));
          if (side < 0) pane.rotation.y = Math.PI;
          building.add(pane);
          const sill = new THREE.Mesh(materials.sillGeometry, materials.concrete);
          sill.position.set(wx, wy - 0.68, side * (d / 2 + 0.1));
          building.add(sill);
        }
      }
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.08), materials.door);
    door.position.set(w / 2 + 0.04, 1.1 + 0.3, d * 0.2);
    door.rotation.y = Math.PI / 2;
    building.add(door);

    this.addObstacle(building, 0.15);
    building.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  }

  createPerimeter() {
    this.createForest();

    const roofTex = corrugatedTextures('#5c3a2c', 24);
    roofTex.map.repeat.set(2, 1);
    roofTex.bumpMap.repeat.set(2, 1);
    const concrete = new THREE.MeshStandardMaterial({ map: this.textures.concrete.map, roughness: 0.95, color: 0x8a877e });
    const materials = {
      plaster: plasterTextures('#bdb5a3'),
      concrete,
      roof: new THREE.MeshStandardMaterial({ map: roofTex.map, bumpMap: roofTex.bumpMap, bumpScale: 2, roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide }),
      frame: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0e1418, roughness: 0.05, metalness: 0.95 }),
      boards: new THREE.MeshStandardMaterial({ map: this.textures.wood.map, roughness: 0.9 }),
      door: new THREE.MeshStandardMaterial({ color: 0x3b4a3f, roughness: 0.6, metalness: 0.4 }),
      frameGeometry: new THREE.BoxGeometry(1.25, 1.5, 0.08),
      paneGeometry: new THREE.PlaneGeometry(1.05, 1.3),
      sillGeometry: new THREE.BoxGeometry(1.4, 0.08, 0.2)
    };
    [[-58, -40, 12, 5, 9], [55, -48, 16, 7, 8], [-62, 40, 10, 4, 14]].forEach((spec, index) => this.createBuilding(spec, index, materials));
  }

  createForest() {
    const count = 320;
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 1 });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.26, 1, 7), trunkMaterial, count);

    // Grankrona: konlager med ojämn kant och mörkare insida.
    const crownGeometry = new THREE.ConeGeometry(1, 1, 11, 2, true);
    const positions = crownGeometry.attributes.position;
    const crownColors = new Float32Array(positions.count * 3);
    const inner = new THREE.Color(0x1b2a1d);
    const outer = new THREE.Color(0x48663f);
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);
      const t = 0.5 - vertex.y;
      const key = Math.round(Math.atan2(vertex.z, vertex.x) * 100) + Math.round(vertex.y * 10) * 1000;
      const jag = 1 + (this.seededRandom(key) - 0.5) * 0.35 * t;
      positions.setXYZ(i, vertex.x * jag, vertex.y - (t > 0.9 ? this.seededRandom(key + 7) * 0.12 : 0), vertex.z * jag);
      const c = inner.clone().lerp(outer, Math.min(1, t * 1.1));
      crownColors.set([c.r, c.g, c.b], i * 3);
    }
    crownGeometry.setAttribute('color', new THREE.BufferAttribute(crownColors, 3));
    crownGeometry.computeVertexNormals();
    const crownMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    const layers = 4;
    const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, count * layers);

    const leafGeometry = this.displacedBlob(1, 0.28, 8.3);
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    const deciduousCount = 70;
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, deciduousCount * 3);
    const birchTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.16, 1, 6), new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.8 }), deciduousCount);

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let crownIndex = 0;
    let pineIndex = 0;
    let leafIndex = 0;
    let birchIndex = 0;
    for (let i = 0; i < count + deciduousCount; i += 1) {
      const radius = 64 + Math.pow(this.seededRandom(i * 5), 0.7) * 150;
      const angle = this.seededRandom(i * 5 + 1) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const ground = terrainHeight(x, z) - 0.2;
      const height = 6 + this.seededRandom(i * 5 + 2) * 9;
      const isBirch = i % 5 === 4 && birchIndex < deciduousCount;
      dummy.rotation.set(0, this.seededRandom(i * 5 + 3) * Math.PI * 2, 0);
      if (isBirch) {
        const trunkHeight = height * 0.6;
        dummy.position.set(x, ground + trunkHeight / 2, z);
        dummy.scale.set(1, trunkHeight, 1);
        dummy.updateMatrix();
        birchTrunks.setMatrixAt(birchIndex++, dummy.matrix);
        for (let blob = 0; blob < 3; blob++) {
          const size = height * (0.24 - blob * 0.04);
          dummy.position.set(x + (this.seededRandom(i + blob) - 0.5) * 1.6, ground + height * (0.62 + blob * 0.14), z + (this.seededRandom(i * 2 + blob) - 0.5) * 1.6);
          dummy.scale.set(size, size * 0.85, size);
          dummy.updateMatrix();
          leaves.setMatrixAt(leafIndex, dummy.matrix);
          tint.setHex(blob % 2 ? 0x6d7f3a : 0x5b7034).multiplyScalar(0.85 + this.seededRandom(i * 7 + blob) * 0.3);
          leaves.setColorAt(leafIndex++, tint);
        }
        continue;
      }
      if (pineIndex >= count) continue;
      dummy.position.set(x, ground + height * 0.3, z);
      dummy.scale.set(1, height * 0.6, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(pineIndex++, dummy.matrix);
      tint.setScalar(0.75 + this.seededRandom(i * 9) * 0.4);
      for (let layer = 0; layer < layers; layer++) {
        const crownRadius = height * (0.23 - layer * 0.04);
        dummy.position.set(x, ground + height * (0.38 + layer * 0.16), z);
        dummy.rotation.y += 0.9;
        dummy.scale.set(crownRadius, height * (0.34 - layer * 0.03), crownRadius);
        dummy.updateMatrix();
        crowns.setMatrixAt(crownIndex, dummy.matrix);
        crowns.setColorAt(crownIndex++, tint);
      }
    }
    trunks.count = pineIndex;
    crowns.count = crownIndex;
    leaves.count = leafIndex;
    birchTrunks.count = birchIndex;
    for (const mesh of [trunks, crowns, leaves, birchTrunks]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }
}
