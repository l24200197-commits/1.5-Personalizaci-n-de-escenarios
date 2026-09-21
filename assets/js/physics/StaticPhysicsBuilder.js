import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Física estática del escenario.
//
// IMPORTANTE: cannon-es NO implementa la colisión Box<->Trimesh (la entrada
// 'convexTrimesh' está comentada en la propia librería; solo existen
// sphereTrimesh y planeTrimesh). Por eso el Trimesh del escenario no detiene a
// las cajas dinámicas: lo atraviesan.
//
// La solución es buildBoxColliders(): un CANNON.Box estático por cada mesh del
// escenario, a partir de su caja envolvente en el mundo. Box<->Box sí está
// soportado, así que las cajas chocan con la calle, los edificios y los muros.
export class StaticPhysicsBuilder {
  /**
   * Genera un colisionador de caja estático por mesh del escenario.
   * Devuelve los cuerpos creados y sus cajas en coordenadas de mundo, que
   * sirven además para comprobar si un sitio está libre antes de colocar algo.
   */
  static buildBoxColliders(sceneRoot, physicsWorld, options = {}) {
    const { material = null, minThickness = 0.04 } = options;
    sceneRoot.updateWorldMatrix(true, true);

    const bodies = [];
    const boxes = [];
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    sceneRoot.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;

      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const worldBox = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
      worldBox.getSize(size);
      worldBox.getCenter(center);

      // Un mesh degenerado produciría una caja de grosor cero.
      const half = new CANNON.Vec3(
        Math.max(size.x / 2, minThickness),
        Math.max(size.y / 2, minThickness),
        Math.max(size.z / 2, minThickness)
      );

      const body = new CANNON.Body({ mass: 0 });
      if (material) body.material = material;
      body.addShape(new CANNON.Box(half));
      body.position.set(center.x, center.y, center.z);
      physicsWorld.addBody(body);

      bodies.push(body);
      boxes.push(worldBox);
    });

    console.info(`Colisionadores del escenario: ${bodies.length} cajas estáticas.`);
    return { bodies, boxes };
  }

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
