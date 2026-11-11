import {createContext, use, type ReactNode} from 'react';
import type {ResolvedTheme} from './tokens.js';

/**
No colours at all (colour level 0). Context default, `NO_COLOR` and test fallback.
*/
export const PLAIN_THEME: ResolvedTheme = {
	name: 'amber',
	label: 'Plain',
	colorLevel: 0,
	colors: {
		accent: undefined,
		accentDim: undefined,
		text: undefined,
		muted: undefined,
		border: undefined,
		ok: undefined,
		warn: undefined,
		err: undefined,
		bg: undefined,
	},
};

const ThemeContext = createContext<ResolvedTheme>(PLAIN_THEME);

type ThemeProviderProps = {
	readonly theme: ResolvedTheme;
	readonly children?: ReactNode;
};

/**
Supplies the resolved theme to every kit component below it.
*/
export function ThemeProvider({theme, children}: ThemeProviderProps) {
	return <ThemeContext value={theme}>{children}</ThemeContext>;
}

/**
The current resolved theme (`PLAIN_THEME` outside a provider).
*/
export function useTheme(): ResolvedTheme {
	return use(ThemeContext);
}
