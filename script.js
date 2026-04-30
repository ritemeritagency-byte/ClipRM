const form = document.getElementById("leadForm");
const statusEl = document.getElementById("formStatus");

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
  return {
    agencyName: clean(rawLead.agencyName) || "Rite Merit International Recruitment Agency",
    representativeName: clean(rawLead.representativeName) || "Clip",
    fullName: clean(rawLead.fullName),
    phoneNumber: clean(rawLead.phoneNumber),
    location: clean(rawLead.location),
    desiredPosition: clean(rawLead.desiredPosition),
    desiredCountry: clean(rawLead.desiredCountry),
    passportStatus: clean(rawLead.passportStatus),
    schedule: clean(rawLead.schedule),
    notes: clean(rawLead.notes),
    createdAt: new Date().toISOString(),
    source: "website-form",
  };
}

function validateLead(lead) {
  const errors = [];

  if (!lead.fullName) errors.push("Full Name is required.");
  if (!lead.phoneNumber) errors.push("Phone Number is required.");
  if (!lead.location) errors.push("Location is required.");
  if (!lead.desiredPosition) errors.push("Desired Position is required.");
  if (!lead.desiredCountry) errors.push("Desired Country is required.");
  if (!lead.passportStatus) errors.push("Passport Status is required.");
  if (!lead.schedule) errors.push("Schedule for Call or Visit to Office is required.");

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
      setStatus("Thanks. The representative will call you within 1 hour or at your selected time.", "success");
    } else {
      setStatus("Thanks. The representative will call you within 1 hour or at your selected time.", "success");
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
