import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { position, coordinates, splitBounds, visibleBounds, isVisible, selectAircraft, mergeStates, interpolatePosition, advanceRotation, advanceGlobePose } from './globeMath.js';

function scene() {
  const globe = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  camera.position.z = 3.65;
  return { globe, camera };
}
test('coordinate convention round-trips and clips the far side and canvas', () => {
  expect(coordinates(position(106.65, -6.13)).longitude).toBeCloseTo(106.65);
  expect(coordinates(position(106.65, -6.13)).latitude).toBeCloseTo(-6.13);
  const { globe, camera } = scene();
  expect(isVisible(position(0, 0, 1.02), globe, camera)).toBe(true);
  expect(isVisible(position(180, 0, 1.02), globe, camera)).toBe(false);
  camera.aspect = 0.2;
  camera.updateProjectionMatrix();
  expect(isVisible(position(45, 0, 1.02), globe, camera)).toBe(false);
});
test('bounds conservatively enclose visible transformed surface and split antimeridian', () => {
  expect(splitBounds(-10, 170, 10, -170)).toEqual([
    [-10, 170, 10, 180],
    [-10, -180, 10, -170],
  ]);
  const { globe, camera } = scene();
  globe.rotation.y = -Math.PI;
  const bounds = visibleBounds(globe, camera);
  expect(bounds).toHaveLength(2);
  for (const [south, west, north, east] of bounds) {
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(east);
    expect(west).toBeGreaterThanOrEqual(-180);
    expect(east).toBeLessThanOrEqual(180);
  }
  globe.rotation.set(0.4, -2.1, -0.09);
  globe.scale.setScalar(1.62);
  camera.aspect = 0.6;
  camera.updateProjectionMatrix();
  const boxes = visibleBounds(globe, camera);
  let count = 0;
  for (let latitude = -89; latitude <= 89; latitude += 5)
    for (let longitude = -179; longitude <= 179; longitude += 5) {
      if (!isVisible(position(longitude, latitude), globe, camera)) continue;
      count++;
      expect(boxes.some(([s, w, n, e]) => latitude >= s && latitude <= n && longitude >= w && longitude <= e)).toBe(true);
    }
  expect(count).toBeGreaterThan(0);
  globe.position.x = 100;
  expect(visibleBounds(globe, camera)).toEqual([]);
});
test('stable selection retains eligible identities, excludes ground/missing/hidden and fills freshest deterministically', () => {
  const states = Array.from({ length: 12 }, (_, i) => ({ icao24: i.toString(16).padStart(6, '0'), longitude: 0, latitude: 0, on_ground: false, time_position: i, last_contact: i }));
  const previous = [states[0].icao24, states[1].icao24];
  states[1].on_ground = true;
  states[2].latitude = null;
  const chosen = selectAircraft(states, previous, (state) => state !== states[11]);
  expect(chosen).toHaveLength(8);
  expect(chosen.map((item) => item.icao24)).toEqual(['000000', '00000a', '000009', '000008', '000007', '000006', '000005', '000004']);
  expect(selectAircraft(states.slice(0, 3))).toHaveLength(1);
  const a = { ...states[0], time_position: null, last_contact: 5 };
  const b = { ...a, icao24: 'abc123' };
  expect(selectAircraft([b, a]).map((item) => item.icao24)).toEqual(['000000', 'abc123']);
  expect(mergeStates([[a], [{ ...a, last_contact: 10 }]])[0].last_contact).toBe(10);
});
test('interpolation crosses antimeridian on shortest arc then holds, supports antipodes and reduced motion', () => {
  const from = position(179, 0, 1.02),
    to = position(-179, 0, 1.02);
  expect(Math.abs(coordinates(interpolatePosition(from, to, 2500)).longitude)).toBeCloseTo(180);
  expect(interpolatePosition(from, to, 8000).distanceTo(to)).toBeLessThan(1e-10);
  expect(interpolatePosition(from, to, 0, true).distanceTo(to)).toBeLessThan(1e-10);
  expect(interpolatePosition(position(0, 0), position(180, 0), 2500).length()).toBeCloseTo(1);
  expect(advanceRotation(0, 360)).toBeCloseTo(-Math.PI * 2);
  expect(advanceRotation(1, 10, true)).toBe(1);
  expect(advanceRotation(1, 10, false, true)).toBe(1);
});

test('airport chapter hands rotation back smoothly in both scroll directions near angle wraps', () => {
  const airportAngle = -THREE.MathUtils.degToRad(106.65);
  for (const direction of [-1, 1])
    for (const turns of [-4, 0, 4]) {
      const spin = airportAngle + turns * Math.PI * 2 + 0.6;
      let pose = { spin, rotation: spin, weight: 0 };
      const step = (progress) => {
        const next = advanceGlobePose({ spin: pose.spin, previousRotation: pose.rotation, previousWeight: pose.weight, progress, deltaSeconds: 1 / 60 });
        expect(Math.abs(next.rotation - pose.rotation)).toBeLessThan(0.02);
        pose = next;
      };
      for (let i = 0; i <= 450; i++) step(2 + direction * (0.45 - i / 1000));
      expect(pose.weight).toBeCloseTo(1);
      expect(pose.rotation).toBeCloseTo(airportAngle + turns * Math.PI * 2);
      expect(pose.scale).toBeCloseTo(1.62);
      expect(pose.tilt).toBeCloseTo(-0.12);
      for (let i = 1; i <= 450; i++) step(2 - (direction * i) / 1000);
      expect(pose.weight).toBeCloseTo(0);
      expect(pose.scale).toBeCloseTo(0.94);
      const last = pose.rotation;
      step(2 - direction * 0.5);
      expect(pose.rotation).toBeCloseTo(last - (Math.PI * 2) / 360 / 60);
    }
});

test('pose rotation makes one leftward turn in six minutes and honors pause/reduced motion', () => {
  const input = { spin: 1, previousRotation: 1, previousWeight: 0, progress: 1, deltaSeconds: 360 };
  expect(advanceGlobePose(input).rotation).toBeCloseTo(1 - Math.PI * 2);
  expect(advanceGlobePose({ ...input, paused: true }).rotation).toBe(1);
  expect(advanceGlobePose({ ...input, reducedMotion: true, progress: 2 }).rotation).toBe(1);
  // Enabling reduced motion at airport zoom holds the actual orientation.
  const reduced = advanceGlobePose({ ...input, previousRotation: -2, previousWeight: 1, reducedMotion: true, progress: 2 });
  expect(reduced.rotation).toBe(-2);
  expect(reduced.weight).toBe(0);
});
