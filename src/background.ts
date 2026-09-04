import OBR from "@owlbear-rodeo/sdk";
import { setupStampTool } from "./scene";
import { loadState, saveState } from "./state";

const BIND_MENU_ID = "com.esortland.miru-companion/bind-player";

async function setupPlayerBinding() {
  await OBR.contextMenu.create({
    id: BIND_MENU_ID,
    icons: [{ icon: "/stamp-tool.svg", label: "Bind as MIRU player", filter: { min: 1, max: 1 } }],
    onClick: context => {
      void (async () => {
        const item = context.items[0];
        if (!item) return;
        const state = await loadState();
        state.playerTokenId = item.id;
        await saveState(state);
        await OBR.notification.show(`${item.name || "Token"} bound as MIRU player`, "SUCCESS");
      })();
    }
  });
}

OBR.onReady(() => {
  void setupStampTool().catch(async error => {
    console.error("MIRU stamp tool failed to initialize", error);
    await OBR.notification.show("MIRU stamp tool failed to initialize", "ERROR");
  });
  void setupPlayerBinding().catch(async error => {
    console.error("MIRU player binding failed to initialize", error);
    await OBR.notification.show("MIRU player binding failed to initialize", "ERROR");
  });
});
