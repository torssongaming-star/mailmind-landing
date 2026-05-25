import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeFetch } from './safe-fetch';
import * as dns from 'node:dns/promises';
import { fetch as undiciFetch } from 'undici';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

vi.mock('undici', () => {
  return {
    fetch: vi.fn(),
    Agent: class {
      close = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('safe-fetch', () => {
  const mockFetch = vi.mocked(undiciFetch);
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: '93.184.216.34', family: 4 }
    ] as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-https URLs', async () => {
    const result = await safeFetch('http://example.com');
    expect(result).toEqual({ ok: false, reason: 'scheme_not_allowed' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects localhost and internal TLDs', async () => {
    let result = await safeFetch('https://localhost');
    expect(result).toEqual({ ok: false, reason: 'host_blocked: localhost' });
    
    result = await safeFetch('https://service.internal');
    expect(result).toEqual({ ok: false, reason: 'host_blocked: internal tld' });
    
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects direct private IPs', async () => {
    const result = await safeFetch('https://192.168.1.1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('blocked ipv4');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects DNS resolving to private IP', async () => {
    vi.mocked(dns.lookup).mockResolvedValueOnce([
      { address: '10.0.0.1', family: 4 }
    ] as any);

    const result = await safeFetch('https://my-internal-tool.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('resolved to private ipv4 10.0.0.1');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles valid fetch successfully', async () => {
    const mockValue = new TextEncoder().encode('Hello, world!');
    let readCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(async () => {
        if (readCount === 0) {
          readCount++;
          return { done: false, value: mockValue };
        }
        return { done: true };
      }),
      cancel: vi.fn(),
    };
    
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      body: { getReader: () => mockReader }
    } as any);

    const result = await safeFetch('https://example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.bodyText).toBe('Hello, world!');
      expect(result.finalUrl).toBe('https://example.com');
    }
  });

  it('caps response size', async () => {
    const mockValue = new Uint8Array(2000001); 
    const mockReader = {
      read: vi.fn().mockResolvedValueOnce({ done: false, value: mockValue }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
    
    mockFetch.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      body: { getReader: () => mockReader }
    } as any);

    const result = await safeFetch('https://example.com', { maxBytes: 2000000 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('response_too_large (>2000000 bytes)');
    }
  });
});
