// ------------------------------------------------------------------
// MTG Scanner - prototipo
// Flujo: foto -> OCR (Tesseract.js) -> Scryfall API -> Google Apps Script -> Google Sheets
// ------------------------------------------------------------------

const STORAGE_KEY = "mtgScannerScriptUrl";
const GEMINI_KEY_STORAGE = "mtgScannerGeminiKey";

const els = {
  scriptUrlInput: document.getElementById("scriptUrlInput"),
  geminiKeyInput: document.getElementById("geminiKeyInput"),
  saveConfigBtn: document.getElementById("saveConfigBtn"),
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

// --------------------------- Configuración ---------------------------

function loadConfig() {
  const scriptUrl = localStorage.getItem(STORAGE_KEY);
  if (scriptUrl) {
    els.scriptUrlInput.value = scriptUrl;
  }
  const geminiKey = localStorage.getItem(GEMINI_KEY_STORAGE);
  if (geminiKey) {
    els.geminiKeyInput.value = geminiKey;
  }
  
  if (scriptUrl && geminiKey) {
    setStatus(els.configStatus, "Configuración guardada ✓", "ok");
  }
}

els.saveConfigBtn.addEventListener("click", () => {
  const url = els.scriptUrlInput.value.trim();
  const key = els.geminiKeyInput.value.trim();
  
  if (url && !url.startsWith("https://script.google.com/")) {
    setStatus(els.configStatus, "Pegá una URL válida de Apps Script (/exec)", "err");
    return;
  }
  if (!key) {
    setStatus(els.configStatus, "Pegá tu API Key de Gemini", "err");
    return;
  }
  
  localStorage.setItem(STORAGE_KEY, url);
  localStorage.setItem(GEMINI_KEY_STORAGE, key);
  setStatus(els.configStatus, "Guardado ✓", "ok");
});

loadConfig();

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

  await runVisionAndSearch(canvas);
});

async function runVisionAndSearch(canvas) {
  const geminiKey = localStorage.getItem(GEMINI_KEY_STORAGE);
  if (!geminiKey) {
    setStatus(els.ocrStatus, "Falta la API Key de Gemini. Guardala en la configuración.", "err");
    return;
  }

  setStatus(els.ocrStatus, "Analizando imagen con IA (Gemini)...");
  try {
    const base64Image = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    
    const cardData = await identifyCardWithGemini(base64Image, geminiKey);
    
    if (!cardData || !cardData.name) {
      setStatus(els.ocrStatus, "La IA no pudo leer el nombre. Escribilo a mano abajo.", "err");
      els.manualSection.hidden = false;
      return;
    }

    setStatus(els.ocrStatus, `Leído: "${cardData.name}" (Set: ${cardData.set || '?'}). Buscando en Scryfall...`);
    const card = await searchScryfall(cardData.name, cardData.set);

    if (!card) {
      setStatus(els.ocrStatus, "No se encontró la carta en Scryfall. Corregí el nombre abajo.", "err");
      els.manualNameInput.value = cardData.name;
      els.manualSection.hidden = false;
      return;
    }

    setStatus(els.ocrStatus, "¡Carta identificada! ✓", "ok");
    showCard(card);
  } catch (err) {
    console.error(err);
    setStatus(els.ocrStatus, "Error analizando la imagen. Probá de nuevo o escribí a mano.", "err");
    els.manualSection.hidden = false;
  }
}

async function identifyCardWithGemini(base64Data, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: "Identify this Magic: The Gathering card. Return ONLY a valid JSON object with 'name' (the exact card name in English) and 'set' (the 3-letter set code if visible or guessable from the expansion symbol, otherwise empty string). Example: {\"name\": \"Black Lotus\", \"set\": \"lea\"}. Do not include markdown formatting or backticks, just the raw JSON." },
        { inline_data: { mime_type: "image/jpeg", data: base64Data } }
      ]
    }]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Gemini API error");

  const data = await response.json();
  const textResponse = data.candidates[0].content.parts[0].text;
  
  try {
    const cleanJson = textResponse.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse Gemini response:", textResponse);
    return null;
  }
}

// --------------------------- Scryfall ---------------------------

async function scryfallFuzzy(name) {
  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function searchScryfall(name, setCode) {
  if (setCode) {
    const url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&set=${encodeURIComponent(setCode.toLowerCase())}`;
    const res = await fetch(url);
    if (res.ok) return res.json();
    await sleep(100); // Pausa antes del fallback para no saturar Scryfall
  }
  // Fallback a fuzzy search si no hay set o si falló la búsqueda exacta
  return await scryfallFuzzy(name);
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
