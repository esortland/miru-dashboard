import OBR, { buildShape, buildText } from "@owlbear-rodeo/sdk";

export const TERRAIN = ["Forest", "Mountain", "Grassland", "Desert", "Swamp"] as const;
export const ICONS = ["Village", "Quest", "Treasure", "Enemy", "Radio Tower", "Power Supply", "Impassable Edge", "Camp", "Current Position", "Explored"] as const;
export const STAMPS = [...TERRAIN, ...ICONS] as const;
export type StampName = (typeof STAMPS)[number];

export const STAMP_TOOL_ID = "com.esortland.miru-companion/stamp-tool";
export const STAMP_MODE_ID = "com.esortland.miru-companion/stamp-mode";

const palette: Record<StampName, { fill: string; stroke: string; glyph: string }> = {
  Forest: { fill: "#d7e2d0", stroke: "#1f2922", glyph: "🌲" },
  Mountain: { fill: "#dedede", stroke: "#28282b", glyph: "▲" },
  Grassland: { fill: "#e5e0bf", stroke: "#343529", glyph: "〰" },
  Desert: { fill: "#ead7ad", stroke: "#473d2d", glyph: "∿" },
  Swamp: { fill: "#ced9c0", stroke: "#263a30", glyph: "♒" },
  Village: { fill: "#f4f1e8", stroke: "#ef554c", glyph: "⌂" },
  Quest: { fill: "#f4f1e8", stroke: "#ef554c", glyph: "!" },
  Treasure: { fill: "#f4f1e8", stroke: "#ef554c", glyph: "◆" },
  Enemy: { fill: "#ef554c", stroke: "#17171a", glyph: "☠" },
  "Radio Tower": { fill: "#f4f1e8", stroke: "#ef554c", glyph: "⌁" },
  "Power Supply": { fill: "#f4f1e8", stroke: "#ef554c", glyph: "ϟ" },
  "Impassable Edge": { fill: "#17171a", stroke: "#ef554c", glyph: "×" },
  Camp: { fill: "#f4f1e8", stroke: "#ef554c", glyph: "△" },
  "Current Position": { fill: "#ef554c", stroke: "#17171a", glyph: "◆" },
  Explored: { fill: "#f4f1e8", stroke: "#ef554c", glyph: "✓" }
};

function isStampName(value: unknown): value is StampName {
  return typeof value === "string" && (STAMPS as readonly string[]).includes(value);
}

export async function createStampAt(name: StampName, point: { x: number; y: number }) {
  if (!(await OBR.scene.isReady())) throw new Error("Open an Owlbear scene first.");
  const p = palette[name];
  const size = name === "Impassable Edge"
    ? { w: 180, h: 36, type: "RECTANGLE" as const }
    : { w: 96, h: 96, type: "HEXAGON" as const };
  const position = { x: point.x - size.w / 2, y: point.y - size.h / 2 };

  const shape = buildShape()
    .name(`MIRU ${name}`)
    .position(position)
    .layer("PROP")
    .width(size.w)
    .height(size.h)
    .shapeType(size.type)
    .fillColor(p.fill)
    .fillOpacity(0.96)
    .strokeColor(p.stroke)
    .strokeWidth(5)
    .metadata({ "com.esortland.miru-companion/stamp": name })
    .build();

  const text = buildText()
    .name(`MIRU ${name} Label`)
    .position(position)
    .layer("TEXT")
    .width(size.w)
    .height(size.h)
    .plainText(`${p.glyph}\n${name.toUpperCase()}`)
    .fontSize(name === "Impassable Edge" ? 18 : 16)
    .fontWeight(700)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .fillColor(name === "Enemy" ? "#f4f1e8" : "#17171a")
    .metadata({ "com.esortland.miru-companion/stamp-label": name })
    .build();

  await OBR.scene.items.addItems([shape, text]);
}

export async function armStamp(name: StampName) {
  await OBR.tool.setMetadata(STAMP_TOOL_ID, { selectedStamp: name });
  await OBR.notification.show(`${name} armed — choose the MIRU Stamp tool, then click the map`, "SUCCESS");
}

export async function setupStampTool() {
  await OBR.tool.create({
    id: STAMP_TOOL_ID,
    icons: [{ icon: "/stamp-tool.svg", label: "MIRU Stamp" }],
    defaultMode: STAMP_MODE_ID,
    defaultMetadata: { selectedStamp: "Forest" }
  });

  await OBR.tool.createMode({
    id: STAMP_MODE_ID,
    icons: [{ icon: "/stamp-tool.svg", label: "Place MIRU stamp" }],
    cursors: [{ cursor: "crosshair" }],
    onToolClick: (context, event) => {
      const selected = context.metadata.selectedStamp;
      if (!isStampName(selected)) return false;
      void (async () => {
        const point = await OBR.viewport.inverseTransformPoint(event.pointerPosition);
        await createStampAt(selected, point);
        await OBR.notification.show(`${selected} placed`, "SUCCESS");
      })();
      return false;
    }
  });
}
