#!/usr/bin/env node

import { main } from './preview-core.js';

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
