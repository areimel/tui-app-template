/**
Runs an async `Result` operation from React state, with cancel. Only the latest run may report.
*/
import {useLayoutEffect, useRef, useState} from 'react';
import type {AsyncControl, AsyncRun, AsyncState} from './types.js';

/**
Run an async `Result` operation with cancel (see `AsyncControl` in `types.ts`).
*/
export function useAsync<T, E, A extends unknown[]>(
	run: AsyncRun<T, E, A>,
): AsyncControl<T, E, A> {
	const [state, setState] = useState<AsyncState<T, E>>({status: 'idle'});
	const runRef = useRef(run);
	const controllerRef = useRef<AbortController | undefined>(undefined);
	const isMountedRef = useRef(false);

	useLayoutEffect(() => {
		runRef.current = run;
	});

	useLayoutEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			controllerRef.current?.abort();
			controllerRef.current = undefined;
		};
	}, []);

	return {
		state,
		start(...args) {
			if (!isMountedRef.current) {
				return;
			}

			controllerRef.current?.abort();
			const controller = new AbortController();
			controllerRef.current = controller;
			setState({status: 'loading'});
			void runRef.current(controller.signal, ...args).then(result => {
				if (controller.signal.aborted) {
					return;
				}

				setState(
					result.isOk
						? {status: 'done', value: result.value}
						: {status: 'failed', error: result.error},
				);
			});
		},
		cancel() {
			controllerRef.current?.abort();
			controllerRef.current = undefined;
			if (isMountedRef.current) {
				setState({status: 'idle'});
			}
		},
	};
}
