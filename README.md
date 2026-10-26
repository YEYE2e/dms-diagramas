# DMS Diagramas

Editor de **secuencia** y **entidad-relación** con Svelte 5 y Svelte Flow. Selector de tipo, lienzo a todo el ancho, propiedades flotantes y minimapa opcional.

## Iniciar en local

```powershell
npm.cmd install
npm.cmd run dev
```

Usa la dirección local que imprime Vite (`localhost` o `127.0.0.1`). `npm.cmd` evita el bloqueo de `npm.ps1` en PowerShell.

- Añade entidades, participantes o notas desde la barra. Selecciona elementos para editar sus propiedades.
- Arrastra entre puertos o pulsa **Conectar** para crear relaciones y mensajes.
- **Ordenar diagrama** alinea participantes y asigna una fila a cada mensaje. En ER utiliza ELK en un Web Worker para distribuir las tablas y calcular rutas ortogonales con puertos separados. Reduce cruces y evita atravesar entidades; un grafo arbitrario puede necesitar cruces.
- Las nuevas conexiones y los cambios estructurales se ordenan automáticamente. En secuencia, las propiedades permiten subir o bajar mensajes y marcar retornos, que invierten la dirección de la flecha. Hasta 200 mensajes.
- En ER puedes editar atributos, tipos, claves PK/FK/PK-FK y nulabilidad. Las cardinalidades se muestran como texto.
- Ctrl/⌘+Z deshace; Ctrl/⌘+Shift+Z rehace; Ctrl/⌘+D duplica; Supr elimina; Shift permite selección múltiple. Rueda para zoom y fondo para desplazar.
- Cada tipo conserva un borrador en el navegador. Importar/exportar JSON permite llevar copias. Límite de importación: 5 MB, 1500 nodos y 5000 conexiones.

## Guardar en el repositorio

En la versión local (`npm.cmd run dev`), pulsa **Guardar en repositorio**. Esto escribe:

```text
public/diagrams/<identificador>.json
public/diagrams/index.json
```

**Diagramas** abre la biblioteca tanto en local como en Pages. Abrir un archivo existente y guardarlo de nuevo actualiza el mismo JSON; un nuevo diagrama crea otro archivo. El guardado en archivos es explícito: el autoguardado normal solo conserva el borrador en el navegador.

Incluye los JSON y su índice en el mismo commit y súbelos a `main`. El siguiente despliegue incorporará esos diagramas. No se hacen commits ni pushes automáticos.

En GitHub Pages, la biblioteca carga los JSON estáticos publicados. El botón de escribir en el repositorio solo existe en desarrollo local. Puedes explorar y editar una copia en el navegador y exportarla, pero publicar cambios requiere guardarlos en local y subirlos a Git.

Enlaces directos:

```text
https://yeye2e.github.io/dms-diagramas/?diagram=modelo-pedidos
https://yeye2e.github.io/dms-diagramas/?diagram=consulta-datos
```

El repositorio incluye esos dos ejemplos. Los diagramas nuevos reciben identificadores propios.

## GitHub Pages

El workflow `.github/workflows/pages.yml` ejecuta pruebas, compila Vite y publica `dist` cuando se suben cambios a `main`, o al ejecutarlo manualmente. Utiliza el `base_path` proporcionado por GitHub Pages para las rutas de scripts, biblioteca y Web Worker.

1. Sube los cambios del proyecto y `public/diagrams/` a GitHub.
2. En **Settings → Pages → Build and deployment → Source**, selecciona **GitHub Actions**.
3. Ejecuta el workflow **Deploy diagrams to GitHub Pages**, o sube un commit a `main`.

El código no cambia la configuración remota ni publica por sí solo durante el trabajo local. La URL estará disponible cuando el workflow termine correctamente.

Para comprobar la compilación con el subdirectorio de Pages:

```powershell
$env:VITE_BASE_PATH='/dms-diagramas/'
npm.cmd run build
Remove-Item Env:VITE_BASE_PATH
```

## Cargar esquema SQL existente

En **Archivo → Cargar esquema SQL**, el editor local lee `public/schema/erd.json`. Confirma el reemplazo del ER actual y luego utiliza Guardar en repositorio si quieres incluirlo en la biblioteca publicada.

Para regenerarlo, configura `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` y, opcionalmente, `DB_PORT` y `DB_TRUST_SERVER_CERT` en `.env.erd`:

```powershell
node scripts/export-schema.mjs
```

Las credenciales solo se usan desde Node. `.env.erd` y el esquema generado están excluidos de Git; guardar un diagrama en `public/diagrams` sí lo incluye entre los archivos que se publicarán.

## Verificación

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run test:pages
```

Las pruebas cubren validación de importaciones, historial, rutas ortogonales, guardado local por HTTP, protección de origen, biblioteca estática, edición, conexiones con puertos, persistencia y pantallas de 320, 768, 1024 y 1440 px. `test:pages` también comprueba el subdirectorio de despliegue, los enlaces y el Web Worker. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite reutilizar un Chromium instalado.
