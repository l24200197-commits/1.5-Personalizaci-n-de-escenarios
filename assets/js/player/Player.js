import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';

export class Player {
  constructor(scene, worldOctree, config) {
    this.scene = scene;
    this.worldOctree = worldOctree;
    this.config = config;
    this.dynamicBoxes = null;

    const [sx, sy, sz] = config.spawn;
    this.collider = new Capsule(
      new THREE.Vector3(sx, sy, sz),
      new THREE.Vector3(sx, sy + (config.capsuleEndY - config.capsuleStartY), sz),
      config.capsuleRadius
    );
    this.velocity = new THREE.Vector3();
    this.onFloor = false;

    // 'visual' es solo el contenedor que define hacia dónde mira el jugador:
    // el arma se monta aquí, así que no debe reemplazarse al cargar el modelo.
    this.visual = new THREE.Group();
    this.visual.name = 'PlayerVisual';
    this.placeholder = this._createPlaceholderCharacter();
    this.visual.add(this.placeholder);
    this.model = null;
    scene.add(this.visual);
    this.syncVisual();
  }

  /**
   * Sustituye el muñeco provisional por el modelo glTF del personaje.
   * El modelo se reescala a la estatura indicada y se reposiciona para que
   * los pies queden en el origen del contenedor.
   */
  attachModel(gltfScene, characterConfig = {}) {
    const {
      targetHeight = 1.75,
      yawOffset = 0,
      yOffset = 0,
    } = characterConfig;

    const model = gltfScene;
    model.name = 'PlayerCharacter';
    model.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 1e-6) model.scale.setScalar(targetHeight / size.y);
    model.rotation.y = yawOffset;
    model.updateWorldMatrix(true, true);

    // Apoya el modelo en el suelo y lo centra en X/Z respecto al contenedor.
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;
    model.position.y += yOffset;

    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material?.map) obj.material.map.anisotropy = 4;
    });

    if (this.placeholder) {
      this.visual.remove(this.placeholder);
      this.placeholder.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.geometry?.dispose();
        obj.material?.dispose();
      });
      this.placeholder = null;
    }

    this.visual.add(model);
    this.model = model;
  }

  /** Reubica la cápsula y guarda el punto como nuevo origen de reaparición. */
  setSpawn(x, y, z) {
    this.config.spawn = [x, y, z];
    this.reset();
    this.syncVisual();
  }

  setDynamicBoxes(dynamicBoxes) {
    this.dynamicBoxes = dynamicBoxes;
  }

  _createPlaceholderCharacter() {
    const root = new THREE.Group();
    root.name = 'PlayerPlaceholder';

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d6fa5, roughness: 0.65 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x17202a, roughness: 0.75 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a47f, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.65, 6, 12), bodyMat);
    torso.position.y = 0.95;
    torso.castShadow = true;
    root.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), skinMat);
    head.position.y = 1.55;
    head.castShadow = true;
    root.add(head);

    const legGeo = new THREE.CapsuleGeometry(0.11, 0.42, 5, 10);
    for (const x of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(legGeo, darkMat);
      leg.position.set(x, 0.28, 0);
      leg.castShadow = true;
      root.add(leg);
    }

    const armGeo = new THREE.CapsuleGeometry(0.09, 0.42, 5, 10);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.39, 1.03, -0.04);
    leftArm.rotation.z = -0.2;
    leftArm.castShadow = true;
    root.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.39, 1.03, -0.12);
    rightArm.rotation.x = Math.PI / 2.7;
    rightArm.rotation.z = 0.15;
    rightArm.castShadow = true;
    root.add(rightArm);

    root.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    return root;
  }

  getPosition(out = new THREE.Vector3()) {
    return out.addVectors(this.collider.start, this.collider.end)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, -0.65, 0));
  }

  setFacingDirection(direction) {
    if (direction.lengthSq() < 0.0001) return;
    const yaw = Math.atan2(-direction.x, -direction.z);
    this.visual.rotation.y = yaw;
  }

  move(direction, targetSpeed, dt) {
    const acceleration = this.onFloor ? 18 : 6;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, direction.x * targetSpeed, acceleration, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, direction.z * targetSpeed, acceleration, dt);
  }

  jump() {
    if (this.onFloor) this.velocity.y = this.config.jumpSpeed;
  }

  update(dt) {
    if (!this.onFloor) this.velocity.y -= this.config.gravity * dt;

    this.collider.translate(this.velocity.clone().multiplyScalar(dt));
    this._resolveStaticCollisions();
    this._resolveDynamicCollisions();

    if (this.onFloor && this.velocity.y < 0) this.velocity.y = 0;
    if (this.collider.end.y < -25) this.reset();
    this.syncVisual();
  }

  _resolveStaticCollisions() {
    const result = this.worldOctree.capsuleIntersect(this.collider);
    this.onFloor = false;

    if (!result) return;
    this.onFloor = result.normal.y > 0.45;
    if (!this.onFloor) {
      this.velocity.addScaledVector(result.normal, -result.normal.dot(this.velocity));
    }
    if (result.depth > 1e-8) {
      this.collider.translate(result.normal.multiplyScalar(result.depth));
    }
  }

  _resolveDynamicCollisions() {
    if (!this.dynamicBoxes) return;
    const before = this.getPosition(new THREE.Vector3());
    const corrected = before.clone();
    this.dynamicBoxes.resolvePlayer(corrected, this.velocity, this.config.capsuleRadius, 1.75);
    const correction = corrected.sub(before);
    if (correction.lengthSq() > 0) this.collider.translate(correction);
  }

  syncVisual() {
    this.visual.position.copy(this.getPosition(new THREE.Vector3()));
  }

  reset() {
    const [x, y, z] = this.config.spawn;
    const segment = this.config.capsuleEndY - this.config.capsuleStartY;
    this.collider.start.set(x, y, z);
    this.collider.end.set(x, y + segment, z);
    this.velocity.set(0, 0, 0);
  }
}
