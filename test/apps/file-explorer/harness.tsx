/**
The File Explorer screen over a fake home folder (`HOME`, `FILES`), shared by its screen tests.
*/
import {Screen} from '../../../source/apps/file-explorer/Screen.js';
import {
	createFakeServices,
	renderScreen,
	type ScreenRender,
} from '../../helpers/render-screen.js';

export const HOME = '/home/tester';
const longFile = Array.from(
	{length: 100},
	(_, index) => `line ${index + 1}`,
).join('\n');

export const FILES = {
	[`${HOME}/alpha/inner/deep.txt`]: 'deep\n',
	[`${HOME}/alpha/readme.md`]: 'hello from alpha\n',
	[`${HOME}/zeta/z.txt`]: 'z\n',
	[`${HOME}/empty`]: {isDir: true},
	[`${HOME}/locked/x`]: 'x\n',
	[`${HOME}/.hidden`]: 'secret\n',
	[`${HOME}/apple.txt`]: 'apple contents\n',
	[`${HOME}/banana.log`]: 'banana line one\nbanana line two\n',
	[`${HOME}/big.bin`]: {binaryBytes: 5000},
	[`${HOME}/notes.txt`]: `${'notes '.repeat(50)}\nsecond notes line\n`,
	[`${HOME}/long.txt`]: longFile,
} as const;

export type MountOptions = {
	readonly columns?: number;
	readonly rows?: number;
	readonly config?: Record<string, Record<string, unknown>>;
	readonly params?: Record<string, string>;
	readonly files?: Record<string, string>;
	readonly openableApps?: readonly string[];
};

export function mount(options: MountOptions = {}) {
	const {services} = createFakeServices({
		files: {...FILES, ...options.files},
		modifiedMs: Date.UTC(2026, 10, 11),
		errors: {
			[`${HOME}/locked`]: `EACCES: permission denied, scandir '${HOME}/locked'`,
		},
	});
	const view = renderScreen(<Screen />, {
		columns: options.columns ?? 116,
		rows: options.rows ?? 38,
		services,
		...(options.config !== undefined && {config: options.config}),
		...(options.openableApps !== undefined && {
			openableApps: options.openableApps,
		}),
		route: {
			id: 'file-explorer',
			...(options.params !== undefined && {params: options.params}),
		},
	});
	return view;
}

export const text = (view: ScreenRender) => view.lines().join('\n');
export const cursorLine = (view: ScreenRender) =>
	view.lines().find(line => /❯ [?·↪▸]/v.test(line)) ?? '';
