export const WEAPONS = [
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

export const DRONE_TYPES = {
  scout: { hp: 58, speed: 10.5, scale: 0.82, score: 120, damage: 24, color: 0x2b3236 },
  strike: { hp: 92, speed: 8.4, scale: 1, score: 190, damage: 34, color: 0x303532 },
  armored: { hp: 155, speed: 6.5, scale: 1.18, score: 320, damage: 46, color: 0x434744 }
};

