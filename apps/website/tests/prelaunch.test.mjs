import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { isValidPhone, normalisePhone, isValidApartmentCount } from '../src/lib/validation.ts'
import { localeLocation } from '../src/lib/locale-location.ts'
import { submitSafely } from '../src/lib/submission/safe-submit.ts'

for (const phone of ['050-1234567', '+972501234567', '00972501234567', '02-1234567']) {
  test(`accepts formatted phone ${phone}`, () => assert.equal(isValidPhone(phone), true))
}
test('rejects letters inside phone numbers', () => assert.equal(isValidPhone('050abc1234567'), false))
test('normalises international prefix', () => assert.equal(normalisePhone('00972501234567'), '0501234567'))
for (const count of ['1e3', '0x10', '-1', '2.5', '2001']) {
  test(`rejects invalid apartment count ${count}`, () => assert.equal(isValidApartmentCount(count), false))
}
test('accepts optional and decimal whole counts', () => {
  for (const value of ['', '1', '2000']) assert.equal(isValidApartmentCount(value), true)
})
test('preserves filters and anchors across locale navigation', () => {
  assert.equal(localeLocation('/projects', '?city=Jerusalem', '#results'), '/projects?city=Jerusalem#results')
})
test('submission exception becomes visible failure without leaking details', async () => {
  assert.deepEqual(await submitSafely(() => { throw new Error('private detail') }), {ok:false,reason:'UNKNOWN'})
})
test('successful submission result is preserved', async () => {
  const outcome = {ok:true, result:{id:'test-only'}}
  assert.equal(await submitSafely(async () => outcome), outcome)
})
test('homepage process illustrations and hero exist locally', () => {
  for (const name of ['jerusalem-stone-view', 'stage-1', 'stage-3', 'stage-6', 'stage-7', 'stage-8']) {
    assert.ok(existsSync(new URL(`../public/images/editorial/${name}.webp`, import.meta.url)))
  }
})
test('both languages include filter empty state', () => {
  for (const locale of ['he', 'en']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'))
    assert.ok(messages.projects.noFilterResults)
  }
})
