import test from 'node:test';
import assert from 'node:assert/strict';
import { valuationAccess } from '../../supabase/functions/_shared/valuationAccess.js';
import { isPublicTestPath } from './testAccess.js';

test('public test opens only the customer form without staff authentication', () => {
  for (const path of ['/naceneni-vozu', '/naceneni-vozu/']) assert.equal(isPublicTestPath(path, 'true'), true);
  for (const path of ['/', '/poptavky-naceneni', '/naceneni-vozu/odkaz']) assert.equal(isPublicTestPath(path, 'true'), false);
  for (const flag of [undefined, 'false', '1']) assert.equal(isPublicTestPath('/naceneni-vozu', flag), false);
});

test('explicit public test permits anonymous submission and photos, with test records and no mail', () => {
  for (const action of ['begin', 'upload', 'remove_photo', 'submit']) {
    const access = valuationAccess('test', 'true', 'paused', action);
    assert.equal(access.requiresStaff, false, action);
    assert.equal(access.isTest, true);
    assert.equal(access.mailAllowed, false);
    assert.equal(access.actionAllowed, true);
  }
});

test('public test protects staff actions, token links and unknown actions', () => {
  for (const action of ['save', 'note', 'offer', 'supplement', 'convert', 'retry_mail', 'public_read', 'respond', 'supplement_submit', 'unknown']) {
    assert.equal(valuationAccess('test', 'true', 'paused', action).requiresStaff, true, action);
  }
});

test('private test remains private without explicit public flag', () => {
  for (const flag of [undefined, '', 'false']) assert.equal(valuationAccess('test', flag, 'paused', 'begin').requiresStaff, true);
});

test('public test refuses live or missing mail configuration', () => {
  for (const mode of ['live', '', undefined]) assert.throws(() => valuationAccess('test', 'true', mode, 'begin'));
});

test('all test environments block workers and manual mail queuing', () => {
  assert.equal(valuationAccess('test', '', 'live', 'worker').mailAllowed, false);
  for (const action of ['offer', 'supplement', 'retry_mail']) assert.equal(valuationAccess('test', '', 'paused', action).actionAllowed, false);
  for (const action of ['save', 'note']) assert.equal(valuationAccess('test', '', 'paused', action).actionAllowed, true);
});

test('production retains public form and protected staff operations', () => {
  assert.equal(valuationAccess('production', 'true', 'live', 'begin').requiresStaff, false);
  for (const action of ['save', 'note', 'offer', 'supplement', 'convert', 'retry_mail']) {
    const access = valuationAccess('production', 'true', 'live', action);
    assert.equal(access.requiresStaff, true);
    assert.equal(access.actionAllowed, true);
    assert.equal(access.isTest, false);
  }
});

test('missing or misspelled backend environment fails closed', () => {
  for (const environment of ['', undefined, 'prod', 'staging']) assert.throws(() => valuationAccess(environment, 'true', 'paused', 'begin'));
});


import { manualValuationAccess } from '../../supabase/functions/_shared/manualValuationAccess.js';
test('live manual intake permits customer submission and protects every staff mutation', () => {
 for (const action of ['begin','upload','remove_photo','submit']) assert.deepEqual(manualValuationAccess(action), {allowed:true,requiresStaff:false,internal:false});
 for (const action of ['save','note','convert']) assert.deepEqual(manualValuationAccess(action), {allowed:true,requiresStaff:true,internal:true});
});
test('live manual intake has no email, worker, token-link or unknown operation', () => {
 for (const action of ['offer','supplement','retry_mail','worker','public_read','respond','supplement_submit','unexpected','',null,undefined]) assert.equal(manualValuationAccess(action).allowed,false);
});
