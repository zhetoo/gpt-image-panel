<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { AssistantJobDiagnoseResponse } from '$lib/api/types/assistant';
  import type { GenerateJobStatus } from '$lib/api/types/jobs';
  import JobHistoryList from '$lib/components/JobHistoryList.svelte';
  import RunningJobsList from '$lib/components/RunningJobsList.svelte';
  import { t } from '$lib/i18n';
  import { formatTokenCount, formatUsdCost } from '$lib/utils/format';
  import type { JobsTab } from '$lib/utils/pageUrlSync';

  type MaybePromise = void | Promise<void>;
  type Props = {
    activeTab?: JobsTab;
    jobs?: GenerateJobStatus[];
    historyJobs?: GenerateJobStatus[];
    historyLoading?: boolean;
    historyLoaded?: boolean;
    historyHasMore?: boolean;
    historyFailedOnly?: boolean;
    selectedIds?: Set<string>;
    onTabChange?: (tab: JobsTab) => void;
    onRefresh?: () => MaybePromise;
    onRefreshHistory?: () => MaybePromise;
    onLoadMoreHistory?: () => MaybePromise;
    onHistoryFailedOnlyChange?: (failedOnly: boolean) => MaybePromise;
    onClearHistory?: () => MaybePromise;
    onToggle?: (jobId: string) => void;
    onToggleAll?: () => void;
    onCancelSelected?: () => MaybePromise;
    onUseJob?: (job: GenerateJobStatus) => void;
    onRetryJob?: (job: GenerateJobStatus) => void;
    aiAssistantEnabled?: boolean;
    diagnosingJobId?: string | null;
    diagnoses?: Record<string, AssistantJobDiagnoseResponse>;
    onDiagnoseJob?: (job: GenerateJobStatus) => MaybePromise;
  };

  const EMPTY_JOBS: GenerateJobStatus[] = [];
  const EMPTY_STRING_SET: Set<string> = new Set();
  const EMPTY_DIAGNOSES: Record<string, AssistantJobDiagnoseResponse> = {};

  let {
    activeTab = 'running',
    jobs = EMPTY_JOBS,
    historyJobs = EMPTY_JOBS,
    historyLoading = false,
    historyLoaded = false,
    historyHasMore = false,
    historyFailedOnly = false,
    selectedIds = EMPTY_STRING_SET,
    onTabChange = () => {},
    onRefresh = () => {},
    onRefreshHistory = () => {},
    onLoadMoreHistory = () => {},
    onHistoryFailedOnlyChange = () => {},
    onClearHistory = () => {},
    onToggle = () => {},
    onToggleAll = () => {},
    onCancelSelected = () => {},
    onUseJob = () => {},
    onRetryJob = () => {},
    aiAssistantEnabled = false,
    diagnosingJobId = null,
    diagnoses = EMPTY_DIAGNOSES,
    onDiagnoseJob = () => {}
  }: Props = $props();

  const lastSeenStatus = new Map<string, string>();
  const settleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let settledJobIds = $state(new Set<string>());

  function markSettled(jobId: string) {
    const next = new Set(settledJobIds);
    next.add(jobId);
    settledJobIds = next;
    clearTimeout(settleTimers.get(jobId));
    settleTimers.set(
      jobId,
      setTimeout(() => {
        const after = new Set(settledJobIds);
        after.delete(jobId);
        settledJobIds = after;
        settleTimers.delete(jobId);
      }, 620)
    );
  }

  $effect(() => {
    const visible = jobs;
    untrack(() => {
      for (const job of visible) {
        const previous = lastSeenStatus.get(job.job_id);
        if (previous !== undefined && previous !== job.status) markSettled(job.job_id);
        lastSeenStatus.set(job.job_id, job.status);
      }
    });
  });

  onDestroy(() => {
    settleTimers.forEach((timer) => clearTimeout(timer));
    settleTimers.clear();
  });

  function selectTab(tab: JobsTab) {
    onTabChange(tab);
    if (tab === 'history' && !historyLoaded && !historyLoading) void onRefreshHistory();
  }

  function refreshCurrentTab() {
    if (activeTab === 'history') void onRefreshHistory();
    else void onRefresh();
  }

  function toggleHistoryFailedOnly(event: Event) {
    void onHistoryFailedOnlyChange((event.currentTarget as HTMLInputElement).checked);
  }

  const historyCostSummary = $derived.by(() => {
    let totalTokens = 0;
    let hasTokens = false;
    let totalCost = 0;
    let pricedCount = 0;
    for (const job of historyJobs) {
      if (typeof job.usage?.total_tokens === 'number' && Number.isFinite(job.usage.total_tokens)) {
        totalTokens += job.usage.total_tokens;
        hasTokens = true;
      }
      if (job.cost?.complete && typeof job.cost.estimated_cost_usd === 'number') {
        totalCost += job.cost.estimated_cost_usd;
        pricedCount += 1;
      }
    }
    if (!hasTokens && pricedCount === 0) return null;
    return {
      totalTokens: hasTokens ? totalTokens : null,
      totalCost: pricedCount > 0 ? totalCost : null,
      pricedCount,
      totalJobs: historyJobs.length
    };
  });
</script>

<section class="app-surface flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden" aria-labelledby="jobs-page-title">
  <div class="border-b border-stone-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
    <h2 id="jobs-page-title" class="text-lg font-semibold text-stone-950 dark:text-zinc-100">{$t.jobs.title}</h2>
    <p class="mt-1 text-xs text-stone-500 dark:text-zinc-500">{$t.jobs.subtitle}</p>
  </div>

  <div class="flex flex-col gap-3 border-b border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-zinc-800">
    <div class="grid grid-cols-2 rounded-lg border border-stone-200 bg-stone-100 p-1 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-950">
      <button type="button" class={`control-focus rounded-md px-4 py-2 ${activeTab === 'running' ? 'bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-none' : 'text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-200'}`} aria-pressed={activeTab === 'running'} onclick={() => selectTab('running')}>
        {$t.jobs.runningTab}
      </button>
      <button type="button" class={`control-focus rounded-md px-4 py-2 ${activeTab === 'history' ? 'bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-none' : 'text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-200'}`} aria-pressed={activeTab === 'history'} onclick={() => selectTab('history')}>
        {$t.jobs.historyTab}
      </button>
    </div>

    <div class="flex flex-wrap gap-2 sm:justify-end">
      {#if activeTab === 'running'}
        <button type="button" class="control-focus rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" disabled={!jobs.length} onclick={onToggleAll}>
          {$t.jobs.selectAll}
        </button>
      {:else}
        <label class={`control-focus flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-700 dark:border-zinc-700 dark:text-zinc-300 ${historyLoading ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-stone-100 dark:hover:bg-zinc-800'}`}>
          <input type="checkbox" class="h-3.5 w-3.5 accent-red-600" checked={historyFailedOnly} disabled={historyLoading} aria-label={$t.jobs.errorsOnly} onchange={toggleHistoryFailedOnly} />
          <span>{$t.jobs.errorsOnly}</span>
        </label>
        <button type="button" class="control-focus rounded-lg border border-red-500/40 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-40 dark:text-red-300" disabled={historyLoading} onclick={onClearHistory}>
          {$t.jobs.clearHistory}
        </button>
      {/if}
      <button type="button" class="control-focus rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" disabled={activeTab === 'history' && historyLoading} onclick={refreshCurrentTab}>
        {$t.jobs.refresh}
      </button>
    </div>
  </div>

  {#if activeTab === 'running'}
    <RunningJobsList {jobs} {selectedIds} {settledJobIds} {onToggle} />
    <div class="border-t border-stone-200 p-4 dark:border-zinc-800 sm:px-6">
      <button type="button" disabled={!selectedIds.size} class="control-focus w-full rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto sm:block sm:w-auto" onclick={onCancelSelected}>
        {$t.jobs.cancelSelected}
      </button>
    </div>
  {:else}
    {#if historyCostSummary}
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stone-200 px-5 py-2 text-xs text-stone-500 dark:border-zinc-800 dark:text-zinc-500 sm:px-6">
        {#if historyCostSummary.totalTokens !== null}
          <span>{$t.jobs.historySummaryTokens}: {formatTokenCount(historyCostSummary.totalTokens)}</span>
        {/if}
        {#if historyCostSummary.totalCost !== null}
          <span>
            {$t.jobs.historySummaryCost}: {formatUsdCost(historyCostSummary.totalCost)}
            {#if historyCostSummary.pricedCount < historyCostSummary.totalJobs}
              ({historyCostSummary.pricedCount}/{historyCostSummary.totalJobs} {$t.jobs.historySummaryPriced})
            {/if}
          </span>
        {/if}
      </div>
    {/if}
    <JobHistoryList
      {historyJobs}
      {historyLoading}
      {historyLoaded}
      {historyHasMore}
      {historyFailedOnly}
      {aiAssistantEnabled}
      {diagnosingJobId}
      {diagnoses}
      {onLoadMoreHistory}
      {onUseJob}
      {onRetryJob}
      {onDiagnoseJob}
    />
  {/if}
</section>
