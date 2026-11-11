import test from 'ava';
import {
	CompactTitle,
	HeadingArtBody,
	HeadingCrown,
} from '../../../source/features/heading/Heading.js';
import {HEADING_LINES} from '../../../source/features/heading/heading-art.js';
import {
	COMPACT_TAGLINE,
	COMPACT_TITLE_WIDTH,
} from '../../../source/features/heading/title.js';
import {renderThemed} from '../../helpers/render-themed.js';

test('the crown is art row 0', t => {
	const r = renderThemed(<HeadingCrown />);
	const lines = r.plainFrame().split('\n');
	t.is(lines.length, 1);
	t.is(lines[0]!.trimEnd(), HEADING_LINES[0]!.trimEnd());
	r.unmount();
});

test('the art body is the other five rows, shifted by marginLeft', t => {
	const r = renderThemed(<HeadingArtBody marginLeft={3} />);
	const lines = r.plainFrame().split('\n');
	t.is(lines.length, HEADING_LINES.length - 1);
	for (const [index, line] of lines.entries()) {
		t.is(line.trimEnd(), `   ${HEADING_LINES[index + 1]!.trimEnd()}`);
	}

	r.unmount();
});

test('compact title is one line with a tagline', t => {
	const r = renderThemed(<CompactTitle />);
	const frame = r.plainFrame();
	t.is(frame.split('\n').length, 1);
	t.is(frame.trimEnd(), `COFFEE${COMPACT_TAGLINE}`);
	t.is(frame.trimEnd().length, COMPACT_TITLE_WIDTH);
	r.unmount();
});
