/**
Loads `tasks.json` once through the data service and holds the file value. Entries that failed
validation are reported as one warning toast.
*/
import {useEffect, useEffectEvent, useMemo, useState} from 'react';
import {useServices, useToast} from '../../shell/context.js';
import {TASKS_SPEC} from './tasks-file.js';
import {EMPTY_FILE, type TaskFile} from './tasks-model.js';

export const DATA_FILE = 'tasks.json';

export function useTaskFile() {
	const services = useServices();
	const toast = useToast();
	const store = useMemo(
		() => services.data.file(DATA_FILE, TASKS_SPEC),
		[services],
	);
	const [file, setFile] = useState<TaskFile>(EMPTY_FILE);
	const [isLoaded, setIsLoaded] = useState(false);
	const reportWarnings = useEffectEvent((warnings: readonly string[]) => {
		const count = warnings.length;
		toast(
			`${count} problem${count === 1 ? '' : 's'} in ${DATA_FILE}: ${warnings[0] ?? ''}`,
			'warn',
		);
	});

	useEffect(() => {
		let isCurrent = true;
		void store.load().then(({value, warnings}) => {
			if (!isCurrent) {
				return;
			}

			setFile(value);
			setIsLoaded(true);
			if (warnings.length > 0) {
				reportWarnings(warnings);
			}
		});
		return () => {
			isCurrent = false;
		};
	}, [store]);

	return {store, file, setFile, isLoaded};
}
