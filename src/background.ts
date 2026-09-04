import OBR from "@owlbear-rodeo/sdk";
import { setupStampTool } from "./scene";

OBR.onReady(() => {
  void setupStampTool().catch(async (error) => {
    console.error("MIRU stamp tool failed to initialize", error);
    await OBR.notification.show("MIRU stamp tool failed to initialize", "ERROR");
  });
});
