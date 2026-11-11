/**
Stub: owned by P1 (system service). Pure. Write it test-first with fixtures in `test/fixtures/`.
*/
import type {ProcessInfo} from '../types.js';

/**
The `ps` arguments whose output `parsePs` reads (same on Linux and macOS).
*/
export const PS_ARGS = ['-axo', 'pid=,user=,pcpu=,rss=,comm='] as const;

/**
Parse `ps -axo pid=,user=,pcpu=,rss=,comm=` output (RSS in KiB). Malformed lines are skipped; `comm`
may contain spaces and, on macOS, a full path (keep the basename).
*/
export function parsePs(_text: string): ProcessInfo[] {
	return [];
}
