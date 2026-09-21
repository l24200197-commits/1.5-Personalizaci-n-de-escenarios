import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Convierte todos los triángulos del escenario visual en un único collider estático.
// Así las cajas de cannon-es chocan contra calles, banquetas, edificios y objetos.
export class StaticPhysicsBuilder {
  static buildTrimesh(sceneRoot, physicsWorld) {
    sceneRoot.updateWorldMatrix(true, true);

    const vertices = [];
    const indices = [];
    const temp = new THREE.Vector3();
    let vertexOffset = 0;
    let meshCount = 0;

    sceneRoot.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;

      const geometry = object.geometry;
      const position = geometry.attributes.position;
      const startOffset = vertexOffset;

      for (let i = 0; i < position.count; i++) {
        temp.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
        vertices.push(temp.x, temp.y, temp.z);
        vertexOffset++;
      }

      if (geometry.index) {
        const src = geometry.index.array;
        for (let i = 0; i < src.length; i++) indices.push(startOffset + src[i]);
      } else {
        for (let i = 0; i < position.count; i++) indices.push(startOffset + i);
      }

      meshCount++;
    });

    if (!vertices.length || !indices.length) {
      console.warn('No se encontraron triángulos para crear la física estática del escenario.');
      return null;
    }

    const shape = new CANNON.Trimesh(vertices, indices);
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(shape);
    physicsWorld.addBody(body);

    console.info(`Física del escenario: ${meshCount} meshes, ${vertices.length / 3} vértices, ${indices.length / 3} triángulos.`);
    return body;
  }
}
