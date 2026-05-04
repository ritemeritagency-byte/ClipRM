const SPREADSHEET_ID = "116oDzuFsqnakjbEJaT4RjRrthWuwE-RS3yNG4-wbccs";
const SHEET_NAME = "CallSched";
const HEADER_ROW = [
  "Timestamp",
  "Full Name",
  "Phone Number",
  "Purpose",
  "Date",
  "Time",
  "Location",
  "Age",
  "Passport Status",
  "Desired Country",
  "Desired Position",
  "Notes",
  "Agent",
];

function asText(value) {
  return String(value ?? "").trim();
}

function formatTimeDisplay(value) {
  const text = asText(value);
  if (!text) return "";

  const match = text.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
  if (!match) return text;

  let hours = Number(match[1]);
  const minutes = match[2];
  let meridiem = (match[3] || "").toUpperCase();

  if (!meridiem) {
    meridiem = hours >= 12 ? "PM" : "AM";
  }

  hours %= 12;
  if (hours === 0) hours = 12;

  return `${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    if (isEmptyPayload(payload)) {
      return jsonResponse({ ok: false, error: "Empty payload" });
    }
    const sheet = getOrCreateSheet();

    sheet.appendRow([
      new Date(),
      asText(payload.fullName || payload.workerName || ""),
      "",
      asText(payload.purpose || ""),
      asText(payload.date || ""),
      formatTimeDisplay(payload.time || ""),
      asText(payload.location || ""),
      asText(payload.age || ""),
      asText(payload.passportStatus || ""),
      asText(payload.desiredCountry || ""),
      asText(payload.desiredPosition || ""),
      asText(payload.notes || ""),
      asText(payload.representativeName || payload.agent || ""),
    ]);

    const row = sheet.getLastRow();
    const phoneCell = sheet.getRange(row, 3);
    phoneCell.setNumberFormat("@");
    phoneCell.setValue(asText(payload.phoneNumber || ""));

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

function isEmptyPayload(payload) {
  return !(
    asText(payload.fullName || payload.workerName || "") ||
    asText(payload.phoneNumber || "") ||
    asText(payload.purpose || "") ||
    asText(payload.date || "") ||
    asText(payload.time || "")
  );
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  const headerRange = sheet.getRange(1, 1, 1, HEADER_ROW.length);
  const currentHeaders = headerRange.getValues()[0];
  const hasMatchingHeaders = HEADER_ROW.every((header, index) => currentHeaders[index] === header);

  if (!hasMatchingHeaders) {
    headerRange.setValues([HEADER_ROW]);
  }

  sheet.setFrozenRows(1);

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
