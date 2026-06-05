export type EditorTool =
  | "navigate"
  | "delete_point"
  | "add_point"
  | "coord_point"
  | "clip_box"
  | "hide_region"
  | "polygon_delete"
  | "measure_distance"
  | "measure_area"
  | "mesh_add"
  | "mesh_delete"
  | "breakline";

export type OsnapMode = "off" | "point" | "mesh";

export type ClipMode = "inside" | "outside";

export const TOOL_CURSORS: Record<EditorTool, string> = {
  navigate: "grab",
  delete_point: "crosshair",
  add_point: "cell",
  coord_point: "crosshair",
  clip_box: "crosshair",
  hide_region: "crosshair",
  polygon_delete: "crosshair",
  measure_distance: "crosshair",
  measure_area: "crosshair",
  mesh_add: "copy",
  mesh_delete: "not-allowed",
  breakline: "pointer",
};

export const OSNAP_CURSOR = "crosshair";

export interface ToolGroup {
  id: string;
  labelKey: string;
  tools: EditorTool[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  { id: "view", labelKey: "toolGroupView", tools: ["navigate"] },
  {
    id: "edit",
    labelKey: "toolGroupEdit",
    tools: ["delete_point", "add_point", "coord_point"],
  },
  {
    id: "region",
    labelKey: "toolGroupRegion",
    tools: ["clip_box", "hide_region", "polygon_delete"],
  },
  {
    id: "measure",
    labelKey: "toolGroupMeasure",
    tools: ["measure_distance", "measure_area"],
  },
  {
    id: "mesh",
    labelKey: "toolGroupMesh",
    tools: ["mesh_add", "mesh_delete", "breakline"],
  },
];

export const MESH_TOOLS: EditorTool[] = ["mesh_add", "mesh_delete", "breakline"];

export function toolLabelKey(tool: EditorTool): string {
  const map: Record<EditorTool, string> = {
    navigate: "toolNavigate",
    delete_point: "toolDeletePoint",
    add_point: "toolAddPoint",
    coord_point: "toolCoordPoint",
    clip_box: "toolClipBox",
    hide_region: "toolHideRegion",
    polygon_delete: "toolPolygonDelete",
    measure_distance: "toolMeasureDistance",
    measure_area: "toolMeasureArea",
    mesh_add: "toolMeshAdd",
    mesh_delete: "toolMeshDelete",
    breakline: "toolBreakline",
  };
  return map[tool];
}

export function toolHintKey(tool: EditorTool): string {
  const map: Record<EditorTool, string> = {
    navigate: "toolHint_navigate",
    delete_point: "toolHint_delete_point",
    add_point: "toolHint_add_point",
    coord_point: "toolHint_coord_point",
    clip_box: "toolHint_clip_box",
    hide_region: "toolHint_hide_region",
    polygon_delete: "toolHint_polygon_delete",
    measure_distance: "toolHint_measure_distance",
    measure_area: "toolHint_measure_area",
    mesh_add: "toolHint_mesh_add",
    mesh_delete: "toolHint_mesh_delete",
    breakline: "toolHint_breakline",
  };
  return map[tool];
}

export function distance3d(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function polygonAreaXY(points: [number, number, number][]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1] - points[j][0] * points[i][1];
  }
  return Math.abs(area / 2);
}
