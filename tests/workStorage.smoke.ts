import assert from 'node:assert/strict'
import { loadWorkSessionMarkers, saveWorkSessionMarker } from '../src/rootcellar/workSessionStorage'
import { setFailWrites, values } from './gm.mock'
import type { WorkSessionMarker } from '../src/rootcellar/workSegment'

const key = 'rootcellar:work_session_markers:v2'
const marker: WorkSessionMarker = {
    schemaVersion: 2,
    sessionId: 'ws-11111111-1111-4111-8111-111111111111',
    goal: 'test',
    sourceConversationId: 'parent',
    sourceTitle: '晞02',
    parentConversationId: 'parent',
    boundaryNodeId: 'boundary',
    boundaryMessageId: null,
    markedAt: '2026-09-17T00:00:00Z',
    markerBasis: 'explicit_boundary',
}
assert.deepEqual(loadWorkSessionMarkers(), [])
saveWorkSessionMarker(marker)
saveWorkSessionMarker({ ...marker, latestEndNodeId: 'end' })
assert.equal(loadWorkSessionMarkers().length, 1)
assert.equal(loadWorkSessionMarkers()[0].latestEndNodeId, 'end')
setFailWrites(true)
assert.throws(() => saveWorkSessionMarker(marker), /unavailable/)
setFailWrites(false)
values.set(key, 'broken JSON')
assert.throws(() => loadWorkSessionMarkers())
assert.throws(() => saveWorkSessionMarker(marker))
assert.equal(values.get(key), 'broken JSON')
values.set(key, JSON.stringify([{ schemaVersion: 2 }]))
assert.throws(() => loadWorkSessionMarkers(), /invalid/)
values.delete(key)
values.set('rootcellar:work_session_markers:v1', 'legacy bytes')
assert.deepEqual(loadWorkSessionMarkers(), [])
saveWorkSessionMarker(marker)
assert.equal(values.get('rootcellar:work_session_markers:v1'), 'legacy bytes')
process.stdout.write('PASS: persistent marker write/read-back, failure, corruption and legacy preservation\n')
