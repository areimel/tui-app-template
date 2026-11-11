/**
In-app settings (theme, animation, session options) and their persistence through the config tracker and debounced saver.
*/
import {useState} from 'react';
import type {ConfigPatch, ConfigTracker} from './config/merge.js';
import {toConfigSession, type ConfigSession} from './config/schema.js';
import type {DebouncedSaver} from './config/store.js';
import type {SessionOptions} from './core/session/types.js';
import {nextThemeName} from './theme/resolve.js';
import type {ThemeName} from './theme/tokens.js';

export type SettingsSaver = Pick<DebouncedSaver, 'schedule' | 'flush'>;

/**
The saved-config patch for a live options change: only the keys in `patch`, so untouched flag overrides stay session-only. The PID is never saved.
*/
export function toConfigPatch(
	patch: Partial<SessionOptions>,
	current: SessionOptions,
): Partial<ConfigSession> | undefined {
	const session = toConfigSession({...current, ...patch});
	const changed: Partial<ConfigSession> = {
		...(patch.end !== undefined && {end: session.end}),
		...(patch.display !== undefined && {display: session.display}),
		...(patch.acOnly !== undefined && {acOnly: session.acOnly}),
		...('minBattery' in patch && {minBattery: session.minBattery}),
	};
	return Object.keys(changed).length === 0 ? undefined : changed;
}

export type Settings = {
	/**
	The committed theme.
	*/
	theme: ThemeName;
	/**
	What to draw: the theme being previewed in the picker, else `theme`.
	*/
	shownTheme: ThemeName;
	isAnimated: boolean;
	previewTheme(name: ThemeName): void;
	cancelPreview(): void;
	selectTheme(name: ThemeName): void;
	cycleTheme(): void;
	toggleAnimation(): void;
	saveOptions(patch: Partial<SessionOptions>, current: SessionOptions): void;
};

export function useSettings(
	tracker: ConfigTracker,
	saver: SettingsSaver,
): Settings {
	const [theme, setTheme] = useState(() => tracker.effective().theme);
	const [preview, setPreview] = useState<ThemeName | undefined>();
	const [isAnimated, setIsAnimated] = useState(
		() => tracker.effective().ui.animation,
	);

	const persist = (patch: ConfigPatch) => {
		tracker.applyChange(patch);
		saver.schedule(tracker.toSave());
	};

	const selectTheme = (name: ThemeName) => {
		setPreview(undefined);
		setTheme(name);
		persist({theme: name});
	};

	return {
		theme,
		shownTheme: preview ?? theme,
		isAnimated,
		previewTheme: setPreview,
		cancelPreview() {
			setPreview(undefined);
		},
		selectTheme,
		cycleTheme() {
			selectTheme(nextThemeName(theme));
		},
		toggleAnimation() {
			setIsAnimated(!isAnimated);
			persist({ui: {animation: !isAnimated}});
		},
		saveOptions(patch, current) {
			const session = toConfigPatch(patch, current);
			if (session !== undefined) {
				persist({session});
			}
		},
	};
}
