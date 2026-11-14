// Vercel Functions expose their settings on process.env. Declared here rather than through
// @types/node so the build, which compiles from a temporary folder, finds no missing type library.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };
