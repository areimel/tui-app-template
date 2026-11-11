import {Box} from 'ink';
import type {SessionState} from '../../core/session/types.js';
import {Badge, T} from '../../ui/kit/index.js';
import {buildStatus} from './status-model.js';

export type StatusLineProps = {
	readonly state: SessionState;
	readonly now: number;
};

/**
The session on one row (phase, elapsed, end, lock badges), for small terminals. Never wraps: extra content is cut off.
*/
export function StatusLine({state, now}: StatusLineProps) {
	const model = buildStatus(state, now);
	return (
		<Box height={1} overflow="hidden" gap={2}>
			<Box flexShrink={0}>
				<Badge state={model.phase.state} label={model.phase.label} />
			</Box>
			<Box flexShrink={0}>
				<T tone="muted">
					{model.elapsed} · {model.ends}
				</T>
			</Box>
			{model.locks.map(lock => (
				<Box key={lock.id} flexShrink={0}>
					<Badge state={lock.state} label={lock.label} />
				</Box>
			))}
		</Box>
	);
}
