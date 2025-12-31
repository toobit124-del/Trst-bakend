// Cloudflare Workers entrypoint required by wrangler (was expecting src/index.ts)
// Import the existing backend for side-effects so its event listeners / exports run.
import '../backend';

// Export an empty default so this module is a valid module worker entry.
export default {};
