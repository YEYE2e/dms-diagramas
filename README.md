# DMS Diagramas

Editor interactivo de diagramas con Svelte 5 y `@xyflow/svelte` (Svelte Flow).

## Iniciar

```powershell
npm.cmd install
npm.cmd run dev
```

Abre la URL que imprime Vite. En Windows se usa `npm.cmd` si PowerShell bloquea `npm.ps1`.

## Uso

- **Flujo:** añade procesos, decisiones, inicio/fin y notas. Arrastra los elementos y conecta sus puertos, o utiliza los selectores Desde/Hacia.
- **Entidad-relación:** crea entidades, edita atributos, tipos, claves PK/FK/PK-FK y nulabilidad; etiqueta las relaciones con cardinalidades. La notación de cardinalidad es textual.
- **Secuencia:** crea participantes con líneas de vida. Los 12 pasos numerados permiten mensajes horizontales y retornos discontinuos. Los participantes se alinean al terminar de arrastrarlos.
- Selecciona un elemento o conexión para editarlo en Propiedades. Puedes duplicar y eliminar elementos. Al borrar un elemento se eliminan también sus conexiones.
- Cada tipo conserva su propio diagrama en `localStorage`. El guardado corresponde al navegador y al origen actuales; exporta JSON para conservar copias o trasladar el trabajo.
- Importar JSON valida el formato y mantiene el diagrama actual si el archivo es inválido. Límite: 5 MB, 1500 nodos y 5000 conexiones.
- Usa los controles de zoom, Ajustar vista y el minimapa para navegar. Shift + arrastrar selecciona varios elementos.

Atajos: Ctrl/⌘+Z deshace, Ctrl/⌘+Shift+Z rehace, Ctrl/⌘+D duplica, Ctrl/⌘+S guarda y Supr elimina la selección. El historial conserva hasta 80 estados por sesión del diagrama; al importar o cambiar de modo se reinicia.

## Esquema SQL existente

En Entidad-relación, **Cargar esquema SQL** abre `public/schema/erd.json` con el formato original del proyecto. La confirmación reemplaza el diagrama ER actual: exporta una copia si deseas conservarlo.

Para regenerar el archivo, configura las variables `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` y, opcionalmente, `DB_PORT` y `DB_TRUST_SERVER_CERT` en `.env.erd`, y ejecuta:

```powershell
node scripts/export-schema.mjs
```

La conexión SQL solo se realiza desde ese script de Node. El editor web no recibe las credenciales. `.env.erd` y el esquema generado están excluidos de Git.

## Verificación

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Las pruebas de navegador cubren edición, deshacer/rehacer, conexiones mediante puertos, persistencia, importación/exportación, atributos ER, secuencia y tamaños de 320, 768, 1024 y 1440 px. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite usar un Chromium ya instalado. Las pruebas sirven el compilado de producción en `127.0.0.1:4173`.

Para formatear: `npm.cmd run format`.
