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
  tower: {
    enabled: true,
    // Posición de la torre. Por defecto se coloca enfrente del jugador: el
    // jugador aparece mirando hacia -Z, así que este desplazamiento la deja a
    // la vista al iniciar, sin caer encima del punto de aparición.
    offsetFromSpawn: [0, 0, -7],
    // Para fijarla en coordenadas absolutas del escenario, pon aquí [x, y, z]
    // y se ignorará offsetFromSpawn. La Y se recalcula sobre el suelo real.
    position: null,
    // Bloques por nivel, de abajo hacia arriba. Total actual: 16 bloques.
    rows: [4, 4, 3, 3, 2],
    // Proporciones de torre: 2.78 m de alto por 1.92 de ancho. Con bloques más
    // anchos el conjunto resultaba más ancho que alto (un muro) y no volcaba.
    blockWidth: 0.45,
    blockHeight: 0.55,
    blockDepth: 0.5,
    // Holgura horizontal entre bloques para que no nazcan interpenetrados.
    spacing: 0.04,
    // Holgura vertical: deliberadamente mínima, para que la torre se asiente
    // en vez de caer desde varios centímetros y desmoronarse al cargar.
    verticalSpacing: 0.005,
    mass: 1.5,
    friction: 0.4,
    restitution: 0.02,
    groundFriction: 0.6,
    linearDamping: 0.08,
    angularDamping: 0.14,
    // --- Fuerza de los disparos sobre la torre ---
    // El impacto actúa como onda expansiva: empuja todos los bloques dentro de
    // blastRadius con caída lineal. Subir impactDeltaV o blastRadius para
    // derribarla más fácil; bajarlos para que cueste más.
    // Cambio de velocidad (m/s) que recibe un bloque en el centro del impacto.
    impactDeltaV: 11,
    // Radio de la onda en metros.
    blastRadius: 1.25,
    // Reparto entre la dirección del proyectil (1) y la radial desde el
    // impacto (0). 0.55 conserva la dirección del disparo y a la vez dispersa.
    forwardShare: 0.55,
    // Margen de la losa estática invisible que sostiene la torre. Conviene que
    // sea amplio: los bloques que salgan despedidos siguen teniendo suelo bajo
    // ellos en vez de atravesar la calle.
    padMargin: 3.0,
    // Búsqueda del suelo, igual que el punto de aparición del jugador.
    rayHeight: 40,
    minHeadroom: 3.5,
    searchRadius: 5,
  },
  dynamicBoxes: {
    size: 0.65,
    count: 12,
    origin: [-1, 0.36, -12],
  }
};
