import { afterEach, describe, expect, test, vi } from 'vitest';
import * as three from 'three';
import { createAboutScene } from '@/components/about/AboutIntro/AboutArtwork/AboutScene';

const renderer = vi.hoisted(() => ({
  render: vi.fn<(_scene: unknown, _camera: unknown) => void>(),
  setPixelRatio: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = { remove: vi.fn() };
      setPixelRatio = renderer.setPixelRatio;
      setClearColor = vi.fn();
      setSize = vi.fn();
      render = renderer.render;
      dispose = renderer.dispose;
    },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('About artwork scene', () => {
  test('batches the pins and slowly turns both rings from the static-image pose', () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    const host = {
      appendChild: vi.fn(),
      clientWidth: 512,
      clientHeight: 512,
    } as unknown as HTMLDivElement;
    const artwork = createAboutScene(host);
    artwork.resize();
    const scene = renderer.render.mock.calls[0][0] as three.Scene;
    const objects: three.Object3D[] = [];
    scene.traverse((object) => objects.push(object));
    const pins = objects.find((object) => object instanceof three.InstancedMesh);
    const rings = objects.filter(
      (object): object is three.Mesh =>
        object instanceof three.Mesh && object.geometry instanceof three.TorusGeometry,
    );

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(pins).toBeInstanceOf(three.InstancedMesh);
    expect((pins as three.InstancedMesh).count).toBe(12);
    expect(rings).toHaveLength(2);
    const initialAngles = rings.map((ring) => ring.rotation.clone());
    artwork.render(0);
    expect(rings.map((ring) => ring.rotation.toArray())).toEqual(
      initialAngles.map((angle) => angle.toArray()),
    );
    artwork.render(10);
    expect(rings[0].rotation.y).not.toBe(initialAngles[0].y);
    expect(rings[1].rotation.x).not.toBe(initialAngles[1].x);

    const disposePins = vi.spyOn(pins as three.InstancedMesh, 'dispose');
    artwork.dispose();
    expect(disposePins).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });
});
