import test from 'ava';
import {Box, Text} from 'ink';
import {HEADING_LINES} from '../../source/features/heading/heading-art.js';
import {frameHeight} from '../../source/layouts/frame-plan.js';
import {splitFrame} from '../helpers/frame-lines.js';
import {DashboardLayout} from '../../source/layouts/DashboardLayout.js';
import {
	FRAME_CHROME_ROWS,
	planDashboard,
	type DashboardPlan,
} from '../../source/layouts/dashboard-plan.js';
import {Panel} from '../../source/ui/kit/index.js';
import {computeLayout} from '../../source/ui/hooks/use-layout.js';
import {renderSized} from '../helpers/render-sized.js';

function Block({label, rows}: {readonly label: string; readonly rows: number}) {
	return (
		<Box flexDirection="column">
			{Array.from({length: rows}, (_, index) => (
				<Text key={index}>{`${label}${index}`}</Text>
			))}
		</Box>
	);
}

function draw(
	columns: number,
	rows: number,
	patch: Partial<DashboardPlan> = {},
) {
	const layout = computeLayout(columns, rows);
	const plan = {
		...planDashboard({
			layout,
			footerRows: 0,
			sessionHeight: () => 3,
			stats: {count: 2, minCount: 1, width: 20},
			slotHeight: () => 2,
		}),
		...patch,
	};
	const result = renderSized(
		<DashboardLayout
			layout={layout}
			plan={plan}
			cup={
				<Panel title="cup" width={20} flexGrow={1}>
					<Block label="cup" rows={3} />
				</Panel>
			}
			session={
				<Panel title="ses" {...(patch.stats === 'beside' ? {flexGrow: 1} : {})}>
					<Block label="ses" rows={3} />
				</Panel>
			}
			statusLine={<Text>status-line</Text>}
			stats={
				<Panel title="sta" {...(patch.stats === 'beside' ? {flexGrow: 1} : {})}>
					<Block label="sta" rows={2} />
				</Panel>
			}
			options={
				<Panel title="opt" flexGrow={1}>
					<Block label="opt" rows={2} />
				</Panel>
			}
			hints={<Text>hints</Text>}
			warnings={null}
		/>,
		columns,
		rows,
	);
	const lines = result.plainFrame().split('\n');
	result.unmount();
	return {lines, plan, layout};
}

const rowOf = (lines: string[], text: string) =>
	lines.findIndex(line => line.includes(text));

test('full: cup column left of the stacked panels', t => {
	const {lines, plan} = draw(120, 40, {stats: 'stack'});
	t.is(plan.mode, 'full');
	const cup = lines[rowOf(lines, 'cup0')]!;
	t.true(cup.indexOf('cup0') < cup.indexOf('ses0'));
	t.true(rowOf(lines, 'ses0') < rowOf(lines, 'sta0'));
	t.true(rowOf(lines, 'sta1') < rowOf(lines, 'opt0'));
	const {frame} = splitFrame(lines);
	t.true(frame[0]!.trimStart().startsWith('┏'));
	t.true(frame[0]!.includes(HEADING_LINES[0]!));
});

test('full: cup frame and the last panel end on the same row', t => {
	const {lines} = draw(120, 40, {stats: 'stack'});
	const bottoms = lines
		.map((line, index) => (line.includes('╰') ? index : -1))
		.filter(index => index >= 0);
	const cupBottom = lines.findIndex(line => /╰─+╯\s+╰─+╯/v.test(line));
	t.is(cupBottom, bottoms.at(-1) ?? -1);
	t.true(cupBottom > rowOf(lines, 'opt1'));
});

test('stacked: one column, cup above the panels', t => {
	const {lines, plan} = draw(70, 40, {stats: 'stack'});
	t.is(plan.mode, 'stacked');
	t.true(rowOf(lines, 'cup2') < rowOf(lines, 'ses0'));
	t.true(rowOf(lines, 'ses2') < rowOf(lines, 'sta0'));
});

test('beside: session and stats share rows', t => {
	const {lines} = draw(80, 40, {
		stats: 'beside',
		sessionWidth: 50,
		panelWidth: 76,
		showCup: false,
		mode: 'stacked',
	});
	t.is(rowOf(lines, 'ses0'), rowOf(lines, 'sta0'));
	t.true(lines.some(line => /╰─+╯╰─+╯/v.test(line)));
	t.is(lines.filter(line => line.includes('╭─ ')).length, 2);
});

test('minimal: status line and hints only', t => {
	const {lines, plan} = draw(38, 10);
	t.is(plan.mode, 'minimal');
	t.is(rowOf(lines, 'status-line'), 0);
	t.false(lines.some(line => line.includes('┏')));
	t.is(rowOf(lines, 'opt0'), -1);
});

test('minimal: hints on the last row, no frame', t => {
	const {lines} = draw(38, 10);
	t.is(lines.length, 10);
	t.true(lines.at(-1)!.includes('hints'));
});

test('framed: exact screen height, frame hugs its height and is centred vertically', t => {
	for (const [columns, rows] of [
		[120, 40],
		[80, 24],
		[45, 14],
	] as const) {
		const {lines, plan, layout} = draw(columns, rows);
		t.is(lines.length, rows);
		const {above, frame, below} = splitFrame(lines);
		t.is(frame.length, frameHeight(plan, layout));
		t.true(Math.abs(above - below) <= 1, `${columns}x${rows}`);
		t.regex(frame.at(-1)!, /^\s*┗━ hints ━*┛$/v);
		t.true(lines.every(line => line.length <= columns));
		t.is(below === 0, plan.height + FRAME_CHROME_ROWS >= rows);
	}
});

test('framed: art rows hang under the crown, side borders line up', t => {
	const {frame} = splitFrame(draw(120, 40).lines);
	const crown = frame[0]!.indexOf(HEADING_LINES[0]!);
	t.is(frame[1]!.indexOf(HEADING_LINES[1]!), crown);
	const left = frame[0]!.indexOf('┏');
	const right = frame[0]!.indexOf('┓');
	for (const line of frame.slice(1, -1)) {
		t.is(line.indexOf('┃'), left);
		t.is(line.lastIndexOf('┃'), right);
	}
});

test('framed: the compact title rides in the top edge, one blank row under it', t => {
	const {lines, plan} = draw(80, 24);
	const {frame} = splitFrame(lines);
	t.false(plan.showHeadingArt);
	t.regex(frame[0]!, /^\s*┏━+ COFFEE keeps your machine awake ━+┓$/v);
	t.is(frame[1]!.replaceAll(/[\s┃]/gv, ''), '');
	t.true(frame[2]!.includes('╭'));
});
