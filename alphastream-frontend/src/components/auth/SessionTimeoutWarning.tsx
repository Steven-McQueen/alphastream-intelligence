import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock } from 'lucide-react';

interface SessionTimeoutWarningProps {
  open: boolean;
  remainingTime: number;
  onContinue: () => void;
}

export function SessionTimeoutWarning({
  open,
  remainingTime,
  onContinue,
}: SessionTimeoutWarningProps) {
  const seconds = Math.ceil(remainingTime / 1000);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <AlertDialogTitle>Session Expiring</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            Your session will expire in{' '}
            <span className="font-semibold text-foreground">{seconds} seconds</span>{' '}
            due to inactivity. Click continue to stay signed in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onContinue}>
            Continue Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
