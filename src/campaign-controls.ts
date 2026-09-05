import "./style.css";

function enhanceCampaignControls() {
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) return;

  const reset = app.querySelector<HTMLButtonElement>("#reset");
  if (!reset) return;

  reset.textContent = "Start new campaign";
  reset.classList.add("new-campaign-button");
  reset.setAttribute("aria-label", "Start a new MIRU campaign in this Owlbear room");

  const controls = reset.closest<HTMLElement>(".campaign-controls");
  if (!controls || controls.querySelector(".new-campaign-help")) return;

  const help = document.createElement("p");
  help.className = "new-campaign-help";
  help.textContent = "Starts fresh in this same Owlbear room. This clears the saved MIRU campaign, including the explored map, position, inventory, vitals, notes, combat, and turn progress.";
  controls.insertAdjacentElement("beforebegin", help);
}

const app = document.querySelector<HTMLElement>("#app");
if (app) {
  enhanceCampaignControls();
  new MutationObserver(enhanceCampaignControls).observe(app, { childList: true, subtree: true });
}
