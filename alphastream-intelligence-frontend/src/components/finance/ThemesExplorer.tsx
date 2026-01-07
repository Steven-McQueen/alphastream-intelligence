import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Compass } from 'lucide-react';
import { getThemes } from '@/data/mockFinanceHome';

export function ThemesExplorer() {
  const navigate = useNavigate();
  const themes = getThemes();

  const handleExplore = (prompt: string) => {
    navigate(`/intelligence?q=${encodeURIComponent(prompt)}`);
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Compass className="h-5 w-5" />
          Themes & Sectors to Explore
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {themes.map((theme) => (
            <div
              key={theme.id}
              className="group bg-muted/30 rounded-lg p-4 border border-border/50 hover:border-primary/50 transition-all hover:bg-muted/50"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-sm leading-tight">{theme.title}</h3>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 ml-2 flex-shrink-0"
                >
                  {theme.type}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                {theme.description}
              </p>
              <p className="text-[10px] text-primary/70 mb-3">
                Screen: {theme.screenCriteria}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                onClick={() => handleExplore(theme.prompt)}
              >
                Explore
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
