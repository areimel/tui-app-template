import type {ReactNode} from 'react';
import {Box} from 'ink';
import {
	CompactTitle,
	HeadingArtBody,
	HeadingCrown,
} from '../features/heading/Heading.js';
import {HEADING_WIDTH} from '../features/heading/heading-art.js';
import {COMPACT_TITLE_WIDTH} from '../features/heading/title.js';
import type {Layout} from '../ui/hooks/use-layout.js';
import {bodyOffsetUnderTop, Frame} from '../ui/kit/index.js';
import type {DashboardPlan} from './dashboard-plan.js';
import {frameHeight, frameWidth} from './frame-plan.js';

export type DashboardLayoutProps = {
	readonly layout: Layout;
	/**
	What fits, from `planDashboard`.
	*/
	readonly plan: DashboardPlan;
	readonly cup: ReactNode;
	/**
	The Session panel.
	*/
	readonly session: ReactNode;
	/**
	The one-row session summary used when the panel does not fit.
	*/
	readonly statusLine: ReactNode;
	readonly stats: ReactNode;
	/**
	The options editor panel.
	*/
	readonly options: ReactNode;
	/**
	Theme picker or help; takes the options slot while open.
	*/
	readonly overlay?: ReactNode;
	/**
	Key hints: the frame's bottom edge (their own row in minimal mode).
	*/
	readonly hints: ReactNode;
	/**
	Warning lines, on the last rows inside the frame (above the hints in minimal mode).
	*/
	readonly warnings: ReactNode;
	/**
	Theme background painted over the whole screen.
	*/
	readonly backgroundColor?: string;
};

function Panels({
	plan,
	session,
	statusLine,
	stats,
	slot,
}: Pick<DashboardLayoutProps, 'plan' | 'session' | 'statusLine' | 'stats'> & {
	readonly slot: ReactNode;
}) {
	const sessionNode = plan.session === 'panel' ? session : statusLine;
	return (
		<Box flexDirection="column" width={plan.panelWidth} flexShrink={0}>
			{plan.stats === 'beside' ? (
				<Box>
					<Box flexDirection="column" width={plan.sessionWidth}>
						{sessionNode}
					</Box>
					<Box flexDirection="column" flexGrow={1}>
						{stats}
					</Box>
				</Box>
			) : (
				<>
					{sessionNode}
					{plan.stats === 'stack' ? stats : null}
				</>
			)}
			{slot}
		</Box>
	);
}

/**
Arranges the regions; decides nothing itself. Everything but `minimal` sits in the heavy outer frame, centred and hugging the content (width and height): the first art row (or the compact title) in its top edge, the rest of the art then 2 blank rows (1 with the title) inside, the key hints in its bottom edge and warnings on its last rows. `full`: the framed cup column left of the panel column (Session and Stats side by side or stacked, then the options slot); both columns stretch to end on the same row. `stacked`: one column, cup (if shown) above the panels. `minimal`: status line (or the open overlay), warnings and hints, unframed. The root is exactly the terminal size so the alternate screen never scrolls.
*/
export function DashboardLayout({
	layout,
	plan,
	cup,
	session,
	statusLine,
	stats,
	options,
	overlay,
	hints,
	warnings,
	backgroundColor,
}: DashboardLayoutProps) {
	const slot = overlay ?? options;
	const panels = (
		<Panels
			plan={plan}
			session={session}
			statusLine={statusLine}
			stats={stats}
			slot={slot}
		/>
	);
	let body: ReactNode;
	if (plan.mode === 'full') {
		body = (
			<Box>
				<Box
					flexDirection="column"
					flexShrink={0}
					width={layout.cupColumnWidth}
					paddingRight={1}
				>
					{cup}
				</Box>
				{panels}
			</Box>
		);
	} else {
		body = (
			<Box flexDirection="column">
				{plan.showCup ? (
					<Box flexShrink={0} flexDirection="column" alignItems="center">
						{cup}
					</Box>
				) : null}
				{panels}
			</Box>
		);
	}

	const root = {
		flexDirection: 'column',
		alignItems: 'center',
		width: layout.outerColumns,
		height: layout.outerRows,
		overflow: 'hidden',
		...(backgroundColor !== undefined && {backgroundColor}),
	} as const;
	if (plan.mode === 'minimal') {
		return (
			<Box {...root}>
				<Box flexGrow={1} flexShrink={1} overflow="hidden">
					<Box width={layout.columns}>{overlay ?? statusLine}</Box>
				</Box>
				<Box flexDirection="column" flexShrink={0}>
					{warnings}
					{hints}
				</Box>
			</Box>
		);
	}

	const width = frameWidth(plan, layout);
	const topWidth = plan.showHeadingArt ? HEADING_WIDTH : COMPACT_TITLE_WIDTH;
	return (
		<Box {...root} justifyContent="center">
			<Frame
				width={width}
				height={frameHeight(plan, layout)}
				top={plan.showHeadingArt ? <HeadingCrown /> : <CompactTitle />}
				topWidth={topWidth}
				bottom={hints}
			>
				<Box
					flexDirection="column"
					flexGrow={1}
					flexShrink={1}
					overflow="hidden"
				>
					{plan.showHeadingArt ? (
						<HeadingArtBody
							marginLeft={bodyOffsetUnderTop(width, HEADING_WIDTH)}
						/>
					) : null}
					<Box height={plan.showHeadingArt ? 2 : 1} flexShrink={0} />
					{body}
				</Box>
				{warnings}
			</Frame>
		</Box>
	);
}
