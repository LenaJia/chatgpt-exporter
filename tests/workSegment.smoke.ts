import assert from 'node:assert/strict'
import {
    buildWorkSegment,
    buildWorkSegmentFileName,
    compatibleWorkSessionMarkers,
    createRetroactiveWorkSessionMarker,
    createWorkSessionMarker,
    currentPathNodeIds,
    isWorkSessionMarker,
} from '../src/rootcellar/workSegment'
import type { ApiConversationWithId, ConversationNode } from '../src/api'
import type { WorkSessionMarker } from '../src/rootcellar/workSegment'

function textNode(id: string, parent: string | undefined, role: 'user' | 'assistant', text: string): ConversationNode {
    return {
        id,
        parent,
        children: [],
        message: {
            id: `message-${id}`,
            author: { role, metadata: {} },
            create_time: Number(id.replace(/\D/g, '')) || 1,
            content: { content_type: 'text', parts: [text] },
            metadata: {},
            recipient: 'all',
            weight: 1,
        },
    }
}

const root: ConversationNode = { id: 'node-0', children: ['node-1'] }
const mainUser = textNode('node-1', 'node-0', 'user', 'main chat')
const boundary = textNode('node-2', 'node-1', 'assistant', 'departure reply')
const workUser = textNode('node-3', 'node-2', 'user', 'first unique Work message')
const workAssistant = textNode('node-4', 'node-3', 'assistant', 'Work reply')
const sibling = textNode('node-5', 'node-2', 'user', 'unselected sibling')
mainUser.children = ['node-2']
boundary.children = ['node-3', 'node-5']
workUser.children = ['node-4']

const conversation: ApiConversationWithId = {
    id: 'conversation-child',
    conversation_id: 'conversation-child',
    title: 'Actual window title',
    create_time: 1,
    update_time: 4,
    current_node: 'node-4',
    mapping: {
        'node-0': root,
        'node-1': mainUser,
        'node-2': boundary,
        'node-3': workUser,
        'node-4': workAssistant,
        'node-5': sibling,
    },
    moderation_results: [],
    is_archived: false,
}

const marker: WorkSessionMarker = {
    schemaVersion: 2,
    sessionId: 'ws-11111111-1111-4111-8111-111111111111',
    goal: 'Root Cellar continuity',
    sourceConversationId: 'conversation-parent',
    parentConversationId: 'conversation-parent',
    markerBasis: 'explicit_boundary',
    sourceTitle: 'Main｜Backyard',
    boundaryNodeId: 'node-2',
    boundaryMessageId: 'message-node-2',
    markedAt: '2026-09-17T10:00:00.000Z',
}

assert.deepEqual(currentPathNodeIds(conversation), ['node-0', 'node-1', 'node-2', 'node-3', 'node-4'])

const segment = buildWorkSegment(conversation, marker, '2026-09-17T12:00:00.000Z')
assert.deepEqual(Object.keys(segment.mapping), ['node-2', 'node-3', 'node-4'])
assert.equal(segment.mapping['node-2'].message, null)
assert.equal(segment.mapping['node-2'].parent, null)
assert.deepEqual(segment.mapping['node-2'].children, ['node-3'])
assert.equal(segment.mapping['node-3'].parent, 'node-2')
assert.deepEqual(segment.mapping['node-3'].children, ['node-4'])
assert.equal(segment.mapping['node-4'].parent, 'node-3')
assert.deepEqual(segment.mapping['node-4'].children, [])
assert.equal(segment.mapping['node-1'], undefined)
assert.equal(segment.mapping['node-5'], undefined)
assert.equal(segment.title, 'Work｜Root Cellar continuity')
assert.equal(segment.rootcellar_work_segment.parent_conversation_id, 'conversation-parent')
assert.equal(segment.rootcellar_work_segment.source_conversation_id, 'conversation-child')
assert.equal(segment.rootcellar_work_segment.branch_from_node_id, 'node-2')
assert.equal(segment.rootcellar_work_segment.start_node_id, 'node-3')
assert.equal(segment.rootcellar_work_segment.end_node_id, 'node-4')
assert.equal(segment.rootcellar_work_segment.segment_node_count, 2)

const retro = createRetroactiveWorkSessionMarker(conversation, 'Recovered session', 'unique Work')
assert.equal(retro.boundaryNodeId, 'node-2')
assert.equal(retro.boundaryMessageId, 'message-node-2')
assert.equal(retro.parentConversationId, null)
assert.equal(retro.markerBasis, 'retroactive_user_match')
assert.ok(Date.parse(retro.markedAt) > 1_000_000_000_000)
assert.equal(retro.boundConversationId, conversation.id)
assert.match(buildWorkSegmentFileName(marker, '2026-09-17T12:00:00.000Z', 'W02｜根窖接线'), /^W02｜根窖接线_ws-.*_20260917120000000\.json$/)

const before = JSON.stringify(conversation)
buildWorkSegment(conversation, marker)
assert.equal(JSON.stringify(conversation), before, 'input must remain unchanged')
const leaked = { ...conversation, secret_ancestor_text: 'OLD', safe_urls: ['OLD URL'] }
const bounded = buildWorkSegment(leaked, marker)
assert.equal('secret_ancestor_text' in bounded, false)
assert.equal('safe_urls' in bounded, false)
assert.equal(bounded.rootcellar_work_segment.artifact_kind, 'derived_current_path_projection')
assert.equal(bounded.rootcellar_work_segment.archive_status, 'unverified')
assert.equal(bounded.rootcellar_work_segment.attachments_archived, false)
assert.throws(() => buildWorkSegment(conversation, { ...marker, boundaryNodeId: 'missing' }), /not on/)
assert.throws(() => buildWorkSegment(conversation, { ...marker, boundaryMessageId: 'wrong' }), /identity changed/)
assert.throws(() => buildWorkSegment(conversation, { ...marker, boundConversationId: 'other' }), /another/)
assert.throws(() => buildWorkSegment(conversation, { ...marker, firstNodeId: 'node-5' }), /first Work node/)
assert.throws(() => buildWorkSegment(conversation, { ...marker, latestEndNodeId: 'node-5' }), /divergent/)
assert.throws(() => buildWorkSegment({ ...conversation, current_node: 'node-2' }, marker), /No Work/)
assert.throws(() => currentPathNodeIds({ ...conversation, current_node: '' }), /missing/)
const cycle = structuredClone(conversation)
cycle.mapping['node-0'].parent = 'node-4'
assert.throws(() => currentPathNodeIds(cycle), /cycle/)
const missing = structuredClone(conversation)
delete missing.mapping['node-1']
assert.throws(() => currentPathNodeIds(missing), /missing/)
const mismatched = structuredClone(conversation)
mismatched.mapping['node-1'].id = 'wrong'
assert.throws(() => currentPathNodeIds(mismatched), /mismatched/)
assert.throws(() => createRetroactiveWorkSessionMarker(conversation, 'goal', ''), /empty/)
assert.throws(() => createRetroactiveWorkSessionMarker(conversation, 'goal', 'not here'), /exactly one/)
const ambiguous = structuredClone(conversation)
ambiguous.mapping['node-1'].message!.content = { content_type: 'text', parts: ['first unique Work message'] }
assert.throws(() => createRetroactiveWorkSessionMarker(ambiguous, 'goal', 'unique Work'), /exactly one/)
assert.throws(() => createWorkSessionMarker(conversation, ' '), /empty/)
const fresh1 = createWorkSessionMarker(conversation, 'goal')
const fresh2 = createWorkSessionMarker(conversation, 'goal')
assert.notEqual(fresh1.sessionId, fresh2.sessionId)
assert.ok(isWorkSessionMarker(fresh1))
assert.equal(isWorkSessionMarker({ schemaVersion: 2 }), false)
assert.equal(isWorkSessionMarker({ ...marker, schemaVersion: 1 }), false)
const candidates = compatibleWorkSessionMarkers(conversation, [marker, { ...marker, boundaryNodeId: 'absent' }])
assert.deepEqual(candidates, [marker])
const bound = { ...marker, boundConversationId: conversation.id, firstNodeId: 'node-3', latestEndNodeId: 'node-4' }
assert.equal(buildWorkSegment(conversation, bound).rootcellar_work_segment.session_id, marker.sessionId)
assert.equal(compatibleWorkSessionMarkers({ ...conversation, id: 'sibling-conversation' }, [bound]).length, 0)
process.stdout.write('PASS: Work segment graph, provenance, identity, snapshot and isolation regressions\n')
