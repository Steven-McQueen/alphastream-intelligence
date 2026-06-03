import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useChatModelConfigStore } from '@/hooks/useChatModelConfigStore';
import { ProviderIcon } from '@/lib/modelProviderIcons';
import type { ChatModelConfig, ChatModelEntry, ChatProviderId } from '@/types/chatModelConfig';
import { DEFAULT_CHAT_MODEL_CONFIG } from '@/types/chatModelConfig';
import { cn } from '@/lib/utils';

/** Display and table row order */
const PROVIDER_SORT_ORDER: ChatProviderId[] = [
  'anthropic',
  'google',
  'openai',
  'moonshot',
  'deepseek',
];

const PROVIDER_LABELS: Record<ChatProviderId, string> = {
  google: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  moonshot: 'Moonshot',
  deepseek: 'DeepSeek',
};

const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Stable React key per table row — survives model_id edits without remounting inputs */
type TableRowState = {
  rowKey: string;
  providerId: ChatProviderId;
  model: ChatModelEntry;
};

function providerSortIndex(providerId: ChatProviderId): number {
  const i = PROVIDER_SORT_ORDER.indexOf(providerId);
  return i === -1 ? PROVIDER_SORT_ORDER.length : i;
}

function sortTableRows(rows: TableRowState[]): TableRowState[] {
  return [...rows].sort((a, b) => {
    const byProvider = providerSortIndex(a.providerId) - providerSortIndex(b.providerId);
    if (byProvider !== 0) return byProvider;
    return a.model.display_label.localeCompare(b.model.display_label, undefined, {
      sensitivity: 'base',
    });
  });
}

function cloneConfig(config: ChatModelConfig): ChatModelConfig {
  return JSON.parse(JSON.stringify(config)) as ChatModelConfig;
}

function cloneEntry(entry: ChatModelEntry): ChatModelEntry {
  return { ...entry };
}

function configToTableRows(config: ChatModelConfig): TableRowState[] {
  return sortTableRows(
    config.providers.flatMap((provider) =>
      provider.models.map((model) => ({
        rowKey: crypto.randomUUID(),
        providerId: provider.provider_id,
        model: cloneEntry(model),
      })),
    ),
  );
}

function tableRowsToConfig(rows: TableRowState[]): ChatModelConfig {
  const providerMap = new Map<ChatProviderId, ChatModelEntry[]>();
  for (const id of Object.keys(PROVIDER_LABELS) as ChatProviderId[]) {
    providerMap.set(id, []);
  }
  for (const row of rows) {
    providerMap.get(row.providerId)?.push(cloneEntry(row.model));
  }
  return {
    providers: PROVIDER_SORT_ORDER.map((provider_id) => ({
      provider_id,
      name:
        DEFAULT_CHAT_MODEL_CONFIG.providers.find((p) => p.provider_id === provider_id)?.name ??
        PROVIDER_LABELS[provider_id],
      models: providerMap.get(provider_id) ?? [],
    })),
  };
}

function newModelEntry(providerId: ChatProviderId): ChatModelEntry {
  const suffix = Date.now().toString(36).slice(-4);
  return {
    model_id: `new-${providerId}-${suffix}`,
    display_label: 'New model',
    version: '',
    provider_native_model_name: '',
    enabled: false,
    visible: false,
    is_default: false,
  };
}

function applyModelPatch(
  rows: TableRowState[],
  rowKey: string,
    patch: Partial<ChatModelEntry>,
): TableRowState[] {
  return rows.map((row) => {
    if (row.rowKey !== rowKey) return row;
    const model = { ...row.model, ...patch };

    if (patch.enabled === false) {
      model.visible = false;
    }

    return { ...row, model };
  });
}

function applyDefault(rows: TableRowState[], modelId: string): TableRowState[] {
  return rows.map((row) => ({
    ...row,
    model: {
      ...row.model,
      is_default: row.model.model_id === modelId,
    },
  }));
}

function normalizeRows(rows: TableRowState[]): TableRowState[] {
  let next = rows.map((row) => ({
    ...row,
    model: {
      ...row.model,
      model_id: row.model.model_id.trim().toLowerCase(),
    },
  }));

  const defaultRows = next.filter((r) => r.model.is_default);
  if (defaultRows.length === 0) {
    const fallback = next.find((r) => r.model.enabled) ?? next[0];
    if (fallback) next = applyDefault(next, fallback.model.model_id);
  } else if (defaultRows.length > 1) {
    const keep = defaultRows.find((r) => r.model.enabled) ?? defaultRows[0];
    next = next.map((row) => ({
      ...row,
      model: {
        ...row.model,
        is_default: row.rowKey === keep.rowKey,
      },
    }));
  }

  const defaultRow = next.find((r) => r.model.is_default);
  if (defaultRow && !defaultRow.model.enabled) {
    const fallback = next.find((r) => r.model.enabled && r.rowKey !== defaultRow.rowKey);
    if (fallback) {
      next = next.map((row) => ({
        ...row,
        model: {
          ...row.model,
          is_default: row.rowKey === fallback.rowKey,
        },
      }));
    }
  }

  for (const row of next) {
    if (row.model.is_default && !row.model.enabled) {
      row.model.is_default = false;
    }
  }

  const enabledDefault = next.find((r) => r.model.is_default && r.model.enabled);
  if (!enabledDefault) {
    const gemini = next.find((r) => r.model.model_id === 'gemini-flash' && r.model.enabled);
    const pick = gemini ?? next.find((r) => r.model.enabled);
    if (pick) next = applyDefault(next, pick.model.model_id);
  }

  return next;
}

export function AiModelsSettings() {
  const store = useChatModelConfigStore();
  const [tableRows, setTableRows] = useState<TableRowState[]>(() =>
    configToTableRows(cloneConfig(store.config)),
  );
  const skipStoreSyncRef = useRef(false);

  useEffect(() => {
    if (skipStoreSyncRef.current) {
      skipStoreSyncRef.current = false;
      return;
    }
    setTableRows(configToTableRows(cloneConfig(store.config)));
  }, [store.config]);

  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of tableRows) {
      const id = row.model.model_id.trim().toLowerCase();
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id),
    );
  }, [tableRows]);

  const updateRow = useCallback((rowKey: string, patch: Partial<ChatModelEntry>) => {
    setTableRows((prev) => {
      let next = applyModelPatch(prev, rowKey, patch);

        if (patch.is_default === true) {
        next = next.map((row) => ({
          ...row,
          model: { ...row.model, is_default: row.rowKey === rowKey },
        }));
        }

        if (patch.enabled === false) {
        const wasDefault = prev.find((r) => r.rowKey === rowKey)?.model.is_default;
        if (wasDefault) {
          const fallback =
            next.find(
              (r) => r.model.enabled && r.rowKey !== rowKey && r.model.model_id === 'gemini-flash',
            ) ?? next.find((r) => r.model.enabled && r.rowKey !== rowKey);
          if (fallback) {
            next = next.map((row) => ({
              ...row,
              model: {
                ...row.model,
                is_default: row.rowKey === fallback.rowKey,
              },
            }));
          } else {
            next = next.map((row) =>
              row.rowKey === rowKey
                ? { ...row, model: { ...row.model, is_default: false } }
                : row,
            );
            }
          }
        }

        return next;
      });
  }, []);

  const commitModelId = useCallback((rowKey: string, raw: string) => {
    const normalized = raw.trim().toLowerCase();
    setTableRows((prev) => {
      const next = applyModelPatch(prev, rowKey, { model_id: normalized });
      return sortTableRows(normalizeRows(next));
    });
  }, []);

  const setRowDefault = useCallback((rowKey: string) => {
    setTableRows((prev) =>
      prev.map((row) => ({
        ...row,
        model: { ...row.model, is_default: row.rowKey === rowKey },
      })),
    );
  }, []);

  const addModel = useCallback((providerId: ChatProviderId) => {
    setTableRows((prev) =>
      sortTableRows([
        ...prev,
        {
          rowKey: crypto.randomUUID(),
          providerId,
          model: newModelEntry(providerId),
        },
      ]),
    );
    toast.message('New row added — set Model ID and API name, then Save');
  }, []);

  const removeModel = useCallback((rowKey: string) => {
    setTableRows((prev) => {
      if (prev.length <= 1) {
        toast.error('Keep at least one model in the catalog');
        return prev;
      }
      const removed = prev.find((r) => r.rowKey === rowKey);
      let next = prev.filter((r) => r.rowKey !== rowKey);
      if (removed?.model.is_default) {
        next = normalizeRows(next);
      }
      return sortTableRows(next);
    });
  }, []);

  const handleSave = async () => {
    const normalized = sortTableRows(normalizeRows(tableRows));
    setTableRows(normalized);
    const draft = tableRowsToConfig(normalized);

    const ids = new Set<string>();
    for (const row of normalized) {
      const id = row.model.model_id;
      if (!MODEL_ID_PATTERN.test(id)) {
        toast.error(
          `Invalid model ID "${id}" — use lowercase letters, numbers, and hyphens only`,
        );
        return;
      }
      if (ids.has(id)) {
        toast.error(`Duplicate model ID: ${id}`);
        return;
      }
      ids.add(id);
      if (!row.model.provider_native_model_name.trim()) {
        toast.error(`API model name required for ${id}`);
        return;
      }
    }

    const hasDefault = draft.providers.some((p) =>
      p.models.some((m) => m.is_default && m.enabled),
    );
    if (!hasDefault) {
      toast.error('Select a default model among enabled entries');
      return;
    }

    skipStoreSyncRef.current = true;
    const ok = await store.replaceConfig(draft);
    if (ok) {
      toast.success('AI model settings saved');
    } else {
      toast.warning('Saved locally; backend sync failed — check login and API');
    }
  };

  const handleReset = async () => {
    const defaults = cloneConfig(DEFAULT_CHAT_MODEL_CONFIG);
    setTableRows(configToTableRows(defaults));
    skipStoreSyncRef.current = true;
    const ok = await store.replaceConfig(defaults);
    toast.info(
      ok ? 'Restored default model catalog' : 'Defaults applied locally; backend sync failed',
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
              Model catalog
        </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              One table for all providers. <span className="font-medium text-foreground">Model ID</span>{' '}
              is sent to the API; <span className="font-medium text-foreground">API model name</span> is
              the provider string (e.g. <code className="text-xs">gpt-4o-mini</code>). Keys stay in API
              &amp; Integrations below.
        </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PROVIDER_SORT_ORDER.map((id) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => addModel(id)}
              >
                <Plus className="h-3.5 w-3.5 mr-1 opacity-70" />
                {PROVIDER_LABELS[id]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[7.5rem]">Provider</TableHead>
                <TableHead className="w-[9.5rem]">Model ID</TableHead>
                <TableHead className="min-w-[8rem]">Display label</TableHead>
                <TableHead className="min-w-[11rem]">API model name</TableHead>
                <TableHead className="w-[3.25rem] text-center">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">On</span>
                      </TooltipTrigger>
                      <TooltipContent>Enabled for chat</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="w-[3.5rem] text-center">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Show</span>
                      </TooltipTrigger>
                      <TooltipContent>Visible in composer</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="w-[3rem] text-center">Def.</TableHead>
                <TableHead className="w-[2.75rem]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No models — use Add model above
                  </TableCell>
                </TableRow>
              ) : (
                tableRows.map(({ rowKey, providerId, model }) => {
                  const idNorm = model.model_id.trim().toLowerCase();
                  const idDuplicate = idNorm.length > 0 && duplicateIds.has(idNorm);
                  const idInvalid =
                    idNorm.length > 0 && !MODEL_ID_PATTERN.test(idNorm);

                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2 min-w-0">
                          <ProviderIcon provider={providerId} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">
                            {PROVIDER_LABELS[providerId]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle p-2">
                        <Input
                          value={model.model_id}
                          onChange={(e) =>
                            updateRow(rowKey, { model_id: e.target.value })
                          }
                          onBlur={(e) => commitModelId(rowKey, e.target.value)}
                          className={cn(
                            'h-8 font-mono text-xs',
                            (idDuplicate || idInvalid) && 'border-destructive',
                          )}
                          spellCheck={false}
                          aria-invalid={idDuplicate || idInvalid}
                        />
                        {idDuplicate && (
                          <p className="text-[0.65rem] text-destructive mt-0.5">Duplicate ID</p>
                        )}
                        {idInvalid && !idDuplicate && (
                          <p className="text-[0.65rem] text-destructive mt-0.5">
                            Lowercase, numbers, hyphens
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-middle p-2">
                        <Input
                          value={model.display_label}
                          onChange={(e) =>
                            updateRow(rowKey, { display_label: e.target.value })
                          }
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell className="align-middle p-2">
                        <Input
                          value={model.provider_native_model_name}
                          onChange={(e) =>
                            updateRow(rowKey, {
                              provider_native_model_name: e.target.value,
                            })
                          }
                          className="h-8 font-mono text-xs"
                          placeholder="provider-api-id"
                          spellCheck={false}
                        />
                      </TableCell>
                      <TableCell className="align-middle text-center p-2">
                        <Switch
                          checked={model.enabled}
                          onCheckedChange={(checked) =>
                            updateRow(rowKey, { enabled: checked })
                          }
                          aria-label={`Enable ${model.model_id}`}
                        />
                      </TableCell>
                      <TableCell className="align-middle text-center p-2">
                        <Switch
                          checked={model.visible}
                          disabled={!model.enabled}
                          onCheckedChange={(checked) =>
                            updateRow(rowKey, { visible: checked })
                          }
                          aria-label={`Show ${model.model_id} in composer`}
                        />
                      </TableCell>
                      <TableCell className="align-middle text-center p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn('h-8 w-8', model.is_default && 'text-primary')}
                          disabled={!model.enabled}
                          onClick={() => setRowDefault(rowKey)}
                          aria-label={
                            model.is_default ? 'Default model' : `Set ${model.model_id} as default`
                          }
                        >
                          <Star
                            className={cn('h-4 w-4', model.is_default && 'fill-current')}
                          />
                        </Button>
                      </TableCell>
                      <TableCell className="align-middle p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeModel(rowKey)}
                          aria-label={`Remove ${model.model_id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {store.loadError && (
          <p className="text-xs text-amber-600">
            Could not load from server: {store.loadError}. Showing cached or default catalog.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={store.isSaving || store.isLoading}>
            <Check className="h-4 w-4 mr-2" />
            {store.isSaving ? 'Saving…' : 'Save catalog'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={store.isSaving || store.isLoading}
          >
            Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
