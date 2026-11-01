// Direct interaction with objects in a 3D stage: hover, click and drag.
//
// Pressing on a pickable object takes the gesture away from the orbit camera (our listener runs in the
// capture phase, before OrbitControls sees the event), so dragging a load moves the load, not the view.
// Pressing on empty space still orbits as usual.
import * as THREE from 'three';

/**
 * @param stage    a stage from createStage()
 * @param options
 *   pick():               objects that can be hovered / clicked / dragged (called on every event, so it can change)
 *   onDown(hit, e):       return a drag session {move(ray, e, hit), end()} to start dragging, or nothing
 *   onClick(hit, e):      called for a press-and-release without movement
 *   onHover(hit | null):  optional, when the hovered object changes
 *   cursor:               CSS cursor over pickable objects (default 'grab')
 */
export function interact(stage, { pick, onDown, onClick, onHover, cursor = 'grab' }) {
  const { canvas, container, controls } = stage;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let session = null;
  let down = null;
  let hovered = null;

  const cast = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    stage.camera.updateMatrixWorld(); // the camera sits outside the scene, so refresh its pose explicitly
    raycaster.setFromCamera(ndc, stage.camera);
    return raycaster;
  };
  const hitAt = (e) => {
    // World matrices normally refresh at render time; refresh now so objects moved since the last frame are hit where they are.
    stage.scene.updateMatrixWorld();
    return cast(e).intersectObjects(pick().filter(Boolean), false)[0] ?? null;
  };

  function onPointerDown(e) {
    if (e.button !== 0 || e.target !== canvas) return;
    const hit = hitAt(e);
    down = { x: e.clientX, y: e.clientY, hit };
    if (!hit) return;
    controls.enabled = false; // this gesture belongs to the object, not the camera
    session = onDown?.(hit, e) ?? null;
    if (session) {
      canvas.style.cursor = 'grabbing';
      try {
        canvas.setPointerCapture(e.pointerId); // keep receiving moves even if the pointer leaves the canvas
      } catch {
        /* not an active pointer (e.g. a synthetic event): dragging still works while over the canvas */
      }
    }
  }

  function onPointerMove(e) {
    if (session) {
      session.move(cast(e).ray, e, down.hit);
      return;
    }
    if (down) return; // orbiting
    const hit = hitAt(e);
    const obj = hit?.object ?? null;
    if (obj !== hovered) {
      hovered = obj;
      canvas.style.cursor = obj ? cursor : '';
      onHover?.(hit);
    }
  }

  function onPointerUp(e) {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4;
    if (session) {
      session.end?.();
      session = null;
      canvas.style.cursor = hovered ? cursor : '';
    }
    if (!moved && down.hit) onClick?.(down.hit, e);
    controls.enabled = true;
    down = null;
  }

  container.addEventListener('pointerdown', onPointerDown, { capture: true });
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  return () => {
    container.removeEventListener('pointerdown', onPointerDown, { capture: true });
    canvas.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };
}

/** Where a ray meets a plane (e.g. the plane a dragged object moves in), or null if parallel. */
export function rayOnPlane(ray, plane) {
  return ray.intersectPlane(plane, new THREE.Vector3());
}

/** A plane through `point` facing the camera: dragging on it moves an object freely across the screen. */
export function cameraPlane(camera, point) {
  const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
}

/** Drag session that turns pointer movement (in screen pixels) into a value, e.g. an unfold slider. */
export function screenDrag(e, onDelta) {
  const start = { x: e.clientX, y: e.clientY };
  return {
    move: (_ray, ev) => onDelta(ev.clientX - start.x, ev.clientY - start.y),
  };
}
