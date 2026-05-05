const SPREADSHEET_ID = "116oDzuFsqnakjbEJaT4RjRrthWuwE-RS3yNG4-wbccs";
const SHEET_NAME = "Schedule";
const HEADER_ROW = [
  "Timestamp",
  "Agency Name",
  "Full Name",
  "Phone Number",
  "Email Address",
  "Purpose",
  "Date",
  "Time",
  "Location",
  "Age",
  "Passport Status",
  "Desired Country",
  "Desired Position",
  "Notes",
  "Confirmation Code",
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
    case "Receive a Call from a Rite Merit Representative":
      return "Receive a Call from a Rite Merit Representative";
    case "Visit to Office":
    case "Visit the Office":
      return "Visit the Office";
    case "Schedule Call":
    case "Schedule a Follow-Up Call":
      return "Schedule a Follow-Up Call";
    default:
      return asText(value);
  }
}

function normalizeLeadPayload(rawPayload) {
  const payload = rawPayload || {};

  return {
    agencyName: asText(payload.agencyName || "Rite Merit International Recruitment Agency"),
    fullName: asText(payload.fullName || payload.workerName || ""),
    phoneNumber: asText(payload.phoneNumber || ""),
    emailAddress: asText(payload.emailAddress || ""),
    purpose: normalizePurpose(payload.purpose || ""),
    date: asText(payload.date || ""),
    time: asText(payload.time || ""),
    location: asText(payload.location || ""),
    age: asText(payload.age || ""),
    passportStatus: asText(payload.passportStatus || ""),
    desiredCountry: asText(payload.desiredCountry || ""),
    desiredPosition: asText(payload.desiredPosition || ""),
    notes: asText(payload.notes || ""),
    confirmationCode: asText(payload.confirmationCode || ""),
  };
}

function doGet() {
  migrateSheetHeaders();
  return jsonResponse({
    ok: true,
    message: "Rite Merit appointment endpoint is running.",
  });
}

function doPost(e) {
  try {
    const payload = normalizeLeadPayload(parsePayload(e));
    if (isEmptyPayload(payload)) {
      return jsonResponse({ ok: false, error: "Empty payload" });
    }
    if (!payload.emailAddress) {
      return jsonResponse({ ok: false, error: "Email Address is required." });
    }
    const sheet = migrateSheetHeaders();
    const emailResult = sendConfirmationEmail(payload);

    sheet.appendRow([
      new Date(),
      payload.agencyName,
      payload.fullName,
      payload.phoneNumber,
      payload.emailAddress,
      payload.purpose,
      payload.date,
      formatTimeDisplay(payload.time),
      payload.location,
      payload.age,
      payload.passportStatus,
      payload.desiredCountry,
      payload.desiredPosition,
      payload.notes,
      payload.confirmationCode,
    ]);

    return jsonResponse({ ok: true, emailSent: emailResult.sent, emailError: emailResult.error || "" });
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
    asText(payload.fullName || "") ||
    asText(payload.phoneNumber || "") ||
    asText(payload.emailAddress || "") ||
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
    try {
      return JSON.parse(raw);
    } catch (error) {
      return {};
    }
  }

  try {
    return Utilities.parseQueryString(raw);
  } catch (error) {
    return {};
  }
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

  if (sheet.getMaxColumns() > HEADER_ROW.length) {
    sheet.deleteColumns(HEADER_ROW.length + 1, sheet.getMaxColumns() - HEADER_ROW.length);
  }

  sheet.setFrozenRows(1);

  return sheet;
}

function migrateSheetHeaders() {
  const sheet = getOrCreateSheet();
  const currentHeaders = sheet.getRange(1, 1, 1, HEADER_ROW.length).getValues()[0];
  const needsMigration = HEADER_ROW.some((header, index) => currentHeaders[index] !== header);

  if (needsMigration) {
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
  }

  return sheet;
}

function sendConfirmationEmail(payload) {
  const emailAddress = asText(payload.emailAddress || "");
  if (!emailAddress) {
    return { sent: false, error: "Email Address is required." };
  }

  const fullName = asText(payload.fullName || "Worker Name");
  const dateText = asText(payload.date || "");
  const timeText = formatTimeDisplay(payload.time || "");
  const confirmationCode = asText(payload.confirmationCode || "");
  const purpose = normalizePurpose(payload.purpose || "Appointment");
  const position = asText(payload.desiredPosition || "");
  const country = asText(payload.desiredCountry || "");

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

  try {
    MailApp.sendEmail({
      to: emailAddress,
      subject: `Rite Merit Appointment Confirmation - ${confirmationCode || "RM Appointment"}`,
      body: body.join("\n"),
      name: "Rite Merit International Manpower Corporation",
    });
    return { sent: true, error: "" };
  } catch (error) {
    return {
      sent: false,
      error: error && error.message ? error.message : "Unknown email error",
    };
  }
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
