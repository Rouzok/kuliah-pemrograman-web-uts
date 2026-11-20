import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import * as THREE from 'three';
import { getFlights } from '../../api/client.js';
import { position, visibleBounds, isVisible, selectAircraft, interpolatePosition, advanceGlobePose } from './globeMath.js';
import { createGlobeUpdates } from './globeUpdates.js';

// Deliberately simplified land silhouettes for this illustrative, offline globe.
// Coordinates are longitude/latitude; this is not a navigation map.
const LAND = [
  [
    [-168, 70],
    [-145, 70],
    [-130, 58],
    [-124, 49],
    [-123, 39],
    [-110, 28],
    [-98, 18],
    [-87, 15],
    [-81, 9],
    [-77, 9],
    [-85, 23],
    [-81, 26],
    [-80, 33],
    [-66, 45],
    [-53, 49],
    [-60, 60],
    [-90, 72],
    [-120, 74],
  ],
  [
    [-81, 12],
    [-70, 11],
    [-61, 6],
    [-51, 4],
    [-35, -6],
    [-40, -22],
    [-52, -34],
    [-65, -55],
    [-74, -46],
    [-73, -25],
    [-81, -5],
  ],
  [
    [-53, 60],
    [-42, 60],
    [-22, 76],
    [-32, 83],
    [-52, 80],
    [-63, 68],
  ],
  [
    [-17, 36],
    [0, 37],
    [12, 33],
    [31, 31],
    [35, 23],
    [44, 12],
    [51, 12],
    [42, -10],
    [32, -29],
    [18, -35],
    [11, -20],
    [9, -1],
    [-5, 5],
    [-17, 15],
  ],
  [
    [-10, 36],
    [-9, 44],
    [-1, 49],
    [6, 56],
    [5, 62],
    [20, 71],
    [40, 70],
    [55, 73],
    [90, 77],
    [120, 73],
    [150, 62],
    [179, 66],
    [174, 52],
    [145, 46],
    [140, 35],
    [126, 39],
    [122, 25],
    [108, 18],
    [105, 5],
    [99, 7],
    [91, 23],
    [80, 8],
    [73, 20],
    [65, 25],
    [55, 24],
    [43, 31],
    [35, 40],
    [28, 41],
    [21, 37],
    [15, 38],
    [9, 44],
    [2, 42],
  ],
  [
    [46, -13],
    [51, -15],
    [49, -25],
    [44, -25],
  ],
  [
    [95, 6],
    [101, 2],
    [106, -6],
    [104, -6],
    [98, 0],
  ],
  [
    [106, -6],
    [114, -7],
    [119, -9],
    [111, -8],
  ],
  [
    [109, 7],
    [117, 7],
    [119, 0],
    [114, -4],
    [109, -1],
  ],
  [
    [120, 1],
    [124, 2],
    [125, -2],
    [121, -5],
    [119, -3],
  ],
  [
    [120, 19],
    [124, 16],
    [126, 7],
    [122, 7],
    [120, 13],
  ],
  [
    [130, -3],
    [141, -3],
    [151, -6],
    [147, -10],
    [137, -8],
  ],
  [
    [113, -22],
    [123, -13],
    [132, -12],
    [137, -17],
    [145, -15],
    [153, -27],
    [149, -38],
    [136, -35],
    [130, -31],
    [116, -35],
  ],
  [
    [166, -35],
    [177, -39],
    [172, -46],
    [166, -46],
  ],
  [
    [131, 34],
    [138, 37],
    [143, 45],
    [145, 43],
    [140, 35],
    [133, 32],
  ],
  [
    [-8, 50],
    [-3, 59],
    [1, 58],
    [1, 51],
  ],
];

function onLand(lon, lat) {
  return LAND.some((polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [x, y] = polygon[i];
      const [px, py] = polygon[j];
      if (y > lat !== py > lat && lon < ((px - x) * (lat - y)) / (py - y) + x) inside = !inside;
    }
    return inside;
  });
}

function line(points, color, opacity = 1) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

export default function GlobeScene({ sceneState }) {
  const container = useRef(null);
  const interactions = useRef({ selected: null, hovered: null });
  const select = (id) => {
    interactions.current.selected = id;
  };
  const hover = (id) => {
    interactions.current.hovered = id;
  };

  useEffect(() => {
    const host = container.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
    camera.position.z = 3.65;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      host.dataset.status = 'unavailable';
    }
    renderer?.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer?.setClearColor(0x000000, 0);
    if (renderer) host.appendChild(renderer.domElement);
    const globe = new THREE.Group();
    scene.add(globe);
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.997, 64, 48), new THREE.MeshPhongMaterial({ color: 0x071820, shininess: 12, specular: 0x17414c })));
    scene.add(new THREE.AmbientLight(0x6dbbc5, 1.4));
    const light = new THREE.DirectionalLight(0x92e9f0, 2.3);
    light.position.set(-3, 4, 5);
    scene.add(light);

    const dots = [];
    for (let lat = -55; lat < 80; lat += 1.5) {
      const step = 1.5 / Math.max(0.25, Math.cos(THREE.MathUtils.degToRad(lat)));
      for (let lon = -179; lon < 180; lon += step) {
        if (onLand(lon, lat)) dots.push(...position(lon, lat, 1.003).toArray());
      }
    }
    const geography = new THREE.BufferGeometry();
    geography.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    globe.add(new THREE.Points(geography, new THREE.PointsMaterial({ color: 0x67c9c3, size: 0.009, transparent: true, opacity: 0.78, sizeAttenuation: true })));

    for (let lat = -60; lat <= 60; lat += 30) {
      globe.add(
        line(
          Array.from({ length: 129 }, (_, i) => position((i / 128) * 360, lat, 1.001)),
          0x32818e,
          0.2,
        ),
      );
    }
    for (let lon = 0; lon < 360; lon += 30) {
      globe.add(
        line(
          Array.from({ length: 65 }, (_, i) => position(lon, (i / 64) * 180 - 90, 1.001)),
          0x32818e,
          0.2,
        ),
      );
    }

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.065, 48, 32),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { tint: { value: new THREE.Color(0x4bdde1) } },
        vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
        fragmentShader: 'uniform vec3 tint; varying vec3 n; varying vec3 v; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.5);gl_FragColor=vec4(tint,rim*.25);}',
      }),
    );
    globe.add(atmosphere);

    const jakarta = position(106.65, -6.13, 1.015);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.03);
    shape.lineTo(0.008, 0.003);
    shape.lineTo(0.028, -0.012);
    shape.lineTo(0.006, -0.008);
    shape.lineTo(0.006, -0.025);
    shape.lineTo(-0.006, -0.025);
    shape.lineTo(-0.006, -0.008);
    shape.lineTo(-0.028, -0.012);
    shape.lineTo(-0.008, 0.003);
    shape.closePath();
    const planeGeometry = new THREE.ShapeGeometry(shape);
    const planes = Array.from({ length: 8 }, () => {
      const plane = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ color: 0xe4ffff, side: THREE.DoubleSide }));
      plane.visible = false;
      globe.add(plane);
      return plane;
    });
    const airport = new THREE.Mesh(new THREE.RingGeometry(0.025, 0.034, 40), new THREE.MeshBasicMaterial({ color: 0xaffff3, side: THREE.DoubleSide }));
    airport.position.copy(jakarta);
    airport.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), jakarta.clone().normalize());
    globe.add(airport);

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let lost = false;
    let records = [],
      shown = [];
    let transitions = new Map();
    let lastTime = performance.now();
    let spin = -THREE.MathUtils.degToRad(106.65);
    let previousWeight = 0;
    globe.rotation.set(-0.1, spin, -0.09);
    function sample(id, time) {
      const transition = transitions.get(id);
      return transition ? interpolatePosition(transition.from, transition.to, time - transition.start, motion.matches) : null;
    }
    const updates = createGlobeUpdates({
      getFlights,
      getBounds: () => visibleBounds(globe, camera),
      onData: (envelope) => {
        const time = performance.now();
        const next = new Map();
        for (const state of envelope.data) {
          if (!Number.isFinite(state.longitude) || !Number.isFinite(state.latitude)) continue;
          const target = position(state.longitude, state.latitude, 1.02);
          next.set(state.icao24, { from: sample(state.icao24, time) || target, to: target, start: time });
        }
        transitions = next;
        records = envelope.data;
      },
      onError: () => {
        const time = performance.now();
        for (const [id, transition] of transitions) {
          const point = sample(id, time);
          transition.from = point;
          transition.to = point;
        }
      },
    });
    const eligibility = () => updates.setEligible(visible && !document.hidden && navigator.onLine);
    const render = () => {
      const time = performance.now();
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      if (!visible || document.hidden) return;
      const interaction = interactions.current;
      const hold = interaction.hovered || interaction.selected;
      const pose = advanceGlobePose({ spin, previousRotation: globe.rotation.y, previousWeight, progress: sceneState.current.progress, deltaSeconds: delta, paused: hold, reducedMotion: motion.matches });
      spin = pose.spin;
      globe.rotation.set(pose.tilt, pose.rotation, -0.09);
      globe.scale.setScalar(pose.scale);
      previousWeight = pose.weight;
      shown = selectAircraft(
        records,
        shown.map((state) => state.icao24),
        (state) => isVisible(position(state.longitude, state.latitude), globe, camera),
      );
      if (interaction.selected && !shown.some((state) => state.icao24 === interaction.selected)) select(null);
      if (interaction.hovered && !shown.some((state) => state.icao24 === interaction.hovered)) hover(null);
      planes.forEach((plane, index) => {
        const state = shown[index];
        plane.visible = Boolean(state);
        if (!state) {
          plane.userData.record = null;
          return;
        }
        plane.userData.record = state;
        plane.position.copy(sample(state.icao24, time) || position(state.longitude, state.latitude, 1.02));
        plane.visible = isVisible(plane.position, globe, camera);
        const up = plane.position.clone().normalize();
        const north = new THREE.Vector3(0, 1, 0).addScaledVector(up, -up.y).normalize();
        const east = north.clone().cross(up).normalize();
        const heading = THREE.MathUtils.degToRad(state.true_track ?? 0);
        const forward = north.multiplyScalar(Math.cos(heading)).addScaledVector(east, Math.sin(heading));
        plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward.clone().cross(up).normalize(), forward, up));
        plane.material.color.set(state.icao24 === (interaction.selected || interaction.hovered) ? 0x5ce1e6 : 0xe4ffff);
      });
      if (!lost && renderer) {
        renderer.render(scene, camera);
        host.dataset.status = 'ready';
      }
    };
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer?.setSize(width, height, false);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        select(null);
        hover(null);
      }
      render();
      eligibility();
    });
    visibility.observe(host);
    const preference = () => {
      render();
    };
    const contextLost = (event) => {
      event.preventDefault();
      lost = true;
      host.dataset.status = 'unavailable';
      renderer.domElement.style.visibility = 'hidden';
    };
    renderer?.domElement.addEventListener('webglcontextlost', contextLost);
    const raycaster = new THREE.Raycaster();
    const hit = (event) => {
      const box = host.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, (-(event.clientY - box.top) / box.height) * 2 + 1), camera);
      return raycaster.intersectObjects(planes.filter((plane) => plane.visible))[0]?.object.userData.record?.icao24 || null;
    };
    const pointer = (event) => hover(hit(event));
    const leave = () => hover(null);
    const click = (event) => select(hit(event));
    const escape = (event) => {
      if (event.key === 'Escape') {
        select(null);
        hover(null);
      }
    };
    host.addEventListener('pointermove', pointer);
    host.addEventListener('pointerleave', leave);
    host.addEventListener('click', click);
    window.addEventListener('keydown', escape);
    document.addEventListener('visibilitychange', eligibility);
    window.addEventListener('online', eligibility);
    window.addEventListener('offline', eligibility);
    motion.addEventListener('change', preference);
    preference();
    resize();
    eligibility();
    gsap.ticker.add(render);

    return () => {
      gsap.ticker.remove(render);
      updates.dispose();
      document.removeEventListener('visibilitychange', eligibility);
      window.removeEventListener('online', eligibility);
      window.removeEventListener('offline', eligibility);
      window.removeEventListener('keydown', escape);
      host.removeEventListener('pointermove', pointer);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('click', click);
      observer.disconnect();
      visibility.disconnect();
      motion.removeEventListener('change', preference);
      renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) object.material.dispose();
      });
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [sceneState]);

  return <div ref={container} className="absolute inset-0 size-full [&_canvas]:block [&_canvas]:size-full" aria-hidden="true" data-status="loading" />;
}
