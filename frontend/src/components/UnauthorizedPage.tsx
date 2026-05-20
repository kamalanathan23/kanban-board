import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

export function UnauthorizedPage({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            You do not have permission to view this page. If you believe this is a mistake, contact an
            administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Your account is signed in, but your role does not include the required permissions for this area.
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={onGoHome}>
            Back to board
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
