"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Home,
  Bot,
  WalletCards,
  BarChart3,
  Mic,
  Send,
  Plus,
  Trash2,
  Pencil,
  Target,
  PiggyBank,
  Download,
  Upload,
  RotateCcw,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  AppState,
  AgentOperation,
  ChatMessage,
  Transaction,
  Account,
  defaultState,
  loadState,
  saveState,
  applyAgentOperations,
  summarize,
  filterTransactions,
  categoryTotals,
  datePresetRange,
  formatMoney,
  uid,
} from "@/lib/wallet";

const ORANGE = ["#f97316", "#fb923c", "#fdba74", "#ea580c", "#c2410c", "#fed7aa", "#ffedd5", "#9a3412"];

type Tab = "home" | "insights" | "agent" | "accounts";

export default function WalletApp() {
  const [state, setState] = useState<AppState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [rangePreset, setRangePreset] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const summary = useMemo(() => summarize(state), [state]);
  const dateRange = useMemo(() => {
    if (rangePreset === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
    return datePresetRange(rangePreset);
  }, [rangePreset, customFrom, customTo]);
  const visibleTx = useMemo(() => filterTransactions(state.transactions, dateRange.from, dateRange.to), [state.transactions, dateRange]);
  const pieData = useMemo(() => categoryTotals(visibleTx), [visibleTx]);
  const trendData = useMemo(() => {
    const m = new Map<string, number>();
    visibleTx.filter(t => t.type === "expense").forEach(t => m.set(t.date, (m.get(t.date) || 0) + t.amount));
    return [...m.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [visibleTx]);

  async function sendToAgent(message?: string) {
    const text = (message ?? input).trim();
    if (!text || busy) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", text, createdAt: new Date().toISOString() };
    const nextMessages = [...state.messages, userMsg].slice(-20);
    setState(s => ({ ...s, messages: nextMessages }));
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, state: { ...state, messages: nextMessages } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent request failed");
      const operations = (data.operations || []) as AgentOperation[];
      setState(s => {
        const updated = applyAgentOperations(
          { ...s, messages: nextMessages },
          operations
        );
      
        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          text: data.reply,
          createdAt: new Date().toISOString(),
        };
      
        return {
          ...updated,
          messages: [...nextMessages, assistantMsg].slice(-30),
        };
      });
      } catch (e) {
        const text = e instanceof Error ? e.message : "Something went wrong.";
      
        const errorMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          text: `I couldn't complete that: ${text}`,
          createdAt: new Date().toISOString(),
        };
      
        setState(s => ({
          ...s,
          messages: [...nextMessages, errorMsg],
        }));
      } 
      finally {
      setBusy(false);
    }
  }

  function startVoice() {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return alert("Voice recognition is not supported in this browser. Try Chrome on Android/Desktop.");
    const recognition = new SR();
    recognition.lang = "en-SG";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);
    recognition.start();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `wallet-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setState(parsed);
      } catch { alert("That file is not a valid Wallet backup."); }
    };
    reader.readAsText(file);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-row"><h1>Wallet</h1><span className="beta">Private beta</span></div>
          <p>Your personal AI money companion</p>
        </div>
      </header>

      <section className="content">
        {tab === "home" && <HomeView state={state} summary={summary} sendToAgent={sendToAgent} setTab={setTab} />}
        {tab === "insights" && (
          <InsightsView
            state={state} visibleTx={visibleTx} pieData={pieData} trendData={trendData}
            rangePreset={rangePreset} setRangePreset={setRangePreset}
            customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo}
            sendToAgent={sendToAgent}
          />
        )}
        {tab === "agent" && <AgentView state={state} input={input} setInput={setInput} busy={busy} sendToAgent={sendToAgent} startVoice={startVoice} />}
        {tab === "accounts" && <AccountsView state={state} setState={setState} exportData={exportData} importData={importData} />}
      </section>

      <nav className="bottom-nav">
        <NavButton active={tab === "home"} label="Home" icon={<Home size={21}/>} onClick={() => setTab("home")} />
        <NavButton active={tab === "insights"} label="Insights" icon={<BarChart3 size={21}/>} onClick={() => setTab("insights")} />
        <NavButton active={tab === "agent"} label="Agent" icon={<Bot size={21}/>} onClick={() => setTab("agent")} />
        <NavButton active={tab === "accounts"} label="Accounts" icon={<WalletCards size={21}/>} onClick={() => setTab("accounts")} />
      </nav>
    </main>
  );
}

function HomeView({ state, summary, sendToAgent, setTab }: any) {
  const monthSpend = summary.monthSpend;
  const monthIncome = summary.monthIncome;
  const savings = monthIncome - monthSpend;
  const totalBudget = Object.values(state.budgets).reduce((a: number, b: any) => a + Number(b || 0), 0);
  return <div className="stack">
    <section className="hero-card">
      <div className="eyebrow">Net money</div>
      <div className="hero-money">{formatMoney(summary.netMoney)}</div>
      <div className="hero-grid">
        <Mini label="Cash" value={formatMoney(summary.cash)} />
        <Mini label="Bank / e-wallet" value={formatMoney(summary.bank)} />
        <Mini label="Spent this month" value={formatMoney(monthSpend)} />
        <Mini label="Budget remaining" value={totalBudget ? formatMoney(Math.max(0, totalBudget - monthSpend)) : "Not set"} />
      </div>
    </section>

    <section className="card">
      <div className="section-head"><div><h2>This month</h2><p>Your current money picture.</p></div><button className="link-btn" onClick={() => setTab("insights")}>View insights</button></div>
      <div className="stat-row"><Stat label="Income" value={formatMoney(monthIncome)} /><Stat label="Spent" value={formatMoney(monthSpend)} /><Stat label="Net saved" value={formatMoney(savings)} /></div>
    </section>

    <section className="card">
      <div className="section-head"><div><h2>Ask Wallet</h2><p>Record money or get budgeting help naturally.</p></div><Bot size={24} /></div>
      <div className="quick-grid">
        <button onClick={() => sendToAgent("Give me a quick review of my spending this month and tell me the one thing I should improve.")}>Review my month</button>
        <button onClick={() => sendToAgent("Help me create a realistic monthly budget from my spending history.")}>Build my budget</button>
        <button onClick={() => sendToAgent("What are my biggest spending categories this month?")}>Top categories</button>
        <button onClick={() => sendToAgent("Am I spending more or less than last month? Explain the main differences.")}>Compare months</button>
      </div>
    </section>

    {state.goals.length > 0 && <section className="card">
      <div className="section-head"><div><h2>Savings goals</h2><p>Progress toward what matters.</p></div><Target size={24}/></div>
      <div className="stack small-gap">{state.goals.map((g: any) => {
        const pct = Math.min(100, (g.saved / g.target) * 100 || 0);
        return <div key={g.id}><div className="goal-line"><strong>{g.name}</strong><span>{formatMoney(g.saved)} / {formatMoney(g.target)}</span></div><div className="progress"><span style={{width:`${pct}%`}}/></div></div>
      })}</div>
    </section>}

    <section className="card">
      <h2>Recent activity</h2>
      <div className="activity-list">
        {state.transactions.slice(0,6).map((t: Transaction) => <div className="activity" key={t.id}><div><strong>{t.merchant || t.category}</strong><small>{t.category} · {t.date}</small></div><b className={t.type === "expense" ? "negative" : "positive"}>{t.type === "expense" ? "−" : "+"}{formatMoney(t.amount)}</b></div>)}
        {!state.transactions.length && <p className="muted">No transactions yet. Tell the agent “Spent $12 on lunch”.</p>}
      </div>
    </section>
  </div>
}

function InsightsView({ visibleTx, pieData, trendData, rangePreset, setRangePreset, customFrom, setCustomFrom, customTo, setCustomTo, sendToAgent }: any) {
  const spent = visibleTx.filter((t: Transaction)=>t.type==="expense").reduce((a:number,t:Transaction)=>a+t.amount,0);
  const income = visibleTx.filter((t: Transaction)=>t.type==="income").reduce((a:number,t:Transaction)=>a+t.amount,0);
  return <div className="stack">
    <section className="card">
      <div className="section-head"><div><h2>Insights</h2><p>Choose a period and Wallet recalculates everything.</p></div><BarChart3 size={24}/></div>
      <div className="chips">{[["week","7D"],["30d","30D"],["month","This month"],["lastMonth","Last month"],["3m","3M"],["custom","Custom"]].map(([k,l]) => <button key={k} className={rangePreset===k?"chip active":"chip"} onClick={()=>setRangePreset(k)}>{l}</button>)}</div>
      {rangePreset === "custom" && <div className="date-row"><label>From<input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label><label>To<input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></label></div>}
      <div className="stat-row"><Stat label="Income" value={formatMoney(income)}/><Stat label="Spent" value={formatMoney(spent)}/><Stat label="Net" value={formatMoney(income-spent)}/></div>
    </section>

    <section className="card chart-card"><h2>Spend by category</h2><p>Where your money went in the selected period.</p>
      {pieData.length ? <><div className="chart"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3}>{pieData.map((_:any,i:number)=><Cell key={i} fill={ORANGE[i%ORANGE.length]}/>)}</Pie><Tooltip formatter={(v:any)=>formatMoney(Number(v))}/></PieChart></ResponsiveContainer></div><div className="legend">{pieData.map((x:any,i:number)=><div key={x.name}><span style={{background:ORANGE[i%ORANGE.length]}}/><b>{x.name}</b><em>{formatMoney(x.value)}</em></div>)}</div></> : <EmptyChart/>}
    </section>

    <section className="card chart-card"><h2>Spending over time</h2><p>Daily expense movement in the selected period.</p>
      {trendData.length ? <div className="chart"><ResponsiveContainer width="100%" height={260}><BarChart data={trendData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" fontSize={11}/><YAxis fontSize={11}/><Tooltip formatter={(v:any)=>formatMoney(Number(v))}/><Bar dataKey="amount" fill="#f97316" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div> : <EmptyChart/>}
    </section>

    <button className="primary wide" onClick={()=>sendToAgent(`Analyze my finances for the currently selected period. Total income is ${income.toFixed(2)} and spending is ${spent.toFixed(2)}. Tell me the main patterns and a practical budgeting recommendation.`)}>Ask Wallet to analyze this period</button>
  </div>
}

function AgentView({ state, input, setInput, busy, sendToAgent, startVoice }: any) {
  return <div className="stack agent-page">
    <section className="card agent-card"><div className="section-head"><div><h2>Wallet Agent</h2><p>It remembers your defaults and financial context.</p></div><Bot size={26}/></div>
      <div className="messages">
        {state.messages.length === 0 && <div className="bubble assistant">Hi! You can say “Spent $18 on dinner”, “How much did I spend on food this month?”, or “Build me a $1,200 monthly budget.”</div>}
        {state.messages.map((m:ChatMessage)=><div className={`bubble ${m.role}`} key={m.id}>{m.text}</div>)}
        {busy && <div className="bubble assistant">Thinking…</div>}
      </div>
      <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Spent $18 on dinner, paid by card…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendToAgent();}}}/>
      <div className="composer-actions"><button className="primary" onClick={()=>sendToAgent()} disabled={busy}><Send size={18}/>Send</button><button className="secondary" onClick={startVoice}><Mic size={18}/>Voice</button></div>
    </section>
    <section className="card"><h3>Defaults Wallet remembers</h3><div className="prefs"><div><span>Default date</span><b>Today unless you specify otherwise</b></div><div><span>Default payment</span><b>{state.preferences.defaultAccount}</b></div><div><span>“card” means</span><b>Bank</b></div><div><span>Cash</span><b>Only when explicitly mentioned</b></div><div><span>Default question period</span><b>{state.preferences.defaultPeriod}</b></div></div></section>
  </div>
}

function AccountsView({ state, setState, exportData, importData }: any) {
  const [name,setName]=useState(""); const [type,setType]=useState<Account["type"]>("bank"); const [balance,setBalance]=useState("");
  function add(){if(!name||!balance)return; setState((s:AppState)=>({...s,accounts:[...s.accounts,{id:uid(),name,type,balance:Number(balance)}]}));setName("");setBalance("");}
  function remove(id:string){if(confirm("Delete this account? Existing transactions will remain."))setState((s:AppState)=>({...s,accounts:s.accounts.filter(a=>a.id!==id)}));}
  return <div className="stack">
    <section className="card"><div className="section-head"><div><h2>Accounts</h2><p>Cash, banks, e-wallets and cards.</p></div><WalletCards size={25}/></div>
      <div className="account-list">{state.accounts.map((a:Account)=><div className="account" key={a.id}><div><strong>{a.name}</strong><small>{a.type}</small></div><div className="account-right"><b>{formatMoney(a.balance)}</b><button className="icon-btn" onClick={()=>{const v=prompt(`New balance for ${a.name}`,String(a.balance));if(v!==null&&!isNaN(Number(v)))setState((s:AppState)=>({...s,accounts:s.accounts.map(x=>x.id===a.id?{...x,balance:Number(v)}:x)}));}}><Pencil size={16}/></button><button className="icon-btn" onClick={()=>remove(a.id)}><Trash2 size={16}/></button></div></div>)}</div>
    </section>
    <section className="card"><h2>Add account</h2><div className="form-grid"><input placeholder="Name" value={name} onChange={e=>setName(e.target.value)}/><select value={type} onChange={e=>setType(e.target.value as Account["type"])}><option value="bank">Bank</option><option value="cash">Cash</option><option value="ewallet">E-wallet</option><option value="credit">Credit card</option></select><input type="number" placeholder="Current balance" value={balance} onChange={e=>setBalance(e.target.value)}/><button className="primary" onClick={add}><Plus size={18}/>Add</button></div></section>
    <section className="card"><h2>Your data</h2><p className="muted">This private-beta build stores financial data in this browser. Export backups regularly.</p><div className="composer-actions"><button className="secondary" onClick={exportData}><Download size={18}/>Export</button><label className="secondary file-label"><Upload size={18}/>Import<input type="file" accept="application/json" hidden onChange={e=>e.target.files?.[0]&&importData(e.target.files[0])}/></label><button className="secondary danger" onClick={()=>{if(confirm("Reset Wallet to demo data?"))setState(defaultState)}}><RotateCcw size={18}/>Reset</button></div></section>
  </div>
}

function NavButton({active,label,icon,onClick}:any){return <button className={active?"nav active":"nav"} onClick={onClick}>{icon}<span>{label}</span></button>}
function Mini({label,value}:any){return <div className="mini"><span>{label}</span><b>{value}</b></div>}
function Stat({label,value}:any){return <div className="stat"><span>{label}</span><b>{value}</b></div>}
function EmptyChart(){return <div className="empty"><PiggyBank size={32}/><span>No spending data in this period.</span></div>}
