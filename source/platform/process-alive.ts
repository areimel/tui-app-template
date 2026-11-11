import process from 'node:process';
/**
Whether a process with this pid exists (signal 0 probe).
`EPERM` means it exists but belongs to someone else, so it counts as alive.
Invalid pids (non-integer, zero or negative) are never alive.
*/
export function isPidAlive(pid: number): boolean {
	if (!Number.isSafeInteger(pid) || pid <= 0) {
		return false;
	}

	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}
