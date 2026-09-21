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
   * Colisionadores sólidos del escenario, por columnas.
   *
   * Una sola caja envolvente por mesh no sirve: los edificios son irregulares,
   * así que su AABB se desparrama sobre la calle y acaba tapando toda la
   * carretera con muros invisibles. En su lugar se rasterizan los triángulos
   * reales de cada mesh en una rejilla vertical y se crea una caja por columna
   * ocupada, con la altura que realmente tiene la geometría ahí.
   *
   * Los meshes planos (calle, banquetas, calcomanías) se omiten: su suelo lo
   * da el plano de respaldo, alineado por rayo con la calle visible. Así los
   * bloques se apoyan exactamente donde se ve el pavimento y no flotan.
   */
  static buildColumnColliders(sceneRoot, physicsWorld, options = {}) {
    const {
      cellSize = 1.0,
      minColliderHeight = 0.4,
      minCellHeight = 0.1,
      material = null,
    } = options;

    sceneRoot.updateWorldMatrix(true, true);

    const bodies = [];
    const boxes = [];
    let skipped = 0;

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();

    sceneRoot.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;

      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const meshBox = geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
      if (meshBox.max.y - meshBox.min.y < minColliderHeight) {
        skipped++;
        return;
      }

      const position = geometry.attributes.position;
      const index = geometry.index;
      const count = index ? index.count : position.count;
      const grid = new Map();

      const mark = (ix, iz, lowY, highY) => {
        const key = `${ix},${iz}`;
        const cell = grid.get(key);
        if (!cell) {
          grid.set(key, { ix, iz, min: lowY, max: highY });
          return;
        }
        if (lowY < cell.min) cell.min = lowY;
        if (highY > cell.max) cell.max = highY;
      };

      for (let i = 0; i < count; i += 3) {
        const i0 = index ? index.getX(i) : i;
        const i1 = index ? index.getX(i + 1) : i + 1;
        const i2 = index ? index.getX(i + 2) : i + 2;

        a.fromBufferAttribute(position, i0).applyMatrix4(object.matrixWorld);
        b.fromBufferAttribute(position, i1).applyMatrix4(object.matrixWorld);
        c.fromBufferAttribute(position, i2).applyMatrix4(object.matrixWorld);

        const lowY = Math.min(a.y, b.y, c.y);
        const highY = Math.max(a.y, b.y, c.y);

        // Las celdas de los tres vértices siempre: así un muro delgado no se
        // queda sin colisionador por no llegar al centro de ninguna celda.
        mark(Math.floor(a.x / cellSize), Math.floor(a.z / cellSize), lowY, highY);
        mark(Math.floor(b.x / cellSize), Math.floor(b.z / cellSize), lowY, highY);
        mark(Math.floor(c.x / cellSize), Math.floor(c.z / cellSize), lowY, highY);

        const ix0 = Math.floor(Math.min(a.x, b.x, c.x) / cellSize);
        const ix1 = Math.floor(Math.max(a.x, b.x, c.x) / cellSize);
        const iz0 = Math.floor(Math.min(a.z, b.z, c.z) / cellSize);
        const iz1 = Math.floor(Math.max(a.z, b.z, c.z) / cellSize);
        if (ix1 === ix0 && iz1 === iz0) continue;

        // Para triángulos grandes solo se marcan las celdas cuyo centro cae
        // dentro: marcar todo el rectángulo envolvente reproduciría el mismo
        // problema que tenían los AABB.
        for (let ix = ix0; ix <= ix1; ix++) {
          for (let iz = iz0; iz <= iz1; iz++) {
            const px = (ix + 0.5) * cellSize;
            const pz = (iz + 0.5) * cellSize;
            const d1 = (px - b.x) * (a.z - b.z) - (a.x - b.x) * (pz - b.z);
            const d2 = (px - c.x) * (b.z - c.z) - (b.x - c.x) * (pz - c.z);
            const d3 = (px - a.x) * (c.z - a.z) - (c.x - a.x) * (pz - a.z);
            const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
            const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
            if (neg && pos) continue;
            mark(ix, iz, lowY, highY);
          }
        }
      }

      if (!grid.size) return;

      const body = new CANNON.Body({ mass: 0 });
      if (material) body.material = material;

      for (const cell of grid.values()) {
        const halfY = Math.max((cell.max - cell.min) / 2, minCellHeight);
        const centerY = (cell.min + cell.max) / 2;
        const centerX = (cell.ix + 0.5) * cellSize;
        const centerZ = (cell.iz + 0.5) * cellSize;

        body.addShape(
          new CANNON.Box(new CANNON.Vec3(cellSize / 2, halfY, cellSize / 2)),
          new CANNON.Vec3(centerX, centerY, centerZ)
        );
        boxes.push(new THREE.Box3(
          new THREE.Vector3(centerX - cellSize / 2, centerY - halfY, centerZ - cellSize / 2),
          new THREE.Vector3(centerX + cellSize / 2, centerY + halfY, centerZ + cellSize / 2)
        ));
      }

      physicsWorld.addBody(body);
      bodies.push(body);
    });

    console.info(
      `Colisionadores del escenario: ${bodies.length} cuerpos, ${boxes.length} columnas ` +
      `de ${cellSize} m; ${skipped} meshes planos omitidos (los cubre el suelo).`
    );
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
