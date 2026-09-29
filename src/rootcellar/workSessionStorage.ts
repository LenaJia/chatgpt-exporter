import { GM_getValue, GM_setValue } from 'vite-plugin-monkey/dist/client'
import { compatibleWorkSessionMarkers, isWorkSessionMarker } from './workSegment'
import type { WorkSessionMarker } from './workSegment'
import type { ApiConversationWithId } from '../api'

// Preserve v1 bytes; its ambiguous provenance requires explicit recovery into v2.
const KEY = 'rootcellar:work_session_markers:v2'

export function loadWorkSessionMarkers(): WorkSessionMarker[] {
    if (typeof GM_getValue !== 'function' || typeof GM_setValue !== 'function') throw new Error('Persistent userscript storage is unavailable. Install in Tampermonkey; no in-memory marker will be used.')
    const raw = GM_getValue<unknown>(KEY, null)
    if (raw === null) return []
    if (typeof raw !== 'string') throw new Error('Work marker storage has an invalid encoding; it will not be overwritten.')
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value) || !value.every(isWorkSessionMarker)) throw new Error('Work marker storage is invalid. Back it up before repairing; it will not be overwritten.')
    return value
}

export function saveWorkSessionMarker(marker: WorkSessionMarker): void {
    if (!isWorkSessionMarker(marker)) throw new Error('Invalid Work marker.')
    const markers = loadWorkSessionMarkers().filter(item => item.sessionId !== marker.sessionId)
    markers.push(marker)
    GM_setValue(KEY, JSON.stringify(markers))
    if (JSON.stringify(loadWorkSessionMarkers()) !== JSON.stringify(markers)) throw new Error('Work marker persistence could not be verified.')
}

export function findCompatibleWorkSessionMarkers(conversation: ApiConversationWithId): WorkSessionMarker[] {
    return compatibleWorkSessionMarkers(conversation, loadWorkSessionMarkers())
}
