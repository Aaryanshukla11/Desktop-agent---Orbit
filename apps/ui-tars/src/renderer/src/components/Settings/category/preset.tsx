/**
 
 */
import { useRef, useState } from 'react';
import { Info } from 'lucide-react';

import { Card } from '@renderer/components/ui/card';
import { Button } from '@renderer/components/ui/button';
import {
  Tooltip as CNTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Switch } from '@renderer/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@renderer/components/ui/tabs';
import { useSetting } from '@renderer/hooks/useSetting';

interface PresetBannerProps {
  url?: string;
  date?: number;
  handleUpdatePreset: (e: React.MouseEvent) => void;
  handleResetPreset: (e: React.MouseEvent) => void;
}

interface PresetImportProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PresetImport({ isOpen, onClose }: PresetImportProps) {
  const [remoteUrl, setRemoteUrl] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importPresetFromText, importPresetFromUrl } = useSetting();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      const yamlText = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });

      await importPresetFromText(yamlText);
      toast.success('Preset imported successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to import preset', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleRemoteImport = async () => {
    try {
      await importPresetFromUrl(remoteUrl, autoUpdate);
      toast.success('Preset imported successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to import preset', {
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Import Preset</DialogTitle>
          <DialogDescription>
            Import the preset model configuration file.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="local" className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="local">Local File</TabsTrigger>
            <TabsTrigger value="remote">Remote URL</TabsTrigger>
          </TabsList>

          <TabsContent value="local" className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <DialogDescription>
                Select a YAML file to import settings preset
              </DialogDescription>
              <input
                type="file"
                accept=".yaml,.yml"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="remote" className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="preset-url">Preset URL</Label>
                <Input
                  id="preset-url"
                  className="orbit-glass-input"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  placeholder="https://example.com/preset.yaml"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="auto-update">Auto update on startup</Label>
                <Switch
                  id="auto-update"
                  checked={autoUpdate}
                  onCheckedChange={setAutoUpdate}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-row items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRemoteImport} disabled={!remoteUrl}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PresetBanner(props: PresetBannerProps) {
  return (
    <Card className="p-4 mb-4 orbit-glass-card rounded-2xl border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-200">
            Remote Preset Management
          </span>
          <TooltipProvider>
            <CNTooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300" />
              </TooltipTrigger>
              <TooltipContent>
                When using remote preset, settings will be read-only
              </TooltipContent>
            </CNTooltip>
          </TooltipProvider>
        </div>

        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{props.url}</p>
          {props.date && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {`Last updated: ${new Date(props.date).toLocaleString()}`}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="orbit-glass-button rounded-xl mb-0"
          onClick={props.handleUpdatePreset}
        >
          Update Preset
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-red-400 border-red-400/30 bg-red-500/10 hover:bg-red-500/20 hover:text-red-300 ml-4 mb-0"
          onClick={props.handleResetPreset}
        >
          Reset to Manual
        </Button>
      </div>
    </Card>
  );
}
