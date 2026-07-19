// TypeScript 7 (the native compiler) no longer resolves side-effect CSS imports
// (e.g. import "@vxture/design-system/styles/globals.css"; import "./globals.css")
// without an explicit ambient module declaration - TS 5 accepted them implicitly.
// The bundler (Next.js) handles the actual CSS; this only satisfies the type
// checker. Covers both local ./*.css and the @vxture/design-system/styles/*.css.
declare module "*.css";
