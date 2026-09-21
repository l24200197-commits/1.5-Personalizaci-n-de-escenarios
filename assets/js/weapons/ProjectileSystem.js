import * as THREE from 'three';

export class ProjectileSystem {
  constructor(scene, worldOctree, dynamicBoxes, config) {
    this.scene = scene;
    this.worldOctree = worldOctree;
    this.dynamicBoxes = dynamicBoxes;
    // Todo objeto con applyProjectileImpact(point, velocity, radius) puede
    // recibir disparos: cajas sueltas, torre de bloques, lo que se agregue.
    this.impactTargets = dynamicBoxes ? [dynamicBoxes] : [];
    this.config = config;
    this.index = 0;
    this.lastShot = 0;

    const geometry = new THREE.SphereGeometry(config.radius, 12, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0x3a2600, emissiveIntensity: 0.55 });

    this.projectiles = Array.from({ length: config.poolSize }, () => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      return {
        mesh,
        collider: new THREE.Sphere(new THREE.Vector3(0, -100, 0), config.radius),
        velocity: new THREE.Vector3(),
        life: 0,
        active: false,
      };
    });
  }

  addImpactTarget(target) {
    if (target && !this.impactTargets.includes(target)) this.impactTargets.push(target);
  }

  fire(origin, direction, inheritedVelocity = new THREE.Vector3()) {
    const now = performance.now();
    if (now - this.lastShot < this.config.cooldownMs) return;
    this.lastShot = now;

    const p = this.projectiles[this.index];
    this.index = (this.index + 1) % this.projectiles.length;
    p.collider.center.copy(origin);
    p.velocity.copy(direction).multiplyScalar(this.config.speed).addScaledVector(inheritedVelocity, 0.35);
    p.life = this.config.lifetime;
    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.copy(origin);
  }

  update(dt) {
    for (const p of this.projectiles) {
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        this._deactivate(p);
        continue;
      }

      p.collider.center.addScaledVector(p.velocity, dt);
      p.velocity.y -= this.config.gravity * dt;

      // El proyectil se consume al impactar. Antes solo se frenaba, así que
      // seguía dentro de la caja y le aplicaba un impulso nuevo en cada
      // subpaso, multiplicando la fuerza real del disparo.
      let consumed = false;
      for (const target of this.impactTargets) {
        if (target.applyProjectileImpact(p.collider.center, p.velocity, p.collider.radius)) {
          consumed = true;
          break;
        }
      }
      if (consumed) {
        this._deactivate(p);
        continue;
      }

      const hit = this.worldOctree.sphereIntersect(p.collider);
      if (hit) {
        p.collider.center.add(hit.normal.clone().multiplyScalar(hit.depth));
        p.velocity.reflect(hit.normal).multiplyScalar(0.35);
      }

      p.mesh.position.copy(p.collider.center);
      if (p.collider.center.y < -30) this._deactivate(p);
    }
  }

  _deactivate(p) {
    p.active = false;
    p.mesh.visible = false;
    p.velocity.set(0, 0, 0);
    p.collider.center.set(0, -100, 0);
  }
}
