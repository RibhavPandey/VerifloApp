import React from 'react';
import Navbar from './Navbar';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="pb-8 mb-8 border-b border-muted-foreground/20 last:border-0">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      <div className="text-muted-foreground space-y-2">{children}</div>
    </section>
  );

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Button onClick={() => navigate(-1)} variant="ghost" className="mb-8 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <h1 className="text-3xl font-semibold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-12">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <Section title="1. Introduction">
            <p><strong>By using Veriflo, you agree to this Privacy Policy.</strong> If you do not agree, do not use the service.</p>
            <p>This policy explains in plain language what data we collect, why we collect it, how we use it, and your rights. We have written it so that anyone can understand it.</p>
          </Section>

          <Section title="2. What Data We Collect">
            <h3 className="text-lg font-medium mt-4 mb-2 text-foreground">2.1 Data You Give Us</h3>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Account info:</strong> Name, email address, password (encrypted)</li>
              <li><strong>Your files:</strong> Invoices, spreadsheets, and other documents you upload</li>
              <li><strong>Support messages:</strong> Emails or messages you send us</li>
            </ul>
            <h3 className="text-lg font-medium mt-4 mb-2 text-foreground">2.2 Data We Collect Automatically</h3>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Usage data:</strong> Which features you use, how often you log in</li>
              <li><strong>Device info:</strong> Browser type, device type, screen size</li>
              <li><strong>Log data:</strong> IP address, access times, pages visited</li>
            </ul>
            <p>We need this data to run the service, fix problems, and improve it. We do not collect data we do not need.</p>
          </Section>

          <Section title="3. How We Use Your Data">
            <p>We use your data only to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Provide and run the Veriflo service</li>
              <li>Process your subscription and payments</li>
              <li>Send you important notices (e.g. password reset, billing)</li>
              <li>Respond to your support requests</li>
              <li>Improve the service and fix bugs</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p><strong>We do not sell your data. We do not use your data for advertising.</strong></p>
          </Section>

          <Section title="4. When We Share Your Data">
            <p>We do not sell or rent your data to anyone.</p>
            <p>We may share your data only in these cases:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Service providers:</strong> Companies that help us run Veriflo (e.g. hosting, payment processing). They are bound by contracts to protect your data.</li>
              <li><strong>Legal requirement:</strong> If a court or law requires us to hand over data</li>
              <li><strong>Safety:</strong> To protect our rights, your safety, or the safety of others</li>
            </ul>
            <p>We will not share your data for marketing or with third parties for their own use.</p>
          </Section>

          <Section title="5. Data Security">
            <p>We use industry-standard measures to protect your data (encryption, secure servers, access controls).</p>
            <p><strong>However:</strong> No system is 100% secure. We cannot guarantee that your data will never be breached. You use the service at your own risk.</p>
          </Section>

          <Section title="6. Your Rights (Including GDPR)">
            <p>Depending on where you live, you may have the right to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Access:</strong> Request a copy of the data we hold about you</li>
              <li><strong>Correct:</strong> Ask us to fix inaccurate data</li>
              <li><strong>Delete:</strong> Ask us to delete your data (&quot;right to be forgotten&quot;)</li>
              <li><strong>Restrict:</strong> Ask us to limit how we use your data</li>
              <li><strong>Portability:</strong> Request your data in a format you can use elsewhere</li>
            </ul>
            <p>To exercise any of these rights, email us at{' '}
              <a href="mailto:ribhavkumarpandey@gmail.com" className="text-primary hover:underline">
                ribhavkumarpandey@gmail.com
              </a>. We will respond within 30 days.
            </p>
          </Section>

          <Section title="7. How Long We Keep Your Data">
            <p>We keep your data for as long as you have an account. After you delete your account or cancel, we may keep some data for up to 30 days (e.g. for backups or to resolve disputes).</p>
            <p>We may keep certain data longer if required by law (e.g. tax records, legal compliance).</p>
          </Section>

          <Section title="8. Children">
            <p>Veriflo is not for children under 13. We do not knowingly collect data from anyone under 13. If you are a parent and believe your child gave us data, contact us and we will delete it.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will change the &quot;Last updated&quot; date when we do.</p>
            <p><strong>Your continued use of Veriflo after we post changes means you accept the new policy.</strong> Check this page periodically.</p>
          </Section>

          <Section title="10. Contact Us">
            <p>For privacy questions or to exercise your rights, contact us at{' '}
              <a href="mailto:ribhavkumarpandey@gmail.com" className="text-primary hover:underline">
                ribhavkumarpandey@gmail.com
              </a>.
            </p>
          </Section>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
