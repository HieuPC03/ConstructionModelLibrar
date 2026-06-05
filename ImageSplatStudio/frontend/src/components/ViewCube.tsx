import * as THREE from "three";

export type ViewDirection = "front" | "back" | "left" | "right" | "top" | "bottom";

const VIEWS: Record<ViewDirection, { position: [number, number, number]; up: [number, number, number] }> = {
  front: { position: [0, 0, 1], up: [0, 1, 0] },
  back: { position: [0, 0, -1], up: [0, 1, 0] },
  left: { position: [-1, 0, 0], up: [0, 1, 0] },
  right: { position: [1, 0, 0], up: [0, 1, 0] },
  top: { position: [0, 1, 0], up: [0, 0, -1] },
  bottom: { position: [0, -1, 0], up: [0, 0, 1] },
};

interface ViewCubeProps {
  onSelect: (dir: ViewDirection) => void;
}

export function ViewCube({ onSelect }: ViewCubeProps) {
  const faces: { dir: ViewDirection; label: string; style: React.CSSProperties }[] = [
    { dir: "top", label: "Y", style: { gridColumn: 2, gridRow: 1 } },
    { dir: "left", label: "X-", style: { gridColumn: 1, gridRow: 2 } },
    { dir: "front", label: "Z", style: { gridColumn: 2, gridRow: 2 } },
    { dir: "right", label: "X+", style: { gridColumn: 3, gridRow: 2 } },
    { dir: "back", label: "Z-", style: { gridColumn: 2, gridRow: 3 } },
    { dir: "bottom", label: "Y-", style: { gridColumn: 2, gridRow: 4 } },
  ];

  return (
    <div className="tp-view-cube" title="View Cube">
      <div className="tp-view-cube-grid">
        {faces.map((f) => (
          <button
            key={f.dir}
            type="button"
            className={`tp-view-cube-face tp-face-${f.dir}`}
            style={f.style}
            onClick={() => onSelect(f.dir)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function applyViewDirection(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  target: THREE.Vector3,
  distance: number,
  dir: ViewDirection,
): void {
  const v = VIEWS[dir];
  camera.position.set(
    target.x + v.position[0] * distance,
    target.y + v.position[1] * distance,
    target.z + v.position[2] * distance,
  );
  camera.up.set(v.up[0], v.up[1], v.up[2]);
  camera.lookAt(target);
  controls.update();
}

export function createAxesHelper(size: number): THREE.Group {
  const g = new THREE.Group();
  const axes = new THREE.AxesHelper(size);
  g.add(axes);

  const makeLabel = (text: string, color: string, pos: THREE.Vector3) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = "bold 48px sans-serif";
    ctx.fillText(text, 12, 48);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(size * 0.15, size * 0.15, 1);
    g.add(sprite);
  };

  makeLabel("X", "#ff4444", new THREE.Vector3(size * 1.1, 0, 0));
  makeLabel("Y", "#44ff44", new THREE.Vector3(0, size * 1.1, 0));
  makeLabel("Z", "#4488ff", new THREE.Vector3(0, 0, size * 1.1));
  return g;
}
