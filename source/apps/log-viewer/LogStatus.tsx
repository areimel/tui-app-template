/**
The bottom row: source, line count, level filter, search term and match position, and the state badge.
*/
import {Box} from 'ink';
import {Badge, StatusBar, T} from '../../ui/kit/index.js';
import {LEVEL_VIEWS} from './LogPane.js';
import {LEVELS, type Level} from './log-model.js';

/**
Below this width the search term is left out (only the position stays).
*/
const COMPACT_COLUMNS = 60;

export type LogStatusProps = {
	readonly width: number;
	readonly label: string;
	readonly lineCount: number;
	readonly levels: readonly Level[];
	readonly term: string;
	readonly matchCount: number;
	/**
	1-based rank of the cursor line among the matches, or `undefined` when it is not a match.
	*/
	readonly matchRank: number | undefined;
	readonly isPaused: boolean;
	readonly isFollowing: boolean;
	readonly error: string | undefined;
};

export function filterText(levels: readonly Level[]): string {
	return levels.length === 0
		? 'all'
		: LEVELS.filter(level => levels.includes(level))
				.map(level => LEVEL_VIEWS[level].label)
				.join('+');
}

export function LogStatus({
	width,
	label,
	lineCount,
	levels,
	term,
	matchCount,
	matchRank,
	isPaused,
	isFollowing,
	error,
}: LogStatusProps) {
	const isCompact = width < COMPACT_COLUMNS;
	const position = term === '' ? '' : `${matchRank ?? '-'}/${matchCount}`;
	const search =
		term === '' ? '' : `${isCompact ? '' : `/${term} `}${position}`;
	const left = (
		<Box>
			<T bold>{label}</T>
			<T tone="muted"> {lineCount} lines </T>
			<T tone={levels.length === 0 ? 'muted' : 'accent'}>
				[{filterText(levels)}]
			</T>
			{error === undefined ? null : <T tone="err"> ! {error}</T>}
		</Box>
	);
	const right = (
		<Box>
			{search === '' ? null : <T tone="accent">{search} </T>}
			{isPaused ? (
				<Badge state="warn" label="PAUSED" />
			) : isFollowing ? (
				<Badge state="ok" label="FOLLOW" />
			) : (
				<Badge state="off" label="SCROLL" />
			)}
		</Box>
	);
	return <StatusBar width={width} left={left} right={right} />;
}
