import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

interface MeshViewerProps {
  url: string;
}

export function MeshViewer({ url }: MeshViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    const absoluteUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080c);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    camera.position.set(2.5, 2, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.35);
    fillLight.position.set(-3, 1, -2);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(6, 20, 0x2a3444, 0x1a2230);
    scene.add(grid);

    const resize = () => {
      const { clientWidth, clientHeight } = mount;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const loader = new OBJLoader();
    loader.load(
      absoluteUrl,
      (object) => {
        if (cancelled) return;
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xb8c4d8,
              metalness: 0.15,
              roughness: 0.65,
              flatShading: false,
            });
          }
        });

        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        object.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 2.2 / maxDim;
        object.scale.setScalar(scale);
        scene.add(object);
      },
      undefined,
      (err) => {
        if (!cancelled) console.error("Failed to load mesh:", err);
      },
    );

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [url]);

  return (
    <div className="mesh-viewer">
      <div ref={mountRef} className="mesh-viewer-mount" />
    </div>
  );
}
