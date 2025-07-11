// src/lib/customIdManager.ts
// Centralized utility for creating and parsing structured custom IDs.
// Format: "namespace:action:arg1:arg2:..."

type CustomIdNamespace = 'archive' | 'delete';

/**
 * Creates a structured custom ID string.
 * @param namespace A high-level identifier for the component's domain.
 * @param action The specific action this component triggers.
 * @param args Additional data to be encoded in the ID.
 * @returns A formatted custom ID string.
 */
function createId(namespace: CustomIdNamespace, action: string, ...args: (string | number | undefined)[]): string {
    return [namespace, action, ...args.filter(arg => arg !== undefined)].join(':');
}

/**
 * Parses a structured custom ID string.
 * @param customId The custom ID string from an interaction.
 * @returns An object containing the namespace, action, and any arguments.
 */
export function parseId(customId: string) {
    const [namespace, action, ...args] = customId.split(':');
    return { namespace, action, args };
}

// --- Archive Session Manager IDs ---
export function createArchiveButtonId(
    action: 'force' | 'confirm' | 'ignore' | 'add',
    messageId: string,
    day?: number,
): string {
    return createId('archive', action, messageId, day);
}

export function createArchiveModalId(action: 'submitDayInfo', messageId: string): string {
    return createId('archive', action, messageId);
}

// --- Delete Confirmation IDs ---
export function createDeleteButtonId(action: 'confirm' | 'cancel', messageId: string): string {
    return createId('delete', action, messageId);
}