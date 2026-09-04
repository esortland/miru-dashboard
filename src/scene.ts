import OBR, { buildShape, buildText } from "@owlbear-rodeo/sdk";

export const TERRAIN = ["Forest", "Mountain", "Grassland", "Desert", "Swamp"] as const;
export const ICONS = ["Village", "Quest", "Treasure", "Enemy", "Radio Tower", "Power Supply", "Impassable Edge", "Camp", "Current Position", "Explored"] as const;

const palette: Record<string, { fill: string; stroke: string; glyph: string }> = {
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

async function sceneCenter() {
  const width = await OBR.viewport.getWidth();
  const height = await OBR.viewport.getHeight();
  return OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });
}

export async function placeStamp(name: string) {
  if (!(await OBR.scene.isReady())) throw new Error("Open an Owlbear scene first.");
  const c = await sceneCenter();
  const p = palette[name] ?? palette["Quest"];
  const size = name === "Impassable Edge" ? { w: 180, h: 36, type: "RECTANGLE" as const } : { w: 96, h: 96, type: "HEXAGON" as const };

  const shape = buildShape()
    .name(`MIRU ${name}`)
    .position({ x: c.x - size.w / 2, y: c.y - size.h / 2 })
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
    .position({ x: c.x - size.w / 2, y: c.y - size.h / 2 })
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
  await OBR.notification.show(`${name} placed at the center of your view`, "SUCCESS");
}
