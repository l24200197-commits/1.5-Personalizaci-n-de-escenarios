import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera, domElement, config) {
    this.camera = camera;
    this.domElement = domElement;
    this.config = config;
    this.yaw = 0;
    this.pitch = 0.16;
    this.distance = config.distance;
    this.target = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.staticScene = null;
    // Con la cámara fija se puede disparar y seguir la trayectoria de la bala
    // sin que la vista se mueva al mover el mouse.
    this.lookEnabled = true;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);

    document.addEventListener('mousemove', this._onMouseMove);
    domElement.addEventListener('wheel', this._onWheel, { passive: false });
    domElement.addEventListener('mousedown', this._onMouseDown);
  }

  setStaticScene(sceneRoot) {
    this.staticScene = sceneRoot;
  }

  _onMouseDown() {
    if (document.pointerLockElement !== this.domElement) {
      this.domElement.requestPointerLock().catch(() => {});
    }
  }

  toggleLook() {
    this.lookEnabled = !this.lookEnabled;
    return this.lookEnabled;
  }

  _onMouseMove(event) {
    if (!this.lookEnabled) return;
    if (document.pointerLockElement !== this.domElement) return;
    this.yaw -= event.movementX * this.config.sensitivity;
    this.pitch -= event.movementY * this.config.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.config.pitchMin, this.config.pitchMax);
  }

  _onWheel(event) {
    event.preventDefault();
    this.distance += event.deltaY * 0.004;
    this.distance = THREE.MathUtils.clamp(this.distance, this.config.minDistance, this.config.maxDistance);
  }

  getForward(out = new THREE.Vector3()) {
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return out.normalize();
  }

  getRight(out = new THREE.Vector3()) {
    return this.getForward(out).cross(new THREE.Vector3(0, 1, 0)).normalize();
  }

  getAimDirection(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    out.set(
      -Math.sin(this.yaw) * cp,
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp
    );
    return out.normalize();
  }

  update(playerPosition, dt) {
    this.target.copy(playerPosition).add(new THREE.Vector3(0, this.config.height, 0));

    const cp = Math.cos(this.pitch);
    this.offset.set(
      Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cp
    ).multiplyScalar(this.distance);

    this.desired.copy(this.target).add(this.offset);

    if (this.staticScene) {
      const direction = this.desired.clone().sub(this.target);
      const maxDistance = direction.length();
      if (maxDistance > 0.001) {
        direction.normalize();
        this.raycaster.set(this.target, direction);
        this.raycaster.far = maxDistance;
        const hits = this.raycaster.intersectObject(this.staticScene, true);
        if (hits.length) {
          const safeDistance = Math.max(this.config.minDistance * 0.55, hits[0].distance - 0.2);
          this.desired.copy(this.target).addScaledVector(direction, safeDistance);
        }
      }
    }

    const alpha = 1 - Math.exp(-this.config.smoothing * dt);
    this.camera.position.lerp(this.desired, alpha);
    this.camera.lookAt(this.target);
  }
}
