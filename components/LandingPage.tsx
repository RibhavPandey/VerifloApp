
import React from 'react';
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Link } from "react-router-dom";
import Navbar from './Navbar';
import {
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  Wand2,
  Calculator,
  Database,
  Zap,
  Play,
  CheckCircle2,
  Brain,
  TrendingUp,
  FileStack
} from "lucide-react";

interface LandingPageProps {
  onStart: () => void;
  onPricing: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onPricing }) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex animate-fade-in-up items-center gap-2 border-4 border-black bg-secondary px-4 py-2 font-mono text-sm font-bold shadow-md">
              <Sparkles className="h-4 w-4" />
              <span>AI-POWERED EXCEL AUTOMATION</span>
            </div>

            <h1 className="mb-6 animate-fade-in-up text-balance font-mono text-5xl font-bold leading-tight text-foreground animation-delay-100 md:text-7xl">
              Reduce Your Excel Work by{" "}
              <span className="relative inline-block border-4 border-black bg-primary px-4 py-2 text-primary-foreground shadow-lg">
                80%
              </span>
            </h1>

            <p className="mb-10 animate-fade-in-up text-pretty text-lg text-muted-foreground animation-delay-200 md:text-xl">
              Stop wasting hours on spreadsheets. Our AI handles data cleaning, formula generation, and multi-file
              analysis — even with thousands of rows. Focus on what matters.
            </p>

            <div className="flex flex-col items-center justify-center animate-fade-in-up gap-4 animation-delay-300 sm:flex-row">
              <Button
                onClick={onStart}
                size="lg" className="bg-orange-500 text-black  brutalist-border font-black text-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-4 font-mono text-lg font-bold sm:w-auto bg-transparent">
                Watch Demo
              </Button>
            </div>

            <p className="mt-6 animate-fade-in-up text-sm text-muted-foreground animation-delay-400">
              No credit card required • 14-day free trial • Cancel anytime
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

      {/* Features Section */}
      <section id="features" className="border-t-4 border-black bg-muted py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
              Powerful Features for Modern Professionals
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to supercharge your spreadsheet workflow
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Database,
                title: "Smart Data Cleaning",
                description: "AI automatically detects and fixes errors, duplicates, and formatting issues in seconds.",
                color: "bg-primary",
              },
              {
                icon: Brain,
                title: "Formula Generator",
                description: "Describe what you want in plain English, get complex formulas instantly.",
                color: "bg-accent",
              },
              {
                icon: FileSpreadsheet,
                title: "Full File AI Analysis",
                description: "Get instant insights, summaries, and recommendations from your entire spreadsheet.",
                color: "bg-secondary text-black",
              },
              {
                icon: FileStack,
                title: "Multi-File Processing",
                description:
                  "Work with multiple files simultaneously. Merge, compare, and analyze across spreadsheets.",
                color: "bg-primary",
              },
              {
                icon: Zap,
                title: "Handle 1000s of Rows",
                description: "Process massive datasets without breaking a sweat. Optimized for enterprise-scale data.",
                color: "bg-accent",
              },
              {
                icon: TrendingUp,
                title: "Automated Insights",
                description: "Discover trends, patterns, and anomalies you might have missed.",
                color: "bg-secondary text-black",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="group cursor-pointer border-4 border-black p-6 shadow-md transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-2xs"
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

      {/* Benefits Section */}
      <section id="benefits" className="border-t-4 border-black py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 border-4 border-black bg-accent px-3 py-1 font-mono text-sm font-bold text-accent-foreground shadow-xs">
                HUMAN-FOCUSED AI
              </div>
              <h2 className="mb-6 font-mono text-4xl font-bold leading-tight md:text-5xl">
                Built for Humans, Not Machines
              </h2>
              <p className="mb-8 text-lg text-muted-foreground">
                We believe AI should make work more human, not less. ExcelAI Pro handles the tedious tasks so you can
                focus on strategy, creativity, and meaningful decisions.
              </p>

              <div className="space-y-4">
                {[
                  "Save 20+ hours per week on spreadsheet tasks",
                  "Zero learning curve - works like natural conversation",
                  "Built-in quality checks ensure accuracy",
                  "Enterprise-grade security for your data",
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-6 w-6 flex-shrink-0 text-primary" />
                    <span className="text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-none border-4 border-black bg-card p-8 shadow-xl">
                <div className="mb-6 space-y-3">
                  <div className="h-4 w-3/4 animate-pulse border-2 border-black bg-muted" />
                  <div className="h-4 w-full animate-pulse border-2 border-black bg-muted animation-delay-100" />
                  <div className="h-4 w-5/6 animate-pulse border-2 border-black bg-muted animation-delay-200" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square animate-fade-in border-4 border-black bg-primary/20 shadow-xs"
                      style={{ animationDelay: `${i * 100}ms` }}
                    />
                  ))}
                </div>
              </div>
              <div className="absolute -right-4 -top-4 h-20 w-20 animate-spin-slow border-4 border-black bg-secondary shadow-lg" />
              <div className="absolute -bottom-4 -left-4 h-16 w-16 animate-bounce border-4 border-black bg-accent shadow-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t-4 border-black bg-primary py-20 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 font-mono text-4xl font-bold md:text-5xl">Ready to Transform Your Workflow?</h2>
          <p className="mb-8 text-xl text-primary-foreground/90">
            Join thousands of professionals who've reclaimed their time
          </p>
          <Button
            onClick={onStart}
            size="lg"
            className="bg-yellow-300 text-black px-12 py-6 brutalist-border font-black text-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all hover:bg-yellow-300"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <p className="mt-4 text-sm text-primary-foreground/80">
            14 days free • No credit card • Full access to all features
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-4 border-black bg-background py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center border-4 border-black bg-primary">
                  <FileSpreadsheet className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-mono text-lg font-bold">ExcelAI Pro</span>
              </div>
              <p className="text-sm text-muted-foreground">AI-powered Excel automation for modern professionals.</p>
            </div>

            {[
              { title: "Product", links: ["Features", "Pricing", "Demo", "API"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Legal", links: ["Privacy", "Terms", "Security", "GDPR"] },
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

          <div className="mt-12 border-t-4 border-black pt-8 text-center text-sm text-muted-foreground">
            © 2025 ExcelAI Pro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode, title: string, desc: string, bgColor: string }> = ({ icon, title, desc, bgColor }) => (
  <div className="bg-white p-8 brutalist-card hover:-translate-y-2 transition-transform cursor-default group">
    <div className={`w-12 h-12 ${bgColor} flex items-center justify-center brutalist-border mb-6 group-hover:rotate-6 transition-transform`}>
      {icon}
    </div>
    <h3 className="text-2xl font-black mb-3 heading-font">{title}</h3>
    <p className="text-gray-600 font-medium leading-relaxed">{desc}</p>
  </div>
);

export default LandingPage;
