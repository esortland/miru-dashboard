import OBR from "@owlbear-rodeo/sdk";
import "./dashboard-mode.css";

const DASHBOARD_MODAL_ID = "com.esortland.miru-companion/dashboard";
const PLAY_MODAL_ID = "com.esortland.miru-companion/play";
const params = new URLSearchParams(window.location.search);
const isFullDashboard = params.get("full") === "1";
let playLaunchRequested = false;

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
  if (playLaunchRequested) return;
  playLaunchRequested = true;
  try {
    await OBR.modal.open({
      id: PLAY_MODAL_ID,
      url: `${import.meta.env.BASE_URL}play.html`,
      fullScreen: true,
      hidePaper: true
    });
  } catch (error) {
    playLaunchRequested = false;
    console.error("Unable to open MIRU play surface", error);
  }
}

async function closeDashboard() {
  await OBR.modal.close(DASHBOARD_MODAL_ID);
}

function injectDashboardControls() {
  if (!isFullDashboard || document.querySelector("[data-miru-play-toggle]")) return;
  const hero = document.querySelector<HTMLElement>(".hero");
  if (!hero) return;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.miruPlayToggle = "true";
  button.className = "dashboard-toggle";
  button.textContent = "Open MIRU play surface";
  button.addEventListener("click", () => void openPlaySurface());
  hero.append(button);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "dashboard-toggle";
  close.textContent = "Close dashboard";
  close.addEventListener("click", () => void closeDashboard());
  hero.append(close);
}

function enhance() {
  classifySections();
  injectDashboardControls();
}

const observer = new MutationObserver(enhance);
observer.observe(document.body, { childList: true, subtree: true });
enhance();

// The Owlbear action popover is only a launch target now. Opening MIRU from
// the extension action always goes straight to the full-screen play desk.
// The compact popover no longer asks the player to press a second launcher.
if (!isFullDashboard) {
  OBR.onReady(() => void openPlaySurface());
}
