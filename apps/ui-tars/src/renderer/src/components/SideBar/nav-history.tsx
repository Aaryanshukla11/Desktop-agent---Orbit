/**
 
 */
import { useState } from 'react';
import {
  MoreHorizontal,
  Trash2,
  History,
  ChevronRight,
  Laptop,
  Compass,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@renderer/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible';
import { SessionItem } from '@renderer/db/session';
import { ShareOptions } from './share';

import { Operator } from '@main/store/types';
import { DeleteSessionDialog } from '@renderer/components/AlertDialog/delSessionDialog';

const getIcon = (operator: Operator, isActive: boolean) => {
  const isRemote =
    operator === Operator.RemoteComputer || operator === Operator.RemoteBrowser;
  const isComputer =
    operator === Operator.LocalComputer || operator === Operator.RemoteComputer;

  const MainIcon = isComputer ? Laptop : Compass;

  return (
    <div className="relative flex items-center gap-1">
      <MainIcon className={`w-4 h-4 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`} />
      <div
        className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full text-[6px] flex items-center justify-center font-bold leading-none bg-slate-200 dark:bg-slate-900 border ${isActive ? 'text-cyan-700 dark:text-cyan-300 border-cyan-500/60' : 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`}
      >
        {isRemote ? 'R' : 'L'}
      </div>
    </div>
  );
};

export function NavHistory({
  currentSessionId,
  history,
  onSessionClick,
  onSessionDelete,
}: {
  currentSessionId: string;
  history: SessionItem[];
  onSessionClick: (id: string) => void;
  onSessionDelete: (id: string) => void;
}) {
  const [isShareConfirmOpen, setIsShareConfirmOpen] = useState(false);
  const [id, setId] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const { setOpen, state } = useSidebar();

  const handleDelete = (id: string) => {
    setIsShareConfirmOpen(true);
    setId(id);
  };

  const handleHistory = () => {
    if (state === 'collapsed') {
      setOpen(true);
      setTimeout(() => {
        setIsHistoryOpen(true);
      }, 10);
    }
  };

  return (
    <>
      <SidebarGroup>
        <SidebarMenu className="items-center">
          <Collapsible
            key={'History'}
            asChild
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            className="group/collapsible"
          >
            <SidebarMenuItem className="w-full flex flex-col items-center">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className="!pr-2 font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                  onClick={handleHistory}
                >
                  <History strokeWidth={2} />
                  <span>History</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent className="w-full">
                <SidebarMenuSub className="!mr-0 !pr-1">
                  {history.map((item) => (
                    <SidebarMenuSubItem key={item.id} className="group/item">
                      <SidebarMenuSubButton
                        className={`rounded-xl py-5 cursor-pointer transition-all duration-200 ${item.id === currentSessionId ? 'text-slate-900 dark:text-white bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/15 backdrop-blur-md shadow-sm font-medium' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}`}
                        onClick={() => onSessionClick(item.id)}
                      >
                        {getIcon(
                          item.meta.operator,
                          item.id === currentSessionId,
                        )}
                        <span className="max-w-38 truncate">{item.name}</span>
                      </SidebarMenuSubButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction className="invisible group-hover/item:visible [&[data-state=open]]:visible mt-1">
                            <MoreHorizontal />
                            <span className="sr-only">More</span>
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="rounded-lg"
                          side={'right'}
                          align={'start'}
                        >
                          <ShareOptions sessionId={item.id} />
                          <DropdownMenuItem
                            className="text-red-400 focus:bg-red-50 focus:text-red-500"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="text-red-400" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroup>
      <DeleteSessionDialog
        open={isShareConfirmOpen}
        onOpenChange={setIsShareConfirmOpen}
        onConfirm={() => onSessionDelete(id)}
      />
    </>
  );
}
