import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { Calculator, Send, TrendingUp, Info, Gem, Sparkles, Lock, ArrowRight, User } from 'lucide-react';

interface CalculationResult {
  metalCost: number;
  makingCost: number;
  stoneCost: number;
  gstAmount: number;
  total: number;
  exchangeValue: number;
  netPayable: number;
  discountAmount: number;
  processedOldWeight: number;
}

type PurityType = '22k' | 'silver';

function App() {
  // --- AUTHENTICATION STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Check login state
  useEffect(() => {
    // Listen for auth state changes (secure and persistent)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success is handled by onAuthStateChanged
    } catch (error: any) {
      console.error("Login failed", error);
      let msg = 'Invalid Email or Password';
      if (error.code === 'auth/invalid-email') msg = 'Invalid Email Format';
      if (error.code === 'auth/user-not-found') msg = 'User not found';
      if (error.code === 'auth/wrong-password') msg = 'Incorrect Password';
      if (error.code === 'auth/too-many-requests') msg = 'Too many failed attempts. Try again later.';
      setLoginError(msg);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // --- CALCULATOR STATE ---
  const [rates, setRates] = useState<Record<PurityType, number>>({
    '22k': 0,
    'silver': 0,
  });

  const [isFetchingRates, setIsFetchingRates] = useState(false);

  const fetchRates = async () => {
    setIsFetchingRates(true);
    
    const proxies = [
      {
        name: 'AllOrigins',
        url: (target: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
        isJson: true
      },
      {
        name: 'CodeTabs',
        url: (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
        isJson: false
      },
      {
        name: 'CorsProxy',
        url: (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
        isJson: false
      }
    ];

    try {
      let htmlContent = '';
      let success = false;

      for (const proxy of proxies) {
        try {
          console.log(`Attempting to fetch rates via ${proxy.name}...`);
          const response = await fetch(proxy.url('https://kjpl.in/'));
          
          if (!response.ok) throw new Error(`Status ${response.status}`);
          
          if (proxy.isJson) {
            const data = await response.json();
            htmlContent = data.contents;
          } else {
            htmlContent = await response.text();
          }

          if (htmlContent) {
            success = true;
            break; // Stop if successful
          }
        } catch (err) {
          console.warn(`Failed to fetch via ${proxy.name}:`, err);
        }
      }

      if (!success) throw new Error('All proxies failed to fetch rates.');

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Find all tables that might contain the rate
      const tables = doc.querySelectorAll('table');
      let goldRate = 0;
      let silverRate = 0;
      let found = false;

      tables.forEach(table => {
        if (table.textContent?.includes('MJDTA RATE (With GST)')) {
          const rows = table.querySelectorAll('tr');
          rows.forEach(row => {
            const text = row.textContent || '';
            if (text.includes('GOLD:')) {
              const match = text.match(/[\d,]+\.?\d*/);
              if (match) goldRate = parseFloat(match[0].replace(/,/g, ''));
            }
            if (text.includes('SILVER:')) {
              const match = text.match(/[\d,]+\.?\d*/);
              if (match) silverRate = parseFloat(match[0].replace(/,/g, ''));
            }
          });
          if (goldRate > 0) found = true;
        }
      });

      if (found) {
        setRates({
          '22k': goldRate,
          'silver': silverRate
        });
        // Optional: Show success message or simple console log
        console.log('Rates updated:', { goldRate, silverRate });
      } else {
        console.error('Could not find MJDTA rates in the fetched HTML');
      }

    } catch (error) {
      console.error('Failed to fetch rates:', error);
    } finally {
      setIsFetchingRates(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRates();
    }
  }, [isAuthenticated]);

  const [weight, setWeight] = useState<string>('');
  const [purity, setPurity] = useState<PurityType>('22k');
  const [discount, setDiscount] = useState<string>('');
  const [makingCharge, setMakingCharge] = useState<string>('');
  const [stoneCharges, setStoneCharges] = useState<string>('');
  const [gstPercent, setGstPercent] = useState<string>('0');

  // Exchange / Old Gold State
  const [oldGoldWeight, setOldGoldWeight] = useState<string>('');
  const [oldGoldTouch, setOldGoldTouch] = useState<string>('');
  const [oldGoldRate, setOldGoldRate] = useState<string>('');

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateTotal = () => {
    setIsCalculating(true);

    // Small delay to show animation feel
    setTimeout(() => {
      const safeParse = (val: string) => {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
      };

      const w = Math.max(0, safeParse(weight));
      const r = Math.max(0, rates[purity] || 0);
      const disc = Math.max(0, safeParse(discount));
      const effectiveRate = Math.max(0, r - disc);

      const stone = Math.max(0, safeParse(stoneCharges));
      const gstInput = safeParse(gstPercent);
      const gstP = Math.max(0, gstInput) / 100;

      const makingRate = Math.max(0, safeParse(makingCharge));
      const making = makingRate; // Fixed amount, not per gram

      const metalCost = w * effectiveRate;
      const subtotal = metalCost + making + stone;
      const gstAmount = subtotal * gstP;
      const total = subtotal + gstAmount;

      // Exchange Calculation
      const oldW = Math.max(0, safeParse(oldGoldWeight));
      const oldT = safeParse(oldGoldTouch);
      const touchFactor = oldT > 0 ? oldT / 100 : 1;
      const oldR = Math.max(0, safeParse(oldGoldRate));

      const processedOldWeight = oldW * touchFactor;
      const exchangeValue = processedOldWeight * oldR;
      const netPayable = total - exchangeValue;

      setResult({
        metalCost,
        makingCost: making,
        stoneCost: stone,
        gstAmount,
        total,
        exchangeValue,
        netPayable,
        discountAmount: disc * w,
        processedOldWeight
      });
      setIsCalculating(false);

      // Scroll to result on mobile
      const resultElement = document.getElementById('result-card');
      if (resultElement) {
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 400);
  };

  const handleShareWhatsApp = () => {
    if (!result) return;
    const text = `*✨ AKR JEWELLERS Estimate ✨*
-----------------------------
*Item Details:*
Weight: ${weight}g (${purity.toUpperCase()})
Rate: ₹${rates[purity]}/g ${parseInt(discount) > 0 ? `(Less -₹${discount}/g)` : ''}
Making: ₹${makingCharge} (Fixed)
Stones: ₹${stoneCharges || '0'}

*Breakdown:*
Metal: ₹${result.metalCost.toFixed(2)}
Making: ₹${result.makingCost.toFixed(2)}
Stones: ₹${result.stoneCost.toFixed(2)}
GST (${gstPercent}%): ₹${result.gstAmount.toFixed(2)}

*New Item Total: ₹${result.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}*

${result.exchangeValue > 0 ? `*Old Gold Exchange:*
Weight: ${oldGoldWeight}g ${oldGoldTouch ? `(@ ${oldGoldTouch}%)` : ''}
Net Weight: ${result.processedOldWeight.toFixed(3)}g
Rate: ₹${oldGoldRate}/g
Less: -₹${result.exchangeValue.toLocaleString()}

*NET PAYABLE: ₹${result.netPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}*` : ''}
-----------------------------
_Generated by AKR JEWELLERS_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- LOGIN VIEW ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-neutral-800 animate-slide-up">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 p-1 rounded-2xl shadow-xl shadow-yellow-500/20 mb-4">
              <img src="/logo.jpg" alt="AKR Logo" className="w-16 h-16 rounded-xl object-cover" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent">AKR JEWELLERS</h1>
            <p className="text-neutral-500 text-sm">Authorized Access Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Email</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-neutral-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-white focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all placeholder-neutral-700"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-neutral-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-white focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all placeholder-neutral-700"
                  placeholder="Enter Password"
                />
              </div>
            </div>

            {loginError && (
              <div className="text-red-400 text-xs text-center bg-red-900/20 py-2 rounded-lg border border-red-900/50">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-white text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors mt-4"
            >
              Login <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN CALCULATOR VIEW ---
  return (
    <div className="min-h-screen text-neutral-100 pb-12 font-sans selection:bg-yellow-500/30">

      {/* Navbar / Header */}
      <nav className="sticky top-0 z-50 glass-panel border-b-0 border-b-neutral-800/50 shadow-2xl shadow-black/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 p-0.5 rounded-xl shadow-lg shadow-yellow-500/20">
              <img src="/logo.jpg" alt="AKR Logo" className="w-10 h-10 rounded-lg object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-yellow-200 to-yellow-500 bg-clip-text text-transparent">
                AKR JEWELLERS
              </h1>
              <p className="text-[10px] text-neutral-400 font-medium tracking-wide uppercase">Premium Estimator</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs text-neutral-500 hover:text-white transition-colors">
            Logout
          </button>
        </div>

        <div className="overflow-x-auto pb-3 px-4 no-scrollbar flex items-center gap-2">
          <button
            onClick={fetchRates}
            disabled={isFetchingRates}
            className="h-full px-3 py-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Rates from KJPL"
          >
            <TrendingUp className={`w-4 h-4 ${isFetchingRates ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-3 min-w-max mx-auto max-w-2xl">
            {[
              { label: 'GOLD 22K', key: '22k', color: 'text-yellow-500' },
              { label: 'SILVER', key: 'silver', color: 'text-neutral-300' }
            ].map((item) => (
              <div key={item.key} className="flex flex-col bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-1.5 min-w-[100px]">
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{item.label}</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-neutral-500 text-xs">₹</span>
                  <input
                    type="number"
                    value={rates[item.key as PurityType] || ''}
                    onChange={(e) => setRates({ ...rates, [item.key]: parseFloat(e.target.value) || 0 })}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0"
                    className={`bg-transparent font-bold text-sm outline-none w-full ${item.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 mt-6 space-y-6">

        {/* Input Card */}
        <div className="glass-panel rounded-3xl p-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="bg-neutral-950/50 rounded-[20px] p-5 space-y-6">

            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Parameters</h2>
            </div>

            {/* Weight Input */}
            <div className="flex gap-4">
              <div className="relative group flex-1">
                <label className="absolute -top-2.5 left-3 bg-neutral-900 px-2 text-[10px] font-bold text-yellow-500 uppercase tracking-wide rounded">
                  Weight (g)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0.00"
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 text-2xl font-bold text-white focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all placeholder-neutral-800"
                />
              </div>

              {/* Discount Input */}
              <div className="relative w-1/3">
                <label className="absolute -top-2 left-2 bg-neutral-900 px-1 text-[10px] text-green-500 uppercase font-bold">Offer / g</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="- ₹0"
                  className="w-full h-full bg-neutral-900/50 border border-neutral-800 rounded-2xl px-3 py-4 text-xl font-bold text-green-400 focus:border-green-500/50 outline-none transition-all placeholder-neutral-800 text-right"
                />
              </div>
            </div>

            {/* Purity Selection */}
            <div className="bg-neutral-900/50 p-1 rounded-xl flex gap-1 border border-neutral-800">
              {(['22k', 'silver'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPurity(p)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all uppercase ${purity === p
                    ? 'bg-neutral-800 text-yellow-400 shadow-sm border border-neutral-700'
                    : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* GST */}
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-neutral-900 px-1 text-[10px] text-neutral-500 uppercase">GST %</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="3"
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 text-lg font-medium outline-none focus:border-yellow-500/30 transition-colors text-right"
                />
              </div>
            </div>

            {/* Making Charges */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Total Making Charge</label>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-3 text-neutral-600">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={makingCharge}
                  onChange={(e) => setMakingCharge(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0"
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-8 pr-4 py-3 text-lg font-medium outline-none focus:border-yellow-500/30 transition-colors"
                />
              </div>
            </div>

            {/* Stone Charges */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-neutral-900 px-1 text-[10px] text-neutral-500 uppercase">Stone Price</label>
              <span className="absolute left-4 top-3.5 text-neutral-600">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={stoneCharges}
                onChange={(e) => setStoneCharges(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="0"
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-8 pr-4 py-3 text-lg font-medium outline-none focus:border-yellow-500/30 transition-colors"
              />
            </div>

            {/* Exchange Section */}
            <div className="bg-neutral-900/30 rounded-xl p-4 border border-neutral-800/50 space-y-3">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wide flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-red-400" /> Exchange Old Gold
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <label className="absolute -top-2 left-2 bg-neutral-900 px-1 text-[10px] text-neutral-500 uppercase">Old Wt</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={oldGoldWeight}
                    onChange={(e) => setOldGoldWeight(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0.00"
                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-2 py-3 text-lg font-medium outline-none focus:border-red-500/30 transition-colors text-right"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-2 bg-neutral-900 px-1 text-[10px] text-neutral-500 uppercase">Touch %</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={oldGoldTouch}
                    onChange={(e) => setOldGoldTouch(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="100"
                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-2 py-3 text-lg font-medium outline-none focus:border-red-500/30 transition-colors text-right"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-2 bg-neutral-900 px-1 text-[10px] text-neutral-500 uppercase">Rate / g</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={oldGoldRate}
                    onChange={(e) => setOldGoldRate(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0"
                    className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-2 py-3 text-lg font-medium outline-none focus:border-red-500/30 transition-colors text-right"
                  />
                </div>
              </div>

              {/* Live Net Weight Display */}
              {oldGoldWeight && oldGoldTouch && (
                <div className="flex justify-between items-center bg-neutral-950/50 px-3 py-2 rounded-lg border border-neutral-800/50">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">Net Exchange Weight</span>
                  <span className="text-sm font-bold text-red-400 font-mono">
                    {(parseFloat(oldGoldWeight) * (parseFloat(oldGoldTouch) / 100)).toFixed(3)}g
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={calculateTotal}
              disabled={isCalculating}
              className="group w-full relative overflow-hidden bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-yellow-500/20 disabled:opacity-80"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-2xl"></div>
              {isCalculating ? (
                <span className="animate-pulse">Calculating...</span>
              ) : (
                <>
                  <Calculator className="w-5 h-5" /> Calculate Price
                </>
              )}
            </button>

          </div>
        </div>

        {/* Result Card */}
        {result && (
          <div id="result-card" className="animate-slide-up pb-8">
            <div className="relative bg-neutral-100 text-neutral-900 rounded-3xl p-6 overflow-hidden shadow-2xl">
              {/* Decorative Top Edge */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-neutral-200 via-neutral-400 to-neutral-200"></div>
              <div className="absolute -right-12 -top-12 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl"></div>

              <div className="relative z-10">
                <div className="flex justify-between items-end mb-6 border-b border-neutral-200 pb-4">
                  <div>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Total Estimate</p>
                    <p className="text-[10px] font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-md inline-block mt-1">
                      @{purity.toUpperCase()} ₹{rates[purity]}/g
                    </p>
                    <div className="text-4xl font-black text-neutral-900 tracking-tighter mt-1">
                      <span className="text-2xl text-neutral-400 font-medium mr-1">₹</span>
                      {result.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-[10px] font-bold uppercase">
                    Est. Only
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Metal Rate <span className="text-[10px] text-green-500">{result.discountAmount > 0 ? `(Offer -₹${(result.discountAmount / parseFloat(weight)).toFixed(0)}/g)` : ''}</span></span>
                    <span className="font-mono font-medium">₹{result.metalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Making</span>
                    <span className="font-mono font-medium">₹{result.makingCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Stones</span>
                    <span className="font-mono font-medium">₹{result.stoneCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600 pt-2 border-t border-neutral-200 border-dashed">
                    <span>GST ({gstPercent}%)</span>
                    <span className="font-mono font-medium">₹{result.gstAmount.toLocaleString()}</span>
                  </div>

                  {result.exchangeValue > 0 && (
                    <>
                      <div className="flex justify-between text-red-500 pt-2 border-t border-neutral-200 border-dashed">
                        <div className="flex flex-col">
                          <span>Old Gold Exchange</span>
                          <span className="text-[10px] text-neutral-400">Net Wt: {result.processedOldWeight.toFixed(3)}g</span>
                        </div>
                        <span className="font-mono font-medium">-₹{result.exchangeValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 mt-2 border-t-2 border-neutral-800">
                        <span className="text-lg font-bold text-neutral-900 uppercase">Net Payable</span>
                        <span className="text-2xl font-black text-neutral-900 tracking-tighter">₹{result.netPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={handleShareWhatsApp}
                  className="mt-6 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-500/20 active:scale-[0.98]"
                >
                  <Send className="w-5 h-5" /> Share Quote
                </button>

                <div className="text-center mt-4">
                  <p className="text-[10px] text-neutral-400 flex items-center justify-center gap-1">
                    <Info className="w-3 h-3" /> Market rates subject to change
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;