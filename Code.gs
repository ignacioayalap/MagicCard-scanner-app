/**
 * MTG Scanner - Backend en Google Apps Script
 *
 * Este script se pega en el editor de Apps Script (script.google.com)
 * de una Google Sheet propia, y se despliega como "Web App".
 * La app web le hace POST con los datos de cada carta escaneada
 * y este script agrega una fila a la hoja "Cartas".
 *
 * Ver README.md para el paso a paso de instalación.
 */

const SHEET_NAME = "Cartas";
const HEADERS = ["Fecha", "Imagen", "Nombre", "Edición", "Precio USD", "Precio EUR", "Link Scryfall"];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet_();

    sheet.appendRow([
      new Date(),
      data.imageUrl ? `=IMAGE("${data.imageUrl}")` : "",
      data.name || "",
      data.setName || "",
      data.priceUsd || "",
      data.priceEur || "",
      data.scryfallUri || "",
    ]);

    return jsonResponse_({ status: "ok" });
  } catch (err) {
    return jsonResponse_({ status: "error", message: String(err) });
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    "MTG Scanner API activa. Usar POST para agregar cartas."
  );
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(2, 120); // columna de imagen más ancha
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
