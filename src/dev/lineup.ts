// Dev-only model lineup (not part of the build): /lineup.html?view=top|side
import {
  ACESFilmicToneMapping, AmbientLight, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, OrthographicCamera,
  PCFSoftShadowMap, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';
import { OBJECT_TYPES, SUSPECTS } from '../core/model';
import { Bag } from '../render3d/bag';
import { buildPiece } from '../render3d/furniture';
import { PawnFactory } from '../render3d/pawns';

const view = new URLSearchParams(location.search).get('view') ?? 'side';
const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(2);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new Scene();
const bag = new Bag();
scene.add(new AmbientLight('#ffd9a8', 0.5), new HemisphereLight('#8fa6d8', '#5a3a22', 0.55));
const moon = new DirectionalLight('#cfdcff', 1.9);
moon.position.set(-6, 11, -4);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
const fill = new DirectionalLight('#ffcc96', 0.55);
fill.position.set(3, 6, 9);
scene.add(moon, fill);
const floor = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const pf = new PawnFactory(bag);
SUSPECTS.forEach((sp, i) => {
  const p = pf.pawn({ index: i, name: sp.name, initial: sp.initial, hue: sp.hue, accessory: sp.accessory, victim: false });
  p.position.set(i * 1.1 - 3.85, 0, -1.2);
  scene.add(p);
});
const v = pf.victim();
v.position.set(-3.85 + 8 * 1.1, 0, -1.2);
scene.add(v);
OBJECT_TYPES.forEach((o, i) => {
  const piece = buildPiece(o, bag, 'lineup' + i);
  piece.position.set(i * 1.25 - 3.75, 0, 0.6);
  scene.add(piece);
});
import('../render3d/textures').then(({ floorTexture }) => {
  (['library', 'lounge', 'study', 'dining', 'kitchen', 'bathroom', 'cellar', 'conservatory', 'hall', 'bedroom', 'guest', 'billiard'] as const).forEach((type, i) => {
    const m = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial({ map: floorTexture(type), roughness: 0.7 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(i * 0.68 - 3.75, 0.002, 2.1);
    m.scale.setScalar(0.64);
    m.receiveShadow = true;
    scene.add(m);
  });
  renderer.render(scene, cam);
  (window as unknown as { ready: boolean }).ready = true;
});
const aspect = innerWidth / innerHeight;
const h = 3.2;
const cam = new OrthographicCamera(-h * aspect, h * aspect, h, -h, 0.1, 100);
const tilt = view === 'top' ? 12 : 40;
const t = (tilt * Math.PI) / 180;
cam.position.set(0, Math.cos(t) * 30, Math.sin(t) * 30);
cam.lookAt(0, 0, -0.3);
