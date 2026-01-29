import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Shield } from 'lucide-react';

const AdminSupport: React.FC = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Support Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Support ticket management will be available in a future update.
            For now, please manage support requests through your support email or help desk system.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSupport;
