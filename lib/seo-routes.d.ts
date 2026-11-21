export interface PublicPage { path: string; template: string; title: string; heading: string; description: string; }
export const PUBLIC_PAGES: PublicPage[];
export function publicPage(pathname: string): PublicPage | undefined;
export function isPrivatePath(pathname: string): boolean;
