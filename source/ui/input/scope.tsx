/**
`InputRoot` (the app's only Ink `useInput`) and `InputScope`. See `types.ts` for the dispatch rule.
*/
import {
	createContext,
	use,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import {useInput, useStdin} from 'ink';
import {createKeyQueue} from './key-queue.js';
import {
	createInputRegistry,
	type InputRegistry,
	type ScopeHandle,
} from './registry.js';
import type {InputRootProps, InputScopeProps} from './types.js';

const RegistryContext = createContext<InputRegistry | undefined>(undefined);
const ScopeContext = createContext<ScopeHandle | undefined>(undefined);

/**
The registry of the nearest `InputRoot`. Throws a clear error outside one.
*/
export function useInputRegistry(hookName: string): InputRegistry {
	const registry = use(RegistryContext);
	if (registry === undefined) {
		throw new Error(
			`${hookName} must be used inside <InputRoot> (tests: renderThemed, renderSized and renderScreen add it).`,
		);
	}

	return registry;
}

/**
The nearest `InputScope`, or the root scope.
*/
export function useCurrentScope(registry: InputRegistry): ScopeHandle {
	return use(ScopeContext) ?? registry.root;
}

type DispatcherProps = {
	readonly registry: InputRegistry;
	readonly isActive: boolean;
};

/**
Holds the single Ink `useInput`. Inactive (no raw mode, no listener) when stdin cannot do raw mode, or
when an outer `InputRoot` already dispatches.
*/
function Dispatcher({registry, isActive}: DispatcherProps): ReactNode {
	const {isRawModeSupported} = useStdin();
	const [commits, setCommits] = useState(0);
	const [queue] = useState(() =>
		createKeyQueue(registry.dispatch, () => {
			setCommits(count => count + 1);
		}),
	);
	useLayoutEffect(() => {
		queue.committed();
	}, [queue, commits]);
	useInput(
		(input, key) => {
			queue.push(input, key);
		},
		{isActive: isActive && isRawModeSupported},
	);
	return null;
}

/**
Root of keyboard input. Mount once, high in the tree (inside Ink's `render`). A nested `InputRoot`
reuses the outer one's registry (no second dispatcher) and only adds its `onInterrupt`, so test helpers
and the real Shell can both wrap trees safely.
*/
export function InputRoot({onInterrupt, children}: InputRootProps) {
	const outer = use(RegistryContext);
	const [own] = useState(createInputRegistry);
	const registry = outer ?? own;
	const interruptRef = useRef(onInterrupt);
	useLayoutEffect(() => {
		interruptRef.current = onInterrupt;
	});
	const hasInterrupt = onInterrupt !== undefined;
	useLayoutEffect(() => {
		if (!hasInterrupt) {
			return;
		}

		return registry.addInterrupt(() => {
			interruptRef.current?.();
		});
	}, [registry, hasInterrupt]);

	return (
		<RegistryContext value={registry}>
			<Dispatcher registry={registry} isActive={outer === undefined} />
			{children}
		</RegistryContext>
	);
}

/**
A routing scope. Bindings and handlers registered below it belong to it. `id` and `kind` are fixed
for the component's life (give it a `key` to change them). Registration happens in layout effects, so
a scope opened by one key is already on top for the next key, even in a burst.
*/
export function InputScope({id, kind = 'screen', children}: InputScopeProps) {
	const registry = useInputRegistry('InputScope');
	const [scope] = useState(() => registry.createScope(id, kind));
	useLayoutEffect(() => registry.mountScope(scope), [registry, scope]);
	return <ScopeContext value={scope}>{children}</ScopeContext>;
}
