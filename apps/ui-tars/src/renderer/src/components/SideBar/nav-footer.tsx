/**
 
 */
import { Settings } from 'lucide-react';

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
} from '@renderer/components/ui/sidebar';

interface NavSettingsProps {
  onClick: () => void;
}

export function NavSettings({ onClick }: NavSettingsProps) {
  return (
    <SidebarGroup>
      <SidebarMenu className="items-center">
        <SidebarMenuButton
          className="font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all duration-200"
          onClick={onClick}
        >
          <Settings className="w-4 h-4 text-slate-500 dark:text-slate-300" />
          <span>Settings</span>
        </SidebarMenuButton>
      </SidebarMenu>
    </SidebarGroup>
  );
}
