import * as THREE from 'three';

export class PlayerController {
  constructor(player, thirdPersonCamera) {
    this.player = player;
    this.camera = thirdPersonCamera;
    this.keys = new Set();
    this.move = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        this.player.jump();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  update(dt) {
    this.move.set(0, 0, 0);
    this.camera.getForward(this.forward);
    this.camera.getRight(this.right);

    if (this.keys.has('KeyW')) this.move.add(this.forward);
    if (this.keys.has('KeyS')) this.move.sub(this.forward);
    if (this.keys.has('KeyD')) this.move.add(this.right);
    if (this.keys.has('KeyA')) this.move.sub(this.right);

    if (this.move.lengthSq() > 0) this.move.normalize();

    // Comportamiento tipo third-person shooter: el personaje y el arma
    // miran hacia adelante con respecto a la cámara; A/D funcionan como strafe.
    this.player.setFacingDirection(this.forward);

    const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))
      ? this.player.config.runSpeed
      : this.player.config.walkSpeed;
    this.player.move(this.move, speed, dt);
  }
}
