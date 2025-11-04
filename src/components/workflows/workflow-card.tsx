'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Download, Trash2, Workflow as WorkflowIcon, Play, Key, MessageSquare, Webhook, Clock, Send, Sliders, BarChart3, Table2, Image, FileText, List, Braces } from 'lucide-react';
import { WorkflowListItem } from '@/types/workflows';
import { WorkflowExecutionDialog } from './workflow-execution-dialog';
import { CredentialsConfigDialog } from './credentials-config-dialog';
import { WorkflowSettingsDialog } from './workflow-settings-dialog';
import { WorkflowOutputsDialog } from './workflow-outputs-dialog';
import { detectOutputDisplay, getOutputTypeLabel, getOutputTypeIcon } from '@/lib/workflows/analyze-output-display';
import { toast } from 'sonner';

interface WorkflowCardProps {
  workflow: WorkflowListItem;
  onDeleted: () => void;
  onExport: (id: string) => void;
  onUpdated?: () => void;
}

export function WorkflowCard({ workflow, onDeleted, onExport, onUpdated }: WorkflowCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [credentialsConfigOpen, setCredentialsConfigOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [outputsDialogOpen, setOutputsDialogOpen] = useState(false);

  const handleDelete = async () => {
    toast(`Delete "${workflow.name}"?`, {
      description: 'This cannot be undone.',
      action: {
        label: 'Delete',
        onClick: () => performDelete(),
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    });
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      toast.success('Workflow deleted');
      onDeleted();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast.error('Failed to delete workflow');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (checked: boolean) => {
    const newStatus = checked ? 'active' : 'draft';
    setToggling(true);
    setOptimisticStatus(newStatus);

    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workflow status');
      }

      toast.success(`Workflow ${checked ? 'activated' : 'deactivated'}`);
      onUpdated?.();
    } catch (error) {
      console.error('Error updating workflow status:', error);
      toast.error('Failed to update workflow status');
      setOptimisticStatus(null);
    } finally {
      setToggling(false);
    }
  };

  const handleRunClick = () => {
    if (workflow.trigger.type === 'chat') {
      window.location.href = `/workflows/${workflow.id}/chat`;
    } else {
      setExecutionDialogOpen(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
      case 'draft':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
      case 'paused':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300';
      case 'error':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const getRunStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
      case 'error':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
      case 'running':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'cron':
        return Clock;
      case 'webhook':
        return Webhook;
      case 'telegram':
      case 'discord':
        return Send;
      case 'chat':
        return MessageSquare;
      default:
        return Play;
    }
  };

  const getTriggerLabel = (triggerType: string) => {
    switch (triggerType) {
      case 'cron':
        return 'Scheduled';
      case 'webhook':
        return 'Webhook';
      case 'telegram':
        return 'Telegram';
      case 'discord':
        return 'Discord';
      case 'chat':
        return 'Chat';
      default:
        return 'Manual';
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const TriggerIcon = getTriggerIcon(workflow.trigger.type);

  // Get the last step's module path for output display detection
  const config = workflow.config as { steps?: Array<{ module?: string }> };
  const lastStep = config.steps?.[config.steps.length - 1];
  const lastStepModule = lastStep?.module || '';

  const outputDisplay = detectOutputDisplay(lastStepModule, workflow.lastRunOutput);
  const outputTypeLabel = getOutputTypeLabel(outputDisplay.type);
  const outputIconName = getOutputTypeIcon(outputDisplay.type);

  // Map icon name to component
  const iconMap: Record<string, typeof Table2> = {
    'Table2': Table2,
    'Image': Image,
    'FileText': FileText,
    'BarChart3': BarChart3,
    'List': List,
    'Braces': Braces,
  };
  const OutputIcon = iconMap[outputIconName] || Braces;

  const runButtonConfig = (() => {
    switch (workflow.trigger.type) {
      case 'chat':
        return { label: 'Chat', icon: MessageSquare };
      case 'cron':
        return { label: 'Run Now', icon: Play };
      case 'webhook':
        return { label: 'Test', icon: Play };
      default:
        return { label: 'Run', icon: Play };
    }
  })();

  const RunIcon = runButtonConfig.icon;

  return (
    <Card className="group hover:shadow-md transition-all duration-200 hover:scale-[1.02] relative overflow-hidden border-l-4 border-l-transparent hover:border-l-primary">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="gap-1 bg-muted/50">
            <TriggerIcon className="h-3 w-3" />
            {getTriggerLabel(workflow.trigger.type)}
          </Badge>
          <Switch
            checked={(optimisticStatus || workflow.status) === 'active'}
            onCheckedChange={handleToggleStatus}
            disabled={toggling}
            aria-label="Toggle workflow status"
          />
          <span className={`text-xs font-medium ${(optimisticStatus || workflow.status) === 'active' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {(optimisticStatus || workflow.status) === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <WorkflowIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <CardTitle className="card-title truncate">{workflow.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onExport(workflow.id)}
              title="Export workflow"
              className="transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <Download className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete workflow"
              className="transition-all duration-200 hover:scale-110 active:scale-95 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
            </Button>
          </div>
        </div>
        {workflow.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {workflow.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={getStatusColor(workflow.status)}>
            {workflow.status}
          </Badge>
          {workflow.lastRunStatus && (
            <Badge variant="secondary" className={getRunStatusColor(workflow.lastRunStatus)}>
              {workflow.lastRunStatus}
            </Badge>
          )}
          {outputTypeLabel && (
            <Badge variant="outline" className="gap-1">
              <OutputIcon className="h-3 w-3" />
              {outputTypeLabel}
            </Badge>
          )}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{formatDate(workflow.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Last run:</span>
            <span>{formatDate(workflow.lastRun)}</span>
          </div>
          <div className="flex justify-between">
            <span>Runs:</span>
            <span className="font-medium">{workflow.runCount}</span>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRunClick}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title={`Execute workflow via ${runButtonConfig.label.toLowerCase()}`}
          >
            <RunIcon className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs">{runButtonConfig.label}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsDialogOpen(true)}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title="Configure workflow settings"
          >
            <Sliders className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:rotate-90" />
            <span className="text-xs">Settings</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCredentialsConfigOpen(true)}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title="Configure credentials"
          >
            <Key className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:-rotate-12" />
            <span className="text-xs">Credentials</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOutputsDialogOpen(true)}
            disabled={!workflow.lastRun || workflow.lastRunStatus !== 'success'}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50"
            title={
              !workflow.lastRun
                ? 'No outputs yet'
                : workflow.lastRunStatus !== 'success'
                  ? 'Last run failed'
                  : 'View workflow outputs'
            }
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs">Outputs</span>
          </Button>
        </div>
      </CardContent>

      <WorkflowExecutionDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        workflowDescription={workflow.description || undefined}
        workflowConfig={workflow.config}
        triggerType={workflow.trigger.type}
        triggerConfig={workflow.trigger.config}
        open={executionDialogOpen}
        onOpenChange={setExecutionDialogOpen}
      />

      <CredentialsConfigDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        open={credentialsConfigOpen}
        onOpenChange={setCredentialsConfigOpen}
      />

      <WorkflowSettingsDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        workflowConfig={workflow.config}
        workflowTrigger={workflow.trigger}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onUpdated={onUpdated}
      />

      <WorkflowOutputsDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        workflowConfig={workflow.config}
        open={outputsDialogOpen}
        onOpenChange={setOutputsDialogOpen}
      />
    </Card>
  );
}
