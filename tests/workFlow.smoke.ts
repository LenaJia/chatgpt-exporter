import assert from 'node:assert/strict'
import { exportWorkSegment, markWorkSegmentStart } from '../src/exporter/workSegment'
import { loadWorkSessionMarkers } from '../src/rootcellar/workSessionStorage'
import { setFailWrites, values } from './gm.mock'
import { state } from './workFlow.mock'

let prompts: Array<string | null> = []
let confirms: boolean[] = []
const alerts: string[] = []
Object.assign(globalThis, {
    location: { pathname: '/c/child' },
    window: {
        prompt: () => {
            assert.ok(prompts.length, 'unexpected prompt')
            return prompts.shift()
        },
        confirm: () => {
            assert.ok(confirms.length, 'unexpected confirmation')
            return confirms.shift()
        },
    },
    alert: (text: string) => alerts.push(text),
})
state.conversation = {
    id: 'child',
    title: 'W02｜测试',
    create_time: 1,
    update_time: 2,
    current_node: 'reply',
    moderation_results: [],
    is_archived: false,
    mapping: {
        boundary: { id: 'boundary', children: ['first'] },
        first: {
            id: 'first',
            parent: 'boundary',
            children: ['reply'],
            message: {
                id: 'm-first',
                author: { role: 'user', metadata: {} },
                create_time: 1,
                content: { content_type: 'text', parts: ['unique work start'] },
                metadata: {},
                recipient: 'all',
                weight: 1,
            },
        },
        reply: { id: 'reply', parent: 'first', children: [] },
    },
}

// Cancellation never writes a marker or requests a download.
prompts = ['goal', 'unique work start', 'W02｜测试']
confirms = [false]
assert.equal(await exportWorkSegment(), false)
assert.equal(state.downloads.length, 0)
assert.deepEqual(loadWorkSessionMarkers(), [])

prompts = ['goal', 'unique work start', 'W02｜测试']
confirms = [true]
assert.equal(await exportWorkSegment(), true)
assert.equal(state.downloads.length, 1)
const firstExport = JSON.parse(state.downloads[0].content)[0]
assert.deepEqual(Object.keys(firstExport.mapping), ['boundary', 'first', 'reply'])
assert.equal(firstExport.rootcellar_work_segment.parent_conversation_id, null)
assert.equal(firstExport.rootcellar_work_segment.archive_status, 'unverified')
assert.ok(alerts.at(-1)?.includes('下载已请求'))
assert.equal(loadWorkSessionMarkers()[0].boundConversationId, 'child')

// Re-export requires explicit choice, preserves session ID and includes the full interval.
prompts = ['1', 'W02｜测试']
confirms = [true]
assert.equal(await exportWorkSegment(), true)
const secondExport = JSON.parse(state.downloads[1].content)[0]
assert.equal(secondExport.rootcellar_work_segment.session_id, firstExport.rootcellar_work_segment.session_id)
assert.deepEqual(Object.keys(secondExport.mapping), Object.keys(firstExport.mapping))
prompts = ['bogus']
assert.equal(await exportWorkSegment(), false)
assert.equal(state.downloads.length, 2)

state.urlId = null
const beforeFetch = state.fetches
assert.equal(await exportWorkSegment(), false)
assert.equal(state.fetches, beforeFetch, 'no fallback to latest history')
state.urlId = 'child'
state.temporary = true
assert.equal(await exportWorkSegment(), false)
assert.equal(state.fetches, beforeFetch)
state.temporary = false
state.duringFetch = () => {
    state.urlId = 'other'
}
assert.equal(await exportWorkSegment(), false)
assert.equal(state.downloads.length, 2)
state.urlId = 'child'
state.duringFetch = () => {}

// Persistent-storage failure is shown; no download follows.
values.clear()
setFailWrites(true)
prompts = ['goal', 'unique work start', 'W02｜测试']
confirms = [true]
assert.equal(await exportWorkSegment(), false)
assert.equal(state.downloads.length, 2)
assert.ok(alerts.at(-1)?.includes('storage unavailable'))
setFailWrites(false)

// Pre-departure marker cancellation and persistence.
prompts = ['goal']
confirms = [false]
assert.equal(await markWorkSegmentStart(), false)
assert.deepEqual(loadWorkSessionMarkers(), [])
prompts = ['goal']
confirms = [true]
assert.equal(await markWorkSegmentStart(), true)
assert.equal(loadWorkSessionMarkers()[0].parentConversationId, 'child')
assert.equal(loadWorkSessionMarkers()[0].boundaryNodeId, 'reply')
assert.equal(prompts.length, 0)
assert.equal(confirms.length, 0)
process.stdout.write('PASS: Work button flows, cancellation, repeat export, navigation and storage failure\n')
