# Urban Physics 3D

Demo Web 3D académica desarrollada con **Three.js** y **cannon-es**. Integra un escenario urbano glTF, cámara en tercera persona, personaje provisional, arma 3D, proyectiles, colisiones y cajas dinámicas derribables.

## Ejecutar

Por seguridad del navegador, los archivos glTF deben abrirse mediante un servidor HTTP y no con doble clic sobre `index.html`.

```bash
cd urban_physics_3d
python3 -m http.server 8000
```

Después abre `http://localhost:8000`.

También puede utilizarse la extensión **Live Server** de VS Code.

## Controles

- `W A S D`: mover personaje
- `SHIFT`: correr
- `ESPACIO`: saltar
- `MOUSE`: mover cámara
- `RUEDA`: zoom
- `CLIC IZQUIERDO`: disparar
- `ESC`: liberar el mouse

## Modelos integrados

### Escenario

**street city (7) for games FREE**  
Autor: dasy444  
Fuente: https://sketchfab.com/3d-models/street-city-7-for-games-free-493a69b451284ff88346c7b3e4e1b5a7  
Licencia incluida en `assets/models/city/license.txt`.

### Arma

**WojPlayy's utsm 3.0 cannon (Read description)**  
Autor: SinisterClock  
Fuente: https://sketchfab.com/3d-models/wojplayys-utsm-30-cannon-read-description-e74989937c4e4705b3e13c0f0626be76  
Licencia: CC-BY-NC-4.0. No usar comercialmente. Ver `assets/models/weapon/license.txt`.

Crédito requerido por el modelo:

> This work is based on "WojPlayy's utsm 3.0 cannon (Read description)" by SinisterClock licensed under CC-BY-NC-4.0.

## Física

El personaje utiliza una cápsula y colisiones mediante `Octree` de Three.js. El escenario también se convierte a un `Trimesh` estático de cannon-es para que las cajas dinámicas choquen contra calles, paredes y edificios. Los proyectiles detectan impactos contra el escenario y aplican impulsos a las cajas.

## Estructura relevante

```text
assets/
├── js/
│   ├── core/
│   ├── objects/
│   ├── physics/
│   ├── player/
│   └── weapons/
└── models/
    ├── city/
    │   ├── scene.gltf
    │   ├── scene.bin
    │   └── textures/
    └── weapon/
        ├── scene.gltf
        ├── scene.bin
        └── textures/
```

## GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube todos los archivos del proyecto conservando la estructura.
3. En GitHub abre **Settings → Pages**.
4. Selecciona **Deploy from a branch**.
5. Elige la rama `main` y carpeta `/ (root)`.
6. Guarda y abre la URL que GitHub genere.

Las rutas de los modelos son relativas, por lo que son compatibles con un repositorio publicado como GitHub Pages.

## Nota

Actualmente el personaje es un modelo provisional construido con geometrías de Three.js. La arquitectura queda preparada para sustituirlo posteriormente por un personaje glTF/GLB animado sin cambiar el escenario, el arma ni los sistemas de física.
