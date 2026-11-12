/**
What an example app is. The types are defined in `shell/types.ts` (the shell renders apps and must not
import from `apps/`); this module re-exports them for app authors and adds `defineApp`.
*/
import type {AppDefinition} from '../shell/types.js';

export type {
	AppCli,
	AppDefinition,
	AppService,
	CliFlagSpec,
	CliFlagValues,
	PlainContext,
	ServiceContext,
} from '../shell/types.js';

/**
Type-checks an app against its own config type `C`, then erases `C` so apps with different config
types fit in one registry array. The shell only ever passes an app the values its own `config.validate`
produced, so the erasure is safe.
*/
export function defineApp<C>(definition: AppDefinition<C>): AppDefinition {
	return definition as unknown as AppDefinition;
}
