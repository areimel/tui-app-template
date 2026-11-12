import test from 'ava';
import {Sparkline} from '../../../source/ui/kit/index.js';
import {sparklineGlyphs} from '../../../source/ui/kit/Sparkline.js';
import {renderThemed} from '../../helpers/render-themed.js';

test('sparklineGlyphs scales to the largest value by default', t => {
	t.is(sparklineGlyphs([0, 1, 2, 3, 4, 5, 6, 7], 8), '▁▂▃▄▅▆▇█');
	t.is(sparklineGlyphs([5, 10], 2), '▅█');
});

test('sparklineGlyphs scales to an explicit max and clamps above it', t => {
	t.is(sparklineGlyphs([50, 100, 150], 3, 100), '▅██');
	t.is(sparklineGlyphs([-5], 1, 100), '▁');
});

test('sparklineGlyphs keeps the latest values when there are more than width', t => {
	t.is(sparklineGlyphs([1, 1, 1, 8, 8], 2), '██');
	t.is(sparklineGlyphs([8, 1, 1, 1, 8], 3, 8), '▂▂█');
});

test('sparklineGlyphs right-aligns with padding when there are fewer values', t => {
	t.is(sparklineGlyphs([8, 8], 4), '  ██');
});

test('sparklineGlyphs handles empty data, zero width and all zeros', t => {
	t.is(sparklineGlyphs([], 4), ' '.repeat(4));
	t.is(sparklineGlyphs([1, 2], 0), '');
	t.is(sparklineGlyphs([0, 0, 0], 3), '▁▁▁');
	t.is(sparklineGlyphs([NaN, 4], 2), '▁█');
});

test('Sparkline renders the glyph string in its width', t => {
	const r = renderThemed(<Sparkline values={[1, 2, 3, 4]} width={6} />);
	t.is(r.plainFrame(), '  ▃▅▆█');
	r.rerender(<Sparkline values={[]} width={3} />);
	t.is(r.plainFrame().trim(), '');
	r.unmount();
});
