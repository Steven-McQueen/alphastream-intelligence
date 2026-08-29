import { useEffect, useState } from 'react';
import { Loader2, Plug } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_JUPYTER_BASE_URL,
  DEFAULT_JUPYTER_ROOT_DIR,
  loadConnectionConfig,
  saveConnectionConfig,
  type JupyterConnectionConfig,
} from '@/lib/jupyter/connectionConfig';
import { setConnectionConfig, testConnection } from '@/lib/jupyter/connection';

interface JupyterConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (config: JupyterConnectionConfig) => void;
}

export function JupyterConnectionDialog({
  open,
  onOpenChange,
  onSaved,
}: JupyterConnectionDialogProps) {
  const [draft, setDraft] = useState<JupyterConnectionConfig>(loadConnectionConfig());
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(loadConnectionConfig());
      setTestMessage(null);
      setTestOk(null);
    }
  }, [open]);

  const handleTest = async () => {
    setTesting(true);
    setTestMessage(null);
    const result = await testConnection(draft);
    setTesting(false);
    if (result.ok) {
      setTestOk(true);
      setTestMessage(
        result.version ? `Connected (Jupyter ${result.version})` : 'Connected'
      );
    } else {
      setTestOk(false);
      setTestMessage(result.error);
    }
  };

  const handleSave = () => {
    saveConnectionConfig(draft);
    setConnectionConfig(draft);
    onSaved?.(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Jupyter connection
          </DialogTitle>
          <DialogDescription>
            Connect to a local Jupyter Server you run on your machine. Start it with
            the script in <code className="text-xs">alphastream-notebooks/</code>, then
            paste the URL and token here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="jupyter-base-url">Server URL</Label>
            <Input
              id="jupyter-base-url"
              value={draft.baseUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, baseUrl: e.target.value }))
              }
              placeholder={DEFAULT_JUPYTER_BASE_URL}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jupyter-token">Token</Label>
            <Input
              id="jupyter-token"
              type="password"
              value={draft.token}
              onChange={(e) => setDraft((d) => ({ ...d, token: e.target.value }))}
              placeholder="From jupyter server startup log"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jupyter-root">Notebooks folder (on server)</Label>
            <Input
              id="jupyter-root"
              value={draft.rootDir}
              onChange={(e) =>
                setDraft((d) => ({ ...d, rootDir: e.target.value }))
              }
              placeholder={DEFAULT_JUPYTER_ROOT_DIR}
            />
            <p className="text-xs text-muted-foreground">
              Must match <code>ServerApp.root_dir</code> in your launch script. Used
              to list notebooks in the sidebar.
            </p>
          </div>

          {testMessage && (
            <p
              className={`text-sm ${testOk ? 'text-green-600' : 'text-destructive'}`}
            >
              {testMessage}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={testing}
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test connection
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
