import * as THREE from 'three';
import { CollisionWorld } from './collision.js';

export class World extends CollisionWorld {
  constructor(scene, renderer) {
    super(scene);
    this.renderer = renderer;
  }

  async create() {
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
    this.sun = sun;

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
    // Instance the static trees: three draw calls instead of 380 meshes.
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.28, 1, 7), trunkMaterial, 95);
    const crownGeometry = new THREE.ConeGeometry(1, 1, 8);
    const crowns = pineMaterials.map((material, index) => new THREE.InstancedMesh(crownGeometry, material, (index === 0 ? 48 : 47) * 3));
    const crownIndices = [0, 0];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 95; i += 1) {
      const radius = 67 + this.seededRandom(i * 5) * 64;
      const angle = this.seededRandom(i * 5 + 1) * Math.PI * 2;
      const height = 4.5 + this.seededRandom(i * 5 + 2) * 8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      dummy.rotation.set(0, this.seededRandom(i * 5 + 3) * Math.PI, 0);
      dummy.position.set(x, height * 0.29, z);
      dummy.scale.set(1, height * 0.58, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      for (let layer = 0; layer < 3; layer++) {
        const crownRadius = height * (0.21 - layer * 0.025);
        dummy.position.set(x, height * (0.48 + layer * 0.17), z);
        dummy.scale.set(crownRadius, height * 0.38, crownRadius);
        dummy.updateMatrix();
        crowns[i % 2].setMatrixAt(crownIndices[i % 2]++, dummy.matrix);
      }
    }
    for (const mesh of [trunks, ...crowns]) {
      mesh.castShadow = true;
      this.scene.add(mesh);
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
}
