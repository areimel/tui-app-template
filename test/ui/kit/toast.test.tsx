import test from 'ava';
import {Toast} from '../../../source/ui/kit/index.js';
import {renderThemed} from '../../helpers/render-themed.js';

test('Toast shows a tone glyph before the text', t => {
	const ok = renderThemed(<Toast text="Saved" />);
	t.is(ok.plainFrame(), '✓ Saved');
	ok.rerender(<Toast text="Slow" tone="warn" />);
	t.is(ok.plainFrame(), '! Slow');
	ok.rerender(<Toast text="Failed" tone="err" />);
	t.is(ok.plainFrame(), '✗ Failed');
	ok.unmount();
});

test('Toast stays on one row and truncates long text', t => {
	const r = renderThemed(<Toast text={'x'.repeat(200)} />);
	t.is(r.plainFrame().split('\n').length, 1);
	t.true(r.plainFrame().startsWith('✓ xxx'));
	r.unmount();
});
