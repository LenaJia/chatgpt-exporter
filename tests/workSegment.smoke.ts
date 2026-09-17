import assert from 'node:assert/strict'
import {
    buildWorkSegment,
    buildWorkSegmentFileName,
    createRetroactiveWorkSessionMarker,
    currentPathNodeIds,
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
    schemaVersion: 1,
    sessionId: 'ws-20260917-parent-node2',
    goal: 'Root Cellar continuity',
    sourceConversationId: 'conversation-parent',
    sourceTitle: 'Main｜Backyard',
    boundaryNodeId: 'node-2',
    boundaryMessageId: 'message-node-2',
    markedAt: '2026-09-17T10:00:00.000Z',
}

assert.deepEqual(currentPathNodeIds(conversation), ['node-0', 'node-1', 'node-2', 'node-3', 'node-4'])

const segment = buildWorkSegment(conversation, marker, '2026-09-17T12:00:00.000Z')
assert.deepEqual(Object.keys(segment.mapping), ['node-2', 'node-3', 'node-4'])
assert.equal(segment.mapping['node-2'].message, undefined)
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
assert.match(buildWorkSegmentFileName(marker), /^work-session_Root-Cellar-continuity_20260917_ws-20260917-parent-node2\.json$/)
