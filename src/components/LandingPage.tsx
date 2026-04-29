import React, { useState } from 'react';
import { ArrowRight, Zap, Cloud, Users, Cpu, Code, Sparkles, Github, Twitter, Linkedin, Mail } from 'lucide-react';

export const LandingPage = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleNewsletterSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-8 h-8 text-cyan-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              VOID
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="hover:text-cyan-400 transition">Features</a>
            <a href="#pricing" className="hover:text-cyan-400 transition">Pricing</a>
            <a href="#testimonials" className="hover:text-cyan-400 transition">Testimonials</a>
            <button
              onClick={onGetStarted}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition"
            >
              Launch IDE
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6">
              <div className="inline-block px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-full text-sm">
                🚀 The Future of Cloud IDE is Here
              </div>

              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Code Anywhere,
                <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent"> Anytime</span>
              </h1>

              <p className="text-xl text-gray-300 leading-relaxed">
                Enterprise-grade cloud IDE with T4 GPU, real-time collaboration, and AI-powered code completion. 
                Faster than VSCode, more powerful than Codespaces.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onGetStarted}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-semibold hover:shadow-lg hover:shadow-cyan-500/50 transition flex items-center justify-center gap-2"
                >
                  Start Coding Free <ArrowRight className="w-5 h-5" />
                </button>
                <button className="px-8 py-3 border border-purple-500 rounded-lg font-semibold hover:bg-purple-500/10 transition">
                  Watch Demo
                </button>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <div className="flex -space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 border-2 border-slate-900"
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-300">
                  <strong>2,847</strong> developers coding right now
                </span>
              </div>
            </div>

            {/* Right - Feature Cards */}
            <div className="space-y-4 perspective">
              <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur hover:shadow-2xl hover:shadow-cyan-500/20 transition transform hover:scale-105">
                <Cpu className="w-8 h-8 text-cyan-400 mb-3" />
                <h3 className="text-lg font-bold mb-2">T4 GPU Power</h3>
                <p className="text-gray-300 text-sm">
                  4-12 hour runtime on Google Colab. Perfect for ML, AI, and data science.
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6 backdrop-blur hover:shadow-2xl hover:shadow-purple-500/20 transition transform hover:scale-105">
                <Users className="w-8 h-8 text-purple-400 mb-3" />
                <h3 className="text-lg font-bold mb-2">Live Collaboration</h3>
                <p className="text-gray-300 text-sm">
                  Real-time editing with CRDT. See cursors, resolve conflicts instantly.
                </p>
              </div>

              <div className="bg-gradient-to-br from-pink-500/10 to-cyan-500/10 border border-pink-500/30 rounded-2xl p-6 backdrop-blur hover:shadow-2xl hover:shadow-pink-500/20 transition transform hover:scale-105">
                <Sparkles className="w-8 h-8 text-pink-400 mb-3" />
                <h3 className="text-lg font-bold mb-2">AI Copilot</h3>
                <p className="text-gray-300 text-sm">
                  Claude-powered completions. Generate tests, fix bugs, optimize code.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-purple-500/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Supercharged Features</h2>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Everything developers need to build, deploy, and collaborate at scale
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Code,
                title: 'VSCode Compatible',
                desc: 'Monaco editor with 30+ language support, themes, and keybindings',
              },
              {
                icon: Cloud,
                title: 'Google Colab T4',
                desc: 'Free T4 GPU with 4-12 hour sessions. ML libraries pre-installed.',
              },
              {
                icon: Users,
                title: 'Real-Time Collab',
                desc: 'CRDT-based sync. Edit together, see live cursors and changes.',
              },
              {
                icon: Sparkles,
                title: 'AI Code Complete',
                desc: 'Claude AI suggests completions, generates tests, fixes bugs.',
              },
              {
                icon: Zap,
                title: 'Multi-Gateway',
                desc: 'Execute on Local, SSH, Docker, or custom endpoints instantly.',
              },
              {
                icon: Github,
                title: 'Git Integration',
                desc: 'Clone, commit, push directly. GitHub sync built-in.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6 hover:bg-slate-700/50 transition group"
              >
                <feature.icon className="w-10 h-10 text-cyan-400 mb-4 group-hover:scale-110 transition" />
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-300 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50 border-t border-purple-500/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">How VOID Compares</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-500/30">
                  <th className="text-left py-4 px-4 font-bold">Feature</th>
                  <th className="text-center py-4 px-4">VOID</th>
                  <th className="text-center py-4 px-4">VSCode</th>
                  <th className="text-center py-4 px-4">Codespaces</th>
                  <th className="text-center py-4 px-4">AntiGravity</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Cloud IDE', void: true, vscode: false, codespaces: true, antigravity: true },
                  { feature: 'T4 GPU', void: true, vscode: false, codespaces: true, antigravity: false },
                  { feature: 'Real-time Collab', void: true, vscode: false, codespaces: false, antigravity: true },
                  { feature: 'AI Copilot', void: true, vscode: true, codespaces: true, antigravity: true },
                  { feature: 'Extension Marketplace', void: true, vscode: true, codespaces: true, antigravity: false },
                  { feature: 'Multi-Gateway', void: true, vscode: false, codespaces: false, antigravity: false },
                  { feature: 'Cost Tracking', void: true, vscode: false, codespaces: false, antigravity: false },
                  { feature: 'Custom Plugins', void: true, vscode: true, codespaces: false, antigravity: false },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-4 px-4 font-semibold">{row.feature}</td>
                    <td className="text-center py-4 px-4">
                      {row.void ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.vscode ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.codespaces ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
                    </td>
                    <td className="text-center py-4 px-4">
                      {row.antigravity ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-purple-500/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Loved by Developers</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Sarah Chen',
                role: 'ML Engineer',
                text: 'VOID replaced my entire dev setup. T4 GPU + AI completion = unstoppable productivity.',
                avatar: '🧑‍💻',
              },
              {
                name: 'James Rodriguez',
                role: 'Full Stack Developer',
                text: 'Real-time collaboration with teammates is game-changing. No more merge conflicts!',
                avatar: '👨‍💼',
              },
              {
                name: 'Priya Singh',
                role: 'Data Scientist',
                text: 'Finally, a cloud IDE that understands ML workloads. Colab integration is perfection.',
                avatar: '👩‍🔬',
              },
            ].map((testimonial, i) => (
              <div key={i} className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl">{testimonial.avatar}</div>
                  <div>
                    <h4 className="font-bold">{testimonial.name}</h4>
                    <p className="text-sm text-gray-400">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-gray-300 italic">"{testimonial.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50 border-t border-purple-500/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Simple Pricing</h2>
          <p className="text-center text-gray-300 mb-12 max-w-2xl mx-auto">
            Start free with 10 hours/month Colab time. Upgrade anytime.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Free',
                price: '$0',
                duration: '/forever',
                features: [
                  '10 hours/month Colab T4',
                  'Up to 3 collaborators',
                  '5GB storage',
                  'Community support',
                ],
                cta: 'Get Started',
              },
              {
                name: 'Pro',
                price: '$29',
                duration: '/month',
                features: [
                  '100 hours/month Colab T4',
                  'Unlimited collaborators',
                  '100GB storage',
                  'Priority support',
                  'Custom gateways',
                  'API access',
                ],
                cta: 'Upgrade Now',
                highlight: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                duration: '',
                features: [
                  'Unlimited Colab time',
                  'Private deployment',
                  'SSO/SAML',
                  'Dedicated support',
                  'Custom SLA',
                ],
                cta: 'Contact Sales',
              },
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-xl p-8 border transition ${
                  plan.highlight
                    ? 'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-cyan-500/50 scale-105 shadow-2xl shadow-purple-500/30'
                    : 'bg-slate-800/50 border-purple-500/30'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-400 to-purple-500 px-4 py-1 rounded-full text-sm font-bold">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-400">{plan.duration}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={onGetStarted}
                  className={`w-full py-3 rounded-lg font-bold transition ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:shadow-lg hover:shadow-purple-500/50'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-purple-500/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Code Better?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of developers using VOID. Start for free today.
          </p>

          <form onSubmit={handleNewsletterSignup} className="flex gap-4 max-w-md mx-auto mb-8">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-800 border border-purple-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-bold hover:shadow-lg transition"
            >
              {subscribed ? '✓ Subscribed' : 'Notify Me'}
            </button>
          </form>

          <button
            onClick={onGetStarted}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg font-bold hover:shadow-lg hover:shadow-purple-500/50 transition inline-flex items-center gap-2"
          >
            Launch IDE Now <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-purple-500/30 bg-slate-900/80">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">VOID</h4>
              <p className="text-gray-400">The next-gen cloud IDE for developers.</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-cyan-400">Features</a></li>
                <li><a href="#" className="hover:text-cyan-400">Pricing</a></li>
                <li><a href="#" className="hover:text-cyan-400">Docs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-cyan-400">About</a></li>
                <li><a href="#" className="hover:text-cyan-400">Blog</a></li>
                <li><a href="#" className="hover:text-cyan-400">Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Follow</h4>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-cyan-400 transition">
                  <Github className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-cyan-400 transition">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-cyan-400 transition">
                  <Linkedin className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-500/30 pt-8 flex flex-col md:flex-row items-center justify-between text-gray-400 text-sm">
            <p>&copy; 2026 VOID IDE. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-cyan-400">Privacy Policy</a>
              <a href="#" className="hover:text-cyan-400">Terms of Service</a>
              <a href="#" className="hover:text-cyan-400">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
