import OBR from "@owlbear-rodeo/sdk";
import "./dashboard-mode.css";

const DASHBOARD_MODAL_ID = "com.esortland.miru-companion/dashboard";
const MAP_MODAL_ID = "com.esortland.miru-companion/map";
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
  await OBR.modal.open({ id: DASHBOARD_MODAL_ID, url: `${import.meta.env.BASE_URL}index.html?full=1`, fullScreen: true, hidePaper: true });
}

async function openMap() {
  await OBR.modal.open({ id: MAP_MODAL_ID, url: `${import.meta.env.BASE_URL}map.html`, fullScreen: true, hidePaper: true });
}

function injectLaunchers() {
  if (!document.querySelector("[data-miru-map-toggle]")) {
    const mapButton = document.createElement("button");
    mapButton.type = "button";
    mapButton.dataset.miruMapToggle = "true";
    mapButton.className = isFullDashboard ? "dashboard-toggle" : "dashboard-toggle dashboard-map-fixed";
    mapButton.textContent = "Open interactive map";
    mapButton.addEventListener("click", () => void openMap());
    if (isFullDashboard) document.querySelector<HTMLElement>(".hero")?.append(mapButton); else document.body.append(mapButton);
  }

  if (document.querySelector("[data-miru-dashboard-toggle]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.miruDashboardToggle = "true";
  button.className = isFullDashboard ? "dashboard-toggle" : "dashboard-toggle dashboard-toggle-fixed";
  button.textContent = isFullDashboard ? "Close dashboard" : "Open full dashboard";
  button.addEventListener("click", () => void toggleDashboard());
  if (isFullDashboard) document.querySelector<HTMLElement>(".hero")?.append(button); else document.body.append(button);
}

function enhance() { classifySections(); injectLaunchers(); }
const observer = new MutationObserver(enhance);
observer.observe(document.body, { childList: true, subtree: true });
enhance();
