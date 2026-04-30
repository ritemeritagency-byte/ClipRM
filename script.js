const form = document.getElementById("leadForm");
const leadList = document.getElementById("leadList");
const clearBtn = document.getElementById("clearBtn");
const template = document.getElementById("leadItemTemplate");
const statusEl = document.getElementById("formStatus");
const storageKey = "rmia-lead-callbacks";

const googleSheetsEndpoint =
  document.querySelector('meta[name="google-sheets-web-app-url"]')?.content?.trim() ||
  window.GOOGLE_SHEETS_WEB_APP_URL ||
  "";

const dateTimeFormatter = new Intl.DateTimeFormat([], {
  dateStyle: "medium",
  timeStyle: "short",
});

function setStatus(message, state = "") {
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

function readLeads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLeads(leads) {
  localStorage.setItem(storageKey, JSON.stringify(leads));
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

function formatSchedule(value) {
  if (!value) return "Schedule: not set";
  const date = new Date(value);
  return `Schedule: ${dateTimeFormatter.format(date)}`;
}

function escapeText(value) {
  return clean(value);
}

function renderLeads() {
  const leads = readLeads();
  leadList.innerHTML = "";

  if (!leads.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No leads saved yet.";
    leadList.appendChild(empty);
    return;
  }

  [...leads]
    .reverse()
    .forEach((lead) => {
      const node = template.content.cloneNode(true);
      node.querySelector("[data-name]").textContent = escapeText(lead.fullName);
      node.querySelector("[data-country]").textContent = escapeText(lead.desiredCountry);
      node.querySelector("[data-meta]").textContent =
        `${escapeText(lead.phoneNumber)} · ${escapeText(lead.location)} · ${escapeText(lead.desiredPosition)} · Passport: ${escapeText(lead.passportStatus)}`;
      node.querySelector("[data-schedule]").textContent = formatSchedule(lead.schedule);
      node.querySelector("[data-notes]").textContent = lead.notes ? `Notes: ${escapeText(lead.notes)}` : "";
      leadList.appendChild(node);
    });
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

    const leads = readLeads();
    leads.push(lead);
    writeLeads(leads);

    const syncResult = await syncLeadToGoogleSheets(lead);
    form.reset();
    renderLeads();

    if (syncResult.synced) {
      setStatus("Your response has been recorded and sent to Google Sheets.", "success");
    } else {
      setStatus("Your response has been recorded locally. Google Sheets endpoint is not configured.", "success");
    }
  } catch (error) {
    console.error(error);
    setStatus("Could not record your response right now. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
});

clearBtn.addEventListener("click", () => {
  form.reset();
  resetStatus();
});

renderLeads();

if (!googleSheetsEndpoint) {
  setStatus("Google Sheets sync is not configured yet.", "");
}
