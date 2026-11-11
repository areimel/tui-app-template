/**
Canned content for the demo services: the file tree, process list and battery reading.
*/
import {APP} from '../app.config.js';
import type {BatteryInfo, ProcessInfo} from '../platform/types.js';
import type {DemoFile} from './demo-fs.js';

export const DEMO_HOME = '/home/demo';
export const DEMO_CWD = `${DEMO_HOME}/projects/${APP.command}`;

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

const LOG_MESSAGES: ReadonlyArray<readonly [string, string]> = [
	['INFO', 'server started on port 8080'],
	['INFO', 'connected to database'],
	['DEBUG', 'cache warmed: 128 entries'],
	['INFO', 'GET /api/users 200 12ms'],
	['WARN', 'slow query: 480ms'],
	['INFO', 'GET /api/orders 200 31ms'],
	['ERROR', 'upstream timeout after 30s'],
	['INFO', 'retrying request (attempt 2)'],
	['DEBUG', 'session refreshed'],
	['INFO', 'POST /api/orders 201 54ms'],
];

function demoLog(): string {
	return Array.from({length: 60}, (_, index) => {
		const [level, message] = LOG_MESSAGES[index % LOG_MESSAGES.length] ?? [
			'INFO',
			'',
		];
		const second = String(index).padStart(2, '0');
		return `2026-11-11 09:30:${second} ${level} ${message}`;
	}).join('\n');
}

export const DEMO_FILES: Readonly<Record<string, DemoFile>> = {
	[`${DEMO_HOME}/notes.txt`]:
		'Ideas\n- add a theme\n- write the guide\n- ship the template\n',
	[`${DEMO_HOME}/.bashrc`]: "export PS1='$ '\nalias ll='ls -l'\n",
	[`${DEMO_HOME}/documents/todo.md`]: '# Todo\n\n- [x] menu\n- [ ] docs\n',
	[`${DEMO_HOME}/documents/budget.csv`]: 'item,cost\nlunch,12\ntea,8\n',
	[`${DEMO_HOME}/pictures/photo.png`]: {binaryBytes: 482_113},
	[`${DEMO_HOME}/logs/app.log`]: demoLog(),
	[`${DEMO_CWD}/package.json`]: `{\n\t"name": "${APP.name}",\n\t"version": "1.0.0",\n\t"type": "module"\n}\n`,
	[`${DEMO_CWD}/readme.md`]: `# ${APP.displayName}\n\n${APP.tagline}.\n`,
	[`${DEMO_CWD}/source/cli.tsx`]: 'import {render} from "ink";\n',
	[`${DEMO_CWD}/source/app.tsx`]: 'export function App() {}\n',
};

export const DEMO_PROCESSES: readonly ProcessInfo[] = [
	{
		pid: 1,
		name: 'systemd',
		user: 'root',
		cpuPercent: 0.1,
		memoryBytes: 12 * MIB,
	},
	{
		pid: 642,
		name: 'Xorg',
		user: 'root',
		cpuPercent: 3.4,
		memoryBytes: 180 * MIB,
	},
	{
		pid: 1180,
		name: 'gnome-shell',
		user: 'demo',
		cpuPercent: 6.2,
		memoryBytes: 410 * MIB,
	},
	{
		pid: 2231,
		name: 'firefox',
		user: 'demo',
		cpuPercent: 18.5,
		memoryBytes: 1.4 * GIB,
	},
	{
		pid: 2410,
		name: 'node',
		user: 'demo',
		cpuPercent: 42.5,
		memoryBytes: 310 * MIB,
	},
	{
		pid: 2688,
		name: 'code',
		user: 'demo',
		cpuPercent: 9.1,
		memoryBytes: 720 * MIB,
	},
	{
		pid: 3012,
		name: 'postgres',
		user: 'postgres',
		cpuPercent: 1.2,
		memoryBytes: 96 * MIB,
	},
	{
		pid: 3140,
		name: 'docker',
		user: 'root',
		cpuPercent: 0.8,
		memoryBytes: 64 * MIB,
	},
	{pid: 3377, name: 'tmux', user: 'demo', cpuPercent: 0, memoryBytes: 9 * MIB},
	{pid: 3391, name: 'bash', user: 'demo', cpuPercent: 0, memoryBytes: 6 * MIB},
	{
		pid: 3550,
		name: 'ssh-agent',
		user: 'demo',
		cpuPercent: 0,
		memoryBytes: 2 * MIB,
	},
	{pid: 3902, name: 'cron', user: 'root', cpuPercent: 0, memoryBytes: 3 * MIB},
];

export const DEMO_BATTERY: BatteryInfo = {
	percent: 82,
	charging: false,
	acOnline: false,
	status: 'discharging',
	minutesToEmpty: 275,
	minutesToFull: undefined,
	watts: 9.4,
};
