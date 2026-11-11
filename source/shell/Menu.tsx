/**
Stub: owned by S2 (app shell, menu, overlays, brand). The first page: the brand heading and one row per
app (glyph, title, description, optional `MenuBadge`); ↑/↓ and Enter open an app (`router.push`).
Replace the body; keep the export and props.
*/
import {Box} from 'ink';
import {T} from '../ui/kit/T.js';
import type {AppDefinition} from './types.js';

export type MenuProps = {
	readonly apps: readonly AppDefinition[];
};

export function Menu({apps}: MenuProps) {
	return (
		<Box flexDirection="column">
			{apps.map(app => (
				<T key={app.id}>
					{app.glyph} {app.title} <T tone="muted">{app.description}</T>
				</T>
			))}
		</Box>
	);
}
