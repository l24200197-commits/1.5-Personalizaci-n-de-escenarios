export const GAME_CONFIG = {
  assets: {
    scenario: './assets/models/city/scene.gltf',
    weapon: './assets/models/weapon/scene.gltf',
    character: null,
  },
  world: {
    fallbackFloorY: -2.2,
  },
  player: {
    walkSpeed: 5.5,
    runSpeed: 9.0,
    jumpSpeed: 9.2,
    gravity: 28,
    capsuleRadius: 0.35,
    capsuleStartY: 0.35,
    capsuleEndY: 1.0,
    spawn: [0, 0.35, 0],
  },
  camera: {
    distance: 5.4,
    minDistance: 2.0,
    maxDistance: 8.5,
    height: 1.25,
    sensitivity: 0.0022,
    pitchMin: -0.45,
    pitchMax: 0.75,
    smoothing: 12,
  },
  weapon: {
    targetLength: 1.35,
    mountPosition: [0.34, 1.08, -0.18],
    mountRotation: [0, 0, 0],
    forwardAxis: '-z',
  },
  projectiles: {
    poolSize: 45,
    radius: 0.11,
    speed: 31,
    gravity: 15,
    lifetime: 5,
    cooldownMs: 240,
  },
  dynamicBoxes: {
    size: 0.65,
    count: 12,
    origin: [4.5, 0.36, -2.2],
  }
};
