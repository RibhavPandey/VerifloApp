
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Navbar from './Navbar';
import VerifloLogo from './VerifloLogo';
import {
  ArrowRight,
  FileText,
  CheckCircle2,
  Check,
  MessageSquare,
  Workflow,
  X,
  Minus
} from "lucide-react";

interface LandingPageProps {
  onStart: () => void;
  onPricing: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onPricing }) => {
  const [scrollY, setScrollY] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id');
          if (sectionId) {
            setVisibleSections(prev => new Set(prev).add(sectionId));
          }
        }
      });
    }, observerOptions);

    // Observe all sections with data-section-id
    const sections = document.querySelectorAll('[data-section-id]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  // Auto-play video when section becomes visible
  useEffect(() => {
    const video = document.querySelector('[data-video-demo]') as HTMLVideoElement;
    if (video && visibleSections.has('demo-video')) {
      video.play().catch((error) => {
        console.log('Video autoplay prevented:', error);
      });
    }
  }, [visibleSections]);

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-b from-[#7f9ddf] via-blue-500 to-blue-50">
        <Navbar />

        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 md:py-22 lg:py-14">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="mx-auto max-w-5xl text-center">
              <h1 className="mb-5 md:mb-7 animate-fade-in-up text-balance text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-tight text-white animation-delay-100">
                Stop copy-pasting invoices{" "}
                <span className="text-white">
                  20 invoices → Tally in 5 minutes
                </span>
              </h1>

              <p className="mb-9 md:mb-11 animate-fade-in-up text-pretty text-base sm:text-lg md:text-xl leading-relaxed text-white/90 animation-delay-200 max-w-3xl mx-auto">
                Extract invoices, automate workflows, chat with your data—all in one workspace. Export to Tally, QuickBooks, Zoho.
              </p>

              <div className="flex flex-col items-center justify-center gap-3.5 animate-fade-in-up animation-delay-300 sm:flex-row">
                <Button
                  onClick={() => window.location.href = '/auth?demo=1'}
                  size="lg"
                  className="group w-full sm:w-auto bg-white text-[#7f9ddf] hover:bg-white/90 font-semibold text-sm sm:text-base rounded-xl px-7 py-5 shadow-lg hover:shadow-xl transition-all"
                >
                  Try Demo
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

            </div>

            {/* App Interface Image */}
            <section
              data-section-id="demo-video"
              className={`py-12 md:py-16 transition-opacity duration-700 ${visibleSections.has('demo-video') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                  {/* Outer container with gradient background */}
                  <div
                    className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl"
                    style={{
                      backgroundImage: 'url(/video-background.png)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      backgroundColor: '#1a1a1a'
                    }}
                  >
                    {/* Inner container - smaller video with equal padding on all sides */}
                    <div className="absolute inset-8 md:inset-12 lg:inset-16 xl:inset-20 rounded-2xl overflow-hidden bg-gray-900 shadow-xl">
                      <video
                        data-video-demo
                        className="w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        style={{
                          pointerEvents: 'none'
                        }}
                      >
                        <source src="/demo-video.mp4" type="video/mp4" />
                        <source src="/demo-video.webm" type="video/webm" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>

      {/* Demo Video Section
      <section 
        data-section-id="demo-video"
        className={`py-12 md:py-16 transition-opacity duration-700 ${visibleSections.has('demo-video') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900">
              See It In Action
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Watch: Invoice upload → extraction → review → export to Tally in under 2 minutes.
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-100 shadow-2xl">
              <video
                className="w-full h-full object-contain"
                controls
                preload="metadata"
              >
                <source src="/demo-video.mp4" type="video/mp4" />
                <source src="/demo-video.webm" type="video/webm" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section> */}

      {/* Features Section */}
      <section
        id="features"
        data-section-id="features"
        className={`py-24 md:py-32 transition-opacity duration-700 bg-white ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900">
              Why Veriflo Beats the Tools You Use Now
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              What you do now vs Veriflo
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Invoice Automation",
                description: "Nanonets/Rossum extract, then you export manually. Column mapping? You. Veriflo: Extract → Review risky fields → Export to Tally/QuickBooks/Zoho. One click.",
                color: "bg-primary",
              },
              {
                icon: Workflow,
                title: "Workflow Automation",
                description: "Zapier = per-app setup. Excel macros = code. Veriflo: Record your steps once. Run on any file. No code.",
                color: "bg-accent",
              },
              {
                icon: MessageSquare,
                title: "AI Chat",
                description: "Copy-paste to ChatGPT. Data leaves. Context lost next session. Veriflo: Chat in your workspace. Data stays. Full context.",
                color: "bg-primary",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className={`group cursor-pointer bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${index * 100}ms`, transitionDuration: '700ms' }}
              >
                <div
                  className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl ${feature.color} shadow-sm`}
                >
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        data-section-id="how-it-works"
        className={`py-24 md:py-32 transition-opacity duration-700 bg-gray-50 ${visibleSections.has('how-it-works') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900">
              How It Works
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              Save time and stay efficient—here's how
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Connect Your Data",
                description: "Upload invoices or spreadsheets. One place.",
              },
              {
                step: "02",
                title: "Extract & Export",
                description: "AI extracts. You review risky fields. Export to your accounting software.",
              },
              {
                step: "03",
                title: "Ask AI",
                description: "Ask questions. Get answers. Data stays in your workspace.",
              },
              {
                step: "04",
                title: "Focus",
                description: "Focus on decisions. Automation handles the rest.",
              },
            ].map((item, index) => (
              <div key={index} className="relative animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-white shadow-sm">
                  {item.step}
                </div>
                <h3 className="mb-3 text-2xl font-bold text-gray-900">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section
        id="comparison"
        data-section-id="comparison"
        className={`py-24 md:py-32 transition-opacity duration-700 bg-white ${visibleSections.has('comparison') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[90rem]">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900">
              The Veriflo Difference
            </h2>
            <p className="text-xl sm:text-2xl text-gray-600">
              20 invoices → spreadsheet → accounting in under 5 minutes.
            </p>
          </div>

          <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="py-7 px-8 lg:px-10 text-left text-base lg:text-lg font-semibold text-gray-900">Top Features</th>
                  <th className="py-7 px-8 lg:px-10 text-center text-base lg:text-lg font-semibold text-gray-900">Veriflo</th>
                  <th className="py-7 px-8 lg:px-10 text-center text-base lg:text-lg font-semibold text-gray-900">Other AI Tools</th>
                  <th className="py-7 px-8 lg:px-10 text-center text-base lg:text-lg font-semibold text-gray-900">Spreadsheets / Manual</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Extract invoices → review → one-click export to Tally, QuickBooks, Zoho", veriflo: "yes", other: "no", manual: "no" },
                  { feature: "Record a workflow once, replay on new files—no code", veriflo: "yes", other: "maybe", manual: "no" },
                  { feature: "Ask questions in plain English; data stays in your workspace", veriflo: "yes", other: "no", manual: "no" },
                  { feature: "Bulk process 20+ invoices in minutes, not hours", veriflo: "yes", other: "maybe", manual: "no" },
                  { feature: "One app for extraction, automation, and chat—one subscription", veriflo: "yes", other: "no", manual: "na" },
                ].map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-7 px-8 lg:px-10 text-left text-base lg:text-lg text-gray-700">{row.feature}</td>
                    <td className="py-7 px-8 lg:px-10 text-center">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                        <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
                      </span>
                    </td>
                    <td className="py-7 px-8 lg:px-10 text-center">
                      {row.other === "yes" ? (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                          <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
                        </span>
                      ) : row.other === "maybe" ? (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-gray-500 text-base font-medium">?</span>
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                          <X className="h-5 w-5 text-gray-400" strokeWidth={2.5} />
                        </span>
                      )}
                    </td>
                    <td className="py-7 px-8 lg:px-10 text-center">
                      {row.manual === "yes" ? (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                          <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
                        </span>
                      ) : row.manual === "na" ? (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                          <Minus className="h-5 w-5 text-gray-400" strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                          <X className="h-5 w-5 text-gray-400" strokeWidth={2.5} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section
        id="use-cases"
        data-section-id="use-cases"
        className={`py-24 md:py-32 transition-opacity duration-700 bg-gray-50 ${visibleSections.has('use-cases') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900">
              Built for Finance Teams, E-commerce Teams, and Data Teams
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              One app. One workflow. One export.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Invoice teams",
                description: "Extract → Review → Export. Tally, QuickBooks, Zoho. No manual mapping.",
                examples: ["PDF invoice extraction", "Bulk processing", "One-click accounting export"],
              },
              {
                title: "Monthly close",
                description: "Record your report steps once. Run on next month's file. Same workflow.",
                examples: ["Monthly report generation", "Data transformation", "Bulk file processing"],
              },
              {
                title: "Data questions",
                description: "Ask 'What's the total by vendor?' in plain English. No formulas. No copy-paste.",
                examples: ["Data insights", "Quick analysis", "Natural language queries"],
              },
            ].map((useCase, index) => (
              <Card
                key={index}
                className={`bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 ${visibleSections.has('use-cases') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${index * 150}ms`, transitionDuration: '700ms' }}
              >
                <h3 className="mb-4 text-2xl font-bold text-gray-900">{useCase.title}</h3>
                <p className="mb-6 text-gray-600 leading-relaxed">{useCase.description}</p>
                <div className="space-y-3">
                  {useCase.examples.map((example, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-sm font-medium text-gray-700">{example}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        data-section-id="cta"
        className={`bg-gradient-to-br from-blue-500 to-blue-600 py-24 md:py-32 text-white transition-opacity duration-700 ${visibleSections.has('cta') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-bold">
            One App. One Subscription. Replace 3 Tools.
          </h2>
          <p className="mb-10 text-xl sm:text-2xl text-white/90 max-w-2xl mx-auto">
            14 days free. No credit card. Full access. Cancel anytime.
          </p>
          <Button
            onClick={() => window.location.href = '/auth?demo=1'}
            size="lg"
            className="group bg-white text-primary hover:bg-gray-50 font-semibold text-lg rounded-xl px-8 py-6 shadow-xl hover:shadow-2xl transition-all"
          >
            Try Demo
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="mt-6 text-sm sm:text-base text-white/80">
            14 days free • No credit card • Full feature access • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-16 border-t border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <VerifloLogo size={20} />
                </div>
                <span className="text-lg font-bold text-gray-900">Veriflo</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Invoice automation, workflow automation, and AI chat for ecommerce and finance.
              </p>
            </div>

            {[
              { title: "Product", links: ["Features", "Pricing", "How It Works", "Use Cases"] },
              { title: "Resources", links: ["Documentation", "Tutorials", "Support", "API"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
            ].map((column, index) => (
              <div key={index}>
                <h3 className="mb-4 font-semibold text-gray-900">{column.title}</h3>
                <ul className="space-y-3">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a href={link === "Contact" ? "/contact" : "#"} className="text-sm text-gray-600 transition-colors hover:text-primary">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-16 pt-8 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
              <div>
                © 2025 Veriflo. All rights reserved.
              </div>
              <div className="flex gap-6">
                <a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a>
                <a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
                <a href="/contact" className="hover:text-primary transition-colors">Contact</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
