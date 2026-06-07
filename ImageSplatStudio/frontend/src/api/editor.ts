const API = "/api/pointcloud-editor";

export interface EditorFileInfo {
  name: string;
  format: string;
  point_count: number;
  size_bytes: number;
  start_index: number;
  visible: boolean;
}

export interface EditorProperties {
  session_id: string;
  total_points: number;
  files: EditorFileInfo[];
  swap_xy: boolean;
  hidden_regions: { id: string; min: number[]; max: number[]; hidden: boolean }[];
  grid: { enabled: boolean; cell_size: number; region?: { min: number[]; max: number[] } | null; method?: string; has_data?: boolean; data_size?: number[] };
  mesh: { path: string; vertices: number; triangles: number } | null;
  breaklines: { id: string; points: number[][] }[];
  coord_points: { id: string; position: number[]; label: string }[];
  measurements: { id: string; type: string; points: number[][]; value: number; unit: string }[];
  classifications?: {
    enabled: boolean;
    counts: Record<string, number>;
    layers: { id: number; count: number; visible: boolean }[];
    hidden_class_ids: number[];
  };
  can_undo: boolean;
  can_redo: boolean;
  norm_meta: { center?: number[]; scale?: number; world_min?: number[]; world_max?: number[] };
  crs: { epsg: number; name: string };
  basemap: { enabled: boolean; mode?: string };
  view: { show_axes: boolean; fov: number; color_mode?: string; show_grid_surface?: boolean };
  bounds: { min: number[]; max: number[] };
  contours?: { interval: number; segment_count: number } | null;
  volumes?: { id: string; base_z: number; cut_m3: number; fill_m3: number; net_m3: number }[];
  last_cross_section?: { start: number[]; end: number[]; width: number } | null;
  deviation_heatmap?: {
    design_z: number;
    stats: { rmse_m: number; within_ok_pct: number; max_m: number; min_m: number };
    tolerance_ok: number;
    tolerance_warn: number;
  } | null;
  viewpoints?: { id: string; name: string; camera: number[]; target: number[]; up?: number[] }[];
  has_splat?: boolean;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function fetchEditorProperties(sessionId: string): Promise<EditorProperties> {
  return parseJson(await fetch(`${API}/${sessionId}/properties`));
}

export async function editorSwapXy(sessionId: string): Promise<EditorProperties> {
  return parseJson(await fetch(`${API}/${sessionId}/swap-xy`, { method: "POST" }));
}

export async function editorSetVisibility(
  sessionId: string,
  fileIndex: number,
  visible: boolean,
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_index: fileIndex, visible }),
    }),
  );
}

export async function editorShowAll(sessionId: string): Promise<EditorProperties> {
  return parseJson(await fetch(`${API}/${sessionId}/show-all`, { method: "POST" }));
}

export async function editorHideRegion(
  sessionId: string,
  min: [number, number, number],
  max: [number, number, number],
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/hide-region`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ min, max }),
    }),
  );
}

export async function editorCleanOutliers(sessionId: string): Promise<EditorProperties> {
  return parseJson(await fetch(`${API}/${sessionId}/clean-outliers`, { method: "POST" }));
}

export async function editorSplit(
  sessionId: string,
  axis: number,
  value: number,
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ axis, value }),
    }),
  );
}

export async function editorConfigureGrid(
  sessionId: string,
  opts: {
    enabled: boolean;
    cell_size: number;
    region_min?: number[];
    region_max?: number[];
    create_data?: boolean;
    clear_region?: boolean;
  },
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/grid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    }),
  );
}

export async function editorCreateMesh(
  sessionId: string,
  method: "idw" | "surface" | "tin" | "poisson" | "bpa" = "idw",
  cellSize?: number,
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/mesh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, cell_size: cellSize }),
    }),
  );
}

export function editorExportLasUrl(sessionId: string): string {
  return `${API}/${sessionId}/export/las`;
}

export function editorExportTxtUrl(sessionId: string): string {
  return `${API}/${sessionId}/export/txt`;
}

export function editorMeshUrl(sessionId: string): string {
  return `${API}/${sessionId}/mesh.obj`;
}

export function editorGridUrl(sessionId: string): string {
  return `${API}/${sessionId}/grid`;
}

export function decodeGridLines(buffer: ArrayBuffer): Float32Array {
  const count = new DataView(buffer).getUint32(0, true);
  return new Float32Array(buffer, 4, count * 6);
}

export async function editorDeletePoints(
  sessionId: string,
  position: [number, number, number],
  radius = 0.02,
): Promise<EditorProperties & { removed_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/points/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, radius }),
    }),
  );
}

export async function editorAddPoint(
  sessionId: string,
  position: [number, number, number],
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/points/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    }),
  );
}

export async function editorAddBreakline(
  sessionId: string,
  points: [number, number, number][],
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/breakline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    }),
  );
}

export async function editorMeshAddVertex(
  sessionId: string,
  position: [number, number, number],
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/mesh/vertex/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    }),
  );
}

export async function editorMeshDeleteVertex(
  sessionId: string,
  vertexIndex: number,
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/mesh/vertex/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vertex_index: vertexIndex }),
    }),
  );
}

export async function editorClipBox(
  sessionId: string,
  min: [number, number, number],
  max: [number, number, number],
  mode: "inside" | "outside",
): Promise<EditorProperties & { removed_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/clip-box`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ min, max, mode }),
    }),
  );
}

export async function editorPolygonDelete(
  sessionId: string,
  polygon: [number, number, number][],
): Promise<EditorProperties & { removed_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/polygon-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ polygon }),
    }),
  );
}

export async function editorFilterDensity(
  sessionId: string,
  radius: number,
  minNeighbors = 5,
): Promise<EditorProperties & { removed_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/filter/density`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ radius, min_neighbors: minNeighbors }),
    }),
  );
}

export async function editorFilterGround(
  sessionId: string,
  cellSize: number,
  maxOffset: number,
): Promise<EditorProperties & { removed_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/filter/ground`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cell_size: cellSize, max_offset: maxOffset }),
    }),
  );
}

export async function editorAddCoordPoint(
  sessionId: string,
  position: [number, number, number],
  label = "",
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/coord-point`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position, label }),
    }),
  );
}

export async function editorAddMeasurement(
  sessionId: string,
  type: "distance" | "area" | "angle" | "cross_section",
  points: [number, number, number][],
  value: number,
  unit = "m",
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/measurement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, points, value, unit }),
    }),
  );
}

export async function editorDeleteBreakline(sessionId: string, id: string): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/breakline/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  );
}

export async function editorDeleteRegion(sessionId: string, id: string): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/region/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  );
}

export async function editorDeleteMeasurement(sessionId: string, id: string): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/measurement/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  );
}

export async function editorUndo(sessionId: string): Promise<EditorProperties> {
  return parseJson(await fetch(`${API}/${sessionId}/undo`, { method: "POST" }));
}

export async function editorRedo(sessionId: string): Promise<EditorProperties> {
  return parseJson(await fetch(`${API}/${sessionId}/redo`, { method: "POST" }));
}

export async function editorClearRegions(sessionId: string): Promise<EditorProperties> {
  return parseJson(await fetch(`${API}/${sessionId}/clear-regions`, { method: "POST" }));
}

export interface GridSurfaceData {
  cell_size: number;
  origin: [number, number];
  size: [number, number];
  xs: number[];
  ys: number[];
  values: number[][];
}

export async function fetchGridSurface(sessionId: string): Promise<GridSurfaceData> {
  return parseJson(await fetch(`${API}/${sessionId}/grid-surface`));
}

export async function editorSubsample(
  sessionId: string,
  ratio: number,
): Promise<EditorProperties & { removed_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/subsample`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratio }),
    }),
  );
}

export async function editorConfigureView(
  sessionId: string,
  opts: {
    crs_epsg?: number;
    basemap_enabled?: boolean;
    basemap_mode?: string;
    show_axes?: boolean;
    color_mode?: string;
    show_grid_surface?: boolean;
  },
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    }),
  );
}

export async function editorLassoAction(
  sessionId: string,
  opts: {
    polygon_ndc: [number, number][];
    view_matrix: number[];
    proj_matrix: number[];
    action: "select" | "delete" | "hide" | "classify";
    class_id?: number;
  },
): Promise<EditorProperties & { selected_count?: number; removed_count?: number; classified_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/lasso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    }),
  );
}

export async function editorClassifyPolygon(
  sessionId: string,
  polygon: [number, number, number][],
  classId: number,
): Promise<EditorProperties & { classified_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/classify-polygon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ polygon, class_id: classId }),
    }),
  );
}

export async function editorSetClassVisibility(
  sessionId: string,
  classId: number,
  visible: boolean,
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/class-visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_id: classId, visible }),
    }),
  );
}

export async function editorCrossSection(
  sessionId: string,
  start: [number, number, number],
  end: [number, number, number],
  width = 0.5,
): Promise<import("../utils/editorTools").CrossSectionProfile> {
  return parseJson(
    await fetch(`${API}/${sessionId}/cross-section`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, width }),
    }),
  );
}

export async function editorFetchContours(
  sessionId: string,
  interval = 1.0,
): Promise<import("../utils/editorTools").ContourData> {
  return parseJson(await fetch(`${API}/${sessionId}/contours?interval=${interval}`));
}

export async function editorComputeVolume(
  sessionId: string,
  baseZ: number,
): Promise<EditorProperties & { volume_result?: import("../utils/editorTools").VolumeResult }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/volume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_z: baseZ }),
    }),
  );
}

export async function editorDensityCheck(
  sessionId: string,
  min: [number, number, number],
  max: [number, number, number],
  cellSize: number,
): Promise<{
  total_points: number;
  avg_density_pts_per_m2: number;
  min_density: number;
  max_density: number;
  cells: { count: number; density_pts_per_m2: number }[];
}> {
  return parseJson(
    await fetch(`${API}/${sessionId}/density-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ min, max, cell_size: cellSize }),
    }),
  );
}

export interface DeviationHeatmap {
  deviation: number[][];
  color_class: number[][];
  stats: { mean_m: number; max_m: number; min_m: number; rmse_m: number; within_ok_pct: number; valid_cells: number };
  tolerance_ok_m: number;
  tolerance_warn_m: number;
  xs: number[];
  ys: number[];
  cell_size: number;
  size: number[];
}

export async function editorEvaluateDeviation(
  sessionId: string,
  designZ: number,
  toleranceOk = 0.05,
  toleranceWarn = 0.15,
): Promise<DeviationHeatmap> {
  return parseJson(
    await fetch(`${API}/${sessionId}/deviation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design_z: designZ, tolerance_ok: toleranceOk, tolerance_warn: toleranceWarn }),
    }),
  );
}

export async function editorFetchDeviation(sessionId: string): Promise<DeviationHeatmap> {
  return parseJson(await fetch(`${API}/${sessionId}/deviation`));
}

export async function editorImportCsvSurvey(
  sessionId: string,
  opts: {
    csv_text: string;
    skip_header_rows?: number;
    z_flip?: boolean;
    col_x?: number;
    col_y?: number;
    col_z?: number;
  },
): Promise<EditorProperties & { imported_count?: number }> {
  return parseJson(
    await fetch(`${API}/${sessionId}/import/csv-survey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    }),
  );
}

export async function editorSaveViewpoint(
  sessionId: string,
  name: string,
  camera: [number, number, number],
  target: [number, number, number],
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/viewpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, camera, target }),
    }),
  );
}

export async function editorDeleteViewpoint(sessionId: string, id: string): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/viewpoint/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  );
}
