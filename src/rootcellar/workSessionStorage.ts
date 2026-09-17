import { KEY_ROOTCELLAR_WORK_SESSION_MARKERS } from '../constants'
import { ScriptStorage } from '../utils/storage'
import { currentPathNodeIds } from './workSegment'
import type { WorkSessionMarker } from './workSegment'
import type { ApiConversationWithId } from '../api'

const MAX_MARKERS = 50

export function loadWorkSessionMarkers(): WorkSessionMarker[] {
    const value = ScriptStorage.get<WorkSessionMarker[]>(KEY_ROOTCELLAR_WORK_SESSION_MARKERS)
    if (!Array.isArray(value)) return []
    return value.filter(marker => marker?.schemaVersion === 1)
}

export function saveWorkSessionMarker(marker: WorkSessionMarker): void {
    const markers = loadWorkSessionMarkers().filter(item => item.sessionId !== marker.sessionId)
    markers.push(marker)
    markers.sort((a, b) => a.markedAt.localeCompare(b.markedAt))
    ScriptStorage.set(KEY_ROOTCELLAR_WORK_SESSION_MARKERS, markers.slice(-MAX_MARKERS))
}

export function findCompatibleWorkSessionMarker(conversation: ApiConversationWithId): WorkSessionMarker | null {
    const path = new Set(currentPathNodeIds(conversation))
    const compatible = loadWorkSessionMarkers()
        .filter(marker => path.has(marker.boundaryNodeId))
        .sort((a, b) => {
            const recencyDelta = b.markedAt.localeCompare(a.markedAt)
            if (recencyDelta) return recencyDelta
            return Number(b.sourceConversationId === conversation.id)
                - Number(a.sourceConversationId === conversation.id)
        })
    return compatible[0] ?? null
}
