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
  grid: { enabled: boolean; cell_size: number };
  mesh: { path: string; vertices: number; triangles: number } | null;
  breaklines: { id: string; points: number[][] }[];
  bounds: { min: number[]; max: number[] };
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
  enabled: boolean,
  cellSize: number,
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/grid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, cell_size: cellSize }),
    }),
  );
}

export async function editorCreateMesh(
  sessionId: string,
  method = "poisson",
): Promise<EditorProperties> {
  return parseJson(
    await fetch(`${API}/${sessionId}/mesh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method }),
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
