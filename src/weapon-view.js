import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WEAPONS } from './config.js';

const { clamp, lerp } = THREE.MathUtils;

export class WeaponView {
  constructor(camera) {
    this.camera = camera;
    this.models = new Map();
    this.initialize();
  }

  initialize() {
    this.weaponRig = new THREE.Group();
    this.camera.add(this.weaponRig);
    this.weaponLight = new THREE.PointLight(0xe8f1ed, 1.9, 3.2, 1.4);
    this.weaponLight.position.set(0.2, 0.05, -0.35);
    this.camera.add(this.weaponLight);
    this.muzzleLight = new THREE.PointLight(0xffa640, 0, 4.5, 2);
    this.camera.add(this.muzzleLight);
    this.setWeaponModel(0);
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

  setWeaponModel(index) {
    if (this.weaponModel) {
      this.weaponModel.visible = false;
      this.muzzleFlash.material.opacity = 0;
    }
    if (this.models.has(index)) {
      const cached = this.models.get(index);
      this.weaponModel = cached.model;
      this.muzzleFlash = cached.flash;
      this.weaponModel.visible = true;
      this.weaponRig.rotation.set(-0.04, -0.035, -0.015);
      return;
    }

    const weapon = WEAPONS[index];
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
    this.models.set(index, { model: group, flash: this.muzzleFlash });
    this.weaponRig.position.set(0.36, -0.31, -0.69);
    this.weaponRig.rotation.set(-0.04, -0.035, -0.015);
  }

  update(dt, game) {
    game.recoil = lerp(game.recoil, 0, 1 - Math.exp(-dt * 13));
    game.swayX = lerp(game.swayX, 0, 1 - Math.exp(-dt * 7));
    game.swayY = lerp(game.swayY, 0, 1 - Math.exp(-dt * 7));
    const moving = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((key) => game.keys.has(key));
    const bob = moving ? 1 : 0.25;
    this.weaponRig.position.x = 0.36 + Math.sin(game.bobTime) * 0.008 * bob + game.swayX;
    this.weaponRig.position.y = -0.31 + Math.abs(Math.cos(game.bobTime * 0.5)) * 0.009 * bob - game.swayY - game.recoil * 0.26;
    this.weaponRig.position.z = -0.69 + game.recoil;
    this.weaponRig.rotation.z = -0.015 + Math.sin(game.bobTime * 0.5) * 0.006 * bob;
    const reloadProgress = game.isReloading ? clamp(1 - game.reloadTimer / WEAPONS[game.currentWeapon].reloadDuration, 0, 1) : 0;
    const reloadDip = Math.sin(reloadProgress * Math.PI);
    this.weaponRig.position.y -= reloadDip * 0.28;
    this.weaponRig.rotation.x = -0.04 + reloadDip * 0.48;
    this.weaponRig.rotation.z += reloadDip * 0.24;
    if (game.muzzleTimer > 0) {
      game.muzzleTimer -= dt;
      this.muzzleFlash.material.opacity = Math.random() * 0.85 + 0.15;
      this.muzzleFlash.rotation.z = Math.random() * Math.PI;
      this.muzzleLight.intensity = 6 + Math.random() * 7;
      const muzzlePosition = new THREE.Vector3(0.26, -0.17, -1).applyMatrix4(game.camera.matrixWorld);
      this.muzzleLight.position.copy(game.camera.worldToLocal(muzzlePosition));
    } else {
      this.muzzleFlash.material.opacity = 0;
      this.muzzleLight.intensity = 0;
    }
  }

  dispose() {
    const geometries = new Set();
    const materials = new Set();
    this.weaponRig.traverse(child => {
      if (!child.isMesh) return;
      geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.camera.remove(this.weaponRig, this.weaponLight, this.muzzleLight);
    this.weaponLight.dispose();
    this.muzzleLight.dispose();
    this.models.clear();
  }
}
