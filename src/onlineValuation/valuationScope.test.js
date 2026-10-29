import test from 'node:test';
import assert from 'node:assert/strict';
import { valuationScope } from './valuationScope.js';

test('integrated test inbox cannot use the production backend even with a configured override', () => {
  assert.equal(valuationScope(true, 'online-valuation').functionName, 'online-valuation-public-test');
  assert.equal(valuationScope(true).formUrl, 'https://autovykup-naceneni-test.vercel.app/naceneni-vozu');
});

test('regular valuation keeps its configured backend and same-origin customer form', () => {
  assert.equal(valuationScope(false, 'custom-valuation').functionName, 'custom-valuation');
  assert.equal(valuationScope(false).formUrl, '/naceneni-vozu');
});

test('regular valuation uses the live manual intake endpoint', () => {
  assert.equal(valuationScope(false).functionName, 'online-valuation-intake');
});
