import * as three from 'three';

function roundedRectangle(halfWidth: number, halfHeight: number, radius: number) {
  const shape = new three.Shape();
  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
  return shape;
}

export function createAboutScene(host: HTMLDivElement) {
  const renderer = new three.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(36, 1, 0.1, 30);
  camera.position.z = 7;
  scene.add(new three.AmbientLight(0xffffff, 1.5));
  const light = new three.DirectionalLight(0xffffff, 3);
  light.position.set(3, 4, 6);
  scene.add(light);
  const fill = new three.DirectionalLight(0x779fff, 1.4);
  fill.position.set(-4, -2, 2);
  scene.add(fill);

  const sculpture = new three.Group();
  sculpture.rotation.set(0.1, -0.25, 0.12);
  scene.add(sculpture);

  const chipGeometry = new three.ExtrudeGeometry(roundedRectangle(0.9, 0.9, 0.15), {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 3,
  });
  chipGeometry.center();
  const chipMaterial = new three.MeshStandardMaterial({
    color: 0x174fdb,
    roughness: 0.3,
    metalness: 0.2,
  });
  sculpture.add(new three.Mesh(chipGeometry, chipMaterial));

  const gold = new three.MeshStandardMaterial({ color: 0xffc63d, roughness: 0.3, metalness: 0.3 });
  const pinGeometry = new three.ExtrudeGeometry(roundedRectangle(0.075, 0.15, 0.04), {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  pinGeometry.center();
  const pins = new three.InstancedMesh(pinGeometry, gold, 12);
  const pinTransform = new three.Object3D();
  let pinIndex = 0;
  for (const offset of [-0.55, 0, 0.55]) {
    for (const side of [-1, 1]) {
      pinTransform.position.set(offset, side * 1.02, -0.05);
      pinTransform.rotation.z = 0;
      pinTransform.updateMatrix();
      pins.setMatrixAt(pinIndex++, pinTransform.matrix);
      pinTransform.position.set(side * 1.02, offset, -0.05);
      pinTransform.rotation.z = Math.PI / 2;
      pinTransform.updateMatrix();
      pins.setMatrixAt(pinIndex++, pinTransform.matrix);
    }
  }
  pins.instanceMatrix.needsUpdate = true;
  sculpture.add(pins);

  const panelShape = roundedRectangle(0.63, 0.63, 0.12);
  const panelGeometry = new three.ShapeGeometry(panelShape, 16);
  const panelMaterial = new three.MeshStandardMaterial({
    color: 0x17295f,
    roughness: 0.3,
    metalness: 0.12,
  });
  const panel = new three.Mesh(panelGeometry, panelMaterial);
  panel.position.z = 0.19;
  sculpture.add(panel);
  const outlineGeometry = new three.BufferGeometry().setFromPoints(
    panelShape.getPoints(16).map((point) => new three.Vector3(point.x, point.y, 0.2)),
  );
  const outlineMaterial = new three.LineBasicMaterial({ color: 0xffcf4d });
  sculpture.add(new three.LineLoop(outlineGeometry, outlineMaterial));

  const stylus = new three.Group();
  stylus.position.set(0.24, -0.04, 0.62);
  stylus.rotation.set(0.12, -0.12, -0.72);
  sculpture.add(stylus);
  const barrelGeometry = new three.CylinderGeometry(0.12, 0.12, 2.05, 24);
  const orange = new three.MeshStandardMaterial({
    color: 0xf27625,
    roughness: 0.3,
    metalness: 0.12,
  });
  stylus.add(new three.Mesh(barrelGeometry, orange));
  const capGeometry = new three.CylinderGeometry(0.123, 0.123, 0.32, 24);
  const cap = new three.Mesh(capGeometry, gold);
  cap.position.y = 0.87;
  stylus.add(cap);
  const capEndGeometry = new three.SphereGeometry(0.123, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const capEnd = new three.Mesh(capEndGeometry, gold);
  capEnd.position.y = 1.03;
  stylus.add(capEnd);
  const collarGeometry = new three.CylinderGeometry(0.126, 0.126, 0.07, 24);
  const collarMaterial = new three.MeshStandardMaterial({ color: 0x273449, roughness: 0.45 });
  const collar = new three.Mesh(collarGeometry, collarMaterial);
  collar.position.y = 0.69;
  stylus.add(collar);
  const nibGeometry = new three.CylinderGeometry(0.12, 0.055, 0.32, 24);
  const nib = new three.Mesh(nibGeometry, gold);
  nib.position.y = -1.17;
  stylus.add(nib);
  const tipGeometry = new three.ConeGeometry(0.055, 0.22, 24);
  const tip = new three.Mesh(tipGeometry, collarMaterial);
  tip.rotation.z = Math.PI;
  tip.position.y = -1.43;
  stylus.add(tip);
  const buttonGeometry = new three.SphereGeometry(0.055, 16, 12);
  const button = new three.Mesh(buttonGeometry, collarMaterial);
  button.position.set(0, 0.36, 0.12);
  button.scale.set(0.65, 1.5, 0.4);
  stylus.add(button);

  const ringGeometry = new three.TorusGeometry(1.8, 0.009, 6, 100);
  const ringGold = new three.MeshBasicMaterial({
    color: 0xf5b83b,
    transparent: true,
    opacity: 0.8,
  });
  const ringOrange = new three.MeshBasicMaterial({
    color: 0x7087d0,
    transparent: true,
    opacity: 0.65,
  });
  const ringOne = new three.Mesh(ringGeometry, ringGold);
  ringOne.rotation.set(1.05, 0.2, 0.1);
  sculpture.add(ringOne);
  const ringTwo = new three.Mesh(ringGeometry, ringOrange);
  ringTwo.rotation.set(0.35, 1.05, 0.15);
  sculpture.add(ringTwo);
  const sphereGeometry = new three.SphereGeometry(0.065, 16, 12);
  const dot = new three.Mesh(sphereGeometry, gold);
  dot.position.set(-1.55, 0.15, 0.8);
  sculpture.add(dot);
  const dotTwo = new three.Mesh(sphereGeometry, orange);
  dotTwo.position.set(1.35, -0.65, -0.55);
  sculpture.add(dotTwo);
  let rotation = 0;

  return {
    canvas: renderer.domElement,
    setRotation(value: number) {
      rotation = value;
    },
    resize() {
      const { clientWidth: width, clientHeight: height } = host;
      if (!width || !height) {
        return;
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
    render(time: number) {
      sculpture.rotation.y = rotation - 0.25 + Math.sin(time * 0.28) * 0.14;
      sculpture.rotation.x = 0.1 + Math.sin(time * 0.35) * 0.07;
      sculpture.position.y = Math.sin(time * 0.55) * 0.07;
      ringOne.rotation.y = 0.2 + time * 0.04;
      ringTwo.rotation.x = 0.35 - time * 0.03;
      renderer.render(scene, camera);
    },
    dispose() {
      pins.dispose();
      for (const geometry of [
        chipGeometry,
        pinGeometry,
        panelGeometry,
        outlineGeometry,
        barrelGeometry,
        capGeometry,
        capEndGeometry,
        collarGeometry,
        nibGeometry,
        tipGeometry,
        buttonGeometry,
        ringGeometry,
        sphereGeometry,
      ]) {
        geometry.dispose();
      }
      for (const material of [
        chipMaterial,
        gold,
        panelMaterial,
        outlineMaterial,
        orange,
        collarMaterial,
        ringGold,
        ringOrange,
      ]) {
        material.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export type AboutScene = ReturnType<typeof createAboutScene>;
