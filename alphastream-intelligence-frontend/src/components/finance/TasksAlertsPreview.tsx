import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, ArrowRight } from 'lucide-react';
import { getTasksAlerts } from '@/data/mockFinanceHome';

export function TasksAlertsPreview() {
  const navigate = useNavigate();
  const tasks = getTasksAlerts();

  const handleDesignTask = () => {
    const prompt = "Help me define an automated weekly review workflow for my US equity portfolio.";
    navigate(`/intelligence?q=${encodeURIComponent(prompt)}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-positive/20 text-positive border-positive/30';
      case 'Planned':
        return 'bg-primary/20 text-primary border-primary/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Card className="border-border border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
          <Bell className="h-5 w-5" />
          Tasks & Alerts
          <Badge variant="outline" className="text-[10px] ml-2">Coming Soon</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-md"
          >
            <span className="text-sm text-muted-foreground">{task.title}</span>
            <Badge variant="outline" className={`text-[10px] ${getStatusColor(task.status)}`}>
              {task.status}
            </Badge>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={handleDesignTask}
        >
          Design a new task in Intelligence
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
