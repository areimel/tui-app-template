import test from 'ava';
import {StatusBar} from '../../../source/ui/kit/index.js';
import {renderThemed} from '../../helpers/render-themed.js';

test('StatusBar puts left at the start and right at the end of width', t => {
	const r = renderThemed(<StatusBar left="left" right="right" width={20} />);
	const line = r.plainFrame();
	t.is(line, 'left' + ' '.repeat(11) + 'right');
	t.is([...line].length, 20);
	r.unmount();
});

test('StatusBar stays one row when the left part is too long', t => {
	const r = renderThemed(
		<StatusBar
			left="a long left part that does not fit"
			right="END"
			width={24}
		/>,
	);
	const rows = r.plainFrame().split('\n');
	t.is(rows.length, 1);
	t.true(rows[0]?.endsWith('END') ?? false);
	t.is([...(rows[0] ?? '')].length, 24);
	r.unmount();
});

test('StatusBar with no left or right renders without error', t => {
	const r = renderThemed(<StatusBar right="only" width={10} />);
	t.is(r.plainFrame(), '      only');
	r.rerender(<StatusBar width={10} />);
	t.is(r.plainFrame().trim(), '');
	r.unmount();
});
