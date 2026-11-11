import {stripVTControlCharacters} from 'node:util';
import type {ReactElement} from 'react';
import {render} from 'ink-testing-library';
import {PLAIN_THEME, ThemeProvider} from '../../source/theme/context.js';
import type {ResolvedTheme} from '../../source/theme/tokens.js';
import {InputRoot} from '../../source/ui/input/index.js';

export type ThemedRenderResult = ReturnType<typeof render> & {
	/**
	`lastFrame()` with ANSI codes stripped (`''` when nothing rendered).
	*/
	plainFrame(): string;
};

/**
 Ink-testing-library `render` inside a `ThemeProvider` (default `PLAIN_THEME`) and an
 `InputRoot` (so `useKeys` / `useScopedInput` work). `rerender` keeps the same wrappers.
 */
export function renderThemed(
	node: ReactElement,
	theme: ResolvedTheme = PLAIN_THEME,
): ThemedRenderResult {
	const wrap = (child: ReactElement) => (
		<ThemeProvider theme={theme}>
			<InputRoot>{child}</InputRoot>
		</ThemeProvider>
	);
	const result = render(wrap(node));

	return {
		...result,
		rerender(child) {
			result.rerender(wrap(child));
		},
		plainFrame: () => stripVTControlCharacters(result.lastFrame() ?? ''),
	};
}
