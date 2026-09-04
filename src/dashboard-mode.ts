import OBR from "@owlbear-rodeo/sdk";
import "./dashboard-mode.css";

const DASHBOARD_MODAL_ID = "com.esortland.miru-companion/dashboard";
const params = new URLSearchParams(window.location.search);
const isFullDashboard = params.get("full") === "1";

document.documentElement.dataset.miruFull = isFullDashboard ? "true" : "false";

function classifySections() {
  document.querySelectorAll<HTMLElement>("#app > section").forEach(section => {
    const title = section.querySelector<HTMLElement>(".section-title span")?.textContent?.trim().toLowerCase();
    if (!title) {
      if (section.classList.contains("vitals")) section.dataset.miruSection = "vitals";
      return;
    }
    let key = title.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (key === "combat-control") key = "combat";
    section.dataset.miruSection = key;
  });
}

async function toggleDashboard() {
  if (isFullDashboard) {
    await OBR.modal.close(DASHBOARD_MODAL_ID);
    return;
  }

  await OBR.modal.open({
    id: DASHBOARD_MODAL_ID,
    url: `${import.meta.env.BASE_URL}index.html?full=1`,
    fullScreen: true,
    hidePaper: true
  });
}

function injectDashboardButton() {
  if (document.querySelector("[data-miru-dashboard-toggle]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.miruDashboardToggle = "true";
  button.className = isFullDashboard ? "dashboard-toggle" : "dashboard-toggle dashboard-toggle-fixed";
  button.textContent = isFullDashboard ? "Close dashboard" : "Open full dashboard";
  button.addEventListener("click", () => void toggleDashboard());

  if (isFullDashboard) {
    const hero = document.querySelector<HTMLElement>(".hero");
    if (hero) hero.append(button);
    else document.body.append(button);
  } else {
    document.body.append(button);
  }
}

function enhance() {
  classifySections();
  injectDashboardButton();
}

const observer = new MutationObserver(enhance);
observer.observe(document.body, { childList: true, subtree: true });
enhance();
