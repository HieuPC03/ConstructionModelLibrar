export type EditorTool =
  | "navigate"
  | "delete_point"
  | "add_point"
  | "coord_point"
  | "clip_box"
  | "hide_region"
  | "polygon_delete"
  | "polygon_classify"
  | "lasso_select"
  | "measure_distance"
  | "measure_area"
  | "measure_angle"
  | "cross_section"
  | "mesh_add"
  | "mesh_delete"
  | "breakline"
  | "grid_region";

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
  polygon_classify: "crosshair",
  lasso_select: "crosshair",
  measure_distance: "crosshair",
  measure_area: "crosshair",
  measure_angle: "crosshair",
  cross_section: "crosshair",
  mesh_add: "copy",
  mesh_delete: "not-allowed",
  breakline: "pointer",
  grid_region: "crosshair",
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
    tools: ["clip_box", "hide_region", "polygon_delete", "polygon_classify", "lasso_select"],
  },
  {
    id: "measure",
    labelKey: "toolGroupMeasure",
    tools: ["measure_distance", "measure_area", "measure_angle", "cross_section"],
  },
  {
    id: "mesh",
    labelKey: "toolGroupMesh",
    tools: ["mesh_add", "mesh_delete", "breakline"],
  },
];

export const MESH_TOOLS: EditorTool[] = ["mesh_add", "mesh_delete", "breakline"];

/** Tools that may pick on the ground plane when no point is hit (TREND-POINT style). */
export const PLANE_PICK_TOOLS: EditorTool[] = [
  "clip_box",
  "hide_region",
  "grid_region",
  "polygon_delete",
  "polygon_classify",
  "measure_area",
  "measure_distance",
  "measure_angle",
  "cross_section",
  "coord_point",
  "add_point",
  "breakline",
];

export function toolLabelKey(tool: EditorTool): string {
  const map: Record<EditorTool, string> = {
    navigate: "toolNavigate",
    delete_point: "toolDeletePoint",
    add_point: "toolAddPoint",
    coord_point: "toolCoordPoint",
    clip_box: "toolClipBox",
    hide_region: "toolHideRegion",
    polygon_delete: "toolPolygonDelete",
    polygon_classify: "toolPolygonClassify",
    lasso_select: "toolLassoSelect",
    measure_distance: "toolMeasureDistance",
    measure_area: "toolMeasureArea",
    measure_angle: "toolMeasureAngle",
    cross_section: "toolCrossSection",
    mesh_add: "toolMeshAdd",
    mesh_delete: "toolMeshDelete",
    breakline: "toolBreakline",
    grid_region: "toolGridRegion",
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
    polygon_classify: "toolHint_polygon_classify",
    lasso_select: "toolHint_lasso_select",
    measure_distance: "toolHint_measure_distance",
    measure_area: "toolHint_measure_area",
    measure_angle: "toolHint_measure_angle",
    cross_section: "toolHint_cross_section",
    mesh_add: "toolHint_mesh_add",
    mesh_delete: "toolHint_mesh_delete",
    breakline: "toolHint_breakline",
    grid_region: "toolHint_grid_region",
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

/** Interior angle at vertex b (degrees). */
export function angleAtVertex(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): number {
  const ax = a[0] - b[0], ay = a[1] - b[1], az = a[2] - b[2];
  const cx = c[0] - b[0], cy = c[1] - b[1], cz = c[2] - b[2];
  const la = Math.hypot(ax, ay, az);
  const lc = Math.hypot(cx, cy, cz);
  if (la < 1e-12 || lc < 1e-12) return 0;
  const dot = (ax * cx + ay * cy + az * cz) / (la * lc);
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
}

export interface CrossSectionProfile {
  start: number[];
  end: number[];
  length_m: number;
  width_m: number;
  stations_m: number[];
  z_min: number[];
  z_max: number[];
  z_mean: number[];
}

export interface ContourData {
  interval_m: number;
  z_min: number;
  z_max: number;
  levels: number[];
  segments: Record<string, number[][][]>;
  segment_count: number;
}

export interface VolumeResult {
  base_z: number;
  cut_m3: number;
  fill_m3: number;
  net_m3: number;
  valid_cells: number;
  avg_elevation_m: number;
}
