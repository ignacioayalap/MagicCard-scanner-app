# 🪄 MTG Scanner

Una aplicación web progresiva (PWA) diseñada para escanear tus cartas de Magic: The Gathering usando la cámara de tu dispositivo, identificarlas de forma inteligente e incorporarlas automáticamente a tu base de datos personal en Google Sheets. 

Sin necesidad de descargar apps pesadas ni pagar suscripciones, esta herramienta combina **inteligencia artificial** y **APIs gratuitas** para facilitarte el trabajo de inventariar tu colección.

## Características

- 📷 **Escaneo inteligente**: Saca una foto de la carta y la aplicación usará **Gemini 2.5 Flash** para identificar el nombre de la carta y su edición.
- 🔍 **Búsqueda automática**: Obtiene instantáneamente la imagen de la carta, nombre de la edición y precios actualizados en USD y EUR usando la API pública de **Scryfall**.
- ✨ **Soporte Foil**: ¡Indica si tu carta es Foil para obtener su precio exacto de mercado!
- 📝 **Integración con Google Sheets**: Con un solo clic, la carta (incluyendo su imagen, datos y precio) se guarda en tu planilla de Google Sheets personal.
- 📱 **Instalable (PWA)**: Funciona en el navegador pero puedes instalarla en la pantalla de inicio de tu celular para usarla como una aplicación nativa.
- 🔄 **Búsqueda manual**: Si la foto salió borrosa, podés escribir el nombre de la carta manualmente y el sistema buscará las coincidencias.

## 🛠️ Cómo funciona

1. **Captura**: Abres la app y sacas una foto a tu carta.
2. **Reconocimiento OCR**: La imagen se reduce de tamaño (para ser rápida y eficiente) y se envía a **Gemini 2.5 Flash**, que extrae el nombre y código de expansión.
3. **Consulta de Precios**: Ese nombre se busca en **Scryfall** (mediante *fuzzy search* o búsqueda exacta por set), obteniendo la versión correcta de la carta y sus precios.
4. **Almacenamiento**: Al confirmar y presionar "Agregar a Google Sheets", se hace una petición POST a un **Google Apps Script** propio que añade una nueva fila en tu documento, insertando incluso la imagen con `=IMAGE()`.

Todo el flujo es completamente gratuito: Scryfall no requiere API key y los servicios de Google (Gemini AI Studio, Apps Script y Sheets) tienen cuotas gratuitas más que suficientes para uso personal.

## 📁 Estructura del Proyecto

| Archivo | Descripción |
|---|---|
| `index.html`, `styles.css`, `app.js` | Frontend de la aplicación web. |
| `manifest.json`, `sw.js` | Archivos de configuración para que la web actúe como una PWA. |
| `Code.gs` | Backend (script) que debes instalar en tu Google Apps Script. |
| `config.example.js` | Plantilla para tus claves de entorno. |
| `.github/workflows/deploy.yml` | Configuración para el despliegue automático en GitHub Pages. |

## 🚀 Guía de Instalación

Para tener tu propio escáner funcionando, debes configurar dos partes: la base de datos (Google Sheets) y la aplicación web.

### Paso 1: Configurar Google Sheets y Apps Script

1. Ve a [Google Sheets](https://sheets.google.com) y crea una hoja de cálculo nueva (ej. "Mi Colección de MTG").
2. En el menú superior, ve a **Extensiones → Apps Script**.
3. Borra el código por defecto y pega todo el contenido del archivo `Code.gs` incluido en este repositorio.
4. Guarda el proyecto (icono de disquete).
5. Arriba a la derecha, haz clic en **Implementar → Nueva implementación**.
   - **Tipo**: Aplicación web.
   - **Ejecutar como**: Yo (tu cuenta de Google).
   - **Quién tiene acceso**: Cualquier usuario.
6. Dale a "Implementar" y acepta los permisos de seguridad (Google te advertirá que es una app no verificada, ve a "Configuración avanzada" y permite el acceso, ¡es tu propio código!).
7. Copia la **URL de la aplicación web** (termina en `/exec`). Esta URL es tu `APPS_SCRIPT_URL`.

> ⚠️ **Nota de seguridad:** La opción "Cualquier usuario" permite que la app web pueda enviar datos sin pedir login de Google. Mantén tu URL secreta.

### Paso 2: Desplegar la App Web (Recomendado: GitHub Pages)

Para poder acceder a la cámara, tu teléfono necesita que la web cargue mediante **HTTPS**. 

Este proyecto incluye configuración lista para **GitHub Pages**:

1. En tu repositorio en GitHub, ve a **Settings → Secrets and variables → Actions → New repository secret** y crea dos secretos:
   - `GEMINI_API_KEY`: Tu API key gratuita obtenida en [Google AI Studio](https://aistudio.google.com/apikey).
   - `APPS_SCRIPT_URL`: La URL `/exec` que obtuviste en el Paso 1.
2. En **Settings → Pages → Build and deployment**, selecciona **Source: GitHub Actions**.
3. Ejecuta el workflow (en la pestaña **Actions**, selecciona "Deploy to GitHub Pages" y "Run workflow"). 
4. El workflow inyectará los secretos en un archivo `config.js` y publicará tu app automáticamente en tu dominio de GitHub Pages.

*(Nota: Para proteger tu `GEMINI_API_KEY`, ve a la consola de Google Cloud y restringe el uso de la API por HTTP Referrer para que solo funcione desde tu dominio `https://tuusuario.github.io/*`).*

#### Desarrollo Local

Si deseas probarlo localmente:
1. Copia `config.example.js` y renómbralo a `config.js`.
2. Completa los valores de `GEMINI_API_KEY` y `APPS_SCRIPT_URL`.
3. Ejecuta un servidor local (ej. `npx serve .` o el plugin Live Server en VS Code).

## ⚠️ Limitaciones Conocidas

- **Reconocimiento visual:** Funciona bien con buena luz. Fundas altamente reflectantes, cartas en otro idioma que no sea inglés, o fotos movidas pueden hacer que la IA falle. Siempre puedes escribir el nombre a mano.
- **Precios de Scryfall:** No es el valor "en tiempo real" al segundo, sino el último valor promedio consolidado por Scryfall desde plataformas como TCGplayer o Cardmarket.
- **Cartas de dos caras:** Actualmente mostrarán la imagen frontal por defecto.
- **Duplicados:** No hay control de duplicidad actual; si escaneas la misma carta dos veces, se generarán dos filas separadas.

## 🔮 Futuras Mejoras Posibles

- Implementar reconocimiento real por embeddings (reconocimiento de la imagen de arte) en lugar de OCR al texto, mejorando la precisión en cartas no inglesas o fotos difíciles.
- Agregar un marco o guía visual con el *aspect ratio* en la vista de la cámara para fotos más consistentes.
- Sistema de detección de duplicados para aumentar la "Cantidad" de una carta existente en vez de crear una nueva fila.
- Selector de edición para cuando el nombre coincide con muchas reimpresiones y la IA no pudo leer el set.

---
*Datos de cartas e imágenes cortesía de [Scryfall](https://scryfall.com). Este proyecto no está afiliado ni patrocinado por Wizards of the Coast o Scryfall.*
