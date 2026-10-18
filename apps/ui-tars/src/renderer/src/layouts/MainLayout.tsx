import { Outlet } from 'react-router';
import { AppSidebar } from '@/renderer/src/components/SideBar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@renderer/components/ui/sidebar';

export function MainLayout() {
  return (
    <SidebarProvider
      style={{ '--sidebar-width-icon': '72px' }}
      className="flex h-screen w-full orbit-glass-bg text-slate-800 dark:text-slate-100 overflow-hidden transition-colors duration-300"
    >
      <AppSidebar />
      <SidebarInset className="flex-1 bg-transparent overflow-auto select-text">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
