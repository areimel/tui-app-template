/**
Like ink-testing-library's `render`, but with a chosen terminal size (ink-testing-library is fixed at 100 columns), so full-screen layouts can be checked at real sizes. The tree is wrapped in an `InputRoot` (keyboard routing for `useKeys` / `useScopedInput`); it adds no `ThemeProvider`.
*/
/* eslint-disable unicorn/prefer-event-target, @typescript-eslint/naming-convention, unicorn/consistent-class-member-order -- Mirrors the stream shapes Ink reads. */
import {EventEmitter} from 'node:events';
import {stripVTControlCharacters} from 'node:util';
import type {ReactElement} from 'react';
import {render} from 'ink';
import {InputRoot} from '../../source/ui/input/index.js';

class FakeStdout extends EventEmitter {
	readonly frames: string[] = [];
	readonly columns: number;
	readonly rows: number;

	constructor(columns: number, rows: number) {
		super();
		this.columns = columns;
		this.rows = rows;
	}

	write = (frame: string): boolean => {
		this.frames.push(frame);
		return true;
	};
}

class FakeStdin extends EventEmitter {
	readonly isTTY: boolean;
	private data: string | undefined;

	constructor(isTty = true) {
		super();
		this.isTTY = isTty;
	}

	write = (data: string): void => {
		this.data = data;
		this.emit('readable');
		this.emit('data', data);
	};

	// Ink drains stdin with `while (read() !== null)`, so the end must be `null`.
	// eslint-disable-next-line @typescript-eslint/no-restricted-types
	read = (): string | null => {
		const {data} = this;
		this.data = undefined;

		return data ?? null;
	};

	setEncoding(): void {
		// Not needed.
	}

	setRawMode(): void {
		// Not needed.
	}

	resume(): void {
		// Not needed.
	}

	pause(): void {
		// Not needed.
	}

	ref(): void {
		// Not needed.
	}

	unref(): void {
		// Not needed.
	}
}

export type SizedRender = {
	stdin: FakeStdin;
	/**
	The latest frame with colour codes stripped (`''` before the first render).
	*/
	plainFrame(): string;
	unmount(): void;
};

export type RenderSizedOptions = {
	/**
	Default true. False simulates piped stdin: Ink reports raw mode as unsupported.
	*/
	isTty?: boolean;
};

export function renderSized(
	node: ReactElement,
	columns: number,
	rows: number,
	{isTty = true}: RenderSizedOptions = {},
): SizedRender {
	const stdout = new FakeStdout(columns, rows);
	const stdin = new FakeStdin(isTty);
	const instance = render(<InputRoot>{node}</InputRoot>, {
		stdout: stdout as unknown as NodeJS.WriteStream,
		stderr: new FakeStdout(columns, rows) as unknown as NodeJS.WriteStream,
		stdin: stdin as unknown as NodeJS.ReadStream,
		debug: true,
		exitOnCtrlC: false,
		patchConsole: false,
	});
	return {
		stdin,
		plainFrame: () => stripVTControlCharacters(stdout.frames.at(-1) ?? ''),
		unmount() {
			instance.unmount();
			instance.cleanup();
		},
	};
}
