import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import Navbar from './Navbar';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
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
              <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <div className="space-y-6">
                <section>
                  <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
                  <p className="text-muted-foreground">
                    We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">2. Information We Collect</h2>
                  <h3 className="text-xl font-semibold mb-2 mt-4">2.1 Information You Provide</h3>
                  <p className="text-muted-foreground mb-2">We collect information that you provide directly to us, including:</p>
                  <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
                    <li>Account information (name, email address)</li>
                    <li>Content you upload or create using our service</li>
                    <li>Communications with our support team</li>
                  </ul>

                  <h3 className="text-xl font-semibold mb-2 mt-4">2.2 Automatically Collected Information</h3>
                  <p className="text-muted-foreground mb-2">We automatically collect certain information when you use our service:</p>
                  <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
                    <li>Usage data and analytics</li>
                    <li>Device information</li>
                    <li>Log data (IP address, browser type, access times)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">3. How We Use Your Information</h2>
                  <p className="text-muted-foreground mb-2">We use the information we collect to:</p>
                  <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
                    <li>Provide, maintain, and improve our service</li>
                    <li>Process transactions and send related information</li>
                    <li>Send technical notices and support messages</li>
                    <li>Respond to your comments and questions</li>
                    <li>Monitor and analyze usage patterns</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">4. Information Sharing and Disclosure</h2>
                  <p className="text-muted-foreground mb-2">We do not sell your personal information. We may share your information only:</p>
                  <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
                    <li>With your consent</li>
                    <li>To comply with legal obligations</li>
                    <li>To protect our rights and safety</li>
                    <li>With service providers who assist in operating our service (under strict confidentiality agreements)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">5. Data Security</h2>
                  <p className="text-muted-foreground">
                    We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">6. Your Rights (GDPR)</h2>
                  <p className="text-muted-foreground mb-2">If you are located in the European Economic Area, you have certain rights regarding your personal information:</p>
                  <ul className="list-disc list-inside text-muted-foreground ml-4 space-y-1">
                    <li>Right to access your personal data</li>
                    <li>Right to rectify inaccurate data</li>
                    <li>Right to erasure ("right to be forgotten")</li>
                    <li>Right to restrict processing</li>
                    <li>Right to data portability</li>
                    <li>Right to object to processing</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    To exercise these rights, please contact us through our support channels.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">7. Data Retention</h2>
                  <p className="text-muted-foreground">
                    We retain your personal information for as long as necessary to provide our service and fulfill the purposes outlined in this policy, unless a longer retention period is required by law.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">8. Children's Privacy</h2>
                  <p className="text-muted-foreground">
                    Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">9. Changes to This Privacy Policy</h2>
                  <p className="text-muted-foreground">
                    We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">10. Contact Us</h2>
                  <p className="text-muted-foreground">
                    If you have any questions about this Privacy Policy, please contact us through our support channels.
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

export default PrivacyPolicy;
