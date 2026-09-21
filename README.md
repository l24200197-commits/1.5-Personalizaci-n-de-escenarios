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

### Escenario activo

**Ruined city FREE (5)**  
Autor: dasy444  
Fuente: https://sketchfab.com/3d-models/ruined-city-free-5-4b0b0021d91442079a91b075576efe4e  
Licencia: SKETCHFAB Standard. Incluida en `assets/models/ruined_city/license.txt`.

### Escenario alternativo

**street city (7) for games FREE**  
Autor: dasy444  
Fuente: https://sketchfab.com/3d-models/street-city-7-for-games-free-493a69b451284ff88346c7b3e4e1b5a7  
Licencia incluida en `assets/models/city/license.txt`.

Se conserva en el repositorio como segunda opción. Para volver a él basta con
cambiar `assets.scenario` en `assets/js/config.js`.

### Personaje

**Woman Standing V16**  
Autor: Fadly.W  
Fuente: https://sketchfab.com/3d-models/woman-standing-v16-5b412817044c409eb98a431fadefe170  
Licencia: CC-BY-4.0. Ver `assets/models/character/license.txt`.

Crédito requerido por el modelo:

> This work is based on "Woman Standing V16" (https://sketchfab.com/3d-models/woman-standing-v16-5b412817044c409eb98a431fadefe170) by Fadly.W (https://sketchfab.com/Fadly.W) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

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
    ├── ruined_city/      escenario activo
    │   ├── scene.gltf
    │   ├── scene.bin
    │   └── textures/
    ├── city/             escenario alternativo
    │   ├── scene.gltf
    │   ├── scene.bin
    │   └── textures/
    ├── character/        personaje jugable
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

## Personalización de escenarios

El escenario y el personaje se eligen desde `assets/js/config.js`, sin tocar el
resto del código:

```js
assets: {
  scenario: './assets/models/ruined_city/scene.gltf',
  character: './assets/models/character/scene.gltf',
}
```

Para agregar un escenario nuevo se copia su carpeta (`scene.gltf`, `scene.bin` y
`textures/`) dentro de `assets/models/` y se apunta `assets.scenario` a ella.

Como cada escenario tiene su propia altura y distribución, el punto de aparición
no se fija a mano: al cargar el nivel se lanza un rayo hacia abajo desde
`player.spawn` para dejar al personaje sobre el suelo real, y si ese punto queda
dentro de un edificio se prueban posiciones cercanas en espiral. Se ajusta con
`player.autoSpawn`.

El personaje glTF se reescala solo a la estatura de `character.targetHeight` y se
apoya en el suelo automáticamente. Si aparece de espaldas, se invierte
`character.yawOffset` entre `0` y `Math.PI`.

Si un modelo no carga, el juego no se rompe: el personaje vuelve al muñeco
provisional de geometrías y el arma a su versión de respaldo.

## Nota

El personaje no trae animaciones (es una pose estática), por lo que se desplaza
sin ciclo de caminata. La arquitectura queda preparada para sustituirlo por un
modelo animado sin cambiar el escenario, el arma ni los sistemas de física.
