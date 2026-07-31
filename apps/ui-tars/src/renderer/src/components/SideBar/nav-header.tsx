/**
 
 */
import { useEffect, useState } from 'react';
import { Wifi, Copy, Check } from 'lucide-react';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarTrigger,
} from '@renderer/components/ui/sidebar';

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
    <SidebarMenu className="items-center">
      <SidebarMenuButton
        className="group-data-[collapsible=icon]:p-0! mb-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-transparent"
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
          <img src={logoVector} alt="" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">ORBIT</span>
          <span className="truncate text-xs pb-[1px]">Playground</span>
          {lanIp && (
            <div
              onClick={copyUrl}
              title={`Click to copy: http://${lanIp}:5173\nOpen this link on any phone or device on the same network`}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer mt-0.5"
            >
              <Wifi className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
              <span className="truncate">{lanIp}:5173</span>
              {copied ? (
                <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="w-2.5 h-2.5 opacity-60 hover:opacity-100 shrink-0" />
              )}
            </div>
          )}
        </div>
      </SidebarMenuButton>
      {showTrigger && (
        <SidebarTrigger className="absolute top-12 right-2 group-data-[collapsible=icon]:right-[-36px]" />
      )}
    </SidebarMenu>
  );
}
