import * as THREE from 'three';
const { clamp } = THREE.MathUtils;

export class CollisionWorld {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.solidMeshes = [];
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

  resolveDroneMovement(start, delta, radius, dt) {
    const position = start.clone();
    let collided = false;
    const steps = Math.max(1, Math.ceil(delta.length() / Math.max(0.14, radius * 0.4)));
    const step = delta.clone().divideScalar(steps);
    const stepTime = dt / steps;

    for (let index = 0; index < steps; index += 1) {
      const next = position.clone().add(step);
      if (!this.sphereCollidesAt(next, radius)) {
        position.copy(next);
        continue;
      }

      collided = true;
      const climb = position.clone();
      climb.y += Math.max(9.6 * stepTime, step.length() * 0.9);
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
      slideY.y += Math.max(step.y, 6 * stepTime);
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
}
