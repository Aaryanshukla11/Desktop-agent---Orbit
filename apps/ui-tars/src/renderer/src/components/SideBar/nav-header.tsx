/**
 
 */
import { useEffect, useState } from 'react';
import { Wifi, Copy, Check } from 'lucide-react';

import { SidebarTrigger } from '@renderer/components/ui/sidebar';

import logoVector from '@resources/logo-vector.png?url';

interface HeaderProps {
  showTrigger: boolean;
}

export function OrbitHeader({ showTrigger }: HeaderProps) {
  const [lanIp, setLanIp] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/ip')
      .then((r) => r.json())
      .then((data) => {
        if (data?.ips?.length) {
          // Prefer Wi-Fi or standard LAN IP
          const preferredIp =
            data.ips.find((ip: string) => ip.startsWith('192.168.') || ip.startsWith('10.')) ||
            data.ips[0];
          setLanIp(preferredIp);
        }
      })
      .catch(() => {});
  }, []);

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lanIp) {
      navigator.clipboard.writeText(`http://${lanIp}:5173`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative flex items-center justify-between w-full px-2 pt-1 pb-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
      <div className="flex items-center gap-2.5 min-w-0 group-data-[collapsible=icon]:justify-center">
        <div className="flex aspect-square size-8 items-center justify-center shrink-0">
          <img src={logoVector} alt="ORBIT" className="size-8 object-contain" />
        </div>
        <div className="flex flex-col min-w-0 text-left group-data-[collapsible=icon]:hidden">
          <span className="font-semibold text-sm text-slate-900 dark:text-white tracking-wide leading-tight truncate">
            ORBIT
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-tight truncate">
            Playground
          </span>
          {lanIp && (
            <div
              onClick={copyUrl}
              title={`Click to copy: http://${lanIp}:5173\nOpen this link on any phone or device on the same network`}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer mt-1 transition-colors"
            >
              <Wifi className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span className="truncate font-mono">{lanIp}:5173</span>
              {copied ? (
                <Check className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-2.5 h-2.5 opacity-60 hover:opacity-100 shrink-0" />
              )}
            </div>
          )}
        </div>
      </div>
      {showTrigger && (
        <SidebarTrigger className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white shrink-0 ml-auto group-data-[collapsible=icon]:hidden" />
      )}
    </div>
  );
}
