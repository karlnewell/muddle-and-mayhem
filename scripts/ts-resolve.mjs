// Lets Node run a TypeScript script against `src/` directly, with no bundler
// and no extra dependency. Node strips types itself; this hook only adds the
// `.ts` extension that the source omits on its relative imports (or `/index.ts`
// for a folder import such as `'../sim'`), which Node's ESM loader requires.
//
// Usage: node --import ./scripts/ts-resolve.mjs <script.mts>
import { registerHooks } from 'node:module';

const RELATIVE = /^\.\.?\//;
const HAS_EXTENSION = /\.[cm]?[jt]s$|\.json$/;

registerHooks({
  resolve(specifier, context, next) {
    if (RELATIVE.test(specifier) && !HAS_EXTENSION.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // not a file: try a folder with an index, as `import ... from '../sim'` means
      }
      try {
        return next(`${specifier}/index.ts`, context);
      } catch {
        // fall through: let Node report the original specifier
      }
    }
    return next(specifier, context);
  },
});
