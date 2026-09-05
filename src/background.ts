import OBR from "@owlbear-rodeo/sdk";

// The MIRU interactive play surface is now the single source of truth for
// movement, terrain, icons, and campaign position. Legacy Owlbear-native
// stamp placement and player-token binding are intentionally no longer
// registered here so the extension exposes one coherent map workflow.
OBR.onReady(() => {});
