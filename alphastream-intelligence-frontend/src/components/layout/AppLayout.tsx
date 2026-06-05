import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { SecondaryNav } from './SecondaryNav';
import { AppSidebar } from './AppSidebar';
import { Watchtower } from './Watchtower';
import { CommandPalette } from '@/components/layout/CommandPalette';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'AlphaStream',
  '/intelligence': 'Intelligence',
  '/market': 'Market',
  '/screener': 'Screener',
  '/earnings': 'Earnings',
  '/portfolio': 'Portfolio',
  '/optimizer': 'Optimizer',
  '/notebook': 'Notebook',
  '/simulation': 'Simulation',
  '/news': 'News',
  '/politicians': 'Politicians',
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

        {/* Secondary Navigation */}
        <SecondaryNav />

        {/* Page Content — constrained to a consistent max width (like News),
            centered. Pages that already cap at max-w-[1500px] are unaffected. */}
        <main className="flex-1 overflow-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1500px] h-full">
            {children}
          </div>
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
