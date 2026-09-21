import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Torre de bloques apilados, derribable por los proyectiles del arma.
 *
 * Cada bloque es independiente: su propia BoxGeometry de Three.js y su propio
 * CANNON.Body dinámico. No hay animación de caída; todo el derribo sale de la
 * simulación de cannon-es, el mismo motor que ya usaba el proyecto.
 *
 * Nota sobre el suelo: cannon-es no implementa la colisión Box↔Trimesh (la
 * entrada 'convexTrimesh' está comentada en la propia librería), así que los
 * cuerpos de caja atraviesan el Trimesh del escenario. Por eso la torre crea
 * una losa estática invisible (CANNON.Box) justo bajo su base, a la altura real
 * de la calle: Box↔Box sí está soportado y los bloques se apoyan correctamente.
 */
export class BlockTower {
  constructor(scene, physicsWorld, config) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.config = config;
    this.blocks = [];
    this.padBody = null;
    this.basePosition = new THREE.Vector3();

    this.group = new THREE.Group();
    this.group.name = 'BlockTower';
    this.scene.add(this.group);

    // Materiales de contacto: restitución casi nula y fricción alta son lo que
    // mantiene la pila quieta en lugar de hacerla rebotar o deslizarse.
    this.blockMaterial = new CANNON.Material('tower-block');
    this.groundMaterial = new CANNON.Material('tower-ground');

    physicsWorld.addContactMaterial(new CANNON.ContactMaterial(
      this.blockMaterial,
      this.blockMaterial,
      { friction: config.friction, restitution: config.restitution }
    ));
    physicsWorld.addContactMaterial(new CANNON.ContactMaterial(
      this.blockMaterial,
      this.groundMaterial,
      { friction: config.groundFriction, restitution: 0.01 }
    ));

    this.geometry = new THREE.BoxGeometry(
      config.blockWidth,
      config.blockHeight,
      config.blockDepth
    );

    // Un tono por nivel: ayuda a distinguir los bloques al caer sin depender
    // de texturas nuevas.
    this.levelColors = [0xb0563a, 0xc6743f, 0xd9a05b, 0xbfb08a, 0x8d9aa6];
  }

  /** Construye la losa de apoyo y todos los bloques sobre el punto indicado. */
  build(basePosition) {
    this.basePosition.copy(basePosition);
    this._createSupportPad(basePosition);

    const { rows, blockWidth, blockHeight, spacing, verticalSpacing } = this.config;
    const stepX = blockWidth + spacing;
    // El hueco vertical es mucho menor que el horizontal a propósito: con 4 cm
    // por nivel el bloque de arriba caería casi 20 cm al iniciar y la torre se
    // desmoronaría sola. Así solo se asienta unos milímetros.
    const stepY = blockHeight + verticalSpacing;

    rows.forEach((count, level) => {
      const levelWidth = count * blockWidth + (count - 1) * spacing;
      const startX = basePosition.x - levelWidth / 2 + blockWidth / 2;
      // Pequeña holgura inicial: los bloques nacen separados y se asientan solos
      // en lugar de aparecer interpenetrados y salir disparados.
      const y = basePosition.y + verticalSpacing + level * stepY + blockHeight / 2;

      for (let i = 0; i < count; i++) {
        this.createBlock(startX + i * stepX, y, basePosition.z, level);
      }
    });

    return this.blocks.length;
  }

  _createSupportPad(basePosition) {
    const { rows, blockWidth, blockDepth, spacing, padMargin } = this.config;
    const widest = Math.max(...rows);
    const halfX = (widest * blockWidth + (widest - 1) * spacing) / 2 + padMargin;
    const halfZ = blockDepth / 2 + padMargin;
    const halfY = 0.5;

    const body = new CANNON.Body({ mass: 0, material: this.groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ)));
    // La cara superior de la losa queda exactamente al nivel de la calle.
    body.position.set(basePosition.x, basePosition.y - halfY, basePosition.z);
    this.physicsWorld.addBody(body);
    this.padBody = body;
  }

  createBlock(x, y, z, level = 0) {
    const { blockWidth, blockHeight, blockDepth, mass } = this.config;

    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        color: this.levelColors[level % this.levelColors.length],
        roughness: 0.72,
        metalness: 0.05,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    this.group.add(mesh);

    const body = new CANNON.Body({
      mass,
      material: this.blockMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(blockWidth / 2, blockHeight / 2, blockDepth / 2)),
      linearDamping: this.config.linearDamping,
      angularDamping: this.config.angularDamping,
      allowSleep: true,
      sleepSpeedLimit: 0.14,
      sleepTimeLimit: 0.6,
    });
    body.position.set(x, y, z);
    this.physicsWorld.addBody(body);

    this.blocks.push({ mesh, body });
    return body;
  }

  /**
   * Impacto de un proyectil. Devuelve true si golpeó algún bloque.
   *
   * La detección usa el punto en el espacio local del cuerpo, así que sigue
   * siendo exacta cuando el bloque ya está girado.
   *
   * El empuje no se concentra en el bloque tocado: se reparte como una onda
   * expansiva con caída lineal sobre todos los bloques dentro de blastRadius.
   * Un impulso único concentrado tenía un rango pésimo: no movía los bloques
   * cargados de la base y lanzaba a más de 200 m los libres de la cima.
   */
  applyProjectileImpact(point, velocity, radius) {
    const target = this._findHitBlock(point, radius);
    if (!target) return false;

    const { blastRadius, impactDeltaV, forwardShare, mass } = this.config;
    const center = new CANNON.Vec3(point.x, point.y, point.z);
    const speed = velocity.length() || 1;
    const forward = new CANNON.Vec3(
      velocity.x / speed, velocity.y / speed, velocity.z / speed
    );
    // Limita el brazo de palanca al propio tamaño del bloque: sin esto, un
    // bloque lejano recibiría un par de giro desproporcionado.
    const maxLever = Math.hypot(
      this.config.blockWidth, this.config.blockHeight, this.config.blockDepth
    ) / 2;

    for (const item of this.blocks) {
      const offset = item.body.position.vsub(center);
      const distance = offset.length();
      if (distance > blastRadius) continue;

      const falloff = 1 - distance / blastRadius;
      const radial = distance > 1e-4
        ? offset.scale(1 / distance)
        : new CANNON.Vec3(0, 1, 0);

      const direction = new CANNON.Vec3(
        forward.x * forwardShare + radial.x * (1 - forwardShare),
        forward.y * forwardShare + radial.y * (1 - forwardShare),
        forward.z * forwardShare + radial.z * (1 - forwardShare)
      );
      direction.scale(1 / (direction.length() || 1), direction);

      // Impulso proporcional a la masa: el cambio de velocidad es predecible
      // aunque se retoque 'mass' en la configuración.
      const impulse = direction.scale(mass * impactDeltaV * falloff);

      // applyImpulse espera el punto RELATIVO al centro de masa, no absoluto.
      // Ese desfase es justo lo que produce el giro al golpear una esquina.
      const lever = center.vsub(item.body.position);
      if (lever.length() > maxLever) lever.scale(maxLever / lever.length(), lever);

      item.body.wakeUp();
      item.body.applyImpulse(impulse, lever);
    }
    return true;
  }

  _findHitBlock(point, radius) {
    const hx = this.config.blockWidth / 2;
    const hy = this.config.blockHeight / 2;
    const hz = this.config.blockDepth / 2;
    const world = new CANNON.Vec3(point.x, point.y, point.z);
    const local = new CANNON.Vec3();

    for (const item of this.blocks) {
      item.body.pointToLocalFrame(world, local);
      const dx = local.x - THREE.MathUtils.clamp(local.x, -hx, hx);
      const dy = local.y - THREE.MathUtils.clamp(local.y, -hy, hy);
      const dz = local.z - THREE.MathUtils.clamp(local.z, -hz, hz);
      if (dx * dx + dy * dy + dz * dz <= radius * radius) return item;
    }
    return null;
  }

  /**
   * Colisión aproximada cápsula/bloque para que el jugador no atraviese la
   * torre y pueda empujarla al caminar. Usa el AABB real del cuerpo, así que
   * sigue funcionando con los bloques ya derribados y girados.
   */
  resolvePlayer(playerPosition, playerVelocity, radius, playerHeight = 1.75) {
    for (const item of this.blocks) {
      const { lowerBound: lb, upperBound: ub } = item.body.aabb;

      if (playerPosition.y + playerHeight < lb.y || playerPosition.y > ub.y) continue;

      const closestX = THREE.MathUtils.clamp(playerPosition.x, lb.x, ub.x);
      const closestZ = THREE.MathUtils.clamp(playerPosition.z, lb.z, ub.z);
      let dx = playerPosition.x - closestX;
      let dz = playerPosition.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;

      let dist = Math.sqrt(distSq);
      if (dist < 1e-5) {
        dx = playerPosition.x - item.body.position.x;
        dz = playerPosition.z - item.body.position.z;
        dist = Math.hypot(dx, dz) || 1;
      }
      const nx = dx / dist;
      const nz = dz / dist;
      const penetration = radius - dist;

      playerPosition.x += nx * penetration;
      playerPosition.z += nz * penetration;

      item.body.wakeUp();
      item.body.applyImpulse(
        new CANNON.Vec3(
          nx * (1.2 + Math.abs(playerVelocity.x) * 0.3),
          0.05,
          nz * (1.2 + Math.abs(playerVelocity.z) * 0.3)
        ),
        new CANNON.Vec3(0, -this.config.blockHeight * 0.25, 0)
      );
    }
  }

  /** Sincroniza cada malla con su cuerpo físico. Se llama una vez por frame. */
  update() {
    for (const item of this.blocks) {
      item.mesh.position.copy(item.body.position);
      item.mesh.quaternion.copy(item.body.quaternion);
    }
  }

  /** Vuelve a levantar la torre en el mismo sitio. */
  reset() {
    for (const item of this.blocks) {
      this.group.remove(item.mesh);
      item.mesh.material.dispose();
      this.physicsWorld.removeBody(item.body);
    }
    this.blocks.length = 0;

    if (this.padBody) {
      this.physicsWorld.removeBody(this.padBody);
      this.padBody = null;
    }
    this.build(this.basePosition.clone());
  }
}
