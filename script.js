const form = document.getElementById("leadForm");
const statusEl = document.getElementById("formStatus");
let successModalTimer = null;
let successModal = null;

const googleSheetsEndpoint =
  document.querySelector('meta[name="google-sheets-web-app-url"]')?.content?.trim() ||
  window.GOOGLE_SHEETS_WEB_APP_URL ||
  "";

function setStatus(message, state = "") {
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeLead(rawLead) {
  const date = clean(rawLead.date);
  const time = clean(rawLead.time);
  return {
    agencyName: clean(rawLead.agencyName) || "Rite Merit International Recruitment Agency",
    agent: clean(rawLead.agent) || clean(rawLead.representativeName) || "Clip",
    representativeName: clean(rawLead.representativeName) || clean(rawLead.agent) || "Clip",
    purpose: clean(rawLead.purpose) || "Missed call follow-up",
    workerName: clean(rawLead.workerName),
    phoneNumber: clean(rawLead.phoneNumber),
    age: clean(rawLead.age),
    date,
    time,
    location: clean(rawLead.location),
    desiredPosition: clean(rawLead.desiredPosition),
    desiredCountry: clean(rawLead.desiredCountry),
    passportStatus: clean(rawLead.passportStatus),
    createdAt: new Date().toISOString(),
    source: "website-form",
  };
}

function validateLead(lead) {
  const errors = [];

  if (!lead.workerName) errors.push("Worker Name is required.");
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
      <p class="section-kicker">Submission complete</p>
      <h2 id="successTitle">Thanks. Your details are in.</h2>
      <p>The representative will call you within 1 hour or at the time you selected.</p>
      <p class="success-card__meta">If you need to update anything, please contact the agency directly.</p>
      <button type="button" class="primary-btn success-modal__button" data-close-success>Done</button>
    </div>
  `;

  document.body.appendChild(modal);
  successModal = modal;

  modal.querySelectorAll("[data-close-success]").forEach((element) => {
    element.addEventListener("click", hideSuccessModal);
  });

  return successModal;
}

function showSuccessModal() {
  const modal = ensureSuccessModal();
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
      showSuccessModal();
    } else {
      showSuccessModal();
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

window.addEventListener("pageshow", hideSuccessModal);
