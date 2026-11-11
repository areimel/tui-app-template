import os from 'node:os';

export type SystemStats = {
	uptimeSeconds: number;
	loadAverage: readonly [number, number, number];
	hostname: string;
};

/**
Reads machine uptime, load average and hostname.
*/
export function readSystemStats(): SystemStats {
	const [one = 0, five = 0, fifteen = 0] = os.loadavg();
	return {
		uptimeSeconds: os.uptime(),
		loadAverage: [one, five, fifteen],
		hostname: os.hostname(),
	};
}
