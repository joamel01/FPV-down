import * as THREE from 'three';
import { DRONE_TYPES } from './config.js';
const { clamp, lerp } = THREE.MathUtils;

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
    this.group.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
      else child.material.dispose();
    });
  }
}
