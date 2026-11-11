/**
The Log Viewer screen: a windowed, filterable, searchable log pane over a followed file or a demo stream.
*/
import {useMemo, useState} from 'react';
import {Box} from 'ink';
import {
	useAppConfig,
	useRouter,
	useScreenSize,
	useToast,
} from '../../shell/context.js';
import {useKeys} from '../../ui/input/index.js';
import {SearchInput} from '../../ui/kit/index.js';
import {APP_ID, LOG_VIEWER_CONFIG} from './config.js';
import {LOG_BINDINGS} from './keys.js';
import {LogPane} from './LogPane.js';
import {LogStatus} from './LogStatus.js';
import {
	filterLines,
	findMatches,
	firstMatchFrom,
	indexOfId,
	stepMatch,
	toggleLevel,
	type Level,
} from './log-model.js';
import {useLogSource} from './use-log-source.js';

/**
Width kept free beside the search field (prompt, match count).
*/
const SEARCH_CHROME_CELLS = 20;

type LogScreenProps = {
	readonly path: string | undefined;
};

/**
Reads the route; the keyed inner screen starts fresh whenever the file changes.
*/
export function Screen() {
	const path = useRouter().current.params?.['path'];
	return <LogScreen key={path ?? 'demo'} path={path} />;
}

function LogScreen({path}: LogScreenProps) {
	const {columns, rows} = useScreenSize();
	const toast = useToast();
	const [config, updateConfig] = useAppConfig(APP_ID, LOG_VIEWER_CONFIG);
	const [isPaused, setIsPaused] = useState(false);
	const source = useLogSource(path, isPaused);
	const [isFollowing, setIsFollowing] = useState(config.follow);
	const [cursorId, setCursorId] = useState<number | undefined>();
	const [term, setTerm] = useState('');
	const [previousTerm, setPreviousTerm] = useState('');
	const [isSearching, setIsSearching] = useState(false);

	const levelSet = useMemo(() => new Set(config.levels), [config.levels]);
	const visible = useMemo(
		() => filterLines(source.lines, levelSet),
		[source.lines, levelSet],
	);
	const matches = useMemo(() => findMatches(visible, term), [visible, term]);

	const count = visible.length;
	const paneHeight = Math.max(1, rows - 1);
	const cursorIndex =
		count === 0
			? 0
			: isFollowing || cursorId === undefined
				? count - 1
				: indexOfId(visible, cursorId);
	const matchRank = matches.includes(cursorIndex)
		? matches.indexOf(cursorIndex) + 1
		: undefined;

	const moveTo = (index: number, shouldFollow: boolean) => {
		const target = Math.max(0, Math.min(index, count - 1));
		setCursorId(visible[target]?.id);
		setIsFollowing(shouldFollow);
	};

	const step = (delta: number) => {
		if (isFollowing && delta > 0) {
			return;
		}

		moveTo(cursorIndex + delta, delta > 0 && isFollowing);
	};

	const filter = (level: Level) => {
		updateConfig({levels: toggleLevel(config.levels, level)});
	};

	const jump = (index: number | undefined) => {
		if (index === undefined) {
			toast('No matches', 'warn');
		} else {
			moveTo(index, false);
		}
	};

	useKeys(
		LOG_BINDINGS,
		{
			up() {
				step(-1);
			},
			down() {
				step(1);
			},
			pageUp() {
				step(-Math.max(1, paneHeight - 1));
			},
			pageDown() {
				step(Math.max(1, paneHeight - 1));
			},
			top() {
				moveTo(0, false);
			},
			bottom() {
				setCursorId(undefined);
				setIsFollowing(true);
			},
			follow() {
				const shouldFollow = !isFollowing;
				setCursorId(shouldFollow ? undefined : visible.at(-1)?.id);
				setIsFollowing(shouldFollow);
				updateConfig({follow: shouldFollow});
			},
			pause() {
				setIsPaused(previous => !previous);
			},
			clear() {
				source.clear();
				setCursorId(undefined);
				toast('Buffer cleared');
			},
			search() {
				setPreviousTerm(term);
				setIsSearching(true);
			},
			nextMatch() {
				jump(stepMatch(matches, cursorIndex, 1));
			},
			prevMatch() {
				jump(stepMatch(matches, cursorIndex, -1));
			},
			filterError() {
				filter('error');
			},
			filterWarn() {
				filter('warn');
			},
			filterInfo() {
				filter('info');
			},
			filterDebug() {
				filter('debug');
			},
			clearFilters() {
				updateConfig({levels: []});
			},
		},
		{isActive: !isSearching},
	);

	const emptyText = source.isLoading
		? 'Loading…'
		: source.error !== undefined && source.lines.length === 0
			? source.error
			: source.lines.length === 0
				? 'Waiting for lines…'
				: 'No lines match the level filter';

	return (
		<Box flexDirection="column" width={columns} height={rows}>
			<LogPane
				lines={visible}
				cursor={cursorIndex}
				height={paneHeight}
				width={columns}
				term={term}
				hasMarker={!isFollowing}
				emptyText={emptyText}
			/>
			{isSearching ? (
				<SearchInput
					isActive
					value={term}
					width={Math.max(8, columns - SEARCH_CHROME_CELLS)}
					matchCount={matches.length}
					onChange={setTerm}
					onSubmit={() => {
						setIsSearching(false);
						jump(
							term === '' ? undefined : firstMatchFrom(matches, cursorIndex),
						);
					}}
					onCancel={() => {
						setTerm(previousTerm);
						setIsSearching(false);
					}}
				/>
			) : (
				<LogStatus
					width={columns}
					label={source.label}
					lineCount={source.lines.length}
					levels={config.levels}
					term={term}
					matchCount={matches.length}
					matchRank={matchRank}
					isPaused={isPaused}
					isFollowing={isFollowing}
					error={source.error}
				/>
			)}
		</Box>
	);
}
