import React from 'react';
import Navbar from './Navbar';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';

const ContactUs: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Button onClick={() => navigate(-1)} variant="ghost" className="mb-8 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <h1 className="text-3xl font-semibold mb-2">Contact Us</h1>
          <p className="text-muted-foreground mb-12">
            For questions, support, refund requests, or feedback, reach out using the email below. Please read our <a href="/terms" className="text-primary hover:underline">Terms of Service</a> and <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> first—many questions are answered there.
          </p>

          <div className="pb-8 mb-8 border-b border-muted-foreground/20">
            <h2 className="text-2xl font-semibold mb-4">Email</h2>
            <p className="text-muted-foreground mb-2">
              Send us an email at{' '}
              <a
                href="mailto:ribhavkumarpandey@gmail.com"
                className="text-primary hover:underline font-medium"
              >
                ribhavkumarpandey@gmail.com
              </a>
            </p>
            <p className="text-sm text-muted-foreground">
              We typically respond within 24–48 hours.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContactUs;
