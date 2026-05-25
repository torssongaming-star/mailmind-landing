import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { acquireLock, releaseLock, acquireLockWaiting, withLock } from './redis-lock';

describe('redis-lock (in-memory fallback)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('acquires and releases a lock', async () => {
    const token = await acquireLock('test-key', 5000);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    // Second acquire should fail
    const token2 = await acquireLock('test-key', 5000);
    expect(token2).toBeNull();

    // Release the lock
    await releaseLock('test-key', token as string);

    // Should be able to acquire again
    const token3 = await acquireLock('test-key', 5000);
    expect(token3).toBeTruthy();
    expect(token3).not.toBe(token);
  });

  it('auto-expires locks', async () => {
    const token = await acquireLock('test-expire', 100);
    expect(token).toBeTruthy();

    const token2 = await acquireLock('test-expire', 100);
    expect(token2).toBeNull();

    // Advance time past TTL
    vi.advanceTimersByTime(150);

    const token3 = await acquireLock('test-expire', 100);
    expect(token3).toBeTruthy();
  });

  it('acquireLockWaiting waits and retries', async () => {
    const p1Token = await acquireLock('wait-key', 5000);
    expect(p1Token).toBeTruthy();

    // Run waiting lock concurrently
    const p2Promise = acquireLockWaiting('wait-key', 5000, 2000, 100);
    
    // Immediately, it shouldn't be resolved
    vi.advanceTimersByTime(50);
    
    // Release the original lock
    await releaseLock('wait-key', p1Token as string);
    
    // Advance time for the interval to tick
    vi.advanceTimersByTime(100);
    
    const p2Token = await p2Promise;
    expect(p2Token).toBeTruthy();
    expect(p2Token).not.toBe(p1Token);
  });

  it('withLock runs the function and releases the lock', async () => {
    let executed = false;
    const result = await withLock('with-lock-key', 5000, async () => {
      executed = true;
      return 'success';
    });
    
    expect(executed).toBe(true);
    expect(result).toBe('success');

    // Lock should be released, we can acquire it immediately
    const token = await acquireLock('with-lock-key', 5000);
    expect(token).toBeTruthy();
  });

  it('withLock releases lock even if function throws', async () => {
    await expect(withLock('with-lock-throw', 5000, async () => {
      throw new Error('Test error');
    })).rejects.toThrow('Test error');

    // Lock should be released
    const token = await acquireLock('with-lock-throw', 5000);
    expect(token).toBeTruthy();
  });
});
