/**
 
 */
import { FileText, Loader2, SquareArrowOutUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef } from 'react';

import { Button } from '@renderer/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';
import { ComputerUseUserData, StatusEnum } from '@ui-tars/shared/types';
import { reportHTMLContent } from '@renderer/utils/html';
import { uploadReport } from '@renderer/utils/share';
import { useStore } from '@renderer/hooks/useStore';
import { useSetting } from '@renderer/hooks/useSetting';
import { IMAGE_PLACEHOLDER } from '@ui-tars/shared/constants';
// import { useScreenRecord } from '@renderer/hooks/useScreenRecord';
import { useSession } from '@renderer/hooks/useSession';
import dayjs from 'dayjs';

const SHARE_TIMEOUT = 100000;

export function ShareOptions() {
  const { status } = useStore();
  const { currentSessionId, chatMessages, sessions } = useSession();
  const { settings } = useSetting();
  // const { canSaveRecording, saveRecording } = useScreenRecord();
  // console.log('settings', settings);

  const [isSharing, setIsSharing] = useState(false);
  const [isShareConfirmOpen, setIsShareConfirmOpen] = useState(false);
  const [pendingShareType, setPendingShareType] = useState<
    'report' | 'video' | null
  >(null);
  const isSharePending = useRef(false);
  const shareTimeoutRef = useRef<NodeJS.Timeout>(null);

  const running = status === StatusEnum.RUNNING;
  const lastHumanMessage =
    [...(chatMessages || [])]
      .reverse()
      .find((m) => m?.from === 'human' && m?.value !== IMAGE_PLACEHOLDER)
      ?.value || '';

  const processShare = async (
    type: 'report' | 'video',
    allowCollectShareReport: boolean,
  ) => {
    if (isSharePending.current) return;

    try {
      setIsSharing(true);
      isSharePending.current = true;

      shareTimeoutRef.current = setTimeout(() => {
        setIsSharing(false);
        isSharePending.current = false;
        toast.error('Share timeout', {
          description: 'Please try again later',
        });
      }, SHARE_TIMEOUT);

      if (type === 'video') {
        // saveRecording();
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Orbit Beta Execution Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
    h1 { color: #38bdf8; }
    pre { background: #0f172a; padding: 1rem; border-radius: 6px; overflow-x: auto; color: #a5f3fc; }
  </style>
</head>
<body>
  <h1>Orbit Beta - Session Execution Report</h1>
  <div id="data-container"></div>
  {{dump}}
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      const dumpScripts = document.querySelectorAll('script[type="ui_tars_web_dump"]');
      const container = document.getElementById("data-container");
      dumpScripts.forEach((s, idx) => {
        try {
          const data = JSON.parse(s.textContent);
          const div = document.createElement("div");
          div.className = "card";
          div.innerHTML = "<h3>Session Run " + (idx + 1) + " (Status: " + (data.status || 'Completed') + ")</h3>" +
            "<p><strong>Model:</strong> " + (data.modelDetail?.name || 'Local Orbit') + "</p>" +
            "<pre>" + JSON.stringify(data.conversations || [], null, 2) + "</pre>";
          container.appendChild(div);
        } catch(e) {}
      });
    });
  </script>
</body>
</html>`;

        const restUserData =
          sessions.find((item) => item.id === currentSessionId)?.meta || {};

        const userData = {
          ...restUserData,
          status,
          conversations: chatMessages,
          modelDetail: {
            name: settings.vlmModelName,
            provider: settings.vlmProvider,
            baseUrl: settings.vlmBaseUrl,
            maxLoop: settings.maxLoopCount,
          },
        } as unknown as ComputerUseUserData;

        console.log('restUserData', userData);

        const htmlContent = reportHTMLContent(html, [userData]);

        let uploadSuccess = false;

        if (allowCollectShareReport) {
          let reportUrl: string | undefined;

          if (settings?.reportStorageBaseUrl) {
            try {
              const { url } = await uploadReport(
                htmlContent,
                settings.reportStorageBaseUrl,
              );
              reportUrl = url;
              uploadSuccess = true;
              await navigator.clipboard.writeText(url);
              toast.success('Report link copied to clipboard!');
            } catch (error) {
              console.error('Upload report failed:', error);
              toast.error('Failed to upload report', {
                description:
                  error instanceof Error
                    ? error.message
                    : JSON.stringify(error),
              });
            }
          }

          // Only send UTIO data if user consented
          if (settings?.utioBaseUrl) {
            const lastScreenshot = chatMessages
              .filter((m) => m.screenshotBase64)
              .pop()?.screenshotBase64;

            await window.electron.utio.shareReport({
              type: 'shareReport',
              instruction: lastHumanMessage,
              lastScreenshot,
              report: reportUrl,
            });
          }
        }

        // Only fall back to file download if upload was not configured or failed
        if (!settings?.reportStorageBaseUrl || !uploadSuccess) {
          const blob = new Blob([htmlContent], { type: 'text/html' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `report-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Share failed:', error);
      toast.error('Failed to generate share content', {
        description:
          error instanceof Error ? error.message : JSON.stringify(error),
      });
    } finally {
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
      setIsSharing(false);
      isSharePending.current = false;
    }
  };

  const handleShare = async (type: 'report' | 'video') => {
    if (isSharePending.current) return;

    if (type === 'report' && settings?.reportStorageBaseUrl) {
      setPendingShareType(type);
      setIsShareConfirmOpen(true);
      return;
    }

    await processShare(type, false);
  };

  return (
    <>
      {!running && chatMessages.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-1">
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SquareArrowOutUpRight className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="mr-4">
            <DropdownMenuItem onClick={() => handleShare('report')}>
              <FileText className="mr-2 h-4 w-4" />
              Export as HTML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AlertDialog
        open={isShareConfirmOpen}
        onOpenChange={setIsShareConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Share Report</AlertDialogTitle>
            <AlertDialogDescription>
              📢 Would you like to share your report to help us improve{' '}
              <b>ORBIT</b>? This includes your screen recordings and actions.
              <br />
              <br />
              💡 We encourage you to create a clean and privacy-free desktop
              environment before each use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (pendingShareType) processShare(pendingShareType, false);
              }}
            >
              No, just download
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingShareType) processShare(pendingShareType, true);
              }}
            >
              Yes, continue!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
