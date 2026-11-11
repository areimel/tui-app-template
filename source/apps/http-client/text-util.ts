/**
Tiny pure text helpers shared by the request and response models.
*/

/**
C0 and C1 control characters (including DEL).
*/
export function isControlCode(code: number | undefined): boolean {
	return code !== undefined && (code < 32 || (code >= 127 && code < 160));
}

export const hasControlCharacters = (text: string): boolean =>
	[...text].some(character => isControlCode(character.codePointAt(0)));
