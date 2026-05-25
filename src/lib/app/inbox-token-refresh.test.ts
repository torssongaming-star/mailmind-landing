import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getValidAccessTokenLocked } from './inbox-token-refresh';
import { db } from '@/lib/db';
import * as threadsModule from './threads';

// Mock DB and external dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
  inboxes: {
    config: 'mocked_config',
    id: 'mocked_id',
  },
}));

vi.mock('./threads', () => ({
  updateInboxConfig: vi.fn(),
}));

describe('inbox-token-refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockHooks = {
    decrypt: vi.fn((encrypted) => JSON.parse(encrypted)),
    encrypt: vi.fn((tokens) => JSON.stringify(tokens)),
    refresh: vi.fn(),
    isExpired: vi.fn(), // optional, but we mock it for control
  };

  it('fast path: returns tokens if not expired', async () => {
    const validTokens = { accessToken: 'valid_token', expiresAt: Date.now() + 100000 };
    mockHooks.decrypt.mockReturnValueOnce(validTokens);
    mockHooks.isExpired.mockReturnValueOnce(false);

    const result = await getValidAccessTokenLocked(
      'inbox-1',
      { encryptedTokens: JSON.stringify(validTokens) },
      mockHooks
    );

    expect(result.accessToken).toBe('valid_token');
    expect(result.refreshed).toBe(false);
    expect(mockHooks.refresh).not.toHaveBeenCalled();
    expect(threadsModule.updateInboxConfig).not.toHaveBeenCalled();
  });

  it('slow path: refreshes tokens if expired', async () => {
    const expiredTokens = { accessToken: 'expired_token', expiresAt: Date.now() - 100000 };
    const newTokens = { accessToken: 'new_token', expiresAt: Date.now() + 100000 };

    mockHooks.decrypt.mockReturnValueOnce(expiredTokens); // First decrypt
    mockHooks.isExpired.mockReturnValueOnce(true); // First check: expired

    // Mock DB re-read (double check)
    // db.select().from().where().limit() chain
    const mockLimit = vi.fn().mockResolvedValue([{ config: { encryptedTokens: JSON.stringify(expiredTokens) } }]);
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockLimit
        })
      })
    });

    mockHooks.decrypt.mockReturnValueOnce(expiredTokens); // Second decrypt
    mockHooks.isExpired.mockReturnValueOnce(true); // Second check: still expired

    mockHooks.refresh.mockResolvedValueOnce(newTokens);

    const result = await getValidAccessTokenLocked(
      'inbox-1',
      { encryptedTokens: JSON.stringify(expiredTokens) },
      mockHooks
    );

    expect(result.accessToken).toBe('new_token');
    expect(result.refreshed).toBe(true);
    expect(mockHooks.refresh).toHaveBeenCalledWith(expiredTokens);
    expect(threadsModule.updateInboxConfig).toHaveBeenCalledWith('inbox-1', {
      encryptedTokens: JSON.stringify(newTokens),
    });
  });

  it('double-check path: returns fresh tokens if another worker refreshed', async () => {
    const expiredTokens = { accessToken: 'expired_token', expiresAt: Date.now() - 100000 };
    const freshTokens = { accessToken: 'fresh_token', expiresAt: Date.now() + 100000 };

    mockHooks.decrypt.mockReturnValueOnce(expiredTokens); // First decrypt
    mockHooks.isExpired.mockReturnValueOnce(true); // First check: expired

    // Mock DB re-read finding FRESH tokens (refreshed by another worker)
    const mockLimit = vi.fn().mockResolvedValue([{ config: { encryptedTokens: JSON.stringify(freshTokens) } }]);
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockLimit
        })
      })
    });

    mockHooks.decrypt.mockReturnValueOnce(freshTokens); // Second decrypt
    mockHooks.isExpired.mockReturnValueOnce(false); // Second check: NOT expired

    const result = await getValidAccessTokenLocked(
      'inbox-1',
      { encryptedTokens: JSON.stringify(expiredTokens) },
      mockHooks
    );

    expect(result.accessToken).toBe('fresh_token');
    expect(result.refreshed).toBe(false);
    expect(mockHooks.refresh).not.toHaveBeenCalled(); // We shouldn't refresh
    expect(threadsModule.updateInboxConfig).not.toHaveBeenCalled(); // We shouldn't persist
  });
});
