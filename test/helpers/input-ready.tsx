/**
Ink attaches its stdin listener in a passive effect after the first commit, so keys written right
after `render()` can be dropped. Mount `<ReadySignal />` (any position) and await `whenReady()`
before the first `stdin.write`: passive effects of one commit run together, so by the time this
component's effect has run, Ink's listener is attached too.
*/
import {useEffect} from 'react';
import {waitFor} from './keys.js';

export type ReadySignal = {
	/**
	Mount this anywhere in the rendered tree.
	*/
	readonly ReadySignal: () => undefined;
	isReady(): boolean;
	whenReady(timeoutMs?: number): Promise<void>;
};

export function createReadySignal(): ReadySignal {
	let isReady = false;
	function ReadySignal(): undefined {
		useEffect(() => {
			isReady = true;
		}, []);
		return undefined;
	}

	return {
		ReadySignal,
		isReady: () => isReady,
		async whenReady(timeoutMs = 20_000) {
			await waitFor(() => isReady, 'input ready', timeoutMs);
		},
	};
}
