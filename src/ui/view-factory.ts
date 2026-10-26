import { Board2D } from '../render2d/Board2D';
import type { BoardView } from './view';

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Create the requested board view; the 3D renderer is code-split and only loaded when used. */
export async function createView(kind: '2d' | '3d'): Promise<BoardView> {
  if (kind === '3d' && webglAvailable()) {
    try {
      const { Board3D } = await import('../render3d/Board3D');
      return new Board3D();
    } catch (err) {
      console.error('3D renderer failed to load', err);
    }
  }
  return new Board2D();
}
