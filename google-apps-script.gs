const SHEET_NAME = "Leads";
const HEADER_ROW = [
  "Timestamp",
  "Agency Name",
  "Representative Name",
  "Full Name",
  "Phone Number",
  "Location",
  "Desired Position",
  "Desired Country",
  "Passport Status",
  "Schedule",
  "Notes",
  "Source",
];

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const sheet = getOrCreateSheet();

    sheet.appendRow([
      new Date(),
      payload.agencyName || "",
      payload.representativeName || "",
      payload.fullName || "",
      payload.phoneNumber || "",
      payload.location || "",
      payload.desiredPosition || "",
      payload.desiredCountry || "",
      payload.passportStatus || "",
      payload.schedule || "",
      payload.notes || "",
      payload.source || "website-form",
    ]);

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error.message || "Unknown error",
      },
      500,
    );
  }
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const contentType = String(e.postData.type || "").toLowerCase();
  const raw = e.postData.contents;

  if (contentType.includes("application/json") || raw.trim().startsWith("{")) {
    return JSON.parse(raw);
  }

  return raw.split("&").reduce((acc, pair) => {
    const [key, value = ""] = pair.split("=");
    if (!key) return acc;
    acc[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, " "));
    return acc;
  }, {});
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function jsonResponse(data, status) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  if (status && status !== 200) {
    // Apps Script ContentService doesn't let us set HTTP status directly,
    // so we encode the failure in the response body.
  }

  return output;
}
