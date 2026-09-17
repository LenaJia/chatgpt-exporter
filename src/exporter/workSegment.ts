import { fetchConversation } from '../api'
import { checkIfConversationStarted, getChatIdFromUrl, isTemporaryChat } from '../page'
import { buildWorkSegment, buildWorkSegmentFileName, createRetroactiveWorkSessionMarker, createWorkSessionMarker, messageText } from '../rootcellar/workSegment'
import { findCompatibleWorkSessionMarkers, saveWorkSessionMarker } from '../rootcellar/workSessionStorage'
import { downloadFile } from '../utils/download'

function askForWorkGoal(): string | null {
    const goal = window.prompt('本次 Work 的简短目标 / Short Work goal:')?.trim()
    return goal || null
}

let workActionBusy = false

async function runWorkAction(action: () => Promise<boolean>) {
    if (workActionBusy) return false
    workActionBusy = true
    try {
        return await action()
    }
    catch (error) {
        alert(error instanceof Error ? error.message : String(error))
        return false
    }
    finally { workActionBusy = false }
}

async function fetchWorkConversation() {
    const chatId = getChatIdFromUrl()
    if (!chatId || location.pathname.startsWith('/share') || isTemporaryChat()) throw new Error('Work markers require a saved conversation URL, not a new, shared or temporary chat. Wait for its /c/ URL.')
    const conversation = await fetchConversation(chatId, false)
    await verifyWorkLocation(chatId)
    return { chatId, conversation }
}

async function verifyWorkLocation(chatId: string) {
    if (getChatIdFromUrl() !== chatId || location.pathname.startsWith('/share') || isTemporaryChat()) throw new Error('The conversation changed while loading. Please retry in the intended window.')
}

export function markWorkSegmentStart() {
    return runWorkAction(markWorkSegmentStartInner)
}

async function markWorkSegmentStartInner() {
    if (!checkIfConversationStarted()) {
        alert('请先开始对话 / Please start a conversation first')
        return false
    }

    const goal = askForWorkGoal()
    if (!goal) return false

    const { chatId, conversation } = await fetchWorkConversation()
    const marker = createWorkSessionMarker(conversation, goal)
    const preview = messageText(conversation.mapping[marker.boundaryNodeId]).slice(0, 300)
    if (!window.confirm(`确认切出点 / Confirm boundary\n${conversation.title}\n${marker.boundaryNodeId}\n${preview}\n\n这条消息不包含在 Work 导出中。仅导出之后的当前路径。请等待回复生成结束再标记。`)) return false
    await verifyWorkLocation(chatId)
    saveWorkSessionMarker(marker)
    alert(`Work start marked.\n\n${marker.sessionId}\nBoundary: ${marker.boundaryNodeId}`)
    return true
}

export function exportWorkSegment() {
    return runWorkAction(exportWorkSegmentInner)
}

async function exportWorkSegmentInner() {
    if (!checkIfConversationStarted()) {
        alert('请先开始对话 / Please start a conversation first')
        return false
    }

    const { chatId, conversation } = await fetchWorkConversation()
    const candidates = findCompatibleWorkSessionMarkers(conversation)
    let marker
    if (candidates.length) {
        const choice = window.prompt(`选择本次 Work，不能仅凭祖先节点自动判定。\nSelect session, or 0 to recover a different start:\n${candidates.map((item, index) => `${index + 1}. ${item.goal} | ${item.markedAt} | ${item.sessionId}`).join('\n')}`, '')
        if (choice === null) return false
        if (!/^\d+$/.test(choice.trim()) || Number(choice) > candidates.length) throw new Error('Invalid session selection.')
        if (Number(choice) > 0) marker = candidates[Number(choice) - 1]
    }

    if (!marker) {
        const goal = askForWorkGoal()
        if (!goal) return false
        const snippet = window.prompt('No compatible Work marker was found. Paste a unique phrase from the first user message in this Work session:')?.trim()
        if (!snippet) return false

        try {
            marker = createRetroactiveWorkSessionMarker(conversation, goal, snippet)
        }
        catch (error) {
            alert(error instanceof Error ? error.message : String(error))
            return false
        }
    }

    try {
        const displayTitle = window.prompt('导出显示名（可与窗口一致，例如 W02｜根窖接线）/ Export label:', `Work｜${marker.goal}`)?.trim()
        if (!displayTitle) return false
        const segment = buildWorkSegment(conversation, marker, new Date().toISOString(), displayTitle)
        const meta = segment.rootcellar_work_segment
        const first = segment.mapping[meta.start_node_id]
        const last = segment.mapping[meta.end_node_id]
        if (!window.confirm(`${displayTitle}\n${marker.sessionId}\n源窗口 / Source: ${conversation.title}\n父窗口 / Parent: ${meta.parent_conversation_id ?? 'unknown（未核验）'}\n节点 / Nodes: ${meta.segment_node_count}\n\nSTART ${meta.start_node_id}\n${messageText(first).slice(0, 350)}\n\nEND ${meta.end_node_id}\n${messageText(last).slice(0, 350)}\n\n仅为当前路径的派生快照，不含兄弟分支；附件未归档。请核对首尾并确认回复已结束。继续下载？`)) return false
        await verifyWorkLocation(chatId)
        // Persist identity/binding before requesting a download, not an archive acknowledgement.
        saveWorkSessionMarker({ ...marker, boundConversationId: conversation.id, firstNodeId: meta.start_node_id })
        const content = JSON.stringify([segment], null, 2)
        downloadFile(buildWorkSegmentFileName(marker, meta.exported_at, displayTitle), 'application/json', content)
        saveWorkSessionMarker({
            ...marker,
            boundConversationId: conversation.id,
            firstNodeId: meta.start_node_id,
            latestDownloadRequestedAt: meta.exported_at,
            latestEndNodeId: meta.end_node_id,
        })
        alert('下载已请求；请检查文件。浏览器下载不等于根窖已归档。可重复导出整段 Work，不会推进归档游标。')
        return true
    }
    catch (error) {
        alert(error instanceof Error ? error.message : String(error))
        return false
    }
}
