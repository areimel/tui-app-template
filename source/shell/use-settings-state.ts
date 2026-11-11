/**
The shell's `Settings` value: theme (committed and previewed) and animation, starting from the layered
config and persisted through the config tracker and the debounced saver. A preview is never saved.
*/
import {useMemo, useState} from 'react';
import type {ConfigTracker} from '../config/schema.js';
import type {DebouncedSaver} from '../config/store.js';
import {createStore} from '../core/store.js';
import {nextThemeName} from '../theme/resolve.js';
import type {ThemeName} from '../theme/tokens.js';
import {useExternalStore} from '../ui/hooks/use-external-store.js';
import type {Settings} from './types.js';

export type SettingsSaver = Pick<DebouncedSaver, 'schedule'>;

type SettingsState = {
	readonly theme: ThemeName;
	readonly preview: ThemeName | undefined;
	readonly isAnimated: boolean;
};

export function useSettingsState(
	tracker: ConfigTracker,
	saver: SettingsSaver,
): Settings {
	const [store] = useState(() =>
		createStore<SettingsState>({
			theme: tracker.effective().theme,
			preview: undefined,
			isAnimated: tracker.effective().ui.animation,
		}),
	);
	const state = useExternalStore(store);

	// Every method reads the store, so they never act on a stale render.
	const actions = useMemo(() => {
		const set = (patch: Partial<SettingsState>) => {
			store.setState(previous => ({...previous, ...patch}));
		};

		const selectTheme = (theme: ThemeName) => {
			set({theme, preview: undefined});
			tracker.set('theme', theme);
			saver.schedule(tracker.toSave());
		};

		return {
			selectTheme,
			previewTheme(preview: ThemeName | undefined) {
				if (store.getState().preview !== preview) {
					set({preview});
				}
			},
			cycleTheme() {
				selectTheme(nextThemeName(store.getState().theme));
			},
			toggleAnimation() {
				const isAnimated = !store.getState().isAnimated;
				set({isAnimated});
				tracker.set('ui.animation', isAnimated);
				saver.schedule(tracker.toSave());
			},
		};
	}, [store, tracker, saver]);

	return useMemo(
		() => ({
			theme: state.theme,
			shownTheme: state.preview ?? state.theme,
			isAnimated: state.isAnimated,
			...actions,
		}),
		[state, actions],
	);
}
