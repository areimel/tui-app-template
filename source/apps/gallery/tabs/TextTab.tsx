/**
Text and status: themed text tones, Badge, StatRow, Toast, StatusBar, KeyHints.
*/
import {Box} from 'ink';
import {TOKEN_NAMES} from '../../../theme/tokens.js';
import {
	Badge,
	KeyHints,
	StatRow,
	StatusBar,
	T,
	Toast,
} from '../../../ui/kit/index.js';
import {Sample, Wrap} from '../Sample.js';
import {BADGES, HINTS, STATS} from '../samples.js';
import type {TabProps} from './types.js';

export function TextTab({width}: TabProps) {
	return (
		<>
			<Sample name="T" note="themed text: one tone per colour token">
				<Wrap>
					{TOKEN_NAMES.filter(name => name !== 'bg').map(name => (
						<T key={name} tone={name}>
							{name}
						</T>
					))}
				</Wrap>
				<Wrap>
					<T bold>bold</T>
					<T dim>dim</T>
					<T italic>italic</T>
					<T underline>underline</T>
					<T inverse>inverse</T>
				</Wrap>
			</Sample>
			<Sample name="Badge" note="status pill: glyph differs per state">
				<Wrap>
					{BADGES.map(badge => (
						<Badge key={badge.state} {...badge} />
					))}
				</Wrap>
			</Sample>
			<Sample name="StatRow" note="muted label, then its value">
				<Box flexDirection="column">
					{STATS.map(([label, value]) => (
						<StatRow key={label} label={label} value={value} labelWidth={8} />
					))}
				</Box>
			</Sample>
			<Sample name="Toast" note="short message with a tone glyph">
				<Box flexDirection="column" width={width}>
					<Toast text="Saved" tone="ok" />
					<Toast text="Disk is nearly full" tone="warn" />
					<Toast text="Connection lost" tone="err" />
				</Box>
			</Sample>
			<Sample name="StatusBar" note="left clips, right keeps its size">
				<StatusBar
					width={width}
					left="A left part that is long enough to be clipped when narrow"
					right="right"
				/>
			</Sample>
			<Sample name="KeyHints" note="key and label pairs on one line">
				<KeyHints hints={HINTS} maxWidth={width} />
			</Sample>
		</>
	);
}
