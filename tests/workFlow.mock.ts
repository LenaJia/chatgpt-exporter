import type { ApiConversationWithId } from '../src/api'

export const state = {
    conversation: null as unknown as ApiConversationWithId,
    urlId: 'child' as string | null,
    started: true,
    temporary: false,
    fetches: 0,
    duringFetch: () => {},
    downloads: [] as Array<{ name: string; content: string }>,
}
export function getChatIdFromUrl() {
    return state.urlId
}
export function checkIfConversationStarted() {
    return state.started
}
export function isTemporaryChat() {
    return state.temporary
}
export async function fetchConversation(id: string, replaceAssets: boolean) {
    if (id !== state.conversation.id || replaceAssets) throw new Error('Wrong fetch target or asset mutation')
    state.fetches++
    state.duringFetch()
    return structuredClone(state.conversation)
}
export function downloadFile(name: string, _type: string, content: string) {
    state.downloads.push({ name, content })
}
