import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LABELS } from '@/components/HonestyLabels';
import { Card, KeyValue, StatTile } from './Card';
import { Disclosure, TechnicalDetails } from './Disclosure';
import { HonestyChips } from './HonestyChips';
import { GIVE_UP_MS, LoadState, STILL_LOADING_MS, loadPhase } from './LoadState';
import { Page, PageHeader } from './Page';
import { ErrorState } from './States';
import { Stepper } from './Stepper';
import { SegmentedControl, Tabs, tabPanelProps } from './Tabs';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe('loadPhase', () => {
  const pending = { data: undefined, isError: false };
  it('moves from skeleton to "still loading" at 8s and gives up at 20s', () => {
    expect(loadPhase(pending, 0)).toBe('loading');
    expect(loadPhase(pending, STILL_LOADING_MS - 1)).toBe('loading');
    expect(loadPhase(pending, STILL_LOADING_MS)).toBe('slow');
    expect(loadPhase(pending, GIVE_UP_MS)).toBe('timeout');
  });
  it('shows data whenever it exists, and errors immediately', () => {
    expect(loadPhase({ data: [], isError: false }, GIVE_UP_MS * 2)).toBe('ready');
    expect(loadPhase({ data: undefined, isError: true }, 0)).toBe('error');
  });
});

describe('LoadState', () => {
  const q = (o: Partial<{ data: string[]; isError: boolean; error: unknown }>) => ({
    data: undefined,
    isError: false,
    error: null,
    refetch: () => undefined,
    ...o,
  });
  it('renders the skeleton while loading', () => {
    const out = html(
      <LoadState query={q({})} source="Research API" skeleton={<div className="sweep" />}>
        {(d) => <p>{d.length}</p>}
      </LoadState>,
    );
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('sweep');
  });
  it('names the source and offers Retry on error', () => {
    const out = html(
      <LoadState
        query={q({ isError: true, error: new Error('HTTP 502') })}
        source="Ethereum Sepolia RPC"
        skeleton={null}
      >
        {() => null}
      </LoadState>,
    );
    expect(out).toContain('Ethereum Sepolia RPC isn’t responding');
    expect(out).toContain('HTTP 502');
    expect(out).toContain('Retry');
  });
  it('renders children with data', () => {
    expect(
      html(
        <LoadState query={q({ data: ['a', 'b'] })} source="x" skeleton={null}>
          {(d) => <p>n={d.length}</p>}
        </LoadState>,
      ),
    ).toContain('n=2');
  });
});

describe('HonestyChips', () => {
  it('shows each fact once, with its exact label available to screen readers', () => {
    const out = html(
      <HonestyChips
        facts={['testToken', 'testToken', 'publicStakes', 'demoReport']}
        reportId={1n}
      />,
    );
    expect(out.match(/Test dUSD/g)).toHaveLength(1);
    expect(out).toContain(LABELS.testToken);
    expect(out).toContain(LABELS.publicStakes);
    expect(out).toContain('Demo report #1 (onchain) — not linked to a backend research report');
    expect(out).toContain('aria-expanded="false"');
  });
  it('includes the test-identities fact', () => {
    expect(html(<HonestyChips facts={['testIdentities']} />)).toContain(
      'World proofs at the event use test identities',
    );
  });
});

describe('layout pieces', () => {
  it('PageHeader renders one h1 with the description and actions', () => {
    const out = html(
      <PageHeader
        title="Reports"
        description="Every case file Sniff has written."
        actions={<button>Go</button>}
      />,
    );
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('Every case file Sniff has written.');
    expect(out).toContain('<button>Go</button>');
  });
  it('Page uses the 1200px container', () => {
    expect(html(<Page>x</Page>)).toContain('max-w-[1200px]');
  });
  it('Card variants, StatTile and KeyValue render their content', () => {
    expect(
      html(
        <Card variant="paper" title="Case">
          body
        </Card>,
      ),
    ).toContain('paper-plain');
    expect(html(<StatTile label="Staked" value="106.00" />)).toContain('106.00');
    expect(html(<KeyValue items={[{ label: 'Chain', value: 'Ethereum Sepolia' }]} />)).toContain(
      '<dt',
    );
  });
  it('TechnicalDetails is collapsed by default', () => {
    const out = html(<TechnicalDetails>0xabc</TechnicalDetails>);
    expect(out).toContain('<details');
    expect(out).not.toContain(' open=""');
    expect(
      html(
        <Disclosure summary="More" defaultOpen>
          x
        </Disclosure>,
      ),
    ).toContain('open=""');
  });
  it('ErrorState is announced as an alert', () => {
    expect(html(<ErrorState source="Research API" />)).toContain('role="alert"');
  });
});

describe('Tabs, SegmentedControl, Stepper', () => {
  it('links each tab to its panel and selects one', () => {
    const out = html(
      <Tabs
        id="q"
        label="Queue"
        value="waiting"
        onChange={() => undefined}
        items={[
          { key: 'waiting', label: 'Waiting', count: 3 },
          { key: 'approved', label: 'Approved' },
        ]}
      />,
    );
    expect(out).toContain('role="tablist"');
    expect(out).toContain('aria-selected="true"');
    expect(out).toContain('aria-controls="q-panel-waiting"');
    expect(tabPanelProps('q', 'waiting')['aria-labelledby']).toBe('q-tab-waiting');
  });
  it('SegmentedControl is a radiogroup', () => {
    const out = html(
      <SegmentedControl
        label="Filter"
        value="all"
        onChange={() => undefined}
        items={[
          { key: 'all', label: 'All' },
          { key: 'open', label: 'Open' },
        ]}
      />,
    );
    expect(out).toContain('role="radiogroup"');
    expect(out).toContain('aria-checked="true"');
  });
  it('Stepper marks the current step and spells out each state', () => {
    const out = html(
      <Stepper
        steps={[
          { label: 'Start', state: 'done' },
          { label: 'Confirm', state: 'current' },
          { label: 'Done', state: 'todo' },
        ]}
      />,
    );
    expect(out).toContain('aria-current="step"');
    expect(out).toContain('(done)');
    expect(out).toContain('(not started)');
  });
});
