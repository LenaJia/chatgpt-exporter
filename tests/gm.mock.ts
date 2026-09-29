export const values = new Map<string, unknown>()
let failWrites = false
export function setFailWrites(value: boolean) {
    failWrites = value
}
export function GM_getValue<T>(key: string, fallback: T): T {
    return (values.has(key) ? values.get(key) : fallback) as T
}
export function GM_setValue(key: string, value: unknown) {
    if (failWrites) throw new Error('storage unavailable')
    values.set(key, value)
}
