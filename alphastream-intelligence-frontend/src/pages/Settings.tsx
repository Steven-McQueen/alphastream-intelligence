import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BookOpen,
  Layers,
  Target,
  Bot,
  Keyboard,
  ArrowRight,
  Home,
  Brain,
  TrendingUp,
  List,
  Briefcase,
  Sliders,
  GitCompare,
  Command,
  Check,
  Plug,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIntegrationsStore } from '@/hooks/useIntegrationsStore';

const SETTINGS_SECTIONS = [
  { id: 'overview', label: 'Overview & Onboarding', icon: BookOpen },
  { id: 'modules', label: 'Modules Guide', icon: Layers },
  { id: 'preferences', label: 'Portfolio & Risk Preferences', icon: Target },
  { id: 'ai-behavior', label: 'AI & Data Behavior', icon: Bot },
  { id: 'integrations', label: 'API & Integrations', icon: Plug },
  { id: 'shortcuts', label: 'Shortcuts & Power-User Tips', icon: Keyboard },
];

const MODULES = [
  {
    name: 'Finance Home',
    icon: Home,
    purpose: 'Your Perplexity-style market landing page.',
    features: ['Market summary, indices, sectors, earnings, movers, screener snapshot, themes.'],
    usage: 'Scan this once per day to understand the environment before making any decisions.',
  },
  {
    name: 'Intelligence',
    icon: Brain,
    purpose: 'Chat interface for research and decision support.',
    features: [
      'Ask about specific tickers ("What happened to MSFT today?")',
      'Ask about sectors ("Are US healthcare stocks attractive now?")',
      'Ask about portfolio impact ("What happens to my risk if I add more NVDA?")',
    ],
    usage: 'AI tries to answer with both Market View and Portfolio Impact when relevant.',
  },
  {
    name: 'Market',
    icon: TrendingUp,
    purpose: 'Macro & regime dashboard.',
    features: ['Macro regime, rates, volatility and sector performance.'],
    usage: 'Answer: "Is this a risk-on or risk-off tape? Which sectors are leading/lagging?"',
  },
  {
    name: 'Screener',
    icon: List,
    purpose: 'Long-term monitoring list for interesting stocks.',
    features: [
      'Filter by sector, catalysts, sentiment.',
      'Click a name for LLM-driven filing summary, risk changes, and score history.',
      'Feed only a curated subset into deeper analysis and models.',
    ],
    usage: 'Pre-filter names before running heavy analysis or optimization.',
  },
  {
    name: 'Portfolio',
    icon: Briefcase,
    purpose: 'Read-only view of your actual portfolio.',
    features: [
      'Inspect allocation by sector and factor.',
      'Use insights panel for warnings (concentration, deteriorating fundamentals).',
      'Use as context when talking to the AI.',
    ],
    usage: 'Track your real positions and their risk characteristics.',
  },
  {
    name: 'Optimizer',
    icon: Sliders,
    purpose: 'Visual sandbox for risk/return trade-offs.',
    features: [
      'Adjust risk tolerance and constraints.',
      'Compare current vs optimal portfolio on the efficient frontier.',
      'Export or copy rebalancing plans (for manual use in Nordnet).',
    ],
    usage: 'Explore how constraints affect your portfolio optimization.',
  },
  {
    name: 'Simulation',
    icon: GitCompare,
    purpose: 'Shadow portfolio / paper trading.',
    features: [
      'Test what-if scenarios without touching the live portfolio.',
      'Compare live vs shadow performance and risk.',
      'Use "Propose sync trades" as a conceptual bridge, not execution.',
    ],
    usage: 'Validate ideas before implementing them in real accounts.',
  },
];

const SHORTCUTS = [
  { keys: '⌘K', description: 'Open Command Palette' },
  { keys: 'g h', description: 'Go to Finance Home' },
  { keys: 'g i', description: 'Go to Intelligence' },
  { keys: 'g s', description: 'Go to Screener' },
  { keys: 'g p', description: 'Go to Portfolio' },
  { keys: 'g o', description: 'Go to Optimizer' },
  { keys: 'g s', description: 'Go to Simulation' },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('overview');
  const [riskLevel, setRiskLevel] = useState('medium');
  const [maxPositionWeight, setMaxPositionWeight] = useState([10]);
  const [maxSectorWeight, setMaxSectorWeight] = useState([30]);
  const [investmentHorizon, setInvestmentHorizon] = useState([5]);
  const [styleEmphasis, setStyleEmphasis] = useState('quality-growth');
  
  // Password visibility toggles
  const [showIbKey, setShowIbKey] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [showMarketDataKey, setShowMarketDataKey] = useState(false);
  
  const integrations = useIntegrationsStore();

  const handleSavePreferences = () => {
    // In a real app, persist to localStorage or backend
    localStorage.setItem('alphastream-preferences', JSON.stringify({
      riskLevel,
      maxPositionWeight: maxPositionWeight[0],
      maxSectorWeight: maxSectorWeight[0],
      investmentHorizon: investmentHorizon[0],
      styleEmphasis,
    }));
    toast.success('Preferences saved successfully');
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Settings Navigation */}
      <aside className="w-64 border-r border-border bg-card/50 p-4 flex-shrink-0">
        <h2 className="text-lg font-semibold text-foreground mb-4">Settings & Help</h2>
        <nav className="space-y-1">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                activeSection === section.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <section.icon className="h-4 w-4 flex-shrink-0" />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Right Content Area */}
      <main className="flex-1 overflow-auto p-6 space-y-8">
        {/* Section 1: Overview & Onboarding */}
        <section id="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Welcome to AlphaStream
              </CardTitle>
              <CardDescription>
                AI-assisted finance terminal for US equities, focused on quality/growth investing with portfolio awareness.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                AlphaStream combines market intelligence, portfolio analytics, and AI-powered research into a single integrated platform designed for advanced investors.
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">You can use AlphaStream to:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  <li>Screen and monitor quality US stocks</li>
                  <li>Track your portfolio and factor risk</li>
                  <li>Optimize allocations with constraints</li>
                  <li>Ask an AI that understands both the market and your portfolio</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Start Here – Typical Workflow</CardTitle>
              <CardDescription>Follow this sequence for effective daily use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold flex items-center justify-center">1</span>
                  <div>
                    <p className="font-medium text-foreground">Get the macro picture</p>
                    <p className="text-sm text-muted-foreground">Go to Finance Home and Market to see today's regime, sector moves, and earnings.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold flex items-center justify-center">2</span>
                  <div>
                    <p className="font-medium text-foreground">Build or refine your screener</p>
                    <p className="text-sm text-muted-foreground">Use Screener to find and monitor quality names with LLM scores and catalysts.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold flex items-center justify-center">3</span>
                  <div>
                    <p className="font-medium text-foreground">Connect your portfolio (read-only)</p>
                    <p className="text-sm text-muted-foreground">Use Portfolio to see allocation, PnL, and risk insights based on your holdings.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold flex items-center justify-center">4</span>
                  <div>
                    <p className="font-medium text-foreground">Optimize and simulate changes</p>
                    <p className="text-sm text-muted-foreground">Use Optimizer to see how constraints affect risk/return. Use Simulation to test before changing.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold flex items-center justify-center">5</span>
                  <div>
                    <p className="font-medium text-foreground">Deep dive with AI</p>
                    <p className="text-sm text-muted-foreground">Use Intelligence to ask "why" – about a stock, a sector, or your total portfolio.</p>
                  </div>
                </li>
              </ol>
              
              <Separator className="my-4" />
              
              <div className="flex gap-3">
                <Button asChild variant="outline" size="sm">
                  <Link to="/">
                    <Home className="h-4 w-4 mr-2" />
                    Open Finance Home
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/intelligence">
                    <Brain className="h-4 w-4 mr-2" />
                    Open Intelligence
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 2: Modules Guide */}
        <section id="modules" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Modules Guide</h2>
            <p className="text-muted-foreground">Detailed overview of each AlphaStream module</p>
          </div>
          
          <div className="grid gap-4">
            {MODULES.map((module) => (
              <Card key={module.name}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <module.icon className="h-4 w-4 text-primary" />
                    {module.name}
                  </CardTitle>
                  <CardDescription>{module.purpose}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What you see</p>
                    <ul className="list-disc list-inside space-y-0.5 text-sm text-foreground/80 ml-1">
                      {module.features.map((feature, idx) => (
                        <li key={idx}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">How to use</p>
                    <p className="text-sm text-foreground/80">{module.usage}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Section 3: Portfolio & Risk Preferences */}
        <section id="preferences" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Portfolio & Risk Preferences</h2>
            <p className="text-muted-foreground">Configure defaults for the Optimizer and Portfolio Insights</p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Your Investment Profile</CardTitle>
              <CardDescription>
                These preferences shape default constraints and insights across the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Risk Level</Label>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low – Capital preservation focus</SelectItem>
                    <SelectItem value="medium">Medium – Balanced growth/risk</SelectItem>
                    <SelectItem value="high">High – Growth-oriented, volatility tolerant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Max Single-Position Weight</Label>
                  <span className="text-sm text-muted-foreground">{maxPositionWeight[0]}%</span>
                </div>
                <Slider
                  value={maxPositionWeight}
                  onValueChange={setMaxPositionWeight}
                  min={2}
                  max={25}
                  step={1}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">Maximum allocation to any single holding</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Max Sector Weight</Label>
                  <span className="text-sm text-muted-foreground">{maxSectorWeight[0]}%</span>
                </div>
                <Slider
                  value={maxSectorWeight}
                  onValueChange={setMaxSectorWeight}
                  min={10}
                  max={50}
                  step={5}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">Maximum allocation to any single sector</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Investment Horizon</Label>
                  <span className="text-sm text-muted-foreground">{investmentHorizon[0]} years</span>
                </div>
                <Slider
                  value={investmentHorizon}
                  onValueChange={setInvestmentHorizon}
                  min={1}
                  max={20}
                  step={1}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">Typical holding period for positions</p>
              </div>

              <div className="space-y-3">
                <Label>Style Emphasis</Label>
                <Select value={styleEmphasis} onValueChange={setStyleEmphasis}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quality-growth">Quality Growth</SelectItem>
                    <SelectItem value="macro-aware">Macro-Aware</SelectItem>
                    <SelectItem value="factor-balanced">Factor-Balanced</SelectItem>
                    <SelectItem value="value-tilt">Value Tilt</SelectItem>
                    <SelectItem value="momentum">Momentum</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  The Optimizer and Portfolio Insights will use these defaults when suggesting changes.
                </p>
                <Button onClick={handleSavePreferences}>
                  <Check className="h-4 w-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 4: AI & Data Behavior */}
        <section id="ai-behavior" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">AI & Data Behavior</h2>
            <p className="text-muted-foreground">How the system works and its limitations</p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What the AI Does</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/80">Uses your portfolio (read-only) + screener + market data as context</span>
                </li>
                <li className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/80">Summarizes filings, earnings, and market moves into structured narratives</span>
                </li>
                <li className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/80">Highlights portfolio impact when you ask about trades, sectors or risk</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">What the AI Does NOT Do</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex gap-2 text-sm">
                  <span className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5">✕</span>
                  <span className="text-foreground/80">Does not place trades automatically</span>
                </li>
                <li className="flex gap-2 text-sm">
                  <span className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5">✕</span>
                  <span className="text-foreground/80">Does not guarantee accuracy of third-party data</span>
                </li>
                <li className="flex gap-2 text-sm">
                  <span className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5">✕</span>
                  <span className="text-foreground/80">Does not provide personalized financial advice; it is a decision-support tool</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Sources (Conceptual)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-sm text-foreground/80">
                <li className="flex gap-2">
                  <Badge variant="outline" className="text-xs">Market</Badge>
                  <span>Indices, yields, VIX, sector performance</span>
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline" className="text-xs">Fundamentals</Badge>
                  <span>Screener metrics, earnings, filings</span>
                </li>
                <li className="flex gap-2">
                  <Badge variant="outline" className="text-xs">Portfolio</Badge>
                  <span>Positions from Nordnet (planned real integration; currently mocked)</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                Data refresh cadence and real-time capabilities will be documented once the production backend is in place.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Section 5: API & Integrations */}
        <section id="integrations" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">API & Integrations</h2>
            <p className="text-muted-foreground">Connect external services for brokerage, data and AI functionality</p>
          </div>
          
          {/* Integration Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plug className="h-4 w-4 text-primary" />
                Integration Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect external APIs to unlock brokerage, data and AI functionality. Keys are stored locally in this prototype and will be wired to a secure backend later.
              </p>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Planned integrations:</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Brokerage</Badge>
                    Interactive Brokers – brokerage & live portfolio (future)
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Brokerage</Badge>
                    Nordnet – live portfolio read-only (planned)
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">AI</Badge>
                    OpenAI – custom LLM backend (optional)
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">AI</Badge>
                    Perplexity – finance API / search (optional)
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Data</Badge>
                    Alpha Vantage / Polygon / FMP – market data (future)
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Brokerage Connections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brokerage Connections</CardTitle>
              <CardDescription>Connect to your brokerage for live portfolio data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Interactive Brokers */}
              <div className="p-4 border border-border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">Interactive Brokers API</h4>
                  <Badge variant="secondary" className="text-xs">Future</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ib-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="ib-key"
                        type={showIbKey ? 'text' : 'password'}
                        placeholder="Enter API key..."
                        value={integrations.interactiveBrokersKey}
                        onChange={(e) => integrations.updateField('interactiveBrokersKey', e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowIbKey(!showIbKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showIbKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ib-account">Account ID (optional)</Label>
                    <Input
                      id="ib-account"
                      type="text"
                      placeholder="e.g. U1234567"
                      value={integrations.interactiveBrokersAccountId}
                      onChange={(e) => integrations.updateField('interactiveBrokersAccountId', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => toast.success('Interactive Brokers settings saved')}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info('Connection test not implemented yet – will call backend endpoint in future.')}
                  >
                    Test Connection
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Planned use: live portfolio import, order simulation, and execution in future versions.
                </p>
              </div>

              {/* Nordnet */}
              <div className="p-4 border border-border rounded-lg space-y-4 opacity-60">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">Nordnet</h4>
                  <Badge variant="secondary" className="text-xs">Planned</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>OAuth Token</Label>
                    <Input
                      type="password"
                      placeholder="Will be configured via secure backend..."
                      disabled
                    />
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" disabled>
                        Configure
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Nordnet integration will be handled via secure backend</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-xs text-muted-foreground">
                  Current version uses mock Nordnet data; real integration will never expose your credentials in the browser.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Providers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Providers</CardTitle>
              <CardDescription>Configure AI backends for Intelligence and analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenAI */}
              <div className="p-4 border border-border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">OpenAI API</h4>
                  <Badge variant="secondary" className="text-xs">Optional</Badge>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="openai-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="openai-key"
                      type={showOpenAiKey ? 'text' : 'password'}
                      placeholder="sk-..."
                      value={integrations.openAiApiKey}
                      onChange={(e) => integrations.updateField('openAiApiKey', e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showOpenAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => toast.success('OpenAI API key saved')}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info('Test not implemented – will call backend endpoint in future.')}
                  >
                    Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Planned use: custom LLM backends for Intelligence and filings analysis.
                </p>
              </div>

              {/* Perplexity */}
              <div className="p-4 border border-border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">Perplexity API</h4>
                  <Badge variant="secondary" className="text-xs">Optional</Badge>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="perplexity-key">API Key / Token</Label>
                  <div className="relative">
                    <Input
                      id="perplexity-key"
                      type={showPerplexityKey ? 'text' : 'password'}
                      placeholder="pplx-..."
                      value={integrations.perplexityApiKey}
                      onChange={(e) => integrations.updateField('perplexityApiKey', e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPerplexityKey(!showPerplexityKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPerplexityKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => toast.success('Perplexity API key saved')}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info('Test not implemented – will call backend endpoint in future.')}
                  >
                    Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Planned use: enhanced finance search and retrieval if/when API access is available.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Market Data Provider */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Market Data Provider</CardTitle>
              <CardDescription>Configure live quotes and historical data source</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">Market Data (e.g. Alpha Vantage / Polygon)</h4>
                  <Badge variant="secondary" className="text-xs">Future</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Provider</Label>
                    <Select
                      value={integrations.marketDataProvider}
                      onValueChange={(value: 'none' | 'alpha-vantage' | 'polygon' | 'fmp') => 
                        integrations.updateField('marketDataProvider', value)
                      }
                    >
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="alpha-vantage">Alpha Vantage</SelectItem>
                        <SelectItem value="polygon">Polygon</SelectItem>
                        <SelectItem value="fmp">Financial Modeling Prep</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {integrations.marketDataProvider !== 'none' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="market-data-key">API Key</Label>
                      <div className="relative">
                        <Input
                          id="market-data-key"
                          type={showMarketDataKey ? 'text' : 'password'}
                          placeholder="Enter API key..."
                          value={integrations.marketDataApiKey}
                          onChange={(e) => integrations.updateField('marketDataApiKey', e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMarketDataKey(!showMarketDataKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showMarketDataKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => toast.success('Market data settings saved')}
                >
                  Save
                </Button>
                <p className="text-xs text-muted-foreground">
                  Planned use: live quotes, historical prices, and intraday charts.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-yellow-500" />
                Security Notice (Prototype)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span className="text-foreground/80">
                  In this prototype, API keys are stored locally in your browser (e.g. localStorage) and are not sent to any server.
                </span>
              </div>
              <div className="flex gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-foreground/80">
                  In a production version, all credentials will be handled via a secure backend with proper encryption and never exposed in client code.
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 6: Shortcuts & Power-User Tips */}
        <section id="shortcuts" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Shortcuts & Power-User Tips</h2>
            <p className="text-muted-foreground">Keyboard shortcuts and advanced usage patterns</p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Command className="h-4 w-4" />
                Keyboard Shortcuts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {SHORTCUTS.map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm text-foreground/80">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{shortcut.keys}</kbd>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Power-User Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/80">Always start your session on Finance Home to align with the macro tape.</span>
                </li>
                <li className="flex gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/80">Use Screener to pre-filter names before running heavy analysis or optimization.</span>
                </li>
                <li className="flex gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/80">Use Simulation to sanity-check any aggressive changes before you touch the real portfolio.</span>
                </li>
                <li className="flex gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground/80">When in doubt, ask Intelligence: "What am I missing about {'{ticker/sector}'}?"</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
