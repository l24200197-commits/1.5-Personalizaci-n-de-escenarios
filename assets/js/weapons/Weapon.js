import * as THREE from 'three';

export class Weapon {
  constructor(player, config) {
    this.player = player;
    this.config = config;
    this.root = new THREE.Group();
    this.root.name = 'WeaponRoot';
    this.muzzlePoint = new THREE.Object3D();
    this.muzzlePoint.name = 'muzzlePoint';
    this.root.add(this.muzzlePoint);

    const [px, py, pz] = config.mountPosition;
    const [rx, ry, rz] = config.mountRotation;
    this.root.position.set(px, py, pz);
    this.root.rotation.set(rx, ry, rz);
    player.visual.add(this.root);
  }

  attachModel(model) {
    model.name = 'WeaponModel';
    model.updateWorldMatrix(true, true);

    const originalBox = new THREE.Box3().setFromObject(model);
    const size = originalBox.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const scale = this.config.targetLength / longest;
    model.scale.setScalar(scale);
    model.updateWorldMatrix(true, true);

    // El modelo descargado tiene su eje largo principalmente en Z.
    // Lo centramos en X/Y y dejamos la parte trasera cerca de la mano.
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.y -= center.y;
    model.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(model);
    const desiredRearZ = 0.18;
    model.position.z += desiredRearZ - box.max.z;
    model.updateWorldMatrix(true, true);

    const finalBox = new THREE.Box3().setFromObject(model);
    this.muzzlePoint.position.set(0, 0, finalBox.min.z - 0.08);

    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material?.map) obj.material.map.anisotropy = 4;
    });

    this.root.add(model);
    this.model = model;
  }

  createFallback() {
    const material = new THREE.MeshStandardMaterial({
      color: 0x303a46,
      metalness: 0.7,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.9), material);
    body.position.z = -0.3;
    body.castShadow = true;
    this.root.add(body);
    this.muzzlePoint.position.set(0, 0, -0.82);
  }

  getMuzzleWorldPosition(out = new THREE.Vector3()) {
    return this.muzzlePoint.getWorldPosition(out);
  }
}
