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

const dateField = form.querySelector('input[name="date"]');
let lastGeneratedMessage = "";

function setStatus(message, state = "") {
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

function clean(value) {
  return String(value ?? "").trim();
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
    case "Book an Appointment":
      return "appointment";
    case "Receive a Call from a Rite Merit Representative":
      return "call with a Rite Merit representative";
    case "Schedule a Follow-Up Call":
      return "follow-up call";
    case "Visit the Office":
      return "office visit";
    case "Learn More About Job Opportunities":
      return "discussion about job opportunities";
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
    `You have been invited for an interview on ${dateText}, from ${timeText} at our office, Rite Merit International Manpower Corporation, for a ${purposePhrase} as a ${position} bound for ${country}.`,
    "",
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
      <p>The representative will review your details and confirm the best schedule.</p>
      <p class="success-card__meta">If you need to update anything, please contact the agency directly.</p>
      <div class="success-card__message-wrap">
        <p class="success-card__label">Ready-to-send message</p>
        <pre class="success-card__message" id="generatedMessage"></pre>
      </div>
      <div class="success-modal__actions">
        <button type="button" class="secondary-btn success-modal__button" data-copy-message>Copy message</button>
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

function showSuccessModal(lead) {
  const modal = ensureSuccessModal();
  const messageEl = modal.querySelector("#generatedMessage");
  lastGeneratedMessage = buildAppointmentMessage(lead);
  if (messageEl) {
    messageEl.textContent = lastGeneratedMessage;
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
