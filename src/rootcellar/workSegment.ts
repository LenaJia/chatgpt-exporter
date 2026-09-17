import sanitize from 'sanitize-filename'
import type { ApiConversationWithId, ConversationNode } from '../api'

const SCHEMA_VERSION = 1 as const

export interface WorkSessionMarker {
    schemaVersion: typeof SCHEMA_VERSION
    sessionId: string
    goal: string
    sourceConversationId: string
    sourceTitle: string
    boundaryNodeId: string
    boundaryMessageId: string | null
    markedAt: string
    latestExportAt?: string
    latestEndNodeId?: string
}

export interface RootCellarWorkSegmentMetadata {
    schema: 'rootcellar-work-segment-v1'
    session_id: string
    goal: string
    display_title: string
    source_conversation_id: string
    parent_conversation_id: string
    source_title: string
    branch_from_node_id: string
    branch_from_message_id: string | null
    start_node_id: string
    start_message_id: string | null
    end_node_id: string
    end_message_id: string | null
    marked_at: string
    exported_at: string
    export_mode: 'exclusive_after_boundary'
    original_mapping_node_count: number
    source_path_node_count: number
    segment_node_count: number
    exported_mapping_node_count: number
}

export type RootCellarWorkSegment = ApiConversationWithId & {
    rootcellar_work_segment: RootCellarWorkSegmentMetadata
}

function compactId(value: string): string {
    return value.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() || 'unknown'
}

function markerDate(isoDate: string): string {
    return isoDate.slice(0, 10).replaceAll('-', '')
}

export function goalSlug(goal: string): string {
    return sanitize(goal.trim())
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'work-session'
}

export function createWorkSessionMarker(conversation: ApiConversationWithId, goal: string): WorkSessionMarker {
    const markedAt = new Date().toISOString()
    const boundaryNode = conversation.mapping[conversation.current_node]
    if (!boundaryNode) throw new Error('The current conversation node is missing from the mapping.')

    return {
        schemaVersion: SCHEMA_VERSION,
        sessionId: `ws-${markerDate(markedAt)}-${compactId(conversation.id)}-${compactId(boundaryNode.id)}`,
        goal: goal.trim(),
        sourceConversationId: conversation.id,
        sourceTitle: conversation.title || 'ChatGPT Conversation',
        boundaryNodeId: boundaryNode.id,
        boundaryMessageId: boundaryNode.message?.id ?? null,
        markedAt,
    }
}

export function currentPathNodeIds(conversation: ApiConversationWithId): string[] {
    const path: string[] = []
    const visited = new Set<string>()
    let nodeId: string | undefined = conversation.current_node

    while (nodeId) {
        if (visited.has(nodeId)) throw new Error(`Conversation ancestry contains a cycle at ${nodeId}.`)
        visited.add(nodeId)

        const node: ConversationNode | undefined = conversation.mapping[nodeId]
        if (!node) throw new Error(`Conversation ancestry references missing node ${nodeId}.`)
        path.unshift(nodeId)
        nodeId = node.parent
    }

    return path
}

function messageText(node: ConversationNode): string {
    const content = node.message?.content
    const parts = content && 'parts' in content ? content.parts : null
    if (!Array.isArray(parts)) return ''
    return parts.map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
        return ''
    }).join('\n')
}

export function createRetroactiveWorkSessionMarker(
    conversation: ApiConversationWithId,
    goal: string,
    firstMessageSnippet: string,
): WorkSessionMarker {
    const snippet = firstMessageSnippet.trim().toLowerCase()
    if (!snippet) throw new Error('The first Work message snippet cannot be empty.')

    const matches = currentPathNodeIds(conversation)
        .map(nodeId => conversation.mapping[nodeId])
        .filter(node => node.message?.author.role === 'user' && messageText(node).toLowerCase().includes(snippet))

    if (matches.length === 0) throw new Error('No user message on the current path matches that snippet.')
    if (matches.length > 1) throw new Error('That snippet matches more than one user message. Please use a longer, unique phrase.')

    const firstWorkNode = matches[0]
    if (!firstWorkNode.parent) throw new Error('The matched message has no parent boundary.')
    const boundaryNode = conversation.mapping[firstWorkNode.parent]
    if (!boundaryNode) throw new Error('The matched message points to a missing parent boundary.')

    const markedAt = firstWorkNode.message?.create_time
        ? new Date(firstWorkNode.message.create_time * 1000).toISOString()
        : new Date().toISOString()

    return {
        schemaVersion: SCHEMA_VERSION,
        sessionId: `ws-${markerDate(markedAt)}-${compactId(conversation.id)}-${compactId(boundaryNode.id)}`,
        goal: goal.trim(),
        sourceConversationId: conversation.id,
        sourceTitle: conversation.title || 'ChatGPT Conversation',
        boundaryNodeId: boundaryNode.id,
        boundaryMessageId: boundaryNode.message?.id ?? null,
        markedAt,
    }
}

function cloneNode(node: ConversationNode): ConversationNode {
    return JSON.parse(JSON.stringify(node)) as ConversationNode
}

export function buildWorkSegment(
    conversation: ApiConversationWithId,
    marker: WorkSessionMarker,
    exportedAt = new Date().toISOString(),
): RootCellarWorkSegment {
    const path = currentPathNodeIds(conversation)
    const boundaryIndex = path.indexOf(marker.boundaryNodeId)
    if (boundaryIndex < 0) throw new Error('The Work boundary is not on the current conversation path.')

    const segmentNodeIds = path.slice(boundaryIndex + 1)
    if (segmentNodeIds.length === 0) throw new Error('No Work messages exist after the marked boundary yet.')

    const firstNodeId = segmentNodeIds[0]
    const endNodeId = segmentNodeIds[segmentNodeIds.length - 1]
    const mapping: Record<string, ConversationNode> = {
        [marker.boundaryNodeId]: {
            id: marker.boundaryNodeId,
            children: [firstNodeId],
        },
    }

    segmentNodeIds.forEach((nodeId, index) => {
        const node = cloneNode(conversation.mapping[nodeId])
        node.parent = index === 0 ? marker.boundaryNodeId : segmentNodeIds[index - 1]
        node.children = index === segmentNodeIds.length - 1 ? [] : [segmentNodeIds[index + 1]]
        mapping[nodeId] = node
    })

    const displayTitle = `Work｜${marker.goal}`
    const metadata: RootCellarWorkSegmentMetadata = {
        schema: 'rootcellar-work-segment-v1',
        session_id: marker.sessionId,
        goal: marker.goal,
        display_title: displayTitle,
        source_conversation_id: conversation.id,
        parent_conversation_id: marker.sourceConversationId,
        source_title: conversation.title || 'ChatGPT Conversation',
        branch_from_node_id: marker.boundaryNodeId,
        branch_from_message_id: marker.boundaryMessageId,
        start_node_id: firstNodeId,
        start_message_id: conversation.mapping[firstNodeId]?.message?.id ?? null,
        end_node_id: endNodeId,
        end_message_id: conversation.mapping[endNodeId]?.message?.id ?? null,
        marked_at: marker.markedAt,
        exported_at: exportedAt,
        export_mode: 'exclusive_after_boundary',
        original_mapping_node_count: Object.keys(conversation.mapping).length,
        source_path_node_count: path.length,
        segment_node_count: segmentNodeIds.length,
        exported_mapping_node_count: Object.keys(mapping).length,
    }

    return {
        ...conversation,
        title: displayTitle,
        mapping,
        current_node: endNodeId,
        rootcellar_work_segment: metadata,
    }
}

export function buildWorkSegmentFileName(marker: WorkSessionMarker): string {
    return `work-session_${goalSlug(marker.goal)}_${markerDate(marker.markedAt)}_${marker.sessionId}.json`
}
