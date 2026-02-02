import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Navbar from './Navbar'
import { api } from "@/lib/api"
import { useToast } from './ui/toast'

interface PricingPageProps {
  onBack: () => void;
  onStart: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const PricingPage: React.FC<PricingPageProps> = ({ onBack, onStart }) => {
  const [loading, setLoading] = useState<string | null>(null)
  const { addToast } = useToast()

  const openCheckout = async (orderData: { orderId: string; amount: number; currency: string; keyId: string }, description: string) => {
    if (!window.Razorpay) {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      document.body.appendChild(script)
      await new Promise<void>((resolve) => {
        if (window.Razorpay) return resolve()
        script.onload = () => resolve()
      })
    }

    return new Promise<void>((resolve, reject) => {
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Veriflo',
        description,
        order_id: orderData.orderId,
        handler: (response: any) => {
          api.verifyPayment(response).then(() => {
            addToast('success', 'Payment Successful', 'Your plan has been activated.')
            window.location.reload()
            resolve()
          }).catch((err: any) => {
            addToast('error', 'Verification Failed', err.message || 'Please contact support.')
            reject(err)
          })
        },
        prefill: { email: '' },
        theme: { color: '#0f172a' },
      }
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', () => reject(new Error('Payment failed')))
      rzp.open()
    })
  }

  const handleUpgrade = async (type: string, planId?: string, addonId?: string, period?: string) => {
    setLoading(`${type}-${planId || addonId || ''}`)
    try {
      const order = await api.createPaymentOrder({ type, planId, addonId, period })
      const desc = type === 'intro_offer' ? 'Starter - First month' : type === 'subscription' ? `${planId} - ${period || 'monthly'}` : type === 'addon_docs' ? `${addonId} docs pack` : `${addonId} credits pack`
      await openCheckout(order, desc)
    } catch (e: any) {
      if (e?.message?.includes('authenticated') || e?.message?.includes('session')) {
        onStart()
        return
      }
      addToast('error', 'Payment Error', e?.message || 'Could not start payment.')
    } finally {
      setLoading(null)
    }
  }

  const plans = [
    {
      id: 'free',
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Get started with no credit card",
      features: [
        "10 documents / month",
        "100 credits / month",
        "AI Chat, Enrich, Workflows",
        "Extraction per document",
      ],
      cta: "GET STARTED",
      ctaAction: onStart,
      highlighted: false,
    },
    {
      id: 'starter',
      name: "Starter",
      price: "$29",
      period: "/month",
      description: "For individuals and light usage",
      features: [
        "150 documents / month",
        "750 credits / month",
        "Overage: $0.15/doc, $0.02/credit",
        "Priority support",
      ],
      cta: "UPGRADE",
      ctaAction: () => handleUpgrade('subscription', 'starter', undefined, 'monthly'),
      highlighted: false,
    },
    {
      id: 'pro',
      name: "Pro",
      price: "$79",
      period: "/month",
      description: "Best value for regular users",
      features: [
        "750 documents / month",
        "3,000 credits / month",
        "Overage: $0.12/doc, $0.015/credit",
        "Priority support",
      ],
      cta: "UPGRADE",
      ctaAction: () => handleUpgrade('subscription', 'pro', undefined, 'monthly'),
      highlighted: true,
    },
    {
      id: 'enterprise',
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For teams and higher usage",
      features: [
        "Custom documents & credits",
        "Everything in Pro",
        "Dedicated support",
      ],
      cta: "CONTACT SALES",
      ctaAction: () => window.location.href = '/contact',
      highlighted: false,
    },
  ]

  const creditUsage = [
    { action: "AI Chat (per message)", credits: 3 },
    { action: "AI Analysis", credits: 15 },
    { action: "Enrich (per 100 items)", credits: 20 },
    { action: "Workflow run", credits: 5 },
  ]

  const docPacks = [
    { id: '50', docs: 50, price: 8, perDoc: 0.16 },
    { id: '100', docs: 100, price: 15, perDoc: 0.15 },
    { id: '250', docs: 250, price: 35, perDoc: 0.14 },
  ]

  const creditPacks = [
    { id: 'small', credits: 500, price: 9, perCredit: 0.018, expiry: "30-day" },
    { id: 'medium', credits: 1200, price: 19, perCredit: 0.016, expiry: "30-day" },
    { id: 'large', credits: 3000, price: 39, perCredit: 0.013, expiry: "30-day" },
  ]

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background py-20 px-4 sm:px-6 lg:px-8 animate-fade-in-up">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 pb-12">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-medium mb-10 text-balance">
              Predictable pricing
              <br />
              scalable plans</h1>
            <p className="text-xl sm:text-2xl max-w-2xl mx-auto text-gray-600">
              Documents and credits. Extraction per doc. AI features use credits.
            </p>
          </div>

          {/* Intro offer banner */}
          <div className="mb-12 p-4 bg-primary/10 border-4 border-primary rounded-xl text-center">
            <p className="text-lg font-bold">New user offer: First month Starter at <strong>$19</strong> (one-time, no subscription)</p>
            <Button onClick={() => handleUpgrade('intro_offer')} disabled={!!loading} className="mt-3">
              {loading === 'intro_offer-' ? 'Loading...' : 'Claim Offer'}
            </Button>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative border-4 border-border ${
                  plan.highlighted ? "shadow-xl scale-105 bg-primary text-primary-foreground" : "shadow-md hover:shadow-lg transition-shadow"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-4 py-1 border-2 border-border text-xs font-black">
                    MOST POPULAR
                  </div>
                )}
                <CardHeader className="space-y-2">
                  <CardTitle className="text-2xl font-black uppercase">{plan.name}</CardTitle>
                  <CardDescription className={plan.highlighted ? "text-primary-foreground/90" : ""}>{plan.description}</CardDescription>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{plan.price}</span>
                    <span className="text-sm font-bold">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={3} />
                        <span className="text-sm font-bold">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button onClick={plan.ctaAction} disabled={!!loading} className="w-full font-black" size="lg">
                    {loading?.includes(plan.id) ? 'Loading...' : plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Credit Usage */}
          <div className="mb-16">
            <h2 className="text-2xl font-black mb-6 uppercase">Credit Usage</h2>
            <div className="overflow-x-auto border-4 border-border rounded-xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/50">
                    <th className="p-4 font-black">Action</th>
                    <th className="p-4 font-black">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {creditUsage.map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-4 font-bold">{row.action}</td>
                      <td className="p-4 font-bold">{row.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add-Ons */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div>
              <h2 className="text-2xl font-black mb-4 uppercase">Document Packs</h2>
              <div className="space-y-3">
                {docPacks.map((pack) => (
                  <div key={pack.id} className="flex justify-between items-center p-4 border-4 border-border rounded-xl">
                    <div>
                      <span className="font-black">{pack.docs} docs</span>
                      <span className="text-muted-foreground ml-2">${pack.perDoc}/doc</span>
                    </div>
                    <Button onClick={() => handleUpgrade('addon_docs', undefined, pack.id)} disabled={!!loading} size="sm">
                      {loading?.includes(pack.id) ? '...' : `$${pack.price}`}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black mb-4 uppercase">Credit Packs (30-day expiry)</h2>
              <div className="space-y-3">
                {creditPacks.map((pack) => (
                  <div key={pack.id} className="flex justify-between items-center p-4 border-4 border-border rounded-xl">
                    <div>
                      <span className="font-black">{pack.credits} credits</span>
                      <span className="text-muted-foreground ml-2">${pack.perCredit}/credit</span>
                    </div>
                    <Button onClick={() => handleUpgrade('addon_credits', undefined, pack.id)} disabled={!!loading} size="sm">
                      {loading?.includes(pack.id) ? '...' : `$${pack.price}`}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto mt-16">
            <h2 className="text-4xl font-black text-center mb-10 uppercase">FAQ</h2>
            <div className="space-y-6">
              {[
                { q: "Can I change plans later?", a: "Yes! You can upgrade or downgrade at any time. Changes take effect immediately." },
                { q: "What payment methods do you accept?", a: "We accept cards, UPI, netbanking via Razorpay." },
                { q: "Is there a free trial?", a: "No trial. The Free plan is your entry point—10 docs and 100 credits per month. No credit card required." },
                { q: "What happens when I cancel?", a: "You keep access until the end of your billing period. Your data is kept for 30 days after cancellation." },
              ].map((faq, i) => (
                <div key={i} className="border-4 border-border p-6 shadow-md bg-card rounded-xl">
                  <h3 className="text-xl font-black mb-2">{faq.q}</h3>
                  <p className="font-bold text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-20 text-center bg-accent text-accent-foreground border-4 border-border shadow-xl p-12 rounded-xl">
            <h2 className="text-4xl font-black mb-4 uppercase">Still Have Questions?</h2>
            <p className="text-xl font-bold mb-8 max-w-2xl mx-auto">
              Our team is here to help you find the perfect plan.
            </p>
            <Button size="lg" className="h-14 px-8 text-lg font-black border-4 bg-background text-foreground hover:bg-background/90" onClick={() => window.location.href = '/contact'}>
              CONTACT SALES
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}

export default PricingPage
