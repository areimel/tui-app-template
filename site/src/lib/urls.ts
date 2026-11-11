/** Resolve project-local URLs beneath the configured GitHub Pages base. */
export function href(path = ""): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
