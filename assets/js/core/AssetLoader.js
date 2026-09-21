import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetLoader {
  constructor(onProgress = () => {}) {
    this.onProgress = onProgress;
    this.loader = new GLTFLoader();
  }

  loadGLTF(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        resolve,
        (event) => {
          if (!event.total) return;
          this.onProgress(Math.round((event.loaded / event.total) * 100), url);
        },
        (error) => {
          console.error(`Error cargando modelo: ${url}`, error);
          reject(new Error(`No se pudo cargar ${url}. Verifica el .gltf/.glb, scene.bin y texturas asociadas.`));
        }
      );
    });
  }
}
