import test from 'ava';
import {Gauge} from '../../../source/ui/kit/index.js';
import {gaugeTone} from '../../../source/ui/kit/Gauge.js';
import {renderThemed} from '../../helpers/render-themed.js';

test('gaugeTone moves ok, warn, err at 75% and 90%', t => {
	t.is(gaugeTone(0.74), 'ok');
	t.is(gaugeTone(0.75), 'warn');
	t.is(gaugeTone(0.9), 'err');
	t.is(gaugeTone(1), 'err');
	t.is(gaugeTone(-1), 'ok');
	t.is(gaugeTone(2), 'err');
	t.is(gaugeTone(NaN), 'ok');
});

test('Gauge shows label, bar, percentage and detail on one row of the given width', t => {
	const r = renderThemed(
		<Gauge label="CPU" value={0.42} width={40} detail="2.1 GHz" />,
	);
	const line = r.plainFrame();
	t.is([...line].length, 40);
	t.regex(line, /^CPU █/v);
	t.regex(line, /█/v);
	t.regex(line, /░/v);
	t.regex(line, / 42%/v);
	t.regex(line, /2\.1 GHz$/v);
	r.unmount();
});

test('Gauge clamps the value and always shows the percentage', t => {
	const high = renderThemed(<Gauge label="RAM" value={3} width={30} />);
	t.regex(high.plainFrame(), /100%$/v);
	t.notRegex(high.plainFrame(), /░/v);
	high.unmount();

	const low = renderThemed(<Gauge label="RAM" value={-0.5} width={30} />);
	t.regex(low.plainFrame(), / 0%$/v);
	t.notRegex(low.plainFrame(), /█/v);
	low.unmount();
});

test('Gauge pads or truncates the label to labelWidth so rows line up', t => {
	const r = renderThemed(
		<Gauge label="Load" value={0.5} width={30} labelWidth={8} />,
	);
	t.regex(r.plainFrame(), /^Load {5}/v);
	r.rerender(
		<Gauge label="Very long label" value={0.5} width={30} labelWidth={4} />,
	);
	t.regex(r.plainFrame(), /^Very /v);
	r.unmount();
});

test('Gauge keeps the row width when the detail is too long', t => {
	const r = renderThemed(
		<Gauge
			label="Disk"
			value={0.1}
			width={30}
			detail="a very long detail that cannot fit"
		/>,
	);
	const line = r.plainFrame();
	t.is([...line].length, 30);
	t.regex(line, / 10%/v);
	r.unmount();
});

test('Gauge with a narrow width drops the detail and stays in width', t => {
	const r = renderThemed(
		<Gauge label="X" value={0.5} width={12} detail="detail" />,
	);
	t.is([...r.plainFrame()].length, 12);
	t.regex(r.plainFrame(), / 50%/v);
	r.unmount();
});
