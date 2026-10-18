import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { openDatabase } from '../server/database.js';
import { fileURLToPath } from 'node:url';
const prompt = createInterface({ input: stdin, output: stdout });
const db = openDatabase(process.env.DATABASE_PATH || fileURLToPath(new URL('../data/small-steps.sqlite', import.meta.url)));
try {
  console.log('\nSmall Steps — local administrator setup\nCreate an account in the app first, then enter its email here.\n');
  const email = (await prompt.question('Account email: ')).trim().toLowerCase();
  const user = await db.prepare('SELECT id, name FROM users WHERE email=?').bind(email).first();
  if (!user) { console.error('No account found. Sign up in the app, then run this command again.'); process.exitCode = 1; }
  else { await db.prepare("UPDATE users SET role='admin' WHERE id=?").bind(user.id).run(); console.log(`\n${user.name} is now an administrator. Refresh the app to see Admin dashboard.\n`); }
} finally { db.close(); prompt.close(); }
