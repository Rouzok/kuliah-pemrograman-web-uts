import * as THREE from 'three';

const radians = THREE.MathUtils.degToRad;
const degrees = THREE.MathUtils.radToDeg;
export function position(lon, lat, radius = 1) {
  const phi = radians(lat),
    theta = radians(lon);
  return new THREE.Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)).multiplyScalar(radius);
}
export function coordinates(point) {
  const unit = point.clone().normalize();
  return { longitude: degrees(Math.atan2(unit.x, unit.z)), latitude: degrees(Math.asin(THREE.MathUtils.clamp(unit.y, -1, 1))) };
}
export function splitBounds(south, west, north, east) {
  if (east < west) east += 360;
  if (east - west >= 360) return [[south, -180, north, 180]];
  const width = east - west;
  west = ((((west + 180) % 360) + 360) % 360) - 180;
  east = west + width;
  return east <= 180
    ? [[south, west, north, east]]
    : [
        [south, west, north, 180],
        [south, -180, north, east - 360],
      ];
}

// The camera-visible spherical cap encloses every surface point in the viewport.
// Keep its full bounds when the canvas clips the cap: sampling screen rays could
// miss a narrow limb or geographic extrema. Exact local clipping happens below.
// Assumes the globe's existing uniform scale, perspective camera and unit Earth.
export function visibleBounds(globe, camera, radius = 1) {
  globe.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const sphere = new THREE.Sphere(new THREE.Vector3(), radius).applyMatrix4(globe.matrixWorld);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  if (!frustum.intersectsSphere(sphere)) return [];
  const localCamera = globe.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
  const distance = localCamera.length();
  if (distance <= radius) return [];
  const center = coordinates(localCamera);
  const angle = Math.acos(radius / distance);
  const south = Math.max(-90, center.latitude - degrees(angle));
  const north = Math.min(90, center.latitude + degrees(angle));
  if (south <= -90 || north >= 90) return [[south, -180, north, 180]];
  const span = degrees(Math.asin(Math.min(1, Math.sin(angle) / Math.cos(radians(center.latitude)))));
  return splitBounds(south, center.longitude - span, north, center.longitude + span);
}

export function isVisible(point, globe, camera, radius = 1) {
  globe.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const world = globe.localToWorld(point.clone());
  const projected = world.clone().project(camera);
  if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || Math.abs(projected.z) > 1) return false;
  const eye = globe.worldToLocal(camera.getWorldPosition(new THREE.Vector3()));
  const direction = point.clone().sub(eye);
  const distance = direction.length();
  const hit = new THREE.Ray(eye, direction.normalize()).intersectSphere(new THREE.Sphere(new THREE.Vector3(), radius), new THREE.Vector3());
  return !hit || hit.distanceTo(eye) >= distance - 1e-7;
}

function freshness(a, b) {
  return (b.time_position ?? -1) - (a.time_position ?? -1) || (b.last_contact ?? -1) - (a.last_contact ?? -1) || a.icao24.localeCompare(b.icao24);
}
export function mergeStates(groups) {
  const states = new Map();
  for (const state of groups.flat()) {
    const previous = states.get(state.icao24);
    if (!previous || freshness(state, previous) < 0) states.set(state.icao24, state);
  }
  return [...states.values()];
}
export function selectAircraft(states, previousIds = [], visible = () => true, limit = 8) {
  const eligible = mergeStates([states]).filter(
    (state) => state.on_ground === false && Number.isFinite(state.longitude) && Math.abs(state.longitude) <= 180 && Number.isFinite(state.latitude) && Math.abs(state.latitude) <= 90 && visible(state),
  );
  const byId = new Map(eligible.map((state) => [state.icao24, state]));
  const retained = [...new Set(previousIds)]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, limit);
  const ids = new Set(retained.map((state) => state.icao24));
  return [...retained, ...eligible.filter((state) => !ids.has(state.icao24)).sort(freshness)].slice(0, limit);
}

// Rotate along the shortest great-circle arc; hold the received position after 5s.
export function interpolatePosition(from, to, elapsedMs, reducedMotion = false) {
  const amount = reducedMotion ? 1 : THREE.MathUtils.clamp(elapsedMs / 5000, 0, 1);
  const start = from.clone().normalize(),
    end = to.clone().normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(start, end);
  const partial = new THREE.Quaternion().slerp(rotation, amount);
  return start.applyQuaternion(partial).multiplyScalar(THREE.MathUtils.lerp(from.length(), to.length(), amount));
}

export function advanceRotation(rotation, deltaSeconds, paused = false, reducedMotion = false) {
  return paused || reducedMotion ? rotation : rotation - (deltaSeconds * Math.PI * 2) / 360;
}

export function advanceGlobePose({ spin, previousRotation, previousWeight, progress, deltaSeconds, paused = false, reducedMotion = false }) {
  const chapter = reducedMotion ? 0 : THREE.MathUtils.clamp(progress, 0, 3);
  const weight = Math.max(0, 1 - Math.abs(chapter - 2) / 0.45);
  // Resume from the actual airport pose as its scroll influence decreases.
  if (weight < previousWeight) spin = previousRotation;
  spin = advanceRotation(spin, deltaSeconds, paused || weight > 0, reducedMotion);
  const airportAngle = -radians(106.65);
  const nearest = spin + Math.atan2(Math.sin(airportAngle - spin), Math.cos(airportAngle - spin));
  return { spin, weight, rotation: THREE.MathUtils.lerp(spin, nearest, weight), tilt: THREE.MathUtils.lerp(-0.1, -0.12, weight), scale: THREE.MathUtils.lerp(0.94, 1.62, weight) };
}
