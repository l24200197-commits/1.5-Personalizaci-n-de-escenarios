export const GAME_CONFIG = {
  assets: {
    // Escenario activo. Para volver a la ciudad anterior basta con cambiar
    // esta ruta por './assets/models/city/scene.gltf'.
    scenario: './assets/models/ruined_city/scene.gltf',
    weapon: './assets/models/weapon/scene.gltf',
    character: './assets/models/character/scene.gltf',
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
    spawn: [-1, 1.2, -8],
    // El punto de aparición se corrige al cargar el escenario: se lanza un rayo
    // hacia abajo para dejar al personaje sobre el suelo real y no dentro de un
    // edificio. Si falla, se usa el valor de 'spawn' tal cual.
    autoSpawn: {
      enabled: true,
      rayHeight: 40,
      minHeadroom: 2.0,
      searchRadius: 6,
    },
  },
  character: {
    // El modelo viene normalizado a 1.0 de alto: se reescala a la estatura real
    // y se reposiciona para que los pies queden en el origen del grupo.
    targetHeight: 1.75,
    // El grupo del jugador mira hacia -Z (igual que el arma). Si el personaje
    // aparece de espaldas, cambia este valor entre 0 y Math.PI.
    yawOffset: Math.PI,
    yOffset: 0,
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
    origin: [-1, 0.36, -12],
  }
};
