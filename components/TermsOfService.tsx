import React from 'react';
import Navbar from './Navbar';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const TermsOfService: React.FC = () => {
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

          <h1 className="text-3xl font-semibold mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-12">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <Section title="1. Acceptance of Terms">
            <p><strong>By creating an account, signing in, or using any part of Veriflo, you confirm that you have read, understood, and agree to these terms.</strong> If you do not agree, you must not use the service.</p>
            <p>You cannot use Veriflo without agreeing to these terms. There is no exception. Using the service counts as your acceptance, even if you did not read this page.</p>
          </Section>

          <Section title="2. What You May and May Not Do">
            <p>You may use Veriflo for your business to process invoices, run workflows, and manage your data.</p>
            <p><strong>You must NOT:</strong></p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Copy, resell, or redistribute the service to others</li>
              <li>Reverse engineer, decompile, or try to extract our code or technology</li>
              <li>Scrape, crawl, or use automated tools to access the service without our permission</li>
              <li>Remove any copyright, trademark, or branding from the service</li>
              <li>Use the service to build a competing product</li>
            </ul>
            <p>If you violate these rules, we may terminate your account immediately without refund.</p>
          </Section>

          <Section title="3. Your Account and Password">
            <p>You are solely responsible for your account and password. Everything that happens under your account is your responsibility.</p>
            <p>If someone else uses your account because you shared your password or did not keep it secure, we are not responsible. You must notify us immediately if you suspect unauthorized access.</p>
          </Section>

          <Section title="4. Service Availability">
            <p>We try to keep Veriflo running, but we do not guarantee that the service will always be available. Downtime can happen for maintenance, technical issues, or other reasons.</p>
            <p>We may change, suspend, or shut down the service at any time, with or without notice. We are not liable if the service is unavailable.</p>
          </Section>

          <Section title="5. Your Data and Content">
            <p>You own the data and files you upload. By using Veriflo, you give us permission to store, process, and display your data only for the purpose of providing the service to you.</p>
            <p>We do not own your data. We do not use your data for advertising or sell it to third parties.</p>
          </Section>

          <Section title="6. Prohibited Uses – You Must Not">
            <p>You must NOT use Veriflo to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Break any law or regulation</li>
              <li>Send viruses, malware, or harmful code</li>
              <li>Try to hack or gain unauthorized access to our systems or other users&apos; accounts</li>
              <li>Overload or disrupt our servers</li>
              <li>Impersonate someone else or use a fake identity</li>
            </ul>
            <p><strong>Violation of this section will result in immediate account termination without refund.</strong></p>
          </Section>

          <Section title="7. Our Liability – Important">
            <p><strong>We are not liable for:</strong></p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>Loss or corruption of your data</li>
              <li>Loss of business, profits, or revenue</li>
              <li>Indirect, incidental, or consequential damages</li>
              <li>Any damages beyond the amount you paid us in the last 12 months</li>
            </ul>
            <p>The service is provided &quot;as is.&quot; We do not guarantee that it will meet your specific needs or be error-free.</p>
          </Section>

          <Section title="8. Changes to These Terms">
            <p>We may update these terms at any time. When we do, we will update the &quot;Last updated&quot; date at the top of this page.</p>
            <p><strong>Your continued use of Veriflo after we post changes means you accept the new terms.</strong> It is your responsibility to check this page. We are not required to email you about every change.</p>
          </Section>

          <Section title="9. Cancellations & Refunds">
            <p><strong>Cancellation:</strong> You may cancel your subscription at any time. After you cancel, you will keep access until the end of your current billing period. After that, your access stops.</p>
            <p><strong>Your data:</strong> We keep your data for 30 days after cancellation. After 30 days, it may be permanently deleted. Export your data before cancelling if you need it.</p>
            <p><strong>Refunds:</strong> Refunds are not guaranteed. We may, at our sole discretion, consider refund requests only if you contact us within 14 days of the charge. We will not refund: (a) partial months, (b) amounts for time you already used the service, or (c) requests made more than 14 days after payment. If we approve a refund, it will be processed within 5–10 business days. Our decision on refunds is final.</p>
            <p>Once you cancel, you cannot claim a refund for the remaining period of your billing cycle.</p>
          </Section>

          <Section title="10. Shipping & Delivery">
            <p>Veriflo is a digital, online service. There is no physical product. There is no shipping.</p>
            <p>You get access immediately after you sign up and pay. You can use the service through your web browser at any time.</p>
          </Section>

          <Section title="11. Contact">
            <p>For questions about these terms, contact us at{' '}
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

export default TermsOfService;
