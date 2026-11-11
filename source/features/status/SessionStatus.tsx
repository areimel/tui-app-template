import {Box} from 'ink';
import type {SessionState} from '../../core/session/types.js';
import {Badge, StatRow, T} from '../../ui/kit/index.js';
import {buildStatus, type BadgeData} from './status-model.js';

export type SessionStatusProps = {
	readonly state: SessionState;
	/**
	Current epoch ms from the injected clock.
	*/
	readonly now: number;
};

const LABEL_WIDTH = 8;

function ModelBadge({data}: {readonly data: BadgeData}) {
	return (
		<Badge
			state={data.state}
			label={data.label}
			{...(data.detail === undefined ? {} : {detail: data.detail})}
		/>
	);
}

/**
Phase, elapsed time, what ends the session, lock badges, watched PID and messages.
*/
export function SessionStatus({state, now}: SessionStatusProps) {
	const model = buildStatus(state, now);
	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<ModelBadge data={model.phase} />
			</Box>
			<StatRow label="Elapsed" value={model.elapsed} labelWidth={LABEL_WIDTH} />
			<StatRow label="Timer" value={model.ends} labelWidth={LABEL_WIDTH} />
			{model.pid === undefined ? null : (
				<StatRow
					label="Watching"
					value={`PID ${model.pid}`}
					labelWidth={LABEL_WIDTH}
				/>
			)}
			<Box flexDirection="column" marginTop={1}>
				{model.locks.map(lock => (
					<ModelBadge key={lock.id} data={lock} />
				))}
			</Box>
			{model.message === undefined ? null : (
				<Box marginTop={1}>
					<T tone="warn">{model.message}</T>
				</Box>
			)}
			{model.notes.map(note => (
				<T key={note} tone="muted">
					{note}
				</T>
			))}
		</Box>
	);
}
