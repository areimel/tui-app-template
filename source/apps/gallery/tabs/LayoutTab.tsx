/**
Layout: Panel, Frame, ScrollView, Scrollbar, BorderRule and the theme token swatches. Inside, up/down scroll
the ScrollView sample.
*/
import {Box} from 'ink';
import {TOKEN_NAMES} from '../../../theme/tokens.js';
import {useScroll} from '../../../ui/hooks/index.js';
import {
	BorderRule,
	Frame,
	Panel,
	ScrollView,
	Scrollbar,
	T,
} from '../../../ui/kit/index.js';
import {Sample, Wrap} from '../Sample.js';
import {SCROLL_LINES} from '../samples.js';
import type {TabProps} from './types.js';

const SCROLL_HEIGHT = 4;
const SWATCH_WIDTH = 14;
const MAX_BOX = 36;

export function LayoutTab({width, isInside}: TabProps) {
	const scroll = useScroll({
		contentRows: SCROLL_LINES.length,
		viewportRows: SCROLL_HEIGHT,
		isActive: isInside,
	});
	const box = Math.min(width, MAX_BOX);
	return (
		<>
			<Sample name="Panel" note="titled box; focused gets the accent border">
				<Panel isFocused title="Focused" width={box}>
					<T>Marker, bold title, accent border.</T>
				</Panel>
				<Panel title="Unfocused" width={box}>
					<T>Border tone, plain title.</T>
				</Panel>
			</Sample>
			<Sample
				name="Frame"
				note="heavy outer frame; title and hints in the edges"
			>
				<Frame
					width={box}
					height={3}
					top={<T bold>Title</T>}
					topWidth={5}
					bottom={<T tone="muted">hints</T>}
				>
					<T>Content</T>
				</Frame>
			</Sample>
			<Sample
				name="ScrollView"
				note="viewport over taller content (up/down inside)"
			>
				<ScrollView
					hasScrollbar
					height={SCROLL_HEIGHT}
					offset={scroll.offset}
					contentRows={SCROLL_LINES.length}
					width={box}
				>
					{SCROLL_LINES.map(line => (
						<T key={line} wrap="truncate-end">
							{line}
						</T>
					))}
				</ScrollView>
			</Sample>
			<Sample name="Scrollbar" note="the track and thumb on its own">
				<Box height={3}>
					<Scrollbar total={12} height={3} offset={4} />
					<T tone="muted"> thumb at row 4 of 12</T>
				</Box>
			</Sample>
			<Sample name="BorderRule" note="light and heavy rules in a border tone">
				<Box width={box}>
					<T>a </T>
					<BorderRule glyph="─" tone="border" />
					<T> b</T>
				</Box>
				<Box width={box}>
					<BorderRule glyph="━" tone="accent" />
				</Box>
			</Sample>
			<Sample name="Theme tokens" note="each colour token, by name">
				<Wrap>
					{TOKEN_NAMES.map(name => (
						<Box key={name} width={SWATCH_WIDTH}>
							<T tone={name}>██ </T>
							<T>{name}</T>
						</Box>
					))}
				</Wrap>
			</Sample>
		</>
	);
}
