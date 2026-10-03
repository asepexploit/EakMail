// Quick test: verify GramJS NewMessage fires for this account's session
// Usage: node test-monitor.mjs
// Send a message in any group the account is in, within 60s
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { createDecipheriv } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;
const db = new Client({ connectionString: 'postgresql://eakmail:eakmail@127.0.0.1:5433/eakmail' });
await db.connect();
const { rows } = await db.query('SELECT "sessionEnc", label FROM "PromotionAccount" WHERE status=\'CONNECTED\' LIMIT 1');
await db.end();
if (!rows[0]) { console.error('No CONNECTED account'); process.exit(1); }

import { createHash } from 'node:crypto';
const KEY = createHash('sha256').update('7OG6qmXYDrVfLFe11Ctr1RwL2eSlly3xXSZizh6lTO4=').digest();
function decrypt(enc) {
  const buf = Buffer.from(enc, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString();
}

const session = decrypt(rows[0].sessionEnc);
console.log('Account:', rows[0].label, '| session len:', session.length);

const client = new TelegramClient(new StringSession(session), 36210193, 'db7238918b71973d9c664e7c1e5e33e9', { connectionRetries: 3 });
await client.connect();
const me = await client.getMe();
console.log('Me:', me.firstName ?? '', '@' + (me.username ?? ''), '+' + me.phone);
console.log('\n>>> Send any message in ANY group NOW (60s window) <<<\n');

let count = 0;
client.addEventHandler(async (event) => {
  count++;
  const msg = event.message;
  console.log('--- MSG #' + count + ' ---');
  console.log('  peerId:', JSON.stringify(msg?.peerId ?? null));
  console.log('  .message:', (msg?.message ?? '').slice(0, 100));
  console.log('  .text:', (msg?.text ?? '').slice(0, 100));
}, new NewMessage({}));

await new Promise(r => setTimeout(r, 120_000));
console.log('\nTotal messages received:', count);
await client.disconnect();
