// ===========================================
// SVAKS Offline Sync Queue
// When offline, queue data mutations in localStorage.
// When back online (or background sync fires), replay them.
// ===========================================

const QUEUE_KEY = 'svaks_offline_queue';

/**
 * Get all queued operations from localStorage.
 * @returns {array} Array of { id, type, payload, timestamp }
 */
export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save the queue back to localStorage.
 * @param {array} queue
 */
function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[SVAKS Queue] Failed to save queue:', e);
  }
}

/**
 * Add an operation to the offline queue.
 * @param {object} op - { type: 'save', payload: <full data object> }
 * @returns {number} new queue length
 */
export function enqueue(op) {
  const queue = getQueue();
  const newOp = {
    id: Date.now() + Math.random(),
    type: op.type || 'save',
    payload: op.payload,
    timestamp: new Date().toISOString()
  };
  queue.push(newOp);
  saveQueue(queue);
  console.log('[SVAKS Queue] Enqueued op, total pending:', queue.length);
  return queue.length;
}

/**
 * Remove an operation from the queue (after successful sync).
 * @param {number|string} id
 */
export function dequeue(id) {
  const queue = getQueue();
  const filtered = queue.filter(op => op.id !== id);
  saveQueue(filtered);
  return filtered;
}

/**
 * Clear the entire queue (use with caution).
 */
export function clearQueue() {
  saveQueue([]);
}

/**
 * Get the count of pending operations.
 */
export function getPendingCount() {
  return getQueue().length;
}

/**
 * Replay all queued operations by calling the provided sync function
 * for each queued item.
 *
 * @param {function} syncFn - async function(payload) => boolean (true = success)
 * @returns {Promise<{success: number, failed: number, total: number}>}
 */
export async function replayQueue(syncFn) {
  const queue = getQueue();
  if (queue.length === 0) {
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(`[SVAKS Queue] Replaying ${queue.length} queued operations...`);
  let success = 0;
  let failed = 0;

  for (const op of queue) {
    try {
      const result = await syncFn(op.payload);
      if (result) {
        dequeue(op.id);
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error('[SVAKS Queue] Replay failed for op', op.id, e);
      failed++;
    }
  }

  console.log(`[SVAKS Queue] Replay complete: ${success} success, ${failed} failed`);
  return { success, failed, total: queue.length };
}
