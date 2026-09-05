const LEGACY_SECTIONS = new Set(["QUICK ROLLS", "PLAYER TOKEN", "MAP STAMPS"]);

function consolidate() {
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) return;

  const notice = app.querySelector<HTMLElement>(".notice");
  if (notice && notice.textContent?.includes("map tools")) {
    notice.textContent = "Open a scene in Owlbear Rodeo to persist MIRU campaign state.";
  }

  for (const section of app.querySelectorAll<HTMLElement>(":scope > section")) {
    const title = section.querySelector<HTMLElement>(".section-title span")?.textContent?.trim();
    if (!title) continue;

    if (LEGACY_SECTIONS.has(title)) {
      section.remove();
      continue;
    }

    if (title === "FIELD NOTES") {
      const heading = section.querySelector<HTMLElement>(".section-title span");
      const subheading = section.querySelector<HTMLElement>(".section-title small");
      if (heading) heading.textContent = "CAMPAIGN NOTES";
      if (subheading) subheading.textContent = "saved with scene";
      section.querySelector<HTMLElement>(".field-label")?.remove();
    }
  }
}

const app = document.querySelector<HTMLElement>("#app");
if (app) {
  consolidate();
  new MutationObserver(consolidate).observe(app, { childList: true });
}
