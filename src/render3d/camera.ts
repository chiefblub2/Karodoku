// Orthographic camera rig: nearly top-down "play" view, angled "dollhouse" view, pinch zoom.

import { MathUtils, OrthographicCamera, Vector3 } from 'three';

export const PLAY_TILT = 12; // degrees from straight down
export const DOLLHOUSE_TILT = 45;

export class CameraRig {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  /** 0 = play view, 1 = dollhouse view. */
  blend = 0;
  /** Dollhouse yaw in radians (used for the intro / solved views). */
  yaw = 0;
  zoom = 1;
  pan = { x: 0, z: 0 };
  private aspect = 1;
  private extent = 5; // half-size of the board incl. base, in world units
  private margin = 1.04;

  setBoard(halfExtent: number): void {
    this.extent = halfExtent;
    this.zoom = 1;
    this.pan = { x: 0, z: 0 };
  }

  setViewport(width: number, height: number): void {
    this.aspect = width / Math.max(1, height);
    this.update();
  }

  get tilt(): number { return MathUtils.lerp(PLAY_TILT, DOLLHOUSE_TILT, this.blend); }

  update(): void {
    const tilt = MathUtils.degToRad(this.tilt);
    const yaw = this.yaw * this.blend;
    const dist = 30;
    // Camera sits south of the board (screen-top = north) and looks down at the tilt angle.
    const dir = new Vector3(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt));
    const target = new Vector3(this.pan.x, 0, this.pan.z);
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);

    // Fit: the board's projected footprint is extent wide and extent·cos(tilt)+height·sin(tilt) tall.
    const e = this.extent * this.margin;
    const spin = Math.abs(Math.sin(yaw)) + Math.abs(Math.cos(yaw)); // rotated square gets wider
    const halfW = e * spin;
    const halfH = e * spin * Math.cos(tilt) + 0.6 * Math.sin(tilt);
    let w = halfW, h = halfH;
    if (w / h > this.aspect) h = w / this.aspect; else w = h * this.aspect;
    const z = this.zoom;
    this.camera.left = -w / z; this.camera.right = w / z;
    this.camera.top = h / z; this.camera.bottom = -h / z;
    this.camera.near = 1; this.camera.far = dist * 2;
    this.camera.updateProjectionMatrix();
  }

  /** Keep the zoomed view over the board. */
  clampPan(): void {
    const lim = Math.max(0, this.extent * (1 - 1 / this.zoom));
    this.pan.x = MathUtils.clamp(this.pan.x, -lim, lim);
    this.pan.z = MathUtils.clamp(this.pan.z, -lim, lim);
  }

  /** World units per CSS pixel horizontally (for panning). */
  unitsPerPixel(cssWidth: number): number {
    return (this.camera.right - this.camera.left) / Math.max(1, cssWidth);
  }
}
