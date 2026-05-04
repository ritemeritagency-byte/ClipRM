const form = document.getElementById("leadForm");
const statusEl = document.getElementById("formStatus");
let successModalTimer = null;
let successModal = null;

const googleSheetsEndpoint =
  document.querySelector('meta[name="google-sheets-web-app-url"]')?.content?.trim() ||
  window.GOOGLE_SHEETS_WEB_APP_URL ||
  "";

const officeAddress =
  "1570 A. Mabini St, Ermita, Manila, 4th Floor Gedisco Center Room D";
const officeHours = "10:00 AM to 5:00 PM";
const officeContact = "+63 926 640 6364";
const dmwLicense = "288-LB-03062024-R";
const officeLogoUrl = "Photos/rm logo.jpeg";
const officeMapUrl = `https://www.google.com/maps?q=${encodeURIComponent(officeAddress)}&output=embed`;
const officeDirectionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeAddress)}`;

const dateField = form.querySelector('input[name="date"]');
let lastGeneratedMessage = "";
let lastConfirmationCode = "";
let lastSubmittedLead = null;
let cachedLogoDataUrl = null;

function setStatus(message, state = "") {
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

function clean(value) {
  return String(value ?? "").trim();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateCode(date = new Date()) {
  return [
    String(date.getFullYear()).slice(-2),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("");
}

function generateConfirmationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const now = new Date();
  const randomPart = Array.from({ length: 4 }, () => {
    const index = Math.floor(Math.random() * alphabet.length);
    return alphabet[index];
  }).join("");

  return `RM-${formatDateCode(now)}-${randomPart}`;
}

function formatDateText(value) {
  const text = clean(value);
  if (!text) return "";

  const parsed = new Date(`${text}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return text;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function getPurposePhrase(purpose) {
  switch (clean(purpose)) {
    case "Receive Call":
      return "call with a Rite Merit representative";
    case "Visit to Office":
      return "office visit";
    case "Schedule Call":
      return "scheduled call";
    default:
      return "appointment";
  }
}

function buildAppointmentMessage(lead) {
  const name = clean(lead.fullName) || "Worker Name";
  const dateText = formatDateText(lead.date) || "your selected date";
  const timeText = clean(lead.time) || "your selected time";
  const purposePhrase = getPurposePhrase(lead.purpose);
  const position = clean(lead.desiredPosition).toUpperCase() || "POSITION";
  const country = clean(lead.desiredCountry).toUpperCase() || "COUNTRY";

  return [
    `Hi, ${name},`,
    "",
    `You have been invited for an interview on ${dateText}, from ${timeText} at our office, Rite Merit International Manpower Corporation, for ${purposePhrase} regarding your application as a ${position} bound for ${country}.`,
    "",
    `Reference Code: ${clean(lead.confirmationCode) || "RM-XXXXXX-XXXX"}`,
    `Date to report: ${dateText}`,
    `DMW License: ${dmwLicense}`,
    "",
    `Our office is located at ${officeAddress}. We are open from ${officeHours}.`,
    "",
    "Kindly look for Mr. Clip/Solomon or Ms. Chavz.",
    "",
    "Please remember to bring your updated passport.",
    "",
    `If you have any questions, feel free to call us at ${officeContact}.`,
    "",
    "- Admin Clip",
  ].join("\n");
}

function buildOfficeCardText() {
  return [
    "Rite Merit International Manpower Corporation",
    `Office address: ${officeAddress}`,
    `Office hours: ${officeHours}`,
    `Contact: ${officeContact}`,
    `DMW License: ${dmwLicense}`,
    `Google Maps: ${officeDirectionsUrl}`,
  ].join("\n");
}

function buildAppointmentPassText(lead) {
  const dateText = formatDateText(lead.date) || "your selected date";
  const timeText = clean(lead.time) || "your selected time";

  return [
    "APPOINTMENT PASS",
    `Reference Code: ${clean(lead.confirmationCode) || "RM-XXXXXX-XXXX"}`,
    `Name: ${clean(lead.fullName) || "Worker Name"}`,
    `Purpose: ${clean(lead.purpose) || "Appointment"}`,
    `Date: ${dateText}`,
    `Time: ${timeText}`,
    `Position: ${clean(lead.desiredPosition) || "N/A"}`,
    `Country: ${clean(lead.desiredCountry) || "N/A"}`,
    `Office: ${officeAddress}`,
    `Hours: ${officeHours}`,
    `Contact: ${officeContact}`,
  ].join("\n");
}

function getOfficeLogoDataUrl() {
  if (cachedLogoDataUrl !== null) {
    return Promise.resolve(cachedLogoDataUrl);
  }

  return fetch(officeLogoUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load logo: ${response.status}`);
      }
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            cachedLogoDataUrl = String(reader.result || "");
            resolve(cachedLogoDataUrl);
          };
          reader.onerror = () => reject(reader.error || new Error("Failed to read logo"));
          reader.readAsDataURL(blob);
        }),
    )
    .catch((error) => {
      console.warn("Using fallback pass image without logo.", error);
      cachedLogoDataUrl = "";
      return "";
    });
}

function escapeXml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildAppointmentPassSvg(lead, logoDataUrl = "") {
  const lines = [
    "APPOINTMENT PASS",
    `Reference Code: ${clean(lead.confirmationCode) || "RM-XXXXXX-XXXX"}`,
    `Name: ${clean(lead.fullName) || "Worker Name"}`,
    `Purpose: ${clean(lead.purpose) || "Appointment"}`,
    `Date: ${formatDateText(lead.date) || "your selected date"}`,
    `Time: ${clean(lead.time) || "your selected time"}`,
    `Position: ${clean(lead.desiredPosition) || "N/A"}`,
    `Country: ${clean(lead.desiredCountry) || "N/A"}`,
    `Office: ${officeAddress}`,
    `Hours: ${officeHours}`,
    `Contact: ${officeContact}`,
  ];

  const textNodes = lines
    .map(
      (line, index) => `
        <text x="72" y="${260 + index * 52}" class="pass-line">${escapeXml(line)}</text>
      `,
    )
    .join("");

  const logoBlock = logoDataUrl
    ? `
      <rect x="72" y="72" width="144" height="144" rx="28" fill="#ffffff" opacity="0.08" />
      <image
        x="84"
        y="84"
        width="120"
        height="120"
        href="${logoDataUrl}"
        preserveAspectRatio="xMidYMid meet"
      />
    `
    : `
      <rect x="72" y="72" width="144" height="144" rx="28" fill="url(#accent)" opacity="0.18" />
      <text x="105" y="154" class="badge">RM</text>
    `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1620" viewBox="0 0 1080 1620">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#081226" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#22c55e" />
        </linearGradient>
        <style>
          .title { font: 800 54px 'Manrope', Arial, sans-serif; fill: #f8fafc; letter-spacing: 3px; }
          .sub { font: 600 26px 'Manrope', Arial, sans-serif; fill: #cbd5e1; }
          .badge { font: 800 22px 'Manrope', Arial, sans-serif; fill: #081226; letter-spacing: 2px; }
          .pass-line { font: 600 34px 'Manrope', Arial, sans-serif; fill: #f8fafc; }
          .small { font: 600 24px 'Manrope', Arial, sans-serif; fill: #cbd5e1; }
        </style>
      </defs>
      <rect width="1080" height="1620" rx="48" fill="url(#bg)" />
      <rect x="48" y="48" width="984" height="1524" rx="40" fill="rgba(15,23,42,0.9)" stroke="rgba(148,163,184,0.25)" />
      <rect x="48" y="48" width="984" height="18" rx="9" fill="url(#accent)" />
      ${logoBlock}
      <text x="72" y="160" class="sub">Rite Merit International Manpower Corporation</text>
      <text x="72" y="230" class="title">APPOINTMENT PASS</text>
      <text x="240" y="122" class="small">Reference Code</text>
      <text x="240" y="166" class="pass-line" style="font-size: 28px; letter-spacing: 2px;">${escapeXml(clean(lead.confirmationCode) || "RM-XXXXXX-XXXX")}</text>
      <rect x="72" y="1340" width="936" height="150" rx="26" fill="rgba(56,189,248,0.12)" stroke="rgba(56,189,248,0.35)" />
      <text x="96" y="1392" class="small">Office address</text>
      <text x="96" y="1440" class="pass-line" style="font-size: 30px;">${escapeXml(officeAddress)}</text>
      <text x="96" y="1494" class="small">Hours: ${escapeXml(officeHours)} | Contact: ${escapeXml(officeContact)}</text>
      ${textNodes}
      <text x="72" y="1250" class="small">DMW License: ${escapeXml(dmwLicense)}</text>
      <rect x="72" y="1270" width="936" height="2" fill="rgba(148,163,184,0.18)" />
      <text x="72" y="1330" class="small">Show this pass at the office together with your reference code.</text>
    </svg>
  `.trim();
}

function normalizeLead(rawLead) {
  const date = clean(rawLead.date);
  const time = clean(rawLead.time);
  return {
    agencyName: clean(rawLead.agencyName) || "Rite Merit International Recruitment Agency",
    agent: clean(rawLead.agent) || clean(rawLead.representativeName) || "Clip",
    representativeName: clean(rawLead.representativeName) || clean(rawLead.agent) || "Clip",
    purpose: clean(rawLead.purpose),
    fullName: clean(rawLead.fullName) || clean(rawLead.workerName),
    phoneNumber: clean(rawLead.phoneNumber),
    age: clean(rawLead.age),
    date,
    time,
    location: clean(rawLead.location),
    desiredPosition: clean(rawLead.desiredPosition),
    desiredCountry: clean(rawLead.desiredCountry),
    passportStatus: clean(rawLead.passportStatus),
    notes: clean(rawLead.notes),
    confirmationCode: clean(rawLead.confirmationCode) || generateConfirmationCode(),
    createdAt: new Date().toISOString(),
    source: "website-form",
  };
}

function validateLead(lead) {
  const errors = [];

  if (!lead.fullName) errors.push("Full Name is required.");
  if (!lead.phoneNumber) errors.push("Phone Number is required.");
  if (!lead.age) errors.push("Age is required.");
  if (!lead.location) errors.push("Location is required.");
  if (!lead.purpose) errors.push("Purpose is required.");
  if (!lead.desiredPosition) errors.push("Desired Position is required.");
  if (!lead.desiredCountry) errors.push("Desired Country is required.");
  if (!lead.passportStatus) errors.push("Passport Status is required.");
  if (!lead.date) errors.push("Date is required.");
  if (!lead.time) errors.push("Time is required.");

  return errors;
}

function setDateMinimum() {
  if (!dateField) return;

  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  const localIsoDate = new Date(today.getTime() - offset).toISOString().split("T")[0];
  dateField.min = localIsoDate;
}

async function syncLeadToGoogleSheets(lead) {
  if (!googleSheetsEndpoint) {
    return { synced: false, reason: "No Google Sheets endpoint configured." };
  }

  await fetch(googleSheetsEndpoint, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(lead),
  });

  return { synced: true };
}

function resetStatus() {
  setStatus("");
}

function ensureSuccessModal() {
  if (successModal) return successModal;

  const modal = document.createElement("div");
  modal.id = "successModal";
  modal.className = "success-modal";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="success-modal__backdrop" data-close-success></div>
    <div class="success-modal__panel panel" role="dialog" aria-modal="true" aria-labelledby="successTitle">
      <div class="success-card__icon">✓</div>
      <p class="section-kicker">Appointment booked</p>
      <h2 id="successTitle">Thanks. We received your appointment request.</h2>
      <p class="success-card__code-label">Reference code</p>
      <p class="success-card__code" id="generatedCode"></p>
      <div class="success-card__pass-shell">
        <div class="success-card__pass-head">
          <span>Appointment pass</span>
          <strong id="generatedCodeInline"></strong>
        </div>
        <div class="success-card__pass" id="generatedPass"></div>
      </div>
      <p>The representative will review your details and confirm the best schedule.</p>
      <p class="success-card__meta">If you need to update anything, please contact the agency directly.</p>
      <div class="success-card__message-wrap">
        <p class="success-card__label">Ready-to-send message</p>
        <pre class="success-card__message" id="generatedMessage"></pre>
      </div>
      <div class="success-card__office">
        <div class="success-card__office-map">
          <iframe
            title="Rite Merit office location"
            src="${officeMapUrl}"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
        <div class="success-card__office-body">
          <p class="success-card__label">Office location</p>
          <p class="success-card__office-title">Rite Merit International Manpower Corporation</p>
          <p class="success-card__office-text">${officeAddress}</p>
          <p class="success-card__office-text">Hours: ${officeHours}</p>
          <p class="success-card__office-text">Contact: ${officeContact}</p>
        </div>
      </div>
      <div class="success-modal__actions">
        <div class="success-modal__action-group">
          <p class="success-modal__group-label">Quick actions</p>
          <div class="success-modal__button-grid">
            <button type="button" class="primary-btn success-modal__button" data-share-pass>Share pass</button>
            <button type="button" class="secondary-btn success-modal__button" data-download-pass>Save pass image</button>
            <a class="secondary-btn success-modal__button success-modal__link" href="${officeDirectionsUrl}" target="_blank" rel="noreferrer">Open map</a>
            <button type="button" class="secondary-btn success-modal__button" data-print-pass>Print / PDF</button>
          </div>
        </div>
        <div class="success-modal__action-group">
          <p class="success-modal__group-label">Copy details</p>
          <div class="success-modal__button-grid">
            <button type="button" class="secondary-btn success-modal__button" data-copy-code>Copy code</button>
            <button type="button" class="secondary-btn success-modal__button" data-copy-address>Copy office address</button>
            <button type="button" class="secondary-btn success-modal__button" data-copy-message>Copy full message</button>
            <button type="button" class="secondary-btn success-modal__button" data-download-message>Download message</button>
          </div>
        </div>
        <button type="button" class="primary-btn success-modal__button" data-close-success>Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  successModal = modal;

  modal.querySelectorAll("[data-close-success]").forEach((element) => {
    element.addEventListener("click", hideSuccessModal);
  });

  modal.querySelector("[data-copy-message]")?.addEventListener("click", copyGeneratedMessage);
  modal.querySelector("[data-copy-code]")?.addEventListener("click", copyConfirmationCode);
  modal.querySelector("[data-copy-address]")?.addEventListener("click", copyOfficeAddress);
  modal.querySelector("[data-print-pass]")?.addEventListener("click", printAppointmentPass);
  modal.querySelector("[data-share-pass]")?.addEventListener("click", shareAppointmentPass);
  modal.querySelector("[data-download-pass]")?.addEventListener("click", downloadAppointmentPass);
  modal.querySelector("[data-download-message]")?.addEventListener("click", downloadGeneratedMessage);

  return successModal;
}

async function copyGeneratedMessage() {
  if (!lastGeneratedMessage) return;

  try {
    await navigator.clipboard.writeText(lastGeneratedMessage);
    setStatus("Message copied to clipboard.", "success");
  } catch (error) {
    console.error(error);
    setStatus("We could not copy the message automatically.", "error");
  }
}

async function copyConfirmationCode() {
  if (!lastConfirmationCode) return;

  try {
    await navigator.clipboard.writeText(lastConfirmationCode);
    setStatus("Reference code copied to clipboard.", "success");
  } catch (error) {
    console.error(error);
    setStatus("We could not copy the code automatically.", "error");
  }
}

async function copyOfficeAddress() {
  try {
    await navigator.clipboard.writeText(buildOfficeCardText());
    setStatus("Office details copied to clipboard.", "success");
  } catch (error) {
    console.error(error);
    setStatus("We could not copy the office details automatically.", "error");
  }
}

function downloadGeneratedMessage() {
  if (!lastGeneratedMessage) return;

  const blob = new Blob(
    [
      `Reference Code: ${lastConfirmationCode}`,
      "",
      lastGeneratedMessage,
      "",
      buildOfficeCardText(),
    ],
    { type: "text/plain;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${lastConfirmationCode || "appointment-confirmation"}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printAppointmentPass() {
  window.print();
}

async function shareAppointmentPass() {
  if (!lastSubmittedLead) return;

  const text = buildAppointmentPassText(lastSubmittedLead);

  try {
    if (navigator.share) {
      const file = await buildAppointmentPassFile();
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Appointment Pass",
          text,
          files: [file],
        });
        return;
      }

      await navigator.share({
        title: "Appointment Pass",
        text,
      });
      return;
    }

    await downloadAppointmentPass();
  } catch (error) {
    console.error(error);
    setStatus("We could not open the share sheet.", "error");
  }
}

async function buildAppointmentPassFile() {
  if (!lastSubmittedLead) return null;

  const logoDataUrl = await getOfficeLogoDataUrl();
  const blob = new Blob([buildAppointmentPassSvg(lastSubmittedLead, logoDataUrl)], {
    type: "image/svg+xml;charset=utf-8",
  });
  return new File([blob], `${lastConfirmationCode || "appointment-pass"}.svg`, {
    type: "image/svg+xml",
  });
}

async function downloadAppointmentPass() {
  if (!lastSubmittedLead) return;

  try {
    const file = await buildAppointmentPassFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Appointment pass image saved.", "success");
  } catch (error) {
    console.error(error);
    setStatus("We could not save the pass image.", "error");
  }
}

function showSuccessModal(lead) {
  const modal = ensureSuccessModal();
  const messageEl = modal.querySelector("#generatedMessage");
  const codeEl = modal.querySelector("#generatedCode");
  const codeInlineEl = modal.querySelector("#generatedCodeInline");
  const passEl = modal.querySelector("#generatedPass");
  lastSubmittedLead = lead;
  lastConfirmationCode = lead.confirmationCode || generateConfirmationCode();
  lastGeneratedMessage = buildAppointmentMessage(lead);
  if (messageEl) {
    messageEl.textContent = lastGeneratedMessage;
  }
  if (codeEl) {
    codeEl.textContent = lastConfirmationCode;
  }
  if (codeInlineEl) {
    codeInlineEl.textContent = lastConfirmationCode;
  }
  if (passEl) {
    passEl.innerHTML = `
      <div class="success-card__pass-grid">
        <div><span>Name</span><strong>${clean(lead.fullName)}</strong></div>
        <div><span>Date</span><strong>${formatDateText(lead.date)}</strong></div>
        <div><span>Time</span><strong>${clean(lead.time)}</strong></div>
        <div><span>Purpose</span><strong>${clean(lead.purpose)}</strong></div>
        <div><span>Position</span><strong>${clean(lead.desiredPosition)}</strong></div>
        <div><span>Country</span><strong>${clean(lead.desiredCountry)}</strong></div>
        <div class="success-card__pass-full"><span>Show at office</span><strong>${officeAddress}</strong></div>
      </div>
    `;
  }
  if (successModalTimer) {
    clearTimeout(successModalTimer);
    successModalTimer = null;
  }
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  modal.querySelector("[data-close-success]")?.focus();
  successModalTimer = window.setTimeout(hideSuccessModal, 4500);
}

function hideSuccessModal() {
  if (!successModal) return;
  if (successModalTimer) {
    clearTimeout(successModalTimer);
    successModalTimer = null;
  }
  successModal.hidden = true;
  successModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      form.querySelector("input, select, textarea, button")?.focus();
    }, 150);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetStatus();

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const formData = new FormData(form);
    const rawLead = Object.fromEntries(formData.entries());
    const lead = normalizeLead(rawLead);
    const errors = validateLead(lead);

    if (errors.length) {
      setStatus(errors[0], "error");
      return;
    }

    const syncResult = await syncLeadToGoogleSheets(lead);
    form.reset();

    if (syncResult.synced) {
      showSuccessModal(lead);
    } else {
      showSuccessModal(lead);
      console.warn("Google Sheets endpoint is not configured.");
    }
  } catch (error) {
    console.error(error);
    setStatus("We could not submit your form right now. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});

if (!googleSheetsEndpoint) {
  console.warn("Google Sheets sync is not configured yet.");
}

setDateMinimum();
window.addEventListener("pageshow", hideSuccessModal);
