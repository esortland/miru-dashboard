import OBR from "@owlbear-rodeo/sdk";
import "./dashboard-mode.css";

const DASHBOARD_MODAL_ID = "com.esortland.miru-companion/dashboard";
const PLAY_MODAL_ID = "com.esortland.miru-companion/play";
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

async function openPlaySurface() {
  await OBR.modal.open({
    id: PLAY_MODAL_ID,
    url: `${import.meta.env.BASE_URL}play.html`,
    fullScreen: true,
    hidePaper: true
  });
}

async function closeDashboard() {
  await OBR.modal.close(DASHBOARD_MODAL_ID);
}

function injectLauncher() {
  if (document.querySelector("[data-miru-play-toggle]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.miruPlayToggle = "true";
  button.className = isFullDashboard ? "dashboard-toggle" : "dashboard-toggle play-surface-fixed";
  button.textContent = "Open MIRU play surface";
  button.addEventListener("click", () => void openPlaySurface());

  if (isFullDashboard) {
    const hero = document.querySelector<HTMLElement>(".hero");
    hero?.append(button);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "dashboard-toggle";
    close.textContent = "Close dashboard";
    close.addEventListener("click", () => void closeDashboard());
    hero?.append(close);
  } else {
    document.body.append(button);
  }
}

function enhance() { classifySections(); injectLauncher(); }
const observer = new MutationObserver(enhance);
observer.observe(document.body, { childList: true, subtree: true });
enhance();
