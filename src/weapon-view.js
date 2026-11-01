import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WEAPONS } from './config.js';

const { clamp, lerp } = THREE.MathUtils;

function addPart(parent, geometry, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

export class WeaponView {
  constructor(camera) {
    this.camera = camera;
    this.models = new Map();
    this.initialize();
  }

  initialize() {
    this.weaponRig = new THREE.Group();
    this.camera.add(this.weaponRig);
    this.weaponLight = new THREE.PointLight(0xeef4f0, 1.35, 3.2, 1.4);
    this.weaponLight.position.set(0.24, 0.14, -0.32);
    this.camera.add(this.weaponLight);
    this.muzzleLight = new THREE.PointLight(0xffa640, 0, 4.8, 2);
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

    const addMesh = (geometry, material, position, rotation) => addPart(model, geometry, material, position, rotation);

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

  createShotgunModel() {
    const model = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x2a2f2e, roughness: 0.36, metalness: 0.85 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x16191a, roughness: 0.3, metalness: 0.9 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xaab2b6, roughness: 0.22, metalness: 0.92 });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x1d1f1d, roughness: 0.82, metalness: 0.06 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x121413, roughness: 0.95, metalness: 0.02 });
    const shellBody = new THREE.MeshStandardMaterial({ color: 0x9b241d, roughness: 0.48, metalness: 0.08 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc8a34b, roughness: 0.28, metalness: 0.88 });
    const fiber = new THREE.MeshBasicMaterial({ color: 0x7aff4a });
    const addMesh = (g, m, p, r) => addPart(model, g, m, p, r);

    // Låda med avrundad ovansida, utkastarport och slutstycke.
    addMesh(new RoundedBoxGeometry(0.165, 0.165, 0.56, 4, 0.028), steel, [0, 0.01, -0.12]);
    addMesh(new RoundedBoxGeometry(0.145, 0.05, 0.48, 3, 0.02), steel, [0, 0.085, -0.12]);
    addMesh(new THREE.BoxGeometry(0.018, 0.062, 0.19), chrome, [0.078, 0.025, -0.17]);
    addMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.055, 8), darkSteel, [0.105, 0.025, -0.23], [0, 0, Math.PI / 2]);

    // Toppskena och ghost-ring-sikte bak.
    addMesh(new THREE.BoxGeometry(0.095, 0.018, 0.36), darkSteel, [0, 0.112, -0.1]);
    for (let i = 0; i < 8; i++) addMesh(new THREE.BoxGeometry(0.105, 0.016, 0.018), darkSteel, [0, 0.123, 0.04 - i * 0.042]);
    addMesh(new THREE.BoxGeometry(0.11, 0.045, 0.06), darkSteel, [0, 0.138, 0.04]);
    addMesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16), darkSteel, [0, 0.165, 0.05]);

    // Övre pipa med ventilerad spång, korn och undre magasinrör.
    addMesh(new THREE.CylinderGeometry(0.028, 0.031, 0.96, 16), darkSteel, [0, 0.048, -0.84], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.88, 14), steel, [0, -0.02, -0.8], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.CylinderGeometry(0.031, 0.031, 0.05, 14), darkSteel, [0, -0.02, -1.24], [Math.PI / 2, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.074, 0.125, 0.06, 2, 0.01), darkSteel, [0, 0.014, -1.08]);
    addMesh(new THREE.BoxGeometry(0.032, 0.014, 0.88), darkSteel, [0, 0.088, -0.82]);
    for (let i = 0; i < 11; i++) addMesh(new THREE.BoxGeometry(0.028, 0.016, 0.025), darkSteel, [0, 0.075, -0.44 - i * 0.075]);
    addMesh(new THREE.BoxGeometry(0.024, 0.042, 0.045), darkSteel, [0, 0.095, -1.27]);
    addMesh(new THREE.CylinderGeometry(0.007, 0.007, 0.035, 8), fiber, [0, 0.112, -1.27], [Math.PI / 2, 0, 0]);

    // Räfflat pumphandtag på glidskenor.
    addMesh(new RoundedBoxGeometry(0.155, 0.125, 0.34, 4, 0.032), polymer, [0, -0.038, -0.62]);
    for (let i = 0; i < 9; i++) {
      addMesh(new RoundedBoxGeometry(0.165, 0.11, 0.016, 2, 0.005), rubber, [0, -0.042, -0.48 - i * 0.034]);
    }
    for (const side of [-0.048, 0.048]) addMesh(new THREE.BoxGeometry(0.01, 0.018, 0.28), chrome, [side, -0.02, -0.36]);

    // Patronhållare med 5 synliga kaliber 12-patroner på vänster sida.
    addMesh(new RoundedBoxGeometry(0.022, 0.11, 0.34, 2, 0.006), polymer, [-0.092, 0.01, -0.13]);
    for (let i = 0; i < 5; i++) {
      const z = -0.26 + i * 0.062;
      addMesh(new THREE.CylinderGeometry(0.019, 0.019, 0.095, 10), shellBody, [-0.112, 0.022, z]);
      addMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.028, 10), brass, [-0.112, -0.032, z]);
    }

    // Kolv, gummibakkappa, pistolgrepp och varbygel.
    addMesh(new RoundedBoxGeometry(0.145, 0.15, 0.24, 3, 0.024), polymer, [0, -0.025, 0.26], [-0.14, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.15, 0.27, 0.34, 3, 0.028), polymer, [0, -0.055, 0.52], [-0.06, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.158, 0.285, 0.04, 3, 0.014), rubber, [0, -0.06, 0.7], [-0.06, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.13, 0.055, 0.24, 3, 0.018), rubber, [0, 0.082, 0.48], [-0.04, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.11, 0.27, 0.13, 3, 0.022), rubber, [0, -0.2, 0.12], [-0.24, 0, 0]);
    addMesh(new THREE.TorusGeometry(0.058, 0.01, 6, 16, Math.PI), darkSteel, [0, -0.125, -0.01], [0, Math.PI / 2, Math.PI / 2]);
    return model;
  }

  createCAR15Model() {
    const model = new THREE.Group();
    const gunmetal = new THREE.MeshStandardMaterial({ color: 0x262b2d, roughness: 0.42, metalness: 0.78 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x161a1c, roughness: 0.32, metalness: 0.88 });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x1a1d1e, roughness: 0.76, metalness: 0.08 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x121415, roughness: 0.94, metalness: 0.02 });
    const magMat = new THREE.MeshStandardMaterial({ color: 0x3a3f3d, roughness: 0.5, metalness: 0.68 });
    const addMesh = (g, m, p, r) => addPart(model, g, m, p, r);

    // Övre och undre AR-låda med magasinsbrunn, manöverhandtag och frammatare.
    addMesh(new RoundedBoxGeometry(0.185, 0.145, 0.46, 3, 0.022), gunmetal, [0, 0.04, -0.1]);
    addMesh(new RoundedBoxGeometry(0.175, 0.14, 0.34, 3, 0.02), gunmetal, [0, -0.075, -0.04]);
    addMesh(new RoundedBoxGeometry(0.185, 0.15, 0.16, 2, 0.016), gunmetal, [0, -0.12, -0.16], [0.06, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.14, 0.04, 0.09, 2, 0.01), steel, [0, 0.095, 0.16]);
    addMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.09, 10), steel, [0.105, 0.03, 0.09], [Math.PI / 2, 0.32, 0]);
    addMesh(new THREE.BoxGeometry(0.018, 0.055, 0.14), steel, [0.096, 0.035, -0.13]);

    // Klassiskt bärhandtag med bakre hålsikte.
    addMesh(new RoundedBoxGeometry(0.11, 0.038, 0.38, 2, 0.01), gunmetal, [0, 0.195, -0.09]);
    addMesh(new RoundedBoxGeometry(0.12, 0.09, 0.075, 2, 0.012), gunmetal, [0, 0.145, 0.065]);
    addMesh(new RoundedBoxGeometry(0.115, 0.09, 0.07, 2, 0.012), gunmetal, [0, 0.145, -0.245]);
    addMesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 12), steel, [0.068, 0.185, 0.065], [0, 0, Math.PI / 2]);
    addMesh(new THREE.TorusGeometry(0.018, 0.005, 6, 14), steel, [0, 0.222, 0.075]);

    // Rundat räfflat CAR-15-handskydd med delningsring.
    addMesh(new THREE.CylinderGeometry(0.118, 0.122, 0.045, 16), steel, [0, 0.025, -0.35], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.CylinderGeometry(0.1, 0.112, 0.38, 18), polymer, [0, 0.025, -0.56], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      addMesh(new THREE.TorusGeometry(0.105 - i * 0.0012, 0.009, 6, 18), rubber, [0, 0.025, -0.4 - i * 0.042]);
    }
    addMesh(new THREE.CylinderGeometry(0.098, 0.098, 0.025, 16), steel, [0, 0.025, -0.76], [Math.PI / 2, 0, 0]);

    // A2-kornhus (triangulär profil), kort pipa och XM177-moderator.
    const fsb = new THREE.Group();
    fsb.position.set(0, 0.025, -0.82);
    addPart(fsb, new THREE.BoxGeometry(0.055, 0.17, 0.09), steel, [0, 0.08, 0], [-0.22, 0, 0]);
    addPart(fsb, new THREE.BoxGeometry(0.055, 0.05, 0.11), steel, [0, 0.165, -0.01]);
    for (const side of [-0.022, 0.022]) addPart(fsb, new THREE.BoxGeometry(0.008, 0.035, 0.04), steel, [side, 0.195, -0.01]);
    addPart(fsb, new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6), steel, [0, 0.19, -0.01]);
    addPart(fsb, new THREE.BoxGeometry(0.045, 0.04, 0.05), steel, [0, -0.05, 0.01]);
    model.add(fsb);
    addMesh(new THREE.CylinderGeometry(0.024, 0.027, 0.32, 14), steel, [0, 0.025, -0.92], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.CylinderGeometry(0.042, 0.042, 0.22, 16), steel, [0, 0.025, -1.16], [Math.PI / 2, 0, 0]);
    addMesh(new THREE.TorusGeometry(0.043, 0.006, 6, 16), gunmetal, [0, 0.025, -1.07]);

    // Justerbar CAR-15-kolv på bufferttub.
    addMesh(new THREE.CylinderGeometry(0.046, 0.046, 0.44, 14), gunmetal, [0, 0.035, 0.35], [Math.PI / 2, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.135, 0.11, 0.28, 3, 0.022), polymer, [0, 0.03, 0.48]);
    addMesh(new RoundedBoxGeometry(0.125, 0.25, 0.09, 3, 0.02), polymer, [0, -0.04, 0.6], [-0.06, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.09, 0.07, 0.22, 2, 0.015), polymer, [0, -0.1, 0.46], [0.32, 0, 0]);
    addMesh(new RoundedBoxGeometry(0.132, 0.26, 0.028, 2, 0.01), rubber, [0, -0.04, 0.65], [-0.06, 0, 0]);

    // A2-pistolgrepp, varbygel och 30-skotts STANAG-magasin i grå aluminium.
    addMesh(new RoundedBoxGeometry(0.115, 0.29, 0.135, 3, 0.022), polymer, [0, -0.22, 0.055], [-0.26, 0, 0]);
    addMesh(new THREE.BoxGeometry(0.12, 0.022, 0.03), polymer, [0, -0.19, -0.015]);
    addMesh(new THREE.TorusGeometry(0.06, 0.009, 6, 14, Math.PI), steel, [0, -0.15, -0.075], [0, Math.PI / 2, Math.PI / 2]);
    const mag = new THREE.Group();
    mag.position.set(0, -0.195, -0.165);
    for (const [y, z, angle] of [[-0.02, 0, -0.02], [-0.115, 0.01, -0.07], [-0.21, 0.03, -0.13]]) {
      addPart(mag, new RoundedBoxGeometry(0.118, 0.12, 0.16, 2, 0.012), magMat, [0, y, z], [angle, 0, 0]);
      for (const offset of [-0.035, 0.025]) {
        addPart(mag, new THREE.BoxGeometry(0.124, 0.09, 0.014), magMat, [0, y, z + offset], [angle, 0, 0]);
      }
    }
    model.add(mag);
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
    let muzzleZ = -1.29;
    let muzzleY = 0.025;
    if (weapon.id === 'ak5') {
      group.add(this.createAK5CModel());
      muzzleZ = -1.43;
      muzzleY = 0.015;
    } else if (weapon.id === 'shotgun') {
      group.add(this.createShotgunModel());
      muzzleZ = -1.35;
      muzzleY = 0.048;
    } else {
      group.add(this.createCAR15Model());
    }

    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffd06a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 7), flashMaterial);
    this.muzzleFlash.rotation.x = -Math.PI / 2;
    this.muzzleFlash.position.set(0, muzzleY, muzzleZ);
    const cross = new THREE.PlaneGeometry(0.28, 0.28);
    for (const angle of [0, Math.PI / 2]) {
      const fin = new THREE.Mesh(cross, flashMaterial);
      fin.rotation.x = Math.PI / 2;
      fin.rotation.z = angle;
      this.muzzleFlash.add(fin);
    }
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
