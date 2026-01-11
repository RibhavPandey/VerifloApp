import { Check, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Navbar from './Navbar'

interface PricingPageProps {
  onBack: () => void;
  onStart: () => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onBack, onStart }) => {
  const plans = [
    {
      name: "Starter",
      price: "$9",
      period: "/month",
      description: "Perfect for trying out our platform",
      features: ["Up to 5 projects", "1 GB storage", "Basic analytics", "Email support", "Community access"],
      highlighted: false,
      color: "secondary",
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For professionals and growing teams",
      features: [
        "Unlimited projects",
        "50 GB storage",
        "Advanced analytics",
        "Priority email support",
        "API access",
        "Custom integrations",
        "Team collaboration",
      ],
      highlighted: true,
      color: "primary",
    },
    {
      name: "Enterprise",
      price: "$99",
      period: "/month",
      description: "For large organizations with custom needs",
      features: [
        "Everything in Pro",
        "Unlimited storage",
        "White-label solution",
        "Dedicated account manager",
        "24/7 phone support",
        "Custom SLA",
        "Advanced security",
        "On-premise option",
      ],
      highlighted: false,
      color: "accent",
    },
  ]

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background py-20 px-4 sm:px-6 lg:px-8 animate-fade-in-up">
        <div className="max-w-7xl mx-auto">
          {/* Header with Back Button */}
        {/* <div className="mb-8">
          <Button onClick={onBack} variant="ghost" className="mb-4">
            <ArrowLeft size={20} className="mr-2" /> Back
          </Button>
        </div> */}
        <div className="text-center mb-30 pb-24">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-medium mb-10 text-balance">
            Predictable pricing
            <br />
            scalable plans</h1>
          <p className="text-xl sm:text-2xl max-w-2xl mx-auto text-gray-600">
            Made to save you time and money.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative border-4 border-border ${
                plan.highlighted
                  ? "shadow-xl scale-105 bg-primary text-primary-foreground"
                  : "shadow-md hover:shadow-lg transition-shadow"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-6 py-2 border-4 border-border shadow-2xs font-black text-sm">
                  MOST POPULAR
                </div>
              )}

              <CardHeader className="space-y-4">
                <CardTitle className="text-3xl font-black uppercase tracking-tight">{plan.name}</CardTitle>
                <CardDescription className={plan.highlighted ? "text-primary-foreground/90" : ""}>
                  {plan.description}
                </CardDescription>
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black">{plan.price}</span>
                  <span className="text-xl font-bold">{plan.period}</span>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-6 h-6 shrink-0 mt-0.5" strokeWidth={3} />
                      <span className="font-bold">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  onClick={onStart}
                  className={`w-full text-lg font-black h-14 border-4 ${
                    plan.highlighted ? "bg-background text-foreground hover:bg-background/90" : ""
                  }`}
                  size="lg"
                >
                  GET STARTED
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-4xl font-black text-center mb-10 uppercase">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                question: "Can I change plans later?",
                answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.",
              },
              {
                question: "What payment methods do you accept?",
                answer: "We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.",
              },
              {
                question: "Is there a free trial?",
                answer: "Yes! All plans come with a 14-day free trial. No credit card required.",
              },
              {
                question: "What happens when I cancel?",
                answer:
                  "You'll retain access until the end of your billing period. Your data is kept for 30 days after cancellation.",
              },
            ].map((faq, index) => (
              <div key={index} className="border-4 border-border p-6 shadow-md bg-card">
                <h3 className="text-xl font-black mb-2">{faq.question}</h3>
                <p className="font-bold text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center bg-accent text-accent-foreground border-4 border-border shadow-xl p-12">
          <h2 className="text-4xl font-black mb-4 uppercase">Still Have Questions?</h2>
          <p className="text-xl font-bold mb-8 max-w-2xl mx-auto">
            Our team is here to help you find the perfect plan for your needs.
          </p>
          <Button
            size="lg"
            className="h-14 px-8 text-lg font-black border-4 bg-background text-foreground hover:bg-background/90"
          >
            CONTACT SALES
          </Button>
        </div>
      </div>
      </main>
    </>
  )
}

export default PricingPage;
