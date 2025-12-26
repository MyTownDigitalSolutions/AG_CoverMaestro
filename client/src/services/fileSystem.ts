
// Basic types for File System Access API
// These might be available in newer DOM libs, but defining them ensures safety
interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
    queryPermission(descriptor?: RequestPermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: RequestPermissionDescriptor): Promise<PermissionState>;
}

interface RequestPermissionDescriptor {
    mode?: 'read' | 'readwrite';
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory';
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
    getFile(): Promise<File>;
}

interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
    close(): Promise<void>;
}

declare global {
    interface Window {
        showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle }): Promise<FileSystemDirectoryHandle>;
    }
}

// DB Config
const DB_NAME = 'CoverMaestroDB';
const STORE_NAME = 'settings';
const HANDLE_KEY = 'export_base_dir_handle';

// --- IndexedDB Helpers ---

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
        req.onerror = () => reject(req.error);
    });
}

// --- File System Logic ---

export async function pickBaseDirectory(): Promise<FileSystemDirectoryHandle> {
    console.log("[EXPORT][FS] pickBaseDirectory: entered");
    console.trace("[EXPORT][FS] pickBaseDirectory stack");
    const handle = await window.showDirectoryPicker({
        id: 'cover_maestro_export',
        mode: 'readwrite'
    });
    // Persist immediately upon successful pick
    await persistHandle(handle);
    return handle;
}

export async function verifyPermission(handle: FileSystemDirectoryHandle, readWrite: boolean = true): Promise<boolean> {
    const options: RequestPermissionDescriptor = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }

    // Check if permission already granted
    if ((await handle.queryPermission(options)) === 'granted') {
        return true;
    }

    // Request permission
    if ((await handle.requestPermission(options)) === 'granted') {
        return true;
    }

    return false;
}

// Helper to strictly sanitize a folder or file name segment for Windows
export function sanitizePathSegment(segment: string): string {
    // 1. Trim whitespace
    let safe = segment.trim();

    // 2. Replace illegal chars with _
    // Illegal: < > : " / \ | ? * and ..
    safe = safe.replace(/[<>:"/\\|?*]/g, '_');

    // 3. Remove trailing dots (Windows issue)
    safe = safe.replace(/\.+$/, '');

    // 4. Ensure not empty
    if (!safe) return '_';

    // 5. Check reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reserved.test(safe)) {
        return '_' + safe;
    }

    return safe;
}

// Ensure a subpath exists relative to the base handle
// pathParts: e.g. ["Manufacturer", "Series"]
export async function ensureSubdirectory(baseHandle: FileSystemDirectoryHandle, pathParts: string[]): Promise<FileSystemDirectoryHandle> {
    let currentHandle = baseHandle;
    for (const part of pathParts) {
        const safePart = sanitizePathSegment(part);
        currentHandle = await currentHandle.getDirectoryHandle(safePart, { create: true });
    }
    return currentHandle;
}

export async function writeFile(dirHandle: FileSystemDirectoryHandle, filename: string, blob: Blob): Promise<void> {
    const safeName = filename.replace(/[<>:"/|?*]/g, '');
    const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

export async function writeFileAtomic(dirHandle: FileSystemDirectoryHandle, filename: string, blob: Blob): Promise<{ warning?: string }> {
    const safeName = filename.replace(/[<>:"/|?*]/g, '');
    const tmpName = `${safeName}.tmp`;

    // 1. Write to tmp file first to ensure we can write successfully
    try {
        const tmpHandle = await dirHandle.getFileHandle(tmpName, { create: true });
        const writable = await tmpHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch (e: any) {
        throw new Error(`Temp file write failed: ${e.message || e}`);
    }

    // 2. Overwrite final file
    try {
        const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch (e: any) {
        throw new Error(`Final file write failed: ${e.message || e}`);
    }

    // 3. Cleanup tmp
    try {
        await dirHandle.removeEntry(tmpName);
    } catch (e: any) {
        console.warn("Failed to remove temp file", e);
        return { warning: `Write successful, but failed to remove temporary file (${tmpName}).` };
    }

    return {};
}

export async function clearPersistedHandle(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

/**
 * Robustly gets a write-ready directory handle.
 * 1. Checks provided handle or loads persisted one.
 * 2. Verifies/Requests permission.
 * 3. Coping with failure/rejection/missing: Prompts user to pick new folder.
 */
export async function getOrPickWritableBaseDirectory(currentHandle?: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
    let handle = currentHandle || await loadHandle();

    // If we have a potential handle, try to verify/request permission
    if (handle) {
        if (await verifyPermission(handle, true)) {
            return handle;
        }
        // Permission denied or revoked, fall through to re-pick
    }

    // No handle or permission denied -> Pick new
    // This will throw if user cancels, which is expected flow control
    handle = await pickBaseDirectory();

    // Validate the new one just in case
    if (await verifyPermission(handle, true)) {
        return handle;
    }

    throw new Error("Permission denied for the selected folder.");
}
