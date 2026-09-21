import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class DynamicBoxes {
  constructor(scene, physicsWorld, config) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.size = config.size;
    this.items = [];
    this.material = new CANNON.Material('dynamic-box');
    this.geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
    this.colors = [0x2f80ed, 0xf2994a, 0x27ae60, 0x9b51e0, 0xeb5757];
    this._spawnStack(config.count, config.origin);
  }

  _spawnStack(count, origin) {
    const [ox, oy, oz] = origin;
    const columns = 4;
    for (let i = 0; i < count; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      this.create(
        ox + col * (this.size + 0.06),
        oy + row * (this.size + 0.04),
        oz
      );
    }
  }

  create(x, y, z) {
    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        color: this.colors[this.items.length % this.colors.length],
        roughness: 0.58,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({
      mass: 3,
      material: this.material,
      shape: new CANNON.Box(new CANNON.Vec3(this.size / 2, this.size / 2, this.size / 2)),
      linearDamping: 0.1,
      angularDamping: 0.15,
      allowSleep: true,
      sleepSpeedLimit: 0.12,
      sleepTimeLimit: 1,
    });
    body.position.set(x, y, z);
    this.physicsWorld.addBody(body);
    this.items.push({ mesh, body });
  }

  applyProjectileImpact(point, velocity, radius) {
    const hitRadius = radius + this.size * 0.82;
    for (const item of this.items) {
      const dx = point.x - item.body.position.x;
      const dy = point.y - item.body.position.y;
      const dz = point.z - item.body.position.z;
      if ((dx * dx + dy * dy + dz * dz) <= hitRadius * hitRadius) {
        item.body.wakeUp();
        item.body.applyImpulse(
          new CANNON.Vec3(velocity.x * 0.2, velocity.y * 0.2, velocity.z * 0.2),
          new CANNON.Vec3(point.x, point.y, point.z)
        );
        return true;
      }
    }
    return false;
  }

  // Colisión aproximada cápsula/caja para que el jugador no atraviese las cajas
  // y, al mismo tiempo, pueda empujarlas.
  resolvePlayer(playerPosition, playerVelocity, radius, playerHeight = 1.75) {
    for (const item of this.items) {
      const b = item.body.position;
      const half = this.size / 2;
      const playerBottom = playerPosition.y;
      const playerTop = playerPosition.y + playerHeight;
      if (playerTop < b.y - half || playerBottom > b.y + half) continue;

      const closestX = THREE.MathUtils.clamp(playerPosition.x, b.x - half, b.x + half);
      const closestZ = THREE.MathUtils.clamp(playerPosition.z, b.z - half, b.z + half);
      let dx = playerPosition.x - closestX;
      let dz = playerPosition.z - closestZ;
      let distSq = dx * dx + dz * dz;

      if (distSq >= radius * radius) continue;

      let dist = Math.sqrt(distSq);
      if (dist < 1e-5) {
        dx = playerPosition.x - b.x;
        dz = playerPosition.z - b.z;
        dist = Math.hypot(dx, dz) || 1;
      }
      const nx = dx / dist;
      const nz = dz / dist;
      const penetration = radius - Math.sqrt(Math.max(distSq, 0));

      playerPosition.x += nx * penetration;
      playerPosition.z += nz * penetration;

      item.body.wakeUp();
      item.body.applyImpulse(
        new CANNON.Vec3(
          nx * (1.6 + Math.abs(playerVelocity.x) * 0.35),
          0.12,
          nz * (1.6 + Math.abs(playerVelocity.z) * 0.35)
        ),
        item.body.position
      );
    }
  }

  update() {
    for (const item of this.items) {
      item.mesh.position.copy(item.body.position);
      item.mesh.quaternion.copy(item.body.quaternion);
    }
  }
}
