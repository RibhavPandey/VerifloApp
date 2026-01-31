
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Navbar from './Navbar';
import VerifloLogo from './VerifloLogo';
import {
  ArrowRight,
  FileText,
  CheckCircle2,
  Play,
  MessageSquare,
  Workflow
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 animate-fade-in-up text-balance font-mono text-5xl font-bold leading-tight text-foreground animation-delay-100 md:text-7xl">
              Hours of Manual Work.{" "}
              <span className="relative inline-block border-4 border-black bg-primary px-4 py-2 text-primary-foreground shadow-lg">
                Done in Seconds
              </span>
            </h1>

            <p className="mb-10 animate-fade-in-up text-pretty text-lg leading-relaxed text-muted-foreground animation-delay-200 md:text-xl">
              Invoice automation, workflow automation, and AI chat—built to save you time. Stop manual data entry. Let automation handle the repetitive work.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 animate-fade-in-up animation-delay-300 sm:flex-row">
              <Button
                onClick={onStart}
                size="lg" 
                className="group w-full bg-orange-500 text-black brutalist-border font-black text-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all sm:w-auto"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-4 font-mono text-lg font-bold sm:w-auto bg-transparent"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            <p className="mt-6 animate-fade-in-up text-sm text-muted-foreground animation-delay-400">
              No credit card required • 14-day free trial • Process unlimited files • Cancel anytime
            </p>
          </div>
        </div>

        {/* Floating Elements */}
        <div
          className="pointer-events-none absolute left-10 top-20 hidden animate-float lg:block"
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        >
          <div className="h-20 w-20 border-4 border-black bg-accent shadow-lg" />
        </div>
        <div
          className="pointer-events-none absolute right-10 top-40 hidden animate-float lg:block animation-delay-200"
          style={{ transform: `translateY(${scrollY * 0.15}px)` }}
        >
          <div className="h-16 w-16 rotate-45 border-4 border-black bg-secondary shadow-lg" />
        </div>
      </section>

      {/* Demo Video Section */}
      <section 
        data-section-id="demo-video"
        className={`py-20 transition-opacity duration-700 ${visibleSections.has('demo-video') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
              See It In Action
            </h2>
            <p className="text-lg text-muted-foreground">
              See invoice automation, workflows, and AI chat in action
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video border-4 border-black bg-muted shadow-2xl">
              {/* Video Placeholder - User will replace this */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full border-4 border-black bg-primary flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                    <Play className="h-10 w-10 text-primary-foreground ml-1" fill="currentColor" />
                  </div>
                  <p className="font-mono font-bold text-lg">Demo Video</p>
                  <p className="text-sm text-muted-foreground mt-2">Replace this placeholder with your demo video</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section 
        id="features" 
        data-section-id="features"
        className={`py-20 transition-opacity duration-700 ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
              Built for Speed
            </h2>
            <p className="text-lg text-muted-foreground">
              Three core features that save you time
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Invoice Automation",
                description: "Extract, process, and organize invoices automatically. No manual data entry. Get clean, structured data ready for your books.",
                color: "bg-primary",
              },
              {
                icon: Workflow,
                title: "Workflow Automation",
                description: "Record your steps once, run them on any file. Monthly reports, data transforms, bulk processing—all automated.",
                color: "bg-accent",
              },
              {
                icon: MessageSquare,
                title: "AI Chat",
                description: "Ask questions about your data in plain English. Get answers, insights, and actions without writing formulas or code.",
                color: "bg-secondary text-black",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className={`group cursor-pointer border-4 border-black p-6 shadow-md transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-2xs ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${index * 100}ms`, transitionDuration: '700ms' }}
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center border-4 border-black ${feature.color} shadow-xs`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-mono text-xl font-bold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section 
        id="how-it-works" 
        data-section-id="how-it-works"
        className={`py-20 transition-opacity duration-700 ${visibleSections.has('how-it-works') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              Save time and stay efficient—here's how
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Connect Your Data",
                description: "Upload invoices or spreadsheets. One-time setup. Your data stays in one place.",
              },
              {
                step: "02",
                title: "Let Automation Run",
                description: "Invoice automation extracts and organizes. Workflows run on schedule. No babysitting.",
              },
              {
                step: "03",
                title: "Ask AI When You Need It",
                description: "Chat with your data. Get answers, run analysis, or trigger actions—no formulas or code.",
              },
              {
                step: "04",
                title: "Focus on What Matters",
                description: "Time back for real work. Automation handles the repetitive stuff so you don't have to.",
              },
            ].map((item, index) => (
              <div key={index} className="relative animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center border-4 border-black bg-primary font-mono text-2xl font-bold text-primary-foreground shadow-md">
                  {item.step}
                </div>
                <h3 className="mb-2 font-mono text-2xl font-bold">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section 
        id="comparison" 
        data-section-id="comparison"
        className={`py-20 transition-opacity duration-700 ${visibleSections.has('comparison') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
              Why Veriflo Saves You Time
            </h2>
            <p className="text-lg text-muted-foreground">
              Built for invoice automation, workflows, and AI—all in one place
            </p>
          </div>

          <div className="mx-auto max-w-4xl space-y-10">
            {[
              { 
                feature: "Invoice automation", 
                otherCons: ["Separate tools for extraction vs accounting", "Manual entry = errors and wasted hours", "No single place for invoices + data"], 
                veriflo: "Built-in extraction and processing. One place. No manual entry."
              },
              { 
                feature: "Workflow automation", 
                otherCons: ["Complex setup, often requires coding", "Steep learning curve", "Different tool for each task"], 
                veriflo: "Record once, run on any file. No code. Same workflow for everything."
              },
              { 
                feature: "AI chat with your data", 
                otherCons: ["Copy-paste to ChatGPT—data leaves your workspace", "No connection to your files", "Context lost between sessions"], 
                veriflo: "Chat directly in your workspace. Data stays put. Full context."
              },
              { 
                feature: "Time to first result", 
                otherCons: ["Hours of setup and learning", "Multiple subscriptions to manage", "Integration headaches"], 
                veriflo: "Minutes to automate. One app. Start in seconds."
              },
            ].map((row, i) => (
              <div key={i} className="pl-6 border-l-2 border-muted-foreground/20">
                <p className="font-mono font-bold text-foreground mb-3">{row.feature}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Other apps</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {row.otherCons.map((con, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="text-destructive/80">×</span>
                          {con}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary uppercase tracking-wide mb-2">Veriflo</p>
                    <p className="flex items-center gap-2 text-foreground font-medium">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      {row.veriflo}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section 
        id="use-cases" 
        data-section-id="use-cases"
        className={`py-20 transition-opacity duration-700 ${visibleSections.has('use-cases') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
              Built for Ecommerce & Finance
            </h2>
            <p className="text-lg text-muted-foreground">
              Invoice automation, workflows, and AI—together
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Invoice Automation",
                description: "Extract data from invoices automatically. No manual entry. Get line items, totals, and vendor info ready for your books.",
                examples: ["PDF invoice extraction", "Bulk processing", "Export to accounting"],
              },
              {
                title: "Workflow Automation",
                description: "Record your steps once, run on any file. Monthly reports, data transforms, and bulk processing—all on autopilot.",
                examples: ["Monthly report generation", "Data transformation", "Bulk file processing"],
              },
              {
                title: "AI Chat",
                description: "Ask questions about your data in plain English. Get answers, run analysis, or trigger actions without formulas or code.",
                examples: ["Data insights", "Quick analysis", "Natural language queries"],
              },
            ].map((useCase, index) => (
              <Card
                key={index}
                className={`border-4 border-black p-6 shadow-md transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-2xs ${visibleSections.has('use-cases') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${index * 150}ms`, transitionDuration: '700ms' }}
              >
                <h3 className="mb-3 font-mono text-2xl font-bold">{useCase.title}</h3>
                <p className="mb-4 text-muted-foreground">{useCase.description}</p>
                <div className="space-y-2">
                  {useCase.examples.map((example, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-2 w-2 border-2 border-black bg-primary" />
                      <span className="text-sm font-medium">{example}</span>
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
        className={`bg-primary py-20 text-primary-foreground transition-opacity duration-700 ${visibleSections.has('cta') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
            Automate Invoices, Workflows & AI—Free
          </h2>
          <p className="mb-8 text-xl text-primary-foreground/90">
            No credit card. Start automating in minutes.
          </p>
          <Button
            onClick={onStart}
            size="lg"
            className="group border-4 border-black bg-secondary font-mono text-lg font-bold text-secondary-foreground shadow-xl hover:bg-secondary/90"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="mt-4 text-sm text-primary-foreground/80">
            14 days free • No credit card • Full feature access • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center border-4 border-black bg-primary">
                  <VerifloLogo size={20} />
                </div>
                <span className="font-mono text-lg font-bold">Veriflo</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Invoice automation, workflow automation, and AI chat for ecommerce and finance.
              </p>
            </div>

            {[
              { title: "Product", links: ["Features", "Pricing", "How It Works", "Use Cases"] },
              { title: "Resources", links: ["Documentation", "Tutorials", "Support", "API"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
            ].map((column, index) => (
              <div key={index}>
                <h3 className="mb-4 font-mono font-bold">{column.title}</h3>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
              <div>
                © 2025 Veriflo. All rights reserved.
              </div>
              <div className="flex gap-6">
                <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
                <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
