import test from 'ava';
import keepAwake from '../../../source/apps/keep-awake/index.js';

test('keep-awake is the bare, service-backed, Linux and macOS app', t => {
	t.is(keepAwake.id, 'keep-awake');
	t.is(keepAwake.title, 'Keep Awake');
	t.is(keepAwake.chrome, 'bare');
	t.deepEqual(keepAwake.platforms, ['linux', 'darwin']);
	t.is(typeof keepAwake.createService, 'function');
	t.truthy(keepAwake.menuBadge);
	t.truthy(keepAwake.cli?.runPlain);
});
