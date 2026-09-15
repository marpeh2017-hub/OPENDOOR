import test from 'node:test'
import assert from 'node:assert/strict'
import { slotImages, assignSlotImages, MAX_SLOT_IMAGES } from '../../../packages/api-contracts/src/media-slots.ts'

const image = (id) => ({ mediaId: id, storageKey: `tenant/cms/${id}`, alt: {he:`תמונה ${id}`, en:`Image ${id}`}, classification:'EDITORIAL_CONTEXT' })

test('old single-image publications remain readable', () => {
  assert.deepEqual(slotImages(image('old')), [image('old')])
})
test('editor order survives save and publication serialization', () => {
  const ordered = [image('c'), image('a'), image('b')]
  const document = JSON.parse(JSON.stringify(assignSlotImages(ordered)))
  assert.deepEqual(slotImages(document), ordered)
  assert.equal(document.storageKey, ordered[0].storageKey)
})
test('explicit removal does not restore a legacy first image', () => {
  assert.deepEqual(slotImages({...image('old'),slides:[]}), [])
  assert.deepEqual(slotImages(assignSlotImages([])), [])
})
test('hiding keeps stored selections available for re-enabling', () => {
  const assignment = {...assignSlotImages([image('a')]),disabled:true}
  assert.deepEqual(slotImages(assignment), [])
  assert.deepEqual(slotImages({...assignment,disabled:false}), [image('a')])
})
test('bad entries, missing alt and duplicate images do not reach the gallery', () => {
  const bad = [null, 42, {}, {...image('bad'),alt:{he:''}}, {...image('bad'),classification:'PRIVATE'}, image('a'), image('a')]
  assert.deepEqual(slotImages({slides:bad}), [image('a')])
})
test('gallery media requests stay bounded', () => {
  assert.equal(slotImages({slides:Array.from({length:100},(_,i)=>image(String(i)))}).length,MAX_SLOT_IMAGES)
})
