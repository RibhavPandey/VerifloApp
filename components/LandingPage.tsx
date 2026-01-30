
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Navbar from './Navbar';
import VerifloLogo from './VerifloLogo';
import {
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  Database,
  Zap,
  CheckCircle2,
  Brain,
  FileStack,
  Shield,
  Clock,
  Eye,
  Download,
  Play,
  AlertCircle,
  Workflow,
  Star,
  Users,
  Quote
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
            <div className="mb-6 inline-flex animate-fade-in-up items-center gap-2 border-4 border-black bg-secondary px-4 py-2 font-mono text-sm font-bold shadow-md">
              <Sparkles className="h-4 w-4" />
              <span>TRUSTED BY PROFESSIONALS WORLDWIDE</span>
            </div>

            <h1 className="mb-6 animate-fade-in-up text-balance font-mono text-5xl font-bold leading-tight text-foreground animation-delay-100 md:text-7xl">
              Hours of Excel Work.{" "}
              <span className="relative inline-block border-4 border-black bg-primary px-4 py-2 text-primary-foreground shadow-lg">
                Done in Minutes
              </span>
            </h1>

            <p className="mb-10 animate-fade-in-up text-pretty text-lg leading-relaxed text-muted-foreground animation-delay-200 md:text-xl">
              AI handles data cleaning, formula generation, multi-file analysis, and workflow automation. Process thousands of rows in seconds. Export to any format. No manual entry. No errors.
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

      {/* Trust Indicators Bar */}
      <section 
        data-section-id="trust-indicators"
        className={`py-8 transition-opacity duration-700 ${visibleSections.has('trust-indicators') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-mono font-bold text-lg">Growing Community</span>
            </div>
            <div className="flex items-center gap-2">
              <FileStack className="h-5 w-5 text-primary" />
              <span className="font-mono font-bold text-lg">Trusted Platform</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary fill-primary" />
              <span className="font-mono font-bold text-lg">Highly Rated</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-mono font-bold text-lg">Secure & Reliable</span>
            </div>
          </div>
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
              Watch how Veriflo transforms your workflow in under 2 minutes
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
              Smart Automation. Full Control. Zero Manual Work.
            </h2>
            <p className="text-lg text-muted-foreground">
              The only Excel tool that thinks like you do
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Brain,
                title: "AI Formula Generator",
                description: "Describe what you want in plain English. Get complex formulas, pivot tables, and calculations instantly. No coding required.",
                color: "bg-primary",
              },
              {
                icon: Database,
                title: "Smart Data Cleaning",
                description: "Automatically detect and fix errors, duplicates, formatting issues, and inconsistencies across thousands of rows in seconds.",
                color: "bg-accent",
              },
              {
                icon: Eye,
                title: "Full File Analysis",
                description: "Get instant insights, summaries, trend analysis, and recommendations from your entire spreadsheet. Understand your data at a glance.",
                color: "bg-secondary text-black",
              },
              {
                icon: FileStack,
                title: "Multi-File Processing",
                description: "Merge, compare, and analyze multiple spreadsheets simultaneously. Handle complex data relationships across files effortlessly.",
                color: "bg-primary",
              },
              {
                icon: Workflow,
                title: "Automated Workflows",
                description: "Record your actions once, run them automatically on any file. Save hours on repetitive tasks with reusable workflows.",
                color: "bg-accent",
              },
              {
                icon: Download,
                title: "Export Anywhere",
                description: "Export to Excel, CSV, or any ERP format. Perfect formatting for QuickBooks, SAP, NetSuite, and custom integrations.",
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
              From messy spreadsheets to clean, analyzed data in four simple steps
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Upload Your Files",
                description: "Drag and drop your Excel files, CSVs, or spreadsheets. Supports .xlsx, .xls, .csv formats.",
              },
              {
                step: "02",
                title: "AI Analyzes & Cleans",
                description: "Our AI reads your data, identifies issues, suggests fixes, and prepares everything for analysis.",
              },
              {
                step: "03",
                title: "Automate & Transform",
                description: "Generate formulas, create workflows, merge files, or ask questions in natural language.",
              },
              {
                step: "04",
                title: "Export & Integrate",
                description: "Download clean, structured data ready for your accounting system, ERP, or reporting tools.",
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

      {/* Testimonials Section */}
      <section 
        data-section-id="testimonials"
        className={`py-20 transition-opacity duration-700 ${visibleSections.has('testimonials') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
              Loved by Finance & Data Teams
            </h2>
            <p className="text-lg text-muted-foreground">
              See what professionals are saying about Veriflo
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Sarah Chen",
                role: "CFO, TechCorp",
                content: "We've cut our monthly reporting time from 40 hours to 8 hours. The AI formula generator alone saves us 15+ hours per week. Game changer.",
                rating: 5,
              },
              {
                name: "Michael Rodriguez",
                role: "Data Analyst, FinanceCo",
                content: "The multi-file processing feature is incredible. We process 50+ spreadsheets monthly and Veriflo handles everything automatically. Highly recommend.",
                rating: 5,
              },
              {
                name: "Emily Watson",
                role: "Operations Manager, Growth Inc",
                content: "Best investment we've made this year. The workflow automation has eliminated so much manual work. Our team can finally focus on strategy instead of data entry.",
                rating: 5,
              },
            ].map((testimonial, index) => (
              <Card
                key={index}
                className={`border-4 border-black p-6 shadow-md ${visibleSections.has('testimonials') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${index * 150}ms`, transitionDuration: '700ms' }}
              >
                <div className="mb-4 flex items-center gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-primary fill-primary" />
                  ))}
                </div>
                <Quote className="h-8 w-8 text-primary/30 mb-4" />
                <p className="mb-6 text-muted-foreground italic leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-mono font-bold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section 
        id="benefits" 
        data-section-id="benefits"
        className={`py-20 transition-opacity duration-700 ${visibleSections.has('benefits') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="relative order-2 lg:order-1">
              <div className="relative rounded-none border-4 border-black bg-card p-8 shadow-xl">
                <div className="mb-6 flex items-center gap-3 border-b-4 border-black pb-4">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <span className="font-mono text-lg font-bold">sales_data_q1.xlsx</span>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Total Revenue", value: "$1,245,000", verified: true },
                    { label: "Growth Rate", value: "+23.5%", verified: true },
                    { label: "Top Product", value: "Product A", verified: true },
                    { label: "Anomaly Detected", value: "Q3 spike", verified: false },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex animate-fade-in items-center justify-between border-2 border-black bg-background p-3"
                      style={{ animationDelay: `${i * 150}ms` }}
                    >
                      <div>
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                        <div className="font-mono font-bold">{item.value}</div>
                      </div>
                      {item.verified ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-accent" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -right-4 -top-4 h-20 w-20 animate-spin-slow border-4 border-black bg-secondary shadow-lg" />
              <div className="absolute -bottom-4 -left-4 h-16 w-16 animate-bounce border-4 border-black bg-accent shadow-lg" />
            </div>

            <div className="order-1 lg:order-2">
              <div className="mb-4 inline-flex items-center gap-2 border-4 border-black bg-accent px-3 py-1 font-mono text-sm font-bold text-accent-foreground shadow-xs">
                INTELLIGENT AUTOMATION
              </div>
              <h2 className="mb-6 font-mono text-4xl font-bold leading-tight md:text-5xl">
                The Problem With Spreadsheets? They Don't Think.
              </h2>
              <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
                Most Excel tools just move data around. Veriflo understands your data, finds patterns, suggests improvements, and automates repetitive work. You get insights, not just spreadsheets. You get time back, not more busywork.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Clock, text: "Save 20+ hours per week on spreadsheet tasks" },
                  { icon: Shield, text: "Reduce data entry errors by 95%" },
                  { icon: CheckCircle2, text: "Audit-ready data with full change history" },
                  { icon: Zap, text: "Process files with 10,000+ rows instantly" },
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border-2 border-black bg-primary">
                      <benefit.icon className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span className="text-lg">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>
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
              Built for Finance, Operations & Data Teams
            </h2>
            <p className="text-lg text-muted-foreground">
              Real workflows for real professionals
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Financial Analysis & Reporting",
                description: "Automate monthly close processes, generate financial reports, and analyze revenue trends. Extract insights from complex financial data without manual calculations.",
                examples: ["Revenue analysis", "Expense categorization", "Budget vs actual reports"],
              },
              {
                title: "Data Cleaning & Preparation",
                description: "Clean messy data from multiple sources. Remove duplicates, fix formatting, standardize values, and prepare data for analysis or import into other systems.",
                examples: ["Customer data cleanup", "Product catalog standardization", "Transaction reconciliation"],
              },
              {
                title: "Workflow Automation",
                description: "Record repetitive Excel tasks once, then run them automatically on any file. Perfect for monthly reports, data transformations, and routine data processing.",
                examples: ["Monthly report generation", "Data transformation pipelines", "Bulk file processing"],
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
            Process Your First Spreadsheet Free
          </h2>
          <p className="mb-8 text-xl text-primary-foreground/90">
            No credit card. No setup time. See results in minutes.
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
                AI-powered Excel automation for finance, operations, and data teams.
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
