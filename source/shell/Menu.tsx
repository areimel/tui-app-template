/**
The first page: the brand heading and one row per app (number, glyph, title, description, optional
`menuBadge`). Up/down move, Enter or `1`-`9` open an app (`router.push`). The list is windowed when it
is taller than the body.
*/
import {useMemo} from 'react';
import {Box} from 'ink';
import {useListNav} from '../ui/hooks/index.js';
import {useKeys, type KeyBinding} from '../ui/input/index.js';
import {T, VirtualList} from '../ui/kit/index.js';
import {Brand} from './brand/Brand.js';
import {HEADING_HEIGHT, HEADING_WIDTH} from './brand/heading-art.js';
import {
	AppServiceProvider,
	useRouter,
	useScreenSize,
	useServices,
	useToast,
} from './context.js';
import {planMenu} from './menu-plan.js';
import type {AppDefinition, AppService} from './types.js';

export type MenuProps = {
	readonly apps: readonly AppDefinition[];
	/**
	The running service of an app, for its `menuBadge` (`useOptionalAppService`). Default: none.
	*/
	readonly serviceFor?: (appId: string) => AppService | undefined;
};

const MAX_SHORTCUTS = 9;
/**
Columns the list's marker column takes.
*/
const MARKER_COLUMNS = 2;
const SCROLLBAR_COLUMNS = 1;
const SPLIT_GAP = '  ';

/**
`1`-`9` open the first nine apps; one binding each so help can name the app.
*/
export function shortcutBindings(apps: readonly AppDefinition[]): KeyBinding[] {
	return apps.slice(0, MAX_SHORTCUTS).map((app, index) => ({
		action: app.id,
		keys: [String(index + 1)],
		label: `open ${app.title}`,
		group: 'Menu',
	}));
}

function isSupported(app: AppDefinition, platform: string): boolean {
	return app.platforms === undefined || app.platforms.includes(platform);
}

type MenuRowProps = {
	readonly app: AppDefinition;
	readonly index: number;
	readonly titleWidth: number;
	readonly width: number;
	readonly isAvailable: boolean;
	readonly platform: string;
	readonly service: AppService | undefined;
};

function MenuRow({
	app,
	index,
	titleWidth,
	width,
	isAvailable,
	platform,
	service,
}: MenuRowProps) {
	const {menuBadge: Badge} = app;
	const number = index < MAX_SHORTCUTS ? String(index + 1) : ' ';
	const note = isAvailable ? app.description : `Not available on ${platform}`;
	return (
		<Box width={width} flexShrink={0}>
			<Box flexGrow={1} flexShrink={1}>
				<T tone={isAvailable ? 'text' : 'muted'} wrap="truncate-end">
					<T tone="muted">{number} </T>
					<T tone="accent">{app.glyph} </T>
					<T bold={isAvailable}>{app.title.padEnd(titleWidth)}</T>
					<T tone="muted">{`${SPLIT_GAP}${note}`}</T>
				</T>
			</Box>
			{Badge === undefined ? null : (
				<Box flexShrink={0} marginLeft={1}>
					<AppServiceProvider service={service}>
						<Badge />
					</AppServiceProvider>
				</Box>
			)}
		</Box>
	);
}

export function Menu({apps, serviceFor}: MenuProps) {
	const size = useScreenSize();
	const router = useRouter();
	const toast = useToast();
	const {platform} = useServices();
	const plan = planMenu(size, apps.length, {
		width: HEADING_WIDTH,
		height: HEADING_HEIGHT,
	});

	const open = (app: AppDefinition) => {
		if (isSupported(app, platform)) {
			router.push({id: app.id});
		} else {
			toast(`${app.title} is not available on ${platform}`, 'warn');
		}
	};

	const {cursor} = useListNav({
		count: apps.length,
		pageSize: Math.max(1, plan.listHeight - 1),
		onSelect(index) {
			const app = apps[index];
			if (app !== undefined) {
				open(app);
			}
		},
	});

	const shortcuts = useMemo(() => shortcutBindings(apps), [apps]);
	useKeys(
		shortcuts,
		Object.fromEntries(
			apps.slice(0, MAX_SHORTCUTS).map(app => [
				app.id,
				() => {
					open(app);
				},
			]),
		),
	);

	const titleWidth = Math.max(0, ...apps.map(app => [...app.title].length));
	const rowWidth = Math.max(
		0,
		size.columns - MARKER_COLUMNS - (plan.hasScrollbar ? SCROLLBAR_COLUMNS : 0),
	);
	return (
		<Box
			flexDirection="column"
			width={size.columns}
			height={size.rows}
			overflow="hidden"
		>
			{plan.brand === 'none' ? null : (
				<Box flexDirection="column" flexShrink={0} marginBottom={1}>
					<Brand width={size.columns} hasArt={plan.brand === 'art'} />
				</Box>
			)}
			<VirtualList
				isFocused
				items={apps}
				cursor={cursor}
				height={plan.listHeight}
				hasScrollbar={plan.hasScrollbar}
				emptyText="No apps installed"
				getKey={app => app.id}
				renderItem={(app, {index}) => (
					<MenuRow
						app={app}
						index={index}
						titleWidth={titleWidth}
						width={rowWidth}
						isAvailable={isSupported(app, platform)}
						platform={platform}
						service={serviceFor?.(app.id)}
					/>
				)}
			/>
		</Box>
	);
}
