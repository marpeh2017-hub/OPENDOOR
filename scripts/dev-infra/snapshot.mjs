#!/usr/bin/env node
/**
 * Source-tree snapshot, for working alongside another agent in one checkout.
 *
 * Two tools edit this repository at the same time. `git status` shows that a
 * file differs from HEAD, but not WHO changed it or WHEN — so a file you
 * committed an hour ago and a file the other tool rewrote two minutes ago look
 * identical.
 *
 * This records a hash + mtime per tracked source file. Run it when you start,
 * and diff it when something behaves unexpectedly:
 *
 *   node scripts/dev-infra/snapshot.mjs save          # before you start
 *   node scripts/dev-infra/snapshot.mjs diff          # what moved since?
 *
 * Deliberately dependency-free and read-only. It writes exactly one file, into
 * the OS temp directory rather than the repo, so it can never itself become a
 * thing the two tools fight over.
 *
 * This does not prevent collisions — only `git worktree` does that. It makes
 * them visible, which is the difference between "the API broke for no reason"
 * and "the generated Prisma client changed at 17:27".
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const STORE = join(tmpdir(), 'uros-snapshot.json')

/** Tracked files only — node_modules and build output are not interesting. */
function trackedFiles() {
  const out = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\n').map((s) => s.trim()).filter(Boolean)
}

function fingerprint() {
  const map = {}
  for (const rel of trackedFiles()) {
    if (!existsSync(rel)) continue
    let buf
    try { buf = readFileSync(rel) } catch { continue }
    map[rel] = {
      hash: createHash('sha1').update(buf).digest('hex').slice(0, 12),
      mtime: statSync(rel).mtimeMs,
    }
  }
  return map
}

const [, , cmd = 'diff'] = process.argv

if (cmd === 'save') {
  const map = fingerprint()
  writeFileSync(STORE, JSON.stringify({ at: Date.now(), map }, null, 0))
  console.log(`snapshot saved: ${Object.keys(map).length} files -> ${STORE}`)
  process.exit(0)
}

if (cmd !== 'diff') {
  console.error('usage: snapshot.mjs [save|diff]')
  process.exit(2)
}

if (!existsSync(STORE)) {
  console.error(`No snapshot found. Run:  node ${process.argv[1]} save`)
  process.exit(2)
}

const prev = JSON.parse(readFileSync(STORE, 'utf8'))
const now = fingerprint()

const changed = []
const added = []
const removed = []

for (const [rel, cur] of Object.entries(now)) {
  const old = prev.map[rel]
  if (!old) { added.push(rel); continue }
  if (old.hash !== cur.hash) changed.push({ rel, mtime: cur.mtime })
}
for (const rel of Object.keys(prev.map)) if (!now[rel]) removed.push(rel)

const since = new Date(prev.at).toLocaleString()
console.log(`Comparing against snapshot from ${since}\n`)

if (!changed.length && !added.length && !removed.length) {
  console.log('No tracked source file changed.')
  process.exit(0)
}

// Sorted newest-first: whatever moved most recently is usually the culprit.
changed.sort((a, b) => b.mtime - a.mtime)

if (changed.length) {
  console.log(`CHANGED (${changed.length}), newest first:`)
  for (const c of changed) {
    console.log(`  ${new Date(c.mtime).toLocaleTimeString()}  ${c.rel}`)
  }
}
if (added.length)   console.log(`\nADDED (${added.length}):\n  ${added.join('\n  ')}`)
if (removed.length) console.log(`\nREMOVED (${removed.length}):\n  ${removed.join('\n  ')}`)
