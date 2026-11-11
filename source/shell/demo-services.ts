/**
Stub: owned by S2 (app shell, menu, overlays, brand). Deterministic demo data for screenshots and
`--demo` runs: wraps real `Services`, replacing what varies between machines (hostname, process list,
home folder) with fixed sample values. Keep the export and signature.
*/
import type {Services} from '../platform/types.js';

export function createDemoServices(base: Services): Services {
	return base;
}
