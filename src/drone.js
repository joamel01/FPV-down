import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
    const group = new THREE.Group();
    const carbon = new THREE.MeshStandardMaterial({ color: this.stats.color, roughness: 0.45, metalness: 0.5 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x22272a, roughness: 0.32, metalness: 0.85 });
    const copper = new THREE.MeshStandardMaterial({ color: 0xb56d32, roughness: 0.35, metalness: 0.85 });
    const propMaterial = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.35, metalness: 0.4 });
    const discMaterial = new THREE.MeshBasicMaterial({ map: ROTOR_TEXTURE, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const batteryMaterial = new THREE.MeshStandardMaterial({ color: 0x2c5678, roughness: 0.55, metalness: 0.15 });
    const strapMaterial = new THREE.MeshStandardMaterial({ color: 0xc28a2e, roughness: 0.85 });
    const warheadMaterial = new THREE.MeshStandardMaterial({ color: 0x56623f, roughness: 0.72, metalness: 0.22 });

    // Två kolfiberplattor med distanser emellan.
    for (const y of [-0.075, 0.075]) {
      const plate = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.032, 0.72, 2, 0.01), carbon);
      plate.position.y = y;
      plate.castShadow = true;
      group.add(plate);
    }
    const core = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.12, 0.52, 2, 0.02), metal);
    core.castShadow = true;
    group.add(core);
    for (const [x, z] of [[-0.22, -0.28], [0.22, -0.28], [-0.22, 0.28], [0.22, 0.28]]) {
      const standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 8), copper);
      standoff.position.set(x, 0, z);
      group.add(standoff);
    }

    // FPV-kamera i skyddsbur framtill.
    const camMount = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.18, 0.14, 2, 0.015), carbon);
    camMount.position.set(0, 0.01, 0.34);
    group.add(camMount);
    const camera = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 14), metal);
    camera.rotation.x = Math.PI / 2;
    camera.position.set(0, 0.01, 0.39);
    group.add(camera);
    const cameraGlass = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0x102832, roughness: 0.05, metalness: 0.3, clearcoat: 1 }));
    cameraGlass.position.set(0, 0.01, 0.43);
    group.add(cameraGlass);

    // LiPo-batteri på ovansidan med spännband, samt verkansdel undertill.
    const battery = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.16, 0.44, 3, 0.025), batteryMaterial);
    battery.position.set(0, 0.165, -0.02);
    battery.castShadow = true;
    group.add(battery);
    for (const z of [-0.12, 0.1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.175, 0.045), strapMaterial);
      strap.position.set(0, 0.165, z);
      group.add(strap);
    }
    const payloadRadius = this.type === 'armored' ? 0.14 : this.type === 'strike' ? 0.115 : 0.09;
    const payload = new THREE.Mesh(new THREE.CylinderGeometry(payloadRadius * 0.75, payloadRadius, 0.56, 12), warheadMaterial);
    payload.rotation.x = Math.PI / 2;
    payload.position.set(0, -0.17, 0.04);
    payload.castShadow = true;
    group.add(payload);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(payloadRadius * 0.75, 0.18, 12), metal);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.17, 0.41);
    group.add(nose);

    // VTX-antenn baktill.
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.24, 6), carbon);
    stalk.position.set(0, 0.18, -0.36);
    stalk.rotation.x = -0.35;
    group.add(stalk);
    const lobe = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.07, 10), strapMaterial);
    lobe.position.set(0, 0.29, -0.4);
    group.add(lobe);

    this.rotors = [];
    const armGeometry = new RoundedBoxGeometry(0.08, 0.042, 0.62, 2, 0.01);
    const motorBell = new THREE.CylinderGeometry(0.11, 0.11, 0.075, 14);
    const motorWindings = new THREE.CylinderGeometry(0.085, 0.085, 0.082, 12);
    const bladeGeometry = new THREE.BoxGeometry(0.76, 0.012, 0.058);
    const discGeometry = new THREE.CircleGeometry(0.39, 20);
    discGeometry.rotateX(-Math.PI / 2);
    const corners = [
      [-0.5, -0.78, -0.44],
      [0.5, 0.78, -0.44],
      [-0.5, 0.78, 0.44],
      [0.5, -0.78, 0.44]
    ];

    corners.forEach(([x, angle, z], index) => {
      const arm = new THREE.Mesh(armGeometry, carbon);
      arm.rotation.y = angle;
      arm.position.set(x * 0.56, 0, z * 0.56);
      arm.castShadow = true;
      group.add(arm);

      const motor = new THREE.Mesh(motorBell, metal);
      motor.position.set(x, 0.045, z);
      motor.castShadow = true;
      group.add(motor);
      const coil = new THREE.Mesh(motorWindings, copper);
      coil.position.set(x, 0.04, z);
      group.add(coil);

      if (this.type === 'armored') {
        const guard = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.022, 6, 18), carbon);
        guard.rotation.x = Math.PI / 2;
        guard.position.set(x, 0.055, z);
        group.add(guard);
      }

      const rotor = new THREE.Group();
      rotor.position.set(x, 0.095, z);
      rotor.rotation.y = index * 0.8;
      for (const bladeAngle of [0, Math.PI / 2]) {
        const blade = new THREE.Mesh(bladeGeometry, propMaterial);
        blade.rotation.y = bladeAngle;
        rotor.add(blade);
      }
      const disc = new THREE.Mesh(discGeometry, discMaterial);
      disc.position.y = 0.004;
      rotor.add(disc);
      group.add(rotor);
      this.rotors.push(rotor);
    });

    const ledColor = this.type === 'armored' ? 0xffa020 : this.type === 'strike' ? 0xff2620 : 0x35e0ff;
    const ledMaterial = new THREE.MeshStandardMaterial({ color: ledColor, emissive: ledColor, emissiveIntensity: 5, roughness: 0.2 });
    for (const side of [-0.24, 0.24]) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), ledMaterial);
      led.position.set(side, 0.02, 0.37);
      group.add(led);
    }

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
    const geometries = new Set();
    const materials = new Set();
    this.group.traverse((child) => {
      if (!child.isMesh) return;
      geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
}
