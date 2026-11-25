import path from 'node:path';

import { createFileGroupStore } from './store.ts';
import { listenGroupServer } from './http.ts';

const port = Number(process.env.PORT) || 43124;
const host = process.env.HOST || '0.0.0.0';
const file = process.env.GROUP_FILE || path.join(process.cwd(), 'server', 'data', 'circles.json');

const store = createFileGroupStore(file);
const seeded = await store.seed();
const running = await listenGroupServer(store, port, host);
if (seeded) console.log('Seeded the App Review group APLREV');

console.log(`Group server listening on http://${host}:${running.port}`);
console.log(`Browser preview should use http://127.0.0.1:${running.port}`);
console.log(`Saving groups in ${file}`);
