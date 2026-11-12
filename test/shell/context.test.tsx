import test from 'ava';
import {Text} from 'ink';
import {
	useAppService,
	useOptionalAppService,
	useRouter,
	useServices,
} from '../../source/shell/context.js';
import {renderThemed} from '../helpers/render-themed.js';

function Catch({read}: {readonly read: () => unknown}) {
	let message = 'no error';
	try {
		read();
	} catch (error) {
		message = error instanceof Error ? error.message : String(error);
	}

	return <Text>{message}</Text>;
}

test('shell hooks throw a clear error outside ShellProviders', t => {
	for (const [name, hook] of [
		['useRouter', useRouter],
		['useServices', useServices],
	] as const) {
		const view = renderThemed(<Catch read={hook} />);
		t.regex(
			view.plainFrame(),
			new RegExp(String.raw`${name}\(\) must be used inside`, 'v'),
		);
		view.unmount();
	}
});

test('useAppService throws without a service; the optional form does not', t => {
	const strict = renderThemed(<Catch read={useAppService} />);
	t.regex(strict.plainFrame(), /found no service/v);
	strict.unmount();
	const optional = renderThemed(<Catch read={useOptionalAppService} />);
	t.regex(optional.plainFrame(), /no error/v);
	optional.unmount();
});
