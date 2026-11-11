/**
Pure fitting logic for the dashboard: given the terminal size and the measured height of each region, pick the richest arrangement that fits without clipping.

Degradation order (each step only when the previous one still does not fit; at every step Session and Stats side by side is tried before stacked):
1. Heading art becomes a one-line title.
2. The credits block under the cup is hidden.
3. Lower-priority stat lines are dropped, one at a time.
4. Session and Stats stack instead of sitting side by side (tried per stat count, after the beside form).
5. The cup is hidden; steps 1, 3 and 4 are retried without it (credits belong to the cup).
6. Session collapses to one status line; stats lines are dropped, then hidden.
The options slot (editor or overlay) is always kept whole.
*/
import {CREDITS_ROWS} from '../features/cup/credits.js';
import {CUP_LINES, CUP_WIDTH} from '../features/cup/cup-art.js';
import {STEAM_HEIGHT} from '../features/cup/steam.js';
import {
	HEADING_HEIGHT,
	HEADING_WIDTH,
} from '../features/heading/heading-art.js';
import {COMPACT_TITLE_WIDTH} from '../features/heading/title.js';
import type {Layout, LayoutMode} from '../ui/hooks/use-layout.js';

/**
Border (2) plus horizontal padding (2) of the outer frame.
*/
export const FRAME_CHROME_COLUMNS = 4;
/**
Top and bottom edge of the outer frame. The heading's first art row rides in the top edge and the key hints in the bottom edge.
*/
export const FRAME_CHROME_ROWS = 2;
/**
Art rows inside the frame (all but the first, which is in the top edge) plus the 2 blank rows under them.
*/
export const HEADING_ART_ROWS = HEADING_HEIGHT - 1 + 2;
/**
The blank row under the top edge when it carries the compact title.
*/
export const TITLE_ROWS = 1;
export const CUP_ROWS = STEAM_HEIGHT + CUP_LINES.length;
/**
Top border line (which carries the title) plus bottom border line of a `Panel`.
*/
export const PANEL_CHROME_ROWS = 2;
/**
Border (2) plus horizontal padding (2) of a `Panel`.
*/
export const PANEL_CHROME_COLUMNS = 4;
/**
The framed cup: a `Panel` around the steam and cup art.
*/
export const CUP_FRAME_ROWS = CUP_ROWS + PANEL_CHROME_ROWS;
export const CUP_FRAME_COLUMNS = CUP_WIDTH + PANEL_CHROME_COLUMNS;
/**
Narrowest Session panel used when it shares a row with Stats: the widest fixed line (`● Display gnome-session-inhibit`, 31 cells) plus the panel chrome, with one cell to spare.
*/
export const SESSION_MIN_WIDTH = 36;
/**
Panels never grow wider than this; the dashboard is centred in wider terminals.
*/
export const PANEL_MAX_WIDTH = 76;

export type SessionForm = 'panel' | 'line';
export type StatsForm = 'stack' | 'beside' | 'hidden';

export type DashboardPlan = {
	mode: LayoutMode;
	showHeadingArt: boolean;
	showCup: boolean;
	/**
	Credits block pinned to the bottom of the cup frame; only with the cup.
	*/
	showCredits: boolean;
	session: SessionForm;
	stats: StatsForm;
	/**
	How many stat lines to show (after priority trimming).
	*/
	statsLineCount: number;
	/**
	Width of the panel column.
	*/
	panelWidth: number;
	/**
	Width of the Session panel when `stats` is `beside`.
	*/
	sessionWidth: number;
	/**
	Width of the content inside the frame: the cup column plus panels, at least as wide as the art or the compact title.
	*/
	contentWidth: number;
	/**
	Total rows the plan needs inside the frame; at most `layout.rows` unless nothing fits.
	*/
	height: number;
};

export type PlanInput = {
	layout: Layout;
	/**
	Rows below the body inside the frame: warning lines only (the hints are in the bottom edge). In minimal mode, which has no frame: hints plus warning lines.
	*/
	footerRows: number;
	/**
	Height of the Session panel (border included) at a given width.
	*/
	sessionHeight: (width: number) => number;
	stats: {
		count: number;
		/**
		Fewest lines worth showing (the high-priority ones).
		*/
		minCount: number;
		/**
		Natural width of the Stats panel, border included.
		*/
		width: number;
	};
	/**
	Height of whatever fills the options slot (editor or overlay) at a given width.
	*/
	slotHeight: (width: number) => number;
};

type Candidate = {
	isCup: boolean;
	isArt: boolean;
	isCredits: boolean;
	session: SessionForm;
	stats: StatsForm;
	count: number;
};

const FORMS = ['beside', 'stack'] as const;

function* candidates({layout, stats}: PlanInput): Generator<Candidate> {
	for (const isCup of layout.showCup ? [true, false] : [false]) {
		// Tiers at the full stat count, richest first: art, then credits, then neither.
		const tiers = [
			...(layout.showHeadingArt ? [{isArt: true, isCredits: isCup}] : []),
			...(isCup ? [{isArt: false, isCredits: true}] : []),
		];

		for (const {isArt, isCredits} of tiers) {
			for (const form of FORMS) {
				yield {
					isCup,
					isArt,
					isCredits,
					session: 'panel',
					stats: form,
					count: stats.count,
				};
			}
		}

		for (let {count} = stats; count >= stats.minCount; count--) {
			for (const form of FORMS) {
				yield {
					isCup,
					isArt: false,
					isCredits: false,
					session: 'panel',
					stats: form,
					count,
				};
			}
		}
	}

	for (let {count} = stats; count >= stats.minCount; count--) {
		yield {
			isCup: false,
			isArt: false,
			isCredits: false,
			session: 'line',
			stats: 'stack',
			count,
		};
	}

	yield {
		isCup: false,
		isArt: false,
		isCredits: false,
		session: 'line',
		stats: 'hidden',
		count: 0,
	};
}

function measure(
	input: PlanInput,
	candidate: Candidate,
): DashboardPlan | undefined {
	const {layout, stats} = input;
	const mode: LayoutMode =
		candidate.isCup && layout.mode === 'full' ? 'full' : 'stacked';
	const panelWidth = Math.min(
		PANEL_MAX_WIDTH,
		mode === 'full' ? layout.panelWidth : layout.columns,
	);
	const isBeside = candidate.stats === 'beside';
	const sessionWidth = isBeside ? panelWidth - stats.width : panelWidth;
	if (isBeside && sessionWidth < SESSION_MIN_WIDTH) {
		return undefined;
	}

	const statsRows =
		candidate.stats === 'hidden' ? 0 : PANEL_CHROME_ROWS + candidate.count;
	const sessionRows =
		candidate.session === 'panel' ? input.sessionHeight(sessionWidth) : 1;
	const upper = isBeside
		? Math.max(sessionRows, statsRows)
		: sessionRows + statsRows;
	const panels = upper + input.slotHeight(panelWidth);
	const cupRows = candidate.isCup
		? CUP_FRAME_ROWS + (candidate.isCredits ? CREDITS_ROWS : 0)
		: 0;
	const body = mode === 'full' ? Math.max(cupRows, panels) : cupRows + panels;
	const heading = candidate.isArt ? HEADING_ART_ROWS : TITLE_ROWS;
	const bodyWidth =
		mode === 'full' ? layout.cupColumnWidth + panelWidth : panelWidth;
	return {
		mode,
		showHeadingArt: candidate.isArt,
		showCup: candidate.isCup,
		showCredits: candidate.isCup && candidate.isCredits,
		session: candidate.session,
		stats: candidate.stats,
		statsLineCount: candidate.count,
		panelWidth,
		sessionWidth,
		contentWidth: Math.max(
			bodyWidth,
			candidate.isArt ? HEADING_WIDTH : COMPACT_TITLE_WIDTH,
		),
		height: heading + body + input.footerRows,
	};
}

/**
The first arrangement, in degradation order, that fits `layout.rows`; the last resort when none does.
*/
export function planDashboard(input: PlanInput): DashboardPlan {
	const {layout} = input;
	if (layout.mode === 'minimal') {
		return {
			mode: 'minimal',
			showHeadingArt: false,
			showCup: false,
			showCredits: false,
			session: 'line',
			stats: 'hidden',
			statsLineCount: 0,
			panelWidth: layout.columns,
			sessionWidth: layout.columns,
			contentWidth: layout.columns,
			height: 1 + input.footerRows,
		};
	}

	let last: DashboardPlan | undefined;
	for (const candidate of candidates(input)) {
		const plan = measure(input, candidate);
		if (plan === undefined) {
			continue;
		}

		if (plan.height <= layout.rows) {
			return plan;
		}

		last = plan;
	}

	// The final candidate (status line + options) always measures.
	return last!;
}
