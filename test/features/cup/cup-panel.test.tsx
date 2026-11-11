import test from 'ava';
import {CupPanel} from '../../../source/features/cup/CupPanel.js';
import {CREDITS_ROWS} from '../../../source/features/cup/credits.js';
import {CUP_FRAME_ROWS} from '../../../source/layouts/dashboard-plan.js';
import {renderThemed} from '../../helpers/render-themed.js';

const plain = (node: Parameters<typeof renderThemed>[0]) => {
	const r = renderThemed(node);
	const text = r.plainFrame();
	r.unmount();
	return text;
};

test('title is brewing when hot, paused when cold', t => {
	t.true(
		plain(<CupPanel isHot showCredits isAnimated={false} />).includes(
			'╭─ brewing ',
		),
	);
	t.true(
		plain(<CupPanel showCredits isAnimated={false} isHot={false} />).includes(
			'╭─ paused ',
		),
	);
});

test('credits are shown or hidden', t => {
	const shown = plain(<CupPanel isHot showCredits isAnimated={false} />);
	t.true(shown.includes('Alec Reimel'));
	t.true(shown.includes('github.com/areimel'));
	const hidden = plain(
		<CupPanel isHot isAnimated={false} showCredits={false} />,
	);
	t.false(hidden.includes('Alec Reimel'));
});

test('unstretched height is the cup frame plus the credits', t => {
	t.is(
		plain(<CupPanel isHot showCredits isAnimated={false} />).split('\n').length,
		CUP_FRAME_ROWS + CREDITS_ROWS,
	);
	t.is(
		plain(<CupPanel isHot isAnimated={false} showCredits={false} />).split('\n')
			.length,
		CUP_FRAME_ROWS,
	);
});
