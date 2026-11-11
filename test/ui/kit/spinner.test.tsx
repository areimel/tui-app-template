import test from 'ava';
import {Spinner} from '../../../source/ui/kit/index.js';
import {spinnerGlyph} from '../../../source/ui/kit/Spinner.js';
import {renderThemed} from '../../helpers/render-themed.js';

test('spinnerGlyph cycles through the braille frames and wraps', t => {
	t.is(spinnerGlyph(0), '⠋');
	t.is(spinnerGlyph(1), '⠙');
	t.is(spinnerGlyph(10), '⠋');
	t.is(spinnerGlyph(-1), '⠏');
});

test('Spinner draws the glyph for the given frame, with an optional label', t => {
	const r = renderThemed(<Spinner frame={3} />);
	t.is(r.plainFrame(), '⠸');
	r.rerender(<Spinner frame={4} label="Working" />);
	t.is(r.plainFrame(), '⠼ Working');
	r.unmount();
});

test('Spinner without frame animates from frame 0', t => {
	const r = renderThemed(<Spinner label="Starting" />);
	t.is(r.plainFrame(), '⠋ Starting');
	r.unmount();
});
