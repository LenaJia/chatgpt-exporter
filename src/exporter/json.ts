import JSZip from 'jszip'
import { fetchConversation, getCurrentChatId, processConversation } from '../api'
import i18n from '../i18n'
import { checkIfConversationStarted } from '../page'
import {
    buildWorkSegment,
    buildWorkSegmentFileName,
    createRetroactiveWorkSessionMarker,
    createWorkSessionMarker,
} from '../rootcellar/workSegment'
import { findCompatibleWorkSessionMarker, saveWorkSessionMarker } from '../rootcellar/workSessionStorage'
import { checkIfTemporaryChatIsExportable } from '../temporaryChat'
import { convertToOoba, convertToTavern } from '../utils/conversion'
import { buildJsonBatchFileName, buildZipFileName, downloadFile, getFileNameWithFormat } from '../utils/download'
import type { ApiConversationWithId } from '../api'
import type { ExportMeta } from '../ui/SettingContext'
import type { PartInfo } from '../utils/download'

function askForWorkGoal(): string | null {
    const goal = window.prompt('Short goal for this Work session (used for the export name):')?.trim()
    return goal || null
}

export async function markWorkSegmentStart() {
    if (!checkIfConversationStarted()) {
        alert(i18n.t('Please start a conversation first'))
        return false
    }

    if (!checkIfTemporaryChatIsExportable()) {
        alert(i18n.t('Temporary chat could not be captured'))
        return false
    }

    const goal = askForWorkGoal()
    if (!goal) return false

    const chatId = await getCurrentChatId()
    const conversation = await fetchConversation(chatId, false)
    const marker = createWorkSessionMarker(conversation, goal)
    saveWorkSessionMarker(marker)
    alert(`Work start marked.\n\n${marker.sessionId}\nBoundary: ${marker.boundaryNodeId}`)
    return true
}

export async function exportWorkSegment() {
    if (!checkIfConversationStarted()) {
        alert(i18n.t('Please start a conversation first'))
        return false
    }

    if (!checkIfTemporaryChatIsExportable()) {
        alert(i18n.t('Temporary chat could not be captured'))
        return false
    }

    const chatId = await getCurrentChatId()
    const conversation = await fetchConversation(chatId, false)
    let marker = findCompatibleWorkSessionMarker(conversation)

    if (!marker) {
        const goal = askForWorkGoal()
        if (!goal) return false
        const snippet = window.prompt('No compatible Work marker was found. Paste a unique phrase from the first user message in this Work session:')?.trim()
        if (!snippet) return false

        try {
            marker = createRetroactiveWorkSessionMarker(conversation, goal, snippet)
            saveWorkSessionMarker(marker)
        }
        catch (error) {
            alert(error instanceof Error ? error.message : String(error))
            return false
        }
    }

    try {
        const segment = buildWorkSegment(conversation, marker)
        const content = JSON.stringify([segment], null, 2)
        downloadFile(buildWorkSegmentFileName(marker), 'application/json', content)
        saveWorkSessionMarker({
            ...marker,
            latestExportAt: segment.rootcellar_work_segment.exported_at,
            latestEndNodeId: segment.rootcellar_work_segment.end_node_id,
        })
        return true
    }
    catch (error) {
        alert(error instanceof Error ? error.message : String(error))
        return false
    }
}

export async function exportToJson(fileNameFormat: string) {
    if (!checkIfConversationStarted()) {
        alert(i18n.t('Please start a conversation first'))
        return false
    }

    if (!checkIfTemporaryChatIsExportable()) {
        alert(i18n.t('Temporary chat could not be captured'))
        return false
    }

    const chatId = await getCurrentChatId()
    const rawConversation = await fetchConversation(chatId, false)
    const conversation = processConversation(rawConversation)

    const fileName = getFileNameWithFormat(fileNameFormat, 'json', { title: conversation.title, chatId })
    /**
     * The official format is just an array of the API response.
     */
    const content = conversationToJson([rawConversation])
    downloadFile(fileName, 'application/json', content)

    return true
}

export async function exportToTavern(fileNameFormat: string) {
    if (!checkIfConversationStarted()) {
        alert(i18n.t('Please start a conversation first'))
        return false
    }

    if (!checkIfTemporaryChatIsExportable()) {
        alert(i18n.t('Temporary chat could not be captured'))
        return false
    }

    const chatId = await getCurrentChatId()
    const rawConversation = await fetchConversation(chatId, false)
    const conversation = processConversation(rawConversation)

    const fileName = getFileNameWithFormat(`${fileNameFormat}.tavern`, 'jsonl', { title: conversation.title, chatId })
    const content = convertToTavern(conversation)
    downloadFile(fileName, 'application/json-lines', content)

    return true
}

export async function exportToOoba(fileNameFormat: string) {
    if (!checkIfConversationStarted()) {
        alert(i18n.t('Please start a conversation first'))
        return false
    }

    if (!checkIfTemporaryChatIsExportable()) {
        alert(i18n.t('Temporary chat could not be captured'))
        return false
    }

    const chatId = await getCurrentChatId()
    const rawConversation = await fetchConversation(chatId, false)
    const conversation = processConversation(rawConversation)

    const fileName = getFileNameWithFormat(`${fileNameFormat}.ooba`, 'json', { title: conversation.title, chatId })
    const content = convertToOoba(conversation)
    downloadFile(fileName, 'application/json', content)

    return true
}

export async function exportAllToOfficialJson(_fileNameFormat: string, apiConversations: ApiConversationWithId[], _metaList?: ExportMeta[], projectName?: string, partIndex?: number, totalParts?: number) {
    const partInfo: PartInfo | undefined = (partIndex != null && totalParts != null)
        ? { part: partIndex, total: totalParts }
        : undefined
    const content = conversationToJson(apiConversations)
    downloadFile(buildJsonBatchFileName(projectName, partInfo), 'application/json', content)

    return true
}

export async function exportAllToJson(fileNameFormat: string, apiConversations: ApiConversationWithId[], _metaList?: ExportMeta[], projectName?: string, partIndex?: number, totalParts?: number) {
    const zip = new JSZip()
    const filenameMap = new Map<string, number>()
    const conversations = apiConversations.map(x => ({
        conversation: processConversation(x),
        rawConversation: x,
    }))
    conversations.forEach(({ conversation, rawConversation }) => {
        let fileName = getFileNameWithFormat(fileNameFormat, 'json', {
            title: conversation.title,
            chatId: conversation.id,
            createTime: conversation.createTime,
            updateTime: conversation.updateTime,
        })
        if (filenameMap.has(fileName)) {
            const count = filenameMap.get(fileName) ?? 1
            filenameMap.set(fileName, count + 1)
            fileName = `${fileName.slice(0, -5)} (${count}).json`
        }
        else {
            filenameMap.set(fileName, 1)
        }
        const content = conversationToJson(rawConversation)
        zip.file(fileName, content)
    })

    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 9,
        },
    })
    const partInfo: PartInfo | undefined = (partIndex != null && totalParts != null)
        ? { part: partIndex, total: totalParts }
        : undefined
    downloadFile(buildZipFileName('json', projectName, partInfo), 'application/zip', blob)

    return true
}

function conversationToJson(conversation: ApiConversationWithId | ApiConversationWithId[]) {
    return JSON.stringify(conversation)
}
