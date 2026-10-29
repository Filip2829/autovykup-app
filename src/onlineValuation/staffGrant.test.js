import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../../supabase/migrations/20261029170200_grant_sekanina_valuation_access.sql', import.meta.url),
  'utf8',
);

test('grant targets only Sekanina by immutable Auth identity lookup', () => {
  assert.match(migration, /lower\(email\) = 'sekanina@autovykup\.local'/);
  assert.match(migration, /into strict target_user_id/);
  assert.match(migration, /coalesce\(is_anonymous, false\) = false/);
  assert.match(migration, /values \(target_user_id, 'Adam Sekanina'\)/);
  assert.doesNotMatch(migration, /raw_(?:user|app)_meta_data/);
});

test('grant preserves other staff and removes no access', () => {
  assert.match(migration, /insert into public\.valuation_staff/);
  assert.doesNotMatch(migration, /\bdelete\s+from\s+public\.valuation_staff\b/i);
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\badmin\b/i);
});

test('anonymous callers cannot invoke the staff helper', () => {
  assert.match(migration, /revoke execute on function public\.is_valuation_staff\(\) from anon/);
});
