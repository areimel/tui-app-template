/**
Stub: owned by H1 (hooks). Replace the body; keep the exports and signatures.
*/
import {useState} from 'react';
import type {AsyncControl, AsyncRun, AsyncState} from './types.js';

/**
Run an async `Result` operation with cancel (see `AsyncControl` in `types.ts`).
*/
export function useAsync<T, E, A extends unknown[]>(
	run: AsyncRun<T, E, A>,
): AsyncControl<T, E, A> {
	const [state, setState] = useState<AsyncState<T, E>>({status: 'idle'});
	return {
		state,
		start(...args) {
			setState({status: 'loading'});
			void run(new AbortController().signal, ...args).then(result => {
				setState(
					result.isOk
						? {status: 'done', value: result.value}
						: {status: 'failed', error: result.error},
				);
			});
		},
		cancel() {
			setState({status: 'idle'});
		},
	};
}
