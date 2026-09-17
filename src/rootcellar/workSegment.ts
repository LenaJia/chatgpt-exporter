import sanitize from 'sanitize-filename'
import type { ApiConversationWithId, ConversationNode } from '../api'

export interface WorkSessionMarker {
    schemaVersion: 2
    sessionId: string
    goal: string
    sourceConversationId: string
    sourceTitle: string
    parentConversationId: string | null
    boundaryNodeId: string
    boundaryMessageId: string | null
    markedAt: string
    markerBasis: 'explicit_boundary' | 'retroactive_user_match'
    boundConversationId?: string
    firstNodeId?: string
    latestEndNodeId?: string
    latestDownloadRequestedAt?: string
}

export function isWorkSessionMarker(value: unknown): value is WorkSessionMarker {
    if (!value || typeof value !== 'object') return false
    const m = value as WorkSessionMarker
    return m.schemaVersion === 2
        && ['sessionId', 'goal', 'sourceConversationId', 'sourceTitle', 'boundaryNodeId', 'markedAt']
            .every(key => typeof m[key as keyof WorkSessionMarker] === 'string' && String(m[key as keyof WorkSessionMarker]).trim().length > 0)
        && /^ws-[0-9a-f-]{36}$/i.test(m.sessionId)
        && Number.isFinite(Date.parse(m.markedAt))
        && (m.parentConversationId === null || typeof m.parentConversationId === 'string')
        && (m.boundaryMessageId === null || typeof m.boundaryMessageId === 'string')
        && ['explicit_boundary', 'retroactive_user_match'].includes(m.markerBasis)
        && ['boundConversationId', 'firstNodeId', 'latestEndNodeId', 'latestDownloadRequestedAt']
            .every(key => m[key as keyof WorkSessionMarker] === undefined || typeof m[key as keyof WorkSessionMarker] === 'string')
}

export function currentPathNodeIds(conversation: ApiConversationWithId): string[] {
    if (!conversation.id || !conversation.current_node || !conversation.mapping) throw new Error('Conversation identity or current path is missing.')
    const path: string[] = []
    const visited = new Set<string>()
    let nodeId: string | undefined = conversation.current_node
    while (nodeId) {
        if (visited.has(nodeId)) throw new Error(`Conversation ancestry contains a cycle at ${nodeId}.`)
        visited.add(nodeId)
        const node: ConversationNode | undefined = Object.hasOwn(conversation.mapping, nodeId) ? conversation.mapping[nodeId] : undefined
        if (!node || node.id !== nodeId) throw new Error(`Conversation ancestry references missing or mismatched node ${nodeId}.`)
        if (node.parent != null && (typeof node.parent !== 'string' || !node.parent)) throw new Error('Invalid parent locator.')
        path.push(nodeId)
        nodeId = node.parent
    }
    return path.reverse()
}

export function messageText(node: ConversationNode): string {
    const content = node.message?.content
    const parts = content && 'parts' in content ? content.parts : null
    if (!Array.isArray(parts)) return ''
    return parts.map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
        return ''
    }).join('\n')
}

export function createWorkSessionMarker(conversation: ApiConversationWithId, goal: string): WorkSessionMarker {
    currentPathNodeIds(conversation)
    if (!goal.trim()) throw new Error('Work goal cannot be empty.')
    const boundary = conversation.mapping[conversation.current_node]
    return {
        schemaVersion: 2,
        sessionId: `ws-${crypto.randomUUID()}`,
        goal: goal.trim(),
        sourceConversationId: conversation.id,
        sourceTitle: conversation.title || 'ChatGPT Conversation',
        parentConversationId: conversation.id,
        boundaryNodeId: boundary.id,
        boundaryMessageId: boundary.message?.id ?? null,
        markedAt: new Date().toISOString(),
        markerBasis: 'explicit_boundary',
    }
}

export function createRetroactiveWorkSessionMarker(conversation: ApiConversationWithId, goal: string, firstMessageSnippet: string): WorkSessionMarker {
    const snippet = firstMessageSnippet.trim().toLowerCase()
    if (!snippet) throw new Error('The first Work message snippet cannot be empty.')
    const matches = currentPathNodeIds(conversation).map(id => conversation.mapping[id])
        .filter(node => node.message?.author.role === 'user' && messageText(node).toLowerCase().includes(snippet))
    if (matches.length !== 1) throw new Error('The phrase must match exactly one user message on the current path. Use a longer unique phrase.')
    const first = matches[0]
    if (!first.parent) throw new Error('The matched message has no parent boundary.')
    const marker = createWorkSessionMarker({ ...conversation, current_node: first.parent }, goal)
    return {
        ...marker,
        parentConversationId: null,
        markerBasis: 'retroactive_user_match',
        boundConversationId: conversation.id,
        firstNodeId: first.id,
    }
}

export function segmentNodeIds(conversation: ApiConversationWithId, marker: WorkSessionMarker): string[] {
    if (!isWorkSessionMarker(marker)) throw new Error('Invalid or legacy Work marker; recover the start explicitly.')
    if (marker.boundConversationId && marker.boundConversationId !== conversation.id) throw new Error('This session is bound to another Work conversation.')
    const path = currentPathNodeIds(conversation)
    const boundaryIndex = path.indexOf(marker.boundaryNodeId)
    if (boundaryIndex < 0) throw new Error('The Work boundary is not on the current conversation path.')
    if ((conversation.mapping[marker.boundaryNodeId].message?.id ?? null) !== marker.boundaryMessageId) throw new Error('The boundary message identity changed.')
    const ids = path.slice(boundaryIndex + 1)
    if (!ids.length) throw new Error('No Work messages exist after the marked boundary yet.')
    if (marker.firstNodeId && ids[0] !== marker.firstNodeId) throw new Error('The first Work node changed; recover this branch as a separate session.')
    if (marker.latestEndNodeId && !ids.includes(marker.latestEndNodeId)) throw new Error('The previously exported end is absent. This is a divergent or shortened path; recover a separate session.')
    return ids
}

export function compatibleWorkSessionMarkers(conversation: ApiConversationWithId, markers: WorkSessionMarker[]): WorkSessionMarker[] {
    currentPathNodeIds(conversation)
    return markers.filter((marker) => {
        try {
            segmentNodeIds(conversation, marker)
            return true
        }
        catch { return false }
    }).sort((a, b) => b.markedAt.localeCompare(a.markedAt))
}

export function buildWorkSegment(conversation: ApiConversationWithId, marker: WorkSessionMarker, exportedAt = new Date().toISOString(), displayTitle = `Work｜${marker.goal}`) {
    const ids = segmentNodeIds(conversation, marker)
    const first = ids[0]
    const end = ids[ids.length - 1]
    const mapping: Record<string, ConversationNode> = Object.create(null)
    mapping[marker.boundaryNodeId] = { id: marker.boundaryNodeId, children: [first] }
    ids.forEach((id, index) => {
        const node = structuredClone(conversation.mapping[id])
        node.children = index + 1 < ids.length ? [ids[index + 1]] : []
        mapping[id] = node
    })
    // Deliberate allowlist: unknown conversation-level fields can contain material outside the selected path.
    return {
        id: conversation.id,
        conversation_id: conversation.id,
        title: displayTitle.trim() || `Work｜${marker.goal}`,
        current_node: end,
        mapping,
        rootcellar_work_segment: {
            schema: 'rootcellar-work-segment-v2',
            artifact_kind: 'derived_current_path_projection',
            session_id: marker.sessionId,
            goal: marker.goal,
            display_title: displayTitle.trim() || `Work｜${marker.goal}`,
            source_conversation_id: conversation.id,
            parent_conversation_id: marker.parentConversationId,
            marker_conversation_id: marker.sourceConversationId,
            source_title: conversation.title,
            marker_basis: marker.markerBasis,
            branch_from_node_id: marker.boundaryNodeId,
            branch_from_message_id: marker.boundaryMessageId,
            start_node_id: first,
            start_message_id: mapping[first].message?.id ?? null,
            end_node_id: end,
            end_message_id: mapping[end].message?.id ?? null,
            marked_at: marker.markedAt,
            exported_at: exportedAt,
            export_mode: 'exclusive_after_boundary',
            original_mapping_node_count: Object.keys(conversation.mapping).length,
            source_path_node_count: currentPathNodeIds(conversation).length,
            segment_node_count: ids.length,
            exported_mapping_node_count: ids.length + 1,
            boundary_is_synthetic: true,
            attachments_archived: false,
            archive_status: 'unverified',
        },
    }
}

export function buildWorkSegmentFileName(marker: WorkSessionMarker, exportedAt = new Date().toISOString(), displayTitle = `Work｜${marker.goal}`): string {
    const label = sanitize(displayTitle.trim()).replace(/\s+/g, '-').slice(0, 50) || 'work-session'
    const stamp = exportedAt.replace(/[^0-9]/g, '')
    return `${label}_${marker.sessionId}_${stamp}.json`
}
