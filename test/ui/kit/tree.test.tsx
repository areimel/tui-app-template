import test from 'ava';
import {Tree} from '../../../source/ui/kit/Tree.js';
import {jsonToTree} from '../../../source/ui/kit/tree-model.js';
import {renderThemed} from '../../helpers/render-themed.js';

const nodes = jsonToTree({
	user: {name: 'ann', tags: ['a', 'b'], none: null},
	empty: {},
	list: [],
});

test('Tree shows collapsed parents with glyph and size', t => {
	const r = renderThemed(
		<Tree nodes={nodes} expanded={new Set()} cursorId="$.user" height={5} />,
	);
	const frame = r.plainFrame();
	t.regex(frame, /▸ user \{3\}/v);
	t.regex(frame, /empty \{0\}/v);
	t.false(frame.includes('name'));
	t.false(frame.includes('❯'));
	r.unmount();
});

test('Tree indents expanded children and marks the cursor', t => {
	const r = renderThemed(
		<Tree
			isFocused
			nodes={nodes}
			expanded={new Set(['$.user', '$.user.tags'])}
			cursorId="$.user.none"
			height={8}
		/>,
	);
	const lines = r.plainFrame().split('\n');
	t.regex(lines[0] ?? '', /^ {2}▾ user \{3\}/v);
	t.regex(lines[1] ?? '', /^ {6}name "ann"/v);
	t.regex(lines[2] ?? '', /^ {4}▾ tags \[2\]/v);
	t.regex(lines[3] ?? '', /^ {8}\[0\] "a"/v);
	t.regex(lines.find(l => l.includes('none')) ?? '', /^❯ {5}none null/v);
	r.unmount();
});

test('Tree windows rows around the cursor', t => {
	const big = jsonToTree(Array.from({length: 50}, (_, i) => i));
	const r = renderThemed(
		<Tree
			isFocused
			nodes={big}
			expanded={new Set()}
			cursorId="$[40]"
			height={3}
		/>,
	);
	const lines = r.plainFrame().split('\n');
	t.is(lines.length, 3);
	t.regex(lines.join('\n'), /❯ {3}\[40\] 40/v);
	t.false(r.plainFrame().includes('[0]'));
	r.unmount();
});

test('Tree truncates long details to the width', t => {
	const long = jsonToTree({s: 'x'.repeat(300)});
	const r = renderThemed(
		<Tree nodes={long} expanded={new Set()} cursorId={undefined} height={2} />,
	);
	const first = r.plainFrame().split('\n', 1)[0] ?? '';
	t.regex(first, /^ +s "x+…$/v);
	t.true(first.length <= 100);
	r.unmount();
});
