import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { Octree } from 'three/addons/math/Octree.js';
import * as CANNON from 'cannon-es';
import { GAME_CONFIG } from '../config.js';
import { AssetLoader } from './AssetLoader.js';
import { StaticPhysicsBuilder } from '../physics/StaticPhysicsBuilder.js';
import { Player } from '../player/Player.js';
import { PlayerController } from '../player/PlayerController.js';
import { ThirdPersonCamera } from '../player/ThirdPersonCamera.js';
import { DynamicBoxes } from '../objects/DynamicBoxes.js';
import { BlockTower } from '../objects/BlockTower.js';
import { ProjectileSystem } from '../weapons/ProjectileSystem.js';
import { Weapon } from '../weapons/Weapon.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.config = GAME_CONFIG;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87bde0);
    this.scene.fog = new THREE.Fog(0x87bde0, 70, 155);

    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 500);
    this.camera.position.set(0, 2.3, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.worldOctree = new Octree();
    this.level = null;

    this.loader = new AssetLoader((pct, url) => {
      let name = 'arma';
      if (url.includes('/city/') || url.includes('/ruined_city/')) name = 'escenario';
      else if (url.includes('/character/')) name = 'personaje';
      this.setLoading(`Cargando ${name}... ${pct}%`);
    });

    this.physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    this.physicsWorld.allowSleep = true;
    this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld);
    // Una pila de cajas necesita más iteraciones del solver que unos objetos
    // sueltos; con el valor por defecto (10) la torre tiembla y se desmorona.
    this.physicsWorld.solver.iterations = 16;
    this.physicsWorld.defaultContactMaterial.friction = 0.5;

    this.stats = new Stats();
    this.stats.dom.style.top = '8px';
    this.stats.dom.style.left = '8px';
    this.container.appendChild(this.stats.dom);

    this._animate = this._animate.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onClick = this._onClick.bind(this);
    window.addEventListener('resize', this._onResize);
    this.renderer.domElement.addEventListener('click', this._onClick);
  }

  async init() {
    this._setupLights();
    this._setupFallbackGround();

    try {
      const gltf = await this.loader.loadGLTF(this.config.assets.scenario);
      this.level = gltf.scene;
      this.level.name = 'ScenarioLevel';
      this.scene.add(this.level);
      this.level.updateWorldMatrix(true, true);

      this.worldOctree.fromGraphNode(this.level);
      this.level.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material?.map) child.material.map.anisotropy = 4;
      });

      // Colisionadores de caja: son los que realmente detienen a las cajas
      // dinámicas, porque cannon-es no resuelve Box<->Trimesh.
      const colliders = StaticPhysicsBuilder.buildBoxColliders(this.level, this.physicsWorld);
      this.levelColliderBoxes = colliders.boxes;

      // El Trimesh solo sirve para cuerpos de esfera, y este proyecto no tiene
      // ninguno: el jugador usa Octree y los proyectiles son esferas propias,
      // no cuerpos de cannon. Construirlo cuesta varios cientos de miles de
      // triángulos a cambio de nada, así que queda desactivado por defecto.
      if (this.config.world.trimeshCollider) {
        this.staticPhysicsBody = StaticPhysicsBuilder.buildTrimesh(this.level, this.physicsWorld);
      }
    } catch (error) {
      this.setLoading(error.message, true);
      throw error;
    }

    this.player = new Player(this.scene, this.worldOctree, this.config.player);
    this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.renderer.domElement, this.config.camera);
    this.thirdPersonCamera.setStaticScene(this.level);
    this.controller = new PlayerController(this.player, this.thirdPersonCamera);

    this._placePlayerOnGround();

    this.boxes = new DynamicBoxes(this.scene, this.physicsWorld, this._resolveBoxesConfig());
    this.player.setDynamicBoxes(this.boxes);
    this.projectiles = new ProjectileSystem(this.scene, this.worldOctree, this.boxes, this.config.projectiles);

    this._buildTower();

    await this._loadCharacter();
    await this._loadWeapon();

    this.setLoading('Listo. Haz clic en la pantalla para jugar.');
    setTimeout(() => document.getElementById('loading')?.classList.add('hidden'), 2200);
    this.renderer.setAnimationLoop(this._animate);
  }

  async _loadCharacter() {
    if (!this.config.assets.character) return;

    try {
      const gltf = await this.loader.loadGLTF(this.config.assets.character);
      this.player.attachModel(gltf.scene, this.config.character);
    } catch (error) {
      console.warn('No se pudo cargar el personaje 3D. Se usará el provisional.', error);
    }
  }

  /**
   * Busca suelo firme bajo el punto de aparición configurado. Cada escenario
   * tiene su propia altura y distribución, así que en lugar de fijar una Y a
   * mano se lanza un rayo hacia abajo; si el punto está dentro de un edificio
   * (sin espacio libre encima) se prueban puntos cercanos en espiral.
   */
  /**
   * Busca suelo despejado bajo un punto. Lanza un rayo hacia abajo y, si ese
   * punto está dentro de un edificio (sin altura libre encima), prueba puntos
   * cercanos en espiral. Devuelve el punto sobre el suelo o null.
   */
  _findGroundPoint(x, z, options = {}, clearance = null) {
    if (!this.level) return null;

    const rayHeight = options.rayHeight ?? 40;
    const minHeadroom = options.minHeadroom ?? 2;
    const searchRadius = options.searchRadius ?? 6;

    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();

    const candidates = [[0, 0]];
    for (const r of [searchRadius * 0.5, searchRadius]) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        candidates.push([Math.cos(angle) * r, Math.sin(angle) * r]);
      }
    }

    for (const [ox, oz] of candidates) {
      origin.set(x + ox, rayHeight, z + oz);
      raycaster.set(origin, down);
      const hits = raycaster.intersectObject(this.level, true);
      if (!hits.length) continue;

      const ground = hits[0];
      const headroom = hits.length > 1 ? hits[1].point.y - ground.point.y : Infinity;
      if (headroom < minHeadroom) continue;

      const point = new THREE.Vector3(origin.x, ground.point.y, origin.z);
      // El rayo mide hueco libre sobre el suelo, pero los colisionadores son
      // cajas envolventes: una esquina en L puede cubrir calle despejada. Si el
      // volumen que se va a ocupar choca con uno, este sitio no sirve.
      if (clearance && this._isBlocked(point, clearance)) continue;

      return point;
    }
    return null;
  }

  /**
   * Busca un sitio despejado para las cajas sueltas. Ahora que los edificios
   * son colisionadores sólidos, nacer dentro de uno las lanzaría por los aires.
   */
  _resolveBoxesConfig() {
    const config = { ...this.config.dynamicBoxes };
    const [ox, , oz] = config.origin;
    const columns = 4;
    const spot = this._findGroundPoint(
      ox, oz,
      { rayHeight: 40, minHeadroom: 2.5, searchRadius: 6 },
      {
        width: columns * (config.size + 0.06) + 0.4,
        depth: config.size + 0.4,
        height: Math.ceil(config.count / columns) * (config.size + 0.04) + 0.3,
      }
    );
    if (spot) config.origin = [spot.x, spot.y + 0.05, spot.z];
    return config;
  }

  /** ¿Choca el volumen pedido con algún colisionador sólido del escenario? */
  _isBlocked(point, clearance) {
    if (!this.levelColliderBoxes?.length) return false;

    const candidate = new THREE.Box3(
      new THREE.Vector3(point.x - clearance.width / 2, point.y + 0.1, point.z - clearance.depth / 2),
      new THREE.Vector3(point.x + clearance.width / 2, point.y + clearance.height, point.z + clearance.depth / 2)
    );

    for (const box of this.levelColliderBoxes) {
      // Las cajas planas son suelo (calle, banqueta): no estorban.
      if (box.max.y - box.min.y < 0.4) continue;
      if (box.intersectsBox(candidate)) return true;
    }
    return false;
  }

  _placePlayerOnGround() {
    const options = this.config.player.autoSpawn;
    if (!options?.enabled) return;

    const [sx, , sz] = this.config.player.spawn;
    const point = this._findGroundPoint(sx, sz, options);
    if (!point) {
      console.warn('No se encontró suelo bajo el punto de aparición; se usa el valor de config.js.');
      return;
    }
    this.player.setSpawn(
      point.x,
      point.y + this.config.player.capsuleRadius + 0.05,
      point.z
    );

    // El plano de respaldo estaba a una altura fija muy por debajo de la calle.
    // Como cannon-es no resuelve Box↔Trimesh, las cajas caen hasta él: si queda
    // hundido, cualquier caja desviada desaparece bajo el pavimento. Alinearlo
    // con la calle real las deja apoyadas a la vista.
    if (this.fallbackGroundBody) {
      this.fallbackGroundBody.position.y = point.y;
    }
  }

  /**
   * Levanta la torre de bloques derribable. Por defecto se coloca enfrente del
   * jugador (que aparece mirando hacia -Z), apoyada sobre el suelo real.
   */
  _buildTower() {
    const options = this.config.tower;
    if (!options?.enabled) return;

    let baseX;
    let baseZ;
    if (options.position) {
      [baseX, , baseZ] = options.position;
    } else {
      const [sx, , sz] = this.config.player.spawn;
      const [ox, , oz] = options.offsetFromSpawn;
      baseX = sx + ox;
      baseZ = sz + oz;
    }

    const widest = Math.max(...options.rows);
    const clearance = {
      width: widest * options.blockWidth + (widest - 1) * options.spacing + 0.6,
      depth: options.blockDepth + 0.6,
      height: options.rows.length * (options.blockHeight + options.verticalSpacing) + 0.3,
    };

    const ground = this._findGroundPoint(baseX, baseZ, options, clearance);
    if (!ground) {
      console.warn('No se encontró un sitio despejado para la torre; no se creó.');
      return;
    }

    this.tower = new BlockTower(this.scene, this.physicsWorld, options);
    const count = this.tower.build(ground);

    this.projectiles.addImpactTarget(this.tower);
    this.player.addCollisionProvider(this.tower);

    console.info(
      `Torre de bloques: ${count} bloques en ` +
      `(${ground.x.toFixed(2)}, ${ground.y.toFixed(2)}, ${ground.z.toFixed(2)}).`
    );
  }

  async _loadWeapon() {
    this.weapon = new Weapon(this.player, this.config.weapon);

    if (!this.config.assets.weapon) {
      this.weapon.createFallback();
      return;
    }

    try {
      const gltf = await this.loader.loadGLTF(this.config.assets.weapon);
      this.weapon.attachModel(gltf.scene);
    } catch (error) {
      console.warn('No se pudo cargar el arma 3D. Se usará una provisional.', error);
      this.weapon.createFallback();
    }
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0xdaf1ff, 0x405b49, 1.65);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-18, 28, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.00015;
    this.scene.add(sun);
  }

  _setupFallbackGround() {
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Plane());
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    body.position.y = this.config.world.fallbackFloorY;
    this.physicsWorld.addBody(body);
    this.fallbackGroundBody = body;
  }

  _onClick() {
    if (!this.player || !this.projectiles || !this.weapon) return;

    const direction = this.thirdPersonCamera.getAimDirection(new THREE.Vector3());
    const origin = this.weapon.getMuzzleWorldPosition(new THREE.Vector3());
    this.projectiles.fire(origin, direction, this.player.velocity);
  }

  _animate() {
    const dt = Math.min(this.clock.getDelta(), 0.033);
    this.controller.update(dt);

    const substeps = 3;
    const step = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      this.player.update(step);
      this.projectiles.update(step);
      this.physicsWorld.step(1 / 60, step, 3);
    }

    this.boxes.update();
    this.tower?.update();
    this.thirdPersonCamera.update(this.player.getPosition(new THREE.Vector3()), dt);
    this.renderer.render(this.scene, this.camera);
    this.stats.update();
  }

  _onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  setLoading(message, error = false) {
    const el = document.getElementById('loading');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.remove('hidden');
  }
}
