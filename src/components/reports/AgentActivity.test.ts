import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('agent activity display', () => {
  it('shows a real worker heartbeat without implying discovery is scanning', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORT_API_URL', 'http://127.0.0.1:50653');
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const { AgentActivity } = await import('./AgentActivity');
    const client = new QueryClient();
    client.setQueryData(['agent-activity', 'http://127.0.0.1:50653'], {
      workerFresh: true,
      lastHeartbeat: 1793954963,
      runningJobs: 0,
      queuedJobs: 0,
    });
    const html = renderToStaticMarkup(
      React.createElement(QueryClientProvider, { client }, React.createElement(AgentActivity)),
    );
    expect(html).toContain('Worker heartbeat active');
    expect(html).toContain('Token activity unavailable');
    expect(html).toContain('does not mean tokens are being scanned');
    expect(html).not.toContain('simulating buys and sells');
  });

  it('gives a connection instruction when the API is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_REPORT_API_URL', '');
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const { AgentActivity } = await import('./AgentActivity');
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        React.createElement(AgentActivity),
      ),
    );
    expect(html).toContain('Connect the local reports API to see worker status.');
    expect(html).not.toContain('Worker heartbeat active');
  });
});
