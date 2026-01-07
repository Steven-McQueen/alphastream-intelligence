import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { Watchtower } from './Watchtower';
import { CommandPalette } from '@/components/CommandPalette';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'AlphaStream',
  '/intelligence': 'Intelligence',
  '/market': 'Market',
  '/screener': 'Screener',
  '/portfolio': 'Portfolio',
  '/optimizer': 'Optimizer',
  '/simulation': 'Simulation',
};

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const title = ROUTE_TITLES[location.pathname] || 'AlphaStream';

  // Global keyboard shortcut for command palette
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Sidebar */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <TopBar 
          title={title} 
          onCommandPaletteOpen={() => setCommandPaletteOpen(true)} 
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto scrollbar-thin">
          {children}
        </main>
      </div>

      {/* Right Sidebar - Watchtower */}
      <Watchtower />

      {/* Command Palette */}
      <CommandPalette 
        open={commandPaletteOpen} 
        onOpenChange={setCommandPaletteOpen} 
      />
    </div>
  );
}
