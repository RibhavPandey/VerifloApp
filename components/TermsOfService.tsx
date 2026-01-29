import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import Navbar from './Navbar';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const TermsOfService: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <div className="space-y-6">
                <section>
                  <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground">
                    By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">2. Use License</h2>
                  <p className="text-muted-foreground mb-2">
                    Permission is granted to temporarily use this service for personal, non-commercial transitory viewing only.
                  </p>
                  <p className="text-muted-foreground">
                    This is the grant of a license, not a transfer of title, and under this license you may not:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground ml-4 mt-2 space-y-1">
                    <li>Modify or copy the materials</li>
                    <li>Use the materials for any commercial purpose</li>
                    <li>Attempt to reverse engineer any software contained in the service</li>
                    <li>Remove any copyright or other proprietary notations from the materials</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
                  <p className="text-muted-foreground">
                    You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">4. Service Availability</h2>
                  <p className="text-muted-foreground">
                    We strive to provide continuous availability of our service, but we do not guarantee uninterrupted access. We reserve the right to modify, suspend, or discontinue the service at any time.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">5. User Content</h2>
                  <p className="text-muted-foreground">
                    You retain ownership of any content you upload or create using our service. By using our service, you grant us a license to use, store, and process your content solely for the purpose of providing the service.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">6. Prohibited Uses</h2>
                  <p className="text-muted-foreground mb-2">You may not use our service:</p>
                  <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
                    <li>In any way that violates any applicable law or regulation</li>
                    <li>To transmit any malicious code or viruses</li>
                    <li>To attempt to gain unauthorized access to any part of the service</li>
                    <li>To interfere with or disrupt the service or servers</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">7. Limitation of Liability</h2>
                  <p className="text-muted-foreground">
                    In no event shall we be liable for any damages arising out of the use or inability to use the service, including but not limited to data loss or corruption.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">8. Changes to Terms</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to modify these terms at any time. Your continued use of the service after any changes constitutes acceptance of the new terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">9. Contact Information</h2>
                  <p className="text-muted-foreground">
                    If you have any questions about these Terms of Service, please contact us through our support channels.
                  </p>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;
