/**
The menu badge: the real state of the session, as a glyph plus a word (never colour alone). It reads
the service the menu provides, `off` until the app has been opened once.
*/
import {useOptionalAppService} from '../../shell/context.js';
import type {TokenName} from '../../theme/tokens.js';
import {T} from '../../ui/kit/index.js';
import {useSession} from './hooks/use-session.js';
import type {KeepAwakeService} from './service.js';
import type {SessionState} from './session/types.js';

type BadgeLook = {
	readonly glyph: string;
	readonly text: string;
	readonly tone: TokenName;
};

const OFF: BadgeLook = {glyph: '○', text: 'off', tone: 'muted'};

/**
What the badge says for a session state. `awake` only when every requested lock is held; a held
system lock without the display lock is `system only`.
*/
export function badgeFor(state: SessionState | undefined): BadgeLook {
	switch (state?.phase) {
		case undefined: {
			return OFF;
		}

		case 'awake': {
			return {glyph: '●', text: 'awake', tone: 'ok'};
		}

		case 'degraded': {
			return {glyph: '◐', text: 'system only', tone: 'warn'};
		}

		case 'starting': {
			return {glyph: '◌', text: 'starting', tone: 'warn'};
		}

		case 'paused': {
			return {glyph: '○', text: 'paused', tone: 'muted'};
		}

		case 'stopped': {
			return {glyph: '○', text: 'stopped', tone: 'muted'};
		}

		case 'unsupported': {
			return {glyph: '!', text: 'unsupported', tone: 'err'};
		}
	}
}

function Live({service}: {readonly service: KeepAwakeService}) {
	const look = badgeFor(useSession(service));
	return (
		<T tone={look.tone}>
			{look.glyph} {look.text}
		</T>
	);
}

export function MenuBadge() {
	const service = useOptionalAppService<KeepAwakeService>();
	if (service === undefined) {
		return (
			<T tone={OFF.tone}>
				{OFF.glyph} {OFF.text}
			</T>
		);
	}

	return <Live service={service} />;
}
