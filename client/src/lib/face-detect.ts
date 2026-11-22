// Served from this site itself, not a CDN: the university's intranet may have
// no internet. Only their addresses here — the files load when first needed.
import simdLoader from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import simdBinary from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import plainLoader from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import plainBinary from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import model from "../assets/models/blaze_face_short_range.tflite?url";
import type { FaceBox } from "./face-frame";

/** The faces in one frame of a live picture, in its pixels. `at`: the frame's time, in ms. */
export type FindFaces = (picture: HTMLCanvasElement, at: number) => FaceBox[];

/** Found with less confidence than this: not a face. */
const CONFIDENCE = 0.6;

let loading: Promise<FindFaces | null> | null = null;

/**
 * The face detector — MediaPipe's, with BlazeFace short-range: a model made
 * for faces within arm's length of a phone's camera. Loaded the first time it
 * is asked for (some 4 MB over the wire), then kept for the next opening.
 *
 * Null where it cannot run — no WebAssembly, a policy that forbids it, a
 * download that failed: the shutter is then pressed by hand, as before. A
 * later opening tries again.
 */
export function loadFaceFinder(): Promise<FindFaces | null> {
  loading ??= (async (): Promise<FindFaces | null> => {
    try {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const simd = await FilesetResolver.isSimdSupported();
      const detector = await FaceDetector.createFromOptions(
        { wasmLoaderPath: simd ? simdLoader : plainLoader, wasmBinaryPath: simd ? simdBinary : plainBinary },
        { baseOptions: { modelAssetPath: model, delegate: "CPU" }, runningMode: "VIDEO", minDetectionConfidence: CONFIDENCE },
      );
      // The detector wants each frame's time later than the last one's.
      let last = -1;
      return (picture, at) => {
        last = Math.max(Math.round(at), last + 1);
        return detector.detectForVideo(picture, last).detections.flatMap(({ boundingBox: b }) =>
          b ? [{ x: b.originX, y: b.originY, width: b.width, height: b.height }] : [],
        );
      };
    } catch {
      loading = null;
      return null;
    }
  })();
  return loading;
}
