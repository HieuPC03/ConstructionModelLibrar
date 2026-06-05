declare module "@mkkellogg/gaussian-splats-3d" {
  export enum SplatRenderMode {
    ThreeD = 0,
    TwoD = 1,
  }

  export class Viewer {
    constructor(options: Record<string, unknown>);
    addSplatScene(url: string, options?: Record<string, unknown>): Promise<void>;
    start(): void;
    dispose(): void;
  }
}
