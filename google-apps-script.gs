const SPREADSHEET_ID = "116oDzuFsqnakjbEJaT4RjRrthWuwE-RS3yNG4-wbccs";
const SHEET_NAME = "CallSched";
const HEADER_ROW = [
  "Timestamp",
  "Agency Name",
  "Agent",
  "Representative Name",
  "Full Name",
  "Phone Number",
  "Email Address",
  "Purpose",
  "Date",
  "Time",
  "Location",
  "GPS Latitude",
  "GPS Longitude",
  "GPS Accuracy",
  "GPS Maps Link",
  "GPS Captured At",
  "Age",
  "Passport Status",
  "Desired Country",
  "Desired Position",
  "Notes",
  "Confirmation Code",
  "Created At",
  "Source",
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

function normalizePurpose(value) {
  switch (asText(value)) {
    case "Receive Call":
      return "Receive a Call from a Rite Merit Representative";
    case "Visit to Office":
      return "Visit the Office";
    case "Schedule Call":
      return "Schedule a Follow-Up Call";
    default:
      return asText(value);
  }
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    if (isEmptyPayload(payload)) {
      return jsonResponse({ ok: false, error: "Empty payload" });
    }
    if (!asText(payload.emailAddress || "")) {
      return jsonResponse({ ok: false, error: "Email Address is required." });
    }
    const sheet = getOrCreateSheet();

    sheet.appendRow([
      new Date(),
      asText(payload.agencyName || ""),
      asText(payload.agent || ""),
      asText(payload.representativeName || ""),
      asText(payload.fullName || payload.workerName || ""),
      asText(payload.phoneNumber || ""),
      asText(payload.emailAddress || ""),
      normalizePurpose(payload.purpose || ""),
      asText(payload.date || ""),
      formatTimeDisplay(payload.time || ""),
      asText(payload.location || ""),
      asText(payload.gpsLatitude || ""),
      asText(payload.gpsLongitude || ""),
      asText(payload.gpsAccuracy || ""),
      asText(payload.gpsMapsLink || ""),
      asText(payload.gpsCapturedAt || ""),
      asText(payload.age || ""),
      asText(payload.passportStatus || ""),
      asText(payload.desiredCountry || ""),
      asText(payload.desiredPosition || ""),
      asText(payload.notes || ""),
      asText(payload.confirmationCode || ""),
      asText(payload.createdAt || ""),
      asText(payload.source || ""),
    ]);

    try {
      sendConfirmationEmail(payload);
    } catch (emailError) {
      return jsonResponse({
        ok: false,
        error: `Booking saved, but email sending failed: ${emailError.message || "Unknown email error"}`,
      });
    }

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
    normalizePurpose(payload.purpose || "") ||
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

function sendConfirmationEmail(payload) {
  const emailAddress = asText(payload.emailAddress || "");
  if (!emailAddress) return;

  const fullName = asText(payload.fullName || payload.workerName || "Worker Name");
  const dateText = asText(payload.date || "");
  const timeText = formatTimeDisplay(payload.time || "");
  const confirmationCode = asText(payload.confirmationCode || "");
  const purpose = normalizePurpose(payload.purpose || "Appointment");
  const position = asText(payload.desiredPosition || "");
  const country = asText(payload.desiredCountry || "");
  const mapsLink = asText(payload.gpsMapsLink || "");

  const body = [
    `Hi ${fullName},`,
    "",
    "Your Rite Merit appointment has been confirmed.",
    "We have also included the office address below for easy reference.",
    "",
    `Reference Code: ${confirmationCode}`,
    `Purpose: ${purpose}`,
    `Date: ${dateText}`,
    `Time: ${timeText}`,
    `Position: ${position}`,
    `Country: ${country}`,
    "",
    "Office address:",
    "1570 A. Mabini St, Ermita, Manila, 4th Floor Gedisco Center Room D",
    "Office hours: 10:00 AM to 5:00 PM",
    "Contact: +63 926 640 6364",
    "DMW License: 288-LB-03062024-R",
    `Google Maps: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("1570 A. Mabini St, Ermita, Manila, 4th Floor Gedisco Center Room D")}`,
  ];

  MailApp.sendEmail({
    to: emailAddress,
    subject: `Rite Merit Appointment Confirmation - ${confirmationCode || "RM Appointment"}`,
    body: body.join("\n"),
    name: "Rite Merit International Manpower Corporation",
  });
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
