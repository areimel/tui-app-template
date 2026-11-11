/**
Stub: owned by P2 (fs and http services). Impure: `node:fs`, `node:os`. Read-only by design.
Replace the bodies; keep the exports and signatures.
*/
import os from 'node:os';
import process from 'node:process';
import {fail} from '../../core/result.js';
import type {FsService} from '../types.js';

export function createFsService(): FsService {
	return {
		home: () => os.homedir(),
		cwd: () => process.cwd(),
		list: async path => fail(`Not implemented: list ${path}`),
		preview: async path => fail(`Not implemented: preview ${path}`),
		readText: async path => fail(`Not implemented: read ${path}`),
		follow: () => () => undefined,
	};
}
