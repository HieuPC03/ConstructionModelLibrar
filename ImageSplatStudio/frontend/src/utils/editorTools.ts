export type EditorTool =
  | "navigate"
  | "delete_point"
  | "add_point"
  | "select_region"
  | "mesh_add"
  | "mesh_delete"
  | "breakline";

export const TOOL_CURSORS: Record<EditorTool, string> = {
  navigate: "grab",
  delete_point: "crosshair",
  add_point: "cell",
  select_region: "crosshair",
  mesh_add: "copy",
  mesh_delete: "not-allowed",
  breakline: "pointer",
};

export const OSNAP_CURSOR = "crosshair";
