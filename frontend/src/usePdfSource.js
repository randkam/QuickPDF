import { useEffect, useMemo, useState } from 'react';

// Ref-counted object URL cache keyed by File instance.
// This prevents tearing down blob URLs during frequent mount/unmount
// (e.g. React StrictMode, drag-and-drop reorder), which can crash pdf.js.
const fileUrlCache = new WeakMap();

/**
 * usePdfSource
 * Returns a stable react-pdf `file` prop value for a given input:
 * - File -> stable blob URL (ref-counted, delayed revoke)
 * - string -> string as-is
 * - null/undefined -> null
 */
export default function usePdfSource(fileOrUrl) {
  const isFile = fileOrUrl instanceof File;

  // Stable key for string URLs; for File we derive URL from cache.
  const stringKey = useMemo(() => {
    if (typeof fileOrUrl === 'string') return fileOrUrl;
    return null;
  }, [fileOrUrl]);

  const [source, setSource] = useState(() => {
    if (!fileOrUrl) return null;
    if (typeof fileOrUrl === 'string') return fileOrUrl;
    if (fileOrUrl instanceof File) {
      const existing = fileUrlCache.get(fileOrUrl);
      return existing?.url ?? null;
    }
    return null;
  });

  useEffect(() => {
    if (!fileOrUrl) {
      setSource(null);
      return undefined;
    }

    if (typeof fileOrUrl === 'string') {
      setSource(fileOrUrl);
      return undefined;
    }

    if (!(fileOrUrl instanceof File)) {
      setSource(null);
      return undefined;
    }

    // File: get/create cached URL and ref-count it.
    let entry = fileUrlCache.get(fileOrUrl);
    const isNewEntry = !entry;
    
    if (!entry) {
      entry = { url: URL.createObjectURL(fileOrUrl), refs: 0, revokeTimer: null };
      fileUrlCache.set(fileOrUrl, entry);
    }

    entry.refs += 1;
    if (entry.revokeTimer) {
      window.clearTimeout(entry.revokeTimer);
      entry.revokeTimer = null;
    }

    // For new blob URLs, add a delay to ensure the URL is fully registered
    // before pdf.js tries to consume it. This prevents race conditions.
    if (isNewEntry) {
      // Delay for newly created URLs to stabilize (200ms for reliability)
      const timer = window.setTimeout(() => {
        setSource(entry.url);
      }, 200);
      return () => {
        window.clearTimeout(timer);
        // Handle cleanup as before
        const current = fileUrlCache.get(fileOrUrl);
        if (!current) return;

        current.refs = Math.max(0, (current.refs || 0) - 1);
        if (current.refs === 0 && !current.revokeTimer) {
          current.revokeTimer = window.setTimeout(() => {
            try {
              URL.revokeObjectURL(current.url);
            } catch {
              // ignore
            } finally {
              current.revokeTimer = null;
            }
          }, 30000);
        }
      };
    }
    
    // Existing URL, use immediately
    setSource(entry.url);

    return () => {
      // Release one ref. Revoke only after a generous delay to avoid pdf.js races.
      // If the component remounts quickly, we'll cancel the timer.
      const current = fileUrlCache.get(fileOrUrl);
      if (!current) return;

      current.refs = Math.max(0, (current.refs || 0) - 1);
      if (current.refs === 0 && !current.revokeTimer) {
        current.revokeTimer = window.setTimeout(() => {
          try {
            URL.revokeObjectURL(current.url);
          } catch {
            // ignore
          } finally {
            // Can't delete from WeakMap; it will be GC'd with the File key.
            current.revokeTimer = null;
          }
        }, 30000);
      }
    };
  }, [fileOrUrl, stringKey, isFile]);

  return source;
}

