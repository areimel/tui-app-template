import test from 'ava';
import {Credits} from '../../../source/features/cup/Credits.js';
import {CREDITS_ROWS} from '../../../source/features/cup/credits.js';
import {renderThemed} from '../../helpers/render-themed.js';

const plain = (node: Parameters<typeof renderThemed>[0]) => {
	const r = renderThemed(node);
	const text = r.plainFrame();
	r.unmount();
	return text;
};

test('draws a divider of the given width, then name and github', t => {
	const lines = plain(<Credits width={20} />).split('\n');
	t.is(lines[0], '─'.repeat(20));
	t.is(lines[1], 'Alec Reimel');
	t.is(lines[2], 'github.com/areimel');
});

test('height equals CREDITS_ROWS for the default credits', t => {
	t.is(plain(<Credits width={30} />).split('\n').length, CREDITS_ROWS);
});

test('empty fields are omitted from the rendered rows', t => {
	const text = plain(
		<Credits
			width={20}
			credits={{name: 'Pat', github: '', portfolio: 'pat.dev'}}
		/>,
	);
	t.is(text.split('\n').length, 3);
	t.true(text.includes('pat.dev'));
});

test('a long line is truncated to the width', t => {
	const text = plain(
		<Credits
			width={12}
			credits={{
				name: 'Pat',
				github: 'github.com/a-very-long-handle',
				portfolio: '',
			}}
		/>,
	);
	const row = text.split('\n', 3)[2] ?? '';
	t.true(row.length <= 12);
	t.true(row.startsWith('github.com'));
	t.false(row.includes('handle'));
});
