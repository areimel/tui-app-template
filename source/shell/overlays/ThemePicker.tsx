/**
Stub: owned by S2 (app shell, menu, overlays, brand). A `Dialog` listing `THEME_NAMES`; moving previews
(`settings.previewTheme`), Enter commits (`selectTheme`), Esc cancels the preview. Replace the body;
keep the export and props.
*/
import {T} from '../../ui/kit/T.js';
import {useSettings} from '../context.js';

export type ThemePickerProps = {
	readonly onClose: () => void;
};

export function ThemePicker(_props: ThemePickerProps) {
	const {shownTheme} = useSettings();
	return <T>Theme: {shownTheme}</T>;
}
