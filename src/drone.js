import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRONE_TYPES } from './config.js';
const { clamp, lerp } = THREE.MathUtils;

function createRotorTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1;
      const dy = (y + 0.5) / size * 2 - 1;
      const r = Math.hypot(dx, dy);
      const ring = r < 1 && r > 0.14 ? (1 - Math.abs(r - 0.62) * 1.4) * (1 - Math.pow(r, 4)) : 0;
      const alpha = Math.max(0, Math.min(1, ring)) * 0.55;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 32;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const ROTOR_TEXTURE = createRotorTexture();
const CORNERS = [
  [-0.5, -0.78, -0.44],
  [0.5, 0.78, -0.44],
  [-0.5, 0.78, 0.44],
  [0.5, -0.78, 0.44]
];

function placed(geometry, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(1, 1, 1)
  );
  clone.applyMatrix4(matrix);
  // Some built-in geometries omit uv; normalize attributes for mergeGeometries.
  if (!clone.attributes.uv) {
    clone.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(clone.attributes.position.count * 2), 2));
  }
  return clone;
}

let sharedAssets;
function getAssets() {
  if (sharedAssets) return sharedAssets;
  const materials = {
    metal: new THREE.MeshStandardMaterial({ color: 0x22272a, roughness: 0.32, metalness: 0.85 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb56d32, roughness: 0.35, metalness: 0.85 }),
    prop: new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.35, metalness: 0.4 }),
    disc: new THREE.MeshBasicMaterial({ map: ROTOR_TEXTURE, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    battery: new THREE.MeshStandardMaterial({ color: 0x2c5678, roughness: 0.55, metalness: 0.15 }),
    strap: new THREE.MeshStandardMaterial({ color: 0xc28a2e, roughness: 0.85 }),
    warhead: new THREE.MeshStandardMaterial({ color: 0x56623f, roughness: 0.72, metalness: 0.22 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x102832, roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
    carbon: {},
    led: {}
  };

  const blade = new THREE.BoxGeometry(0.76, 0.012, 0.058);
  const bladesGeometry = mergeGeometries([placed(blade), placed(blade, [0, 0, 0], [0, Math.PI / 2, 0])]);
  const discGeometry = new THREE.CircleGeometry(0.39, 16);
  discGeometry.rotateX(-Math.PI / 2);
  discGeometry.translate(0, 0.004, 0);

  const copperParts = [];
  for (const [x, z] of [[-0.22, -0.28], [0.22, -0.28], [-0.22, 0.28], [0.22, 0.28]]) {
    copperParts.push(placed(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 6), [x, 0, z]));
  }
  const winding = new THREE.CylinderGeometry(0.085, 0.085, 0.082, 10);
  CORNERS.forEach(([x, , z]) => copperParts.push(placed(winding, [x, 0.04, z])));
  const copperGeometry = mergeGeometries(copperParts);

  const strapParts = [
    placed(new THREE.BoxGeometry(0.34, 0.175, 0.045), [0, 0.165, -0.12]),
    placed(new THREE.BoxGeometry(0.34, 0.175, 0.045), [0, 0.165, 0.1]),
    placed(new THREE.CylinderGeometry(0.042, 0.042, 0.07, 8), [0, 0.29, -0.4])
  ];
  const strapGeometry = mergeGeometries(strapParts);
  const batteryGeometry = placed(new RoundedBoxGeometry(0.32, 0.16, 0.44, 2, 0.025), [0, 0.165, -0.02]);
  const glassGeometry = placed(new THREE.SphereGeometry(0.06, 10, 6), [0, 0.01, 0.43]);
  const ledSphere = new THREE.SphereGeometry(0.036, 8, 6);
  const ledGeometry = mergeGeometries([placed(ledSphere, [-0.24, 0.02, 0.37]), placed(ledSphere, [0.24, 0.02, 0.37])]);
  const hitGeometry = new THREE.BoxGeometry(1.45, 0.55, 1.35);

  const byType = {};
  for (const [type, stats] of Object.entries(DRONE_TYPES)) {
    materials.carbon[type] = new THREE.MeshStandardMaterial({ color: stats.color, roughness: 0.45, metalness: 0.5 });
    const ledColor = type === 'armored' ? 0xffa020 : type === 'strike' ? 0xff2620 : 0x35e0ff;
    materials.led[type] = new THREE.MeshStandardMaterial({ color: ledColor, emissive: ledColor, emissiveIntensity: 5, roughness: 0.2 });

    const plate = new RoundedBoxGeometry(0.56, 0.032, 0.72, 2, 0.01);
    const arm = new RoundedBoxGeometry(0.08, 0.042, 0.62, 2, 0.01);
    const carbonParts = [
      placed(plate, [0, -0.075, 0]),
      placed(plate, [0, 0.075, 0]),
      placed(new RoundedBoxGeometry(0.24, 0.18, 0.14, 2, 0.015), [0, 0.01, 0.34]),
      placed(new THREE.CylinderGeometry(0.012, 0.014, 0.24, 6), [0, 0.18, -0.36], [-0.35, 0, 0])
    ];
    CORNERS.forEach(([x, angle, z]) => {
      carbonParts.push(placed(arm, [x * 0.56, 0, z * 0.56], [0, angle, 0]));
      if (type === 'armored') {
        carbonParts.push(placed(new THREE.TorusGeometry(0.41, 0.022, 6, 16), [x, 0.055, z], [Math.PI / 2, 0, 0]));
      }
    });

    const payloadRadius = type === 'armored' ? 0.14 : type === 'strike' ? 0.115 : 0.09;
    const bell = new THREE.CylinderGeometry(0.11, 0.11, 0.075, 12);
    const metalParts = [
      placed(new RoundedBoxGeometry(0.42, 0.12, 0.52, 2, 0.02)),
      placed(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 12), [0, 0.01, 0.39], [Math.PI / 2, 0, 0]),
      placed(new THREE.ConeGeometry(payloadRadius * 0.75, 0.18, 10), [0, -0.17, 0.41], [Math.PI / 2, 0, 0])
    ];
    CORNERS.forEach(([x, , z]) => metalParts.push(placed(bell, [x, 0.045, z])));

    byType[type] = {
      carbon: mergeGeometries(carbonParts),
      metal: mergeGeometries(metalParts),
      warhead: placed(new THREE.CylinderGeometry(payloadRadius * 0.75, payloadRadius, 0.56, 10), [0, -0.17, 0.04], [Math.PI / 2, 0, 0])
    };
  }

  sharedAssets = { materials, bladesGeometry, discGeometry, copperGeometry, strapGeometry, batteryGeometry, glassGeometry, ledGeometry, hitGeometry, byType };
  return sharedAssets;
}

export class Drone {
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
    const assets = getAssets();
    const { materials } = assets;
    const typeGeo = assets.byType[this.type];
    const group = new THREE.Group();

    const carbon = new THREE.Mesh(typeGeo.carbon, materials.carbon[this.type]);
    carbon.castShadow = true;
    const metal = new THREE.Mesh(typeGeo.metal, materials.metal);
    metal.castShadow = true;
    const warhead = new THREE.Mesh(typeGeo.warhead, materials.warhead);
    warhead.castShadow = true;
    const battery = new THREE.Mesh(assets.batteryGeometry, materials.battery);
    battery.castShadow = true;
    group.add(
      carbon,
      metal,
      warhead,
      battery,
      new THREE.Mesh(assets.copperGeometry, materials.copper),
      new THREE.Mesh(assets.strapGeometry, materials.strap),
      new THREE.Mesh(assets.glassGeometry, materials.glass),
      new THREE.Mesh(assets.ledGeometry, materials.led[this.type])
    );

    this.rotors = [];
    CORNERS.forEach(([x, , z], index) => {
      const rotor = new THREE.Group();
      rotor.position.set(x, 0.095, z);
      rotor.rotation.y = index * 0.8;
      rotor.add(new THREE.Mesh(assets.bladesGeometry, materials.prop), new THREE.Mesh(assets.discGeometry, materials.disc));
      group.add(rotor);
      this.rotors.push(rotor);
    });

    this.hitBox = new THREE.Mesh(assets.hitGeometry, materials.hit);
    this.hitBox.userData.drone = this;
    group.add(this.hitBox);

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
    desired.add(this.game.world.getDroneAvoidance(this.group.position, desired, 0.62 * this.stats.scale));

    this.velocity.lerp(desired, 1 - Math.exp(-dt * 2.8));
    const movement = this.game.world.resolveDroneMovement(
      this.group.position,
      this.velocity.clone().multiplyScalar(dt),
      0.62 * this.stats.scale,
      dt
    );
    this.group.position.copy(movement.position);
    if (movement.collided) this.velocity.y = Math.max(this.velocity.y, this.stats.speed * 0.42);
    this.group.position.y = Math.max(1.35, this.group.position.y);

    const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
    this.group.rotation.y = lerp(this.group.rotation.y, targetRotation, dt * 4.5);
    this.group.rotation.z = clamp(-this.velocity.x * 0.035, -0.3, 0.3);
    this.group.rotation.x = clamp(this.velocity.y * 0.03, -0.2, 0.2);

    const currentDistance = this.group.position.distanceTo(player);
    if (currentDistance < 2.25 && this.game.world.hasClearLineOfSight(this.group.position, player)) {
      this.alive = false;
      this.game.droneDetonation(this, this.stats.damage);
    }
  }

  takeDamage(amount, point) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.game.effectsSystem.spawnImpact(point, this.hp <= 0 ? 0xff7b32 : 0xffd17a);
    if (this.hp <= 0) {
      this.alive = false;
      this.game.destroyDrone(this);
      return true;
    }
    return false;
  }

  dispose() {
    this.game.scene.remove(this.group);
  }
}
