// ------------------------------------------------------------------
// MTG Scanner - prototipo
// Flujo: foto -> OCR (Tesseract.js) -> Scryfall API -> Google Apps Script -> Google Sheets
// ------------------------------------------------------------------

const STORAGE_KEY = "mtgScannerScriptUrl";

const els = {
  scriptUrlInput: document.getElementById("scriptUrlInput"),
  saveScriptUrlBtn: document.getElementById("saveScriptUrlBtn"),
  configStatus: document.getElementById("configStatus"),

  cameraInput: document.getElementById("cameraInput"),
  preview: document.getElementById("preview"),
  ocrStatus: document.getElementById("ocrStatus"),

  resultSection: document.getElementById("resultSection"),
  cardImage: document.getElementById("cardImage"),
  cardName: document.getElementById("cardName"),
  cardSet: document.getElementById("cardSet"),
  cardPriceUsd: document.getElementById("cardPriceUsd"),
  cardPriceEur: document.getElementById("cardPriceEur"),
  researchBtn: document.getElementById("researchBtn"),
  addToSheetBtn: document.getElementById("addToSheetBtn"),
  sheetStatus: document.getElementById("sheetStatus"),

  manualSection: document.getElementById("manualSection"),
  manualNameInput: document.getElementById("manualNameInput"),
  manualSearchBtn: document.getElementById("manualSearchBtn"),
};

let currentCard = null; // último resultado de Scryfall

// --------------------------- Config Apps Script ---------------------------

function loadScriptUrl() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    els.scriptUrlInput.value = saved;
    setStatus(els.configStatus, "Conectado ✓", "ok");
  }
}

els.saveScriptUrlBtn.addEventListener("click", () => {
  const url = els.scriptUrlInput.value.trim();
  if (!url.startsWith("https://script.google.com/")) {
    setStatus(els.configStatus, "Pegá una URL válida de Apps Script (/exec)", "err");
    return;
  }
  localStorage.setItem(STORAGE_KEY, url);
  setStatus(els.configStatus, "Guardado ✓", "ok");
});

loadScriptUrl();

// --------------------------- Captura + OCR ---------------------------

els.cameraInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  els.resultSection.hidden = true;
  els.manualSection.hidden = true;

  const imgBitmap = await createImageBitmap(file);
  const canvas = els.preview;
  const ctx = canvas.getContext("2d");

  // Reducimos la imagen para que el OCR sea más rápido
  const maxWidth = 900;
  const scale = Math.min(1, maxWidth / imgBitmap.width);
  canvas.width = imgBitmap.width * scale;
  canvas.height = imgBitmap.height * scale;
  ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);
  canvas.hidden = false;

  await runOcrAndSearch(canvas);
});

async function runOcrAndSearch(canvas) {
  setStatus(els.ocrStatus, "Leyendo el nombre de la carta...");
  try {
    // El nombre de una carta de Magic siempre está en una franja
    // horizontal en la parte superior. Recortamos esa franja para
    // que el OCR sea más preciso y rápido.
    const nameCrop = cropTopBand(canvas, 0.14);

    const { data } = await Tesseract.recognize(nameCrop, "eng", {
      logger: () => {},
    });

    const candidates = buildNameCandidates(data.text);

    if (candidates.length === 0) {
      setStatus(els.ocrStatus, "No se pudo leer el nombre. Escribilo a mano abajo.", "err");
      els.manualSection.hidden = false;
      return;
    }

    setStatus(els.ocrStatus, `Texto leído: "${candidates[0]}". Buscando en Scryfall...`);
    const card = await searchScryfallFromCandidates(candidates);

    if (!card) {
      setStatus(els.ocrStatus, "No se encontró la carta. Corregí el nombre abajo.", "err");
      els.manualNameInput.value = candidates[0];
      els.manualSection.hidden = false;
      return;
    }

    setStatus(els.ocrStatus, "¡Carta identificada! ✓", "ok");
    showCard(card);
  } catch (err) {
    console.error(err);
    setStatus(els.ocrStatus, "Error leyendo la imagen. Probá de nuevo o escribí el nombre a mano.", "err");
    els.manualSection.hidden = false;
  }
}

function cropTopBand(sourceCanvas, fraction) {
  const bandHeight = Math.max(40, Math.floor(sourceCanvas.height * fraction));
  const out = document.createElement("canvas");
  out.width = sourceCanvas.width;
  out.height = bandHeight;
  out.getContext("2d").drawImage(
    sourceCanvas,
    0, 0, sourceCanvas.width, bandHeight,
    0, 0, sourceCanvas.width, bandHeight
  );
  return out;
}

function buildNameCandidates(rawText) {
  return rawText
    .split("\n")
    .map((l) => l.replace(/[^a-zA-Z0-9À-ÿ',\s-]/g, "").trim())
    .filter((l) => l.length >= 3);
}

// --------------------------- Scryfall ---------------------------

async function scryfallFuzzy(name) {
  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function searchScryfallFromCandidates(candidates) {
  for (const candidate of candidates.slice(0, 3)) {
    const card = await scryfallFuzzy(candidate);
    if (card) return card;
    await sleep(120); // Scryfall pide no golpear la API sin pausas
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractImageUrl(card) {
  if (card.image_uris) return card.image_uris.normal;
  if (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris) {
    return card.card_faces[0].image_uris.normal;
  }
  return "";
}

function showCard(card) {
  currentCard = card;
  els.cardImage.src = extractImageUrl(card);
  els.cardName.value = card.name || "";
  els.cardSet.value = card.set_name ? `${card.set_name} (${(card.set || "").toUpperCase()})` : "";
  els.cardPriceUsd.value = card.prices?.usd ? `$${card.prices.usd}` : "N/D";
  els.cardPriceEur.value = card.prices?.eur ? `€${card.prices.eur}` : "N/D";
  els.resultSection.hidden = false;
  els.sheetStatus.textContent = "";
}

// --------------------------- Búsqueda manual / re-búsqueda ---------------------------

els.manualSearchBtn.addEventListener("click", async () => {
  const name = els.manualNameInput.value.trim();
  if (!name) return;
  setStatus(els.ocrStatus, "Buscando en Scryfall...");
  const card = await scryfallFuzzy(name);
  if (!card) {
    setStatus(els.ocrStatus, "No se encontró ninguna carta con ese nombre.", "err");
    return;
  }
  setStatus(els.ocrStatus, "¡Carta identificada! ✓", "ok");
  showCard(card);
});

els.researchBtn.addEventListener("click", async () => {
  const name = els.cardName.value.trim();
  if (!name) return;
  setStatus(els.sheetStatus, "Buscando de nuevo...");
  const card = await scryfallFuzzy(name);
  if (!card) {
    setStatus(els.sheetStatus, "No se encontró ninguna carta con ese nombre.", "err");
    return;
  }
  showCard(card);
});

// --------------------------- Guardar en Google Sheets ---------------------------

els.addToSheetBtn.addEventListener("click", async () => {
  const scriptUrl = localStorage.getItem(STORAGE_KEY);
  if (!scriptUrl) {
    setStatus(els.sheetStatus, "Primero guardá la URL de tu Apps Script (paso 1).", "err");
    return;
  }
  if (!currentCard) return;

  const payload = {
    name: els.cardName.value,
    setName: els.cardSet.value,
    priceUsd: currentCard.prices?.usd || "",
    priceEur: currentCard.prices?.eur || "",
    imageUrl: extractImageUrl(currentCard),
    scryfallUri: currentCard.scryfall_uri || "",
  };

  setStatus(els.sheetStatus, "Guardando en Google Sheets...");
  try {
    // Content-Type text/plain evita el preflight CORS que Apps Script no soporta.
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (json && json.status === "ok") {
      setStatus(els.sheetStatus, "¡Agregada a la planilla! ✓", "ok");
    } else {
      setStatus(els.sheetStatus, "Se envió, pero no se pudo confirmar. Revisá la hoja.", "ok");
    }
  } catch (err) {
    console.error(err);
    setStatus(els.sheetStatus, "Error de conexión con Apps Script.", "err");
  }
});

// --------------------------- Utils ---------------------------

function setStatus(el, text, type) {
  el.textContent = text;
  el.classList.remove("ok", "err");
  if (type) el.classList.add(type);
}

// Service worker (opcional, para poder "instalar" la app)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
