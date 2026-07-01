# MTG Scanner — prototipo

App web (PWA) para escanear cartas de Magic con la cámara del celular, identificarlas vía [Scryfall](https://scryfall.com) (base de datos y precios gratis, sin API key) y cargarlas automáticamente en una Google Sheet.

## Cómo funciona

1. Sacás una foto de la carta desde el celular (abre la cámara nativa).
2. La app recorta la franja superior (donde está el nombre) y usa OCR en el navegador (Tesseract.js) para leerlo.
3. Busca el nombre en Scryfall (`fuzzy search`) y trae imagen, edición y precio (USD/EUR).
4. Mostrás/corregís el resultado y lo agregás con un botón, que manda los datos a un Google Apps Script que escribe la fila en tu Google Sheet (con la imagen embebida vía `=IMAGE()`).

Todo gratis: Scryfall no requiere key, y Google Apps Script + Sheets son gratuitos con tu cuenta de Google normal.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html`, `styles.css`, `app.js` | La app web (frontend) |
| `manifest.json`, `sw.js` | Para poder "instalarla" en el celular como PWA |
| `Code.gs` | Backend que va en Google Apps Script, escribe en tu Sheet |

## Paso 1 — Crear la Google Sheet y el Apps Script

1. Andá a [sheets.google.com](https://sheets.google.com) y creá una hoja nueva (ej: "Colección Magic").
2. En el menú: **Extensiones → Apps Script**.
3. Borrá el contenido de `Code.gs` que aparece por defecto y pegá el contenido del archivo `Code.gs` de este proyecto.
4. Guardá el proyecto (ícono de disquete).
5. Arriba a la derecha, botón **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo** (tu cuenta).
   - Quién tiene acceso: **Cualquier usuario**.
6. Al implementar, Google va a pedirte autorizar permisos (es tu propio script accediendo a tu propia hoja) — aceptá.
7. Copiá la **URL de la aplicación web** que te da (termina en `/exec`). Esa es la URL que vas a pegar en el paso 1 de la app.

> Nota de seguridad: "Cualquier usuario" significa que cualquiera que tenga esa URL exacta puede agregar filas a tu hoja. Para un proyecto personal está bien, pero no compartas la URL públicamente. Si más adelante querés cerrarlo más, se puede agregar un token secreto simple en el propio `Code.gs`.

## Paso 2 — Hostear la app web

El celular necesita acceder a la app por **HTTPS** (o `localhost`) para poder usar la cámara. Opciones gratis, de más a menos simple:

- **GitHub Pages**: subís los archivos (`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`) a un repo de GitHub y activás Pages en la configuración del repo. Te da una URL `https://tuusuario.github.io/repo/` accesible desde cualquier celular.
- **Netlify / Vercel** (plan gratis): arrastrás la carpeta con los archivos y te dan una URL HTTPS al instante.
- **Probar en tu red local**: si querés probarlo ya mismo desde tu compu, corré un servidor simple en la carpeta (por ejemplo `npx serve .` o `python3 -m http.server`) y abrí esa dirección desde el celular conectado al mismo WiFi. Ojo: sin HTTPS, algunos navegadores igual permiten la cámara en la misma red local, pero no siempre — para uso real conviene GitHub Pages/Netlify.

## Paso 3 — Usar la app

1. Abrí la URL en el navegador del celular.
2. Pegá la URL del Apps Script (paso 1) y tocá **Guardar** (queda guardada en el celular).
3. Tocá **Sacar foto de la carta**, apuntá bien al nombre de la carta (que quede legible y derecho).
4. Esperá el resultado. Si el OCR no lee bien el nombre, corregilo a mano y tocá **Buscar de nuevo**.
5. Tocá **Agregar a Google Sheets** — la fila aparece en tu hoja con imagen, nombre, edición y precio.

## Limitaciones de este prototipo (a tener en cuenta)

- El OCR lee el **nombre impreso** en la carta, no reconoce la carta visualmente (no es un modelo de visión entrenado con las ~30.000 cartas de Magic). Con buena luz y foto derecha funciona bien; con cartas en otro idioma, dañadas, o mal enfocadas, puede fallar — por eso está el campo para corregir el nombre a mano.
- Los precios de Scryfall se actualizan a diario (no es el precio "en el momento exacto" al centavo, sino el último precio de mercado que Scryfall tiene registrado, tomado de TCGplayer/Cardmarket).
- Cartas con dos caras (transform, MDFC) traen la imagen del frente.
- No hay control de duplicados: si escaneás la misma carta dos veces, se agregan dos filas.

## Posibles mejoras futuras

- Reconocimiento visual real (embeddings de imagen) en vez de solo OCR del nombre, para más precisión con fotos imperfectas.
- Guía visual en cámara (marco con el aspect ratio de una carta) para fotos más consistentes.
- Detección de duplicados y opción de sumar cantidad en vez de fila nueva.
- Elegir edición específica cuando el nombre coincide con varias impresiones.
- Registrar si la carta es foil (afecta el precio).
