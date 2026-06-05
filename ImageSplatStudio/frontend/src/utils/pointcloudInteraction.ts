import * as THREE from "three";

/** Snap ray to nearest point in a THREE.Points cloud. */
export function snapToPointCloud(
  raycaster: THREE.Raycaster,
  points: THREE.Points,
  threshold: number,
): { point: THREE.Vector3; index: number } | null {
  raycaster.params.Points = { threshold };
  const hits = raycaster.intersectObject(points, false);
  if (hits.length > 0) {
    return { point: hits[0].point.clone(), index: hits[0].index ?? -1 };
  }
  return null;
}

/** Snap to mesh surface or nearest vertex. */
export function snapToMesh(
  raycaster: THREE.Raycaster,
  mesh: THREE.Object3D,
  vertexThreshold: number,
): { point: THREE.Vector3; vertexIndex: number } | null {
  const hits = raycaster.intersectObject(mesh, true);
  if (hits.length === 0) return null;

  const hit = hits[0];
  let bestIdx = -1;
  let bestDist = vertexThreshold;
  const hitMesh = hit.object as THREE.Mesh;
  const pos = hitMesh.geometry?.attributes?.position;
  if (!pos) return { point: hit.point.clone(), vertexIndex: -1 };

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    hitMesh.localToWorld(v);
    const d = v.distanceTo(hit.point);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { point: hit.point.clone(), vertexIndex: bestIdx };
}

export function ndcFromEvent(event: MouseEvent, dom: HTMLElement): THREE.Vector2 {
  const rect = dom.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

export function formatSnapLabel(p: THREE.Vector3): string {
  return `${p.x.toFixed(4)}, ${p.y.toFixed(4)}, ${p.z.toFixed(4)}`;
}
