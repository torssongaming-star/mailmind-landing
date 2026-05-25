import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@upstash/qstash';

vi.mock('@upstash/qstash', () => {
  return {
    Client: vi.fn(),
  };
});

describe('queue', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns queued: false if QSTASH_TOKEN is not set', async () => {
    delete process.env.QSTASH_TOKEN;
    const { enqueueAutoTriage } = await import('./queue');
    
    const result = await enqueueAutoTriage({
      organizationId: 'org_123',
      threadId: 'thread_123',
      newEmailBody: 'test body',
    });

    expect(result).toEqual({ queued: false });
  });

  it('publishes message and returns queued: true if QSTASH_TOKEN is set', async () => {
    process.env.QSTASH_TOKEN = 'test_token';
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.com';

    const mockPublishJSON = vi.fn().mockResolvedValue({ messageId: 'msg_123' });
    vi.mocked(Client).mockImplementation(function() {
      return { publishJSON: mockPublishJSON } as any;
    });

    const { enqueueAutoTriage } = await import('./queue');
    const result = await enqueueAutoTriage({
      organizationId: 'org_123',
      threadId: 'thread_123',
      newEmailBody: 'test body',
    });

    expect(Client).toHaveBeenCalledWith({ token: 'test_token' });
    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: 'https://test.com/api/jobs/triage',
      body: {
        organizationId: 'org_123',
        threadId: 'thread_123',
        newEmailBody: 'test body',
      },
      retries: 3,
      delay: undefined,
    });
    
    expect(result).toEqual({ queued: true, messageId: 'msg_123' });
  });

  it('returns queued: false if publishJSON throws an error', async () => {
    process.env.QSTASH_TOKEN = 'test_token';

    const mockPublishJSON = vi.fn().mockRejectedValue(new Error('QStash error'));
    vi.mocked(Client).mockImplementation(function() {
      return { publishJSON: mockPublishJSON } as any;
    });

    const { enqueueAutoTriage } = await import('./queue');
    const result = await enqueueAutoTriage({
      organizationId: 'org_123',
      threadId: 'thread_123',
      newEmailBody: 'test body',
    });

    expect(result).toEqual({ queued: false });
  });
});
