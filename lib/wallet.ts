export type Account = { id: string; name: string; type: "cash"|"bank"|"ewallet"|"credit"; balance: number };
export type Transaction = { id: string; type: "expense"|"income"; amount: number; category: string; merchant?: string; accountId: string; date: string; note?: string; createdAt: string };
export type Goal = { id: string; name: string; target: number; saved: number; targetDate?: string };
export type ChatMessage = { id: string; role: "user"|"assistant"; text: string; createdAt: string };
export type Preferences = { defaultAccount: string; defaultPeriod: string; currency: "SGD"; categoryMemory: Record<string,string> };
export type AppState = { accounts: Account[]; transactions: Transaction[]; budgets: Record<string,number>; goals: Goal[]; preferences: Preferences; messages: ChatMessage[] };

export type AgentOperation =
  | { type:"add_transaction"; transaction:{ type:"expense"|"income"; amount:number; category:string; merchant?:string; accountName?:string; date:string; note?:string } }
  | { type:"update_transaction"; transactionId:string; patch:Partial<Pick<Transaction,"amount"|"category"|"merchant"|"date"|"note">> & {accountName?:string} }
  | { type:"delete_transaction"; transactionId:string }
  | { type:"set_budget"; category:string; amount:number }
  | { type:"add_goal"; name:string; target:number; saved:number; targetDate?:string }
  | { type:"update_goal"; goalName:string; saved?:number; target?:number; targetDate?:string }
  | { type:"remember_category"; merchant:string; category:string }
  | { type:"none" };

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const today = () => new Date().toISOString().slice(0,10);

export const defaultState: AppState = {
  accounts: [
    { id:"cash", name:"Cash Wallet", type:"cash", balance:116.05 },
    { id:"bank", name:"Main Bank", type:"bank", balance:2419.99 },
  ],
  transactions: [
    { id:"demo1", type:"expense", amount:18, category:"Food & Dining", merchant:"Dinner", accountId:"bank", date:today(), createdAt:new Date().toISOString() },
    { id:"demo2", type:"expense", amount:8.75, category:"Transport", merchant:"Ride", accountId:"bank", date:today(), createdAt:new Date().toISOString() },
    { id:"demo3", type:"expense", amount:6, category:"Food & Dining", merchant:"Coffee", accountId:"cash", date:today(), createdAt:new Date().toISOString() },
  ],
  budgets: {},
  goals: [],
  preferences: { defaultAccount:"Main Bank", defaultPeriod:"this month", currency:"SGD", categoryMemory:{} },
  messages: [],
};

export function loadState():AppState {
  if (typeof window === "undefined") return defaultState;
  try { const raw=localStorage.getItem("wallet-v4-state"); return raw ? JSON.parse(raw) : defaultState; } catch { return defaultState; }
}
export function saveState(state:AppState){ if(typeof window!=="undefined") localStorage.setItem("wallet-v4-state",JSON.stringify(state)); }
export const formatMoney=(n:number)=>`SGD ${Number(n||0).toLocaleString("en-SG",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function accountDelta(t:Transaction){ return t.type === "expense" ? -t.amount : t.amount; }
function findAccountId(state:AppState,name?:string){
  const n=(name||state.preferences.defaultAccount).toLowerCase();
  if(n.includes("cash")) return state.accounts.find(a=>a.type==="cash")?.id || state.accounts[0]?.id;
  if(n.includes("card")||n.includes("bank")||n.includes("paynow")||n.includes("ewallet")) return state.accounts.find(a=>a.type==="bank"||a.type==="ewallet")?.id || state.accounts[0]?.id;
  return state.accounts.find(a=>a.name.toLowerCase()===n)?.id || state.accounts.find(a=>a.name===state.preferences.defaultAccount)?.id || state.accounts[0]?.id;
}

export function applyAgentOperations(state:AppState,ops:AgentOperation[]):AppState{
  let s=structuredClone(state) as AppState;
  for(const op of ops){
    if(op.type==="add_transaction"){
      const accountId=findAccountId(s,op.transaction.accountName);
      const tx:Transaction={id:uid(),createdAt:new Date().toISOString(),accountId,...op.transaction,date:op.transaction.date||today()};
      s.transactions=[tx,...s.transactions];
      s.accounts=s.accounts.map(a=>a.id===accountId?{...a,balance:a.balance+accountDelta(tx)}:a);
      if(tx.merchant) s.preferences.categoryMemory[tx.merchant.toLowerCase()]=tx.category;
    }
    if(op.type==="update_transaction"){
      const old=s.transactions.find(t=>t.id===op.transactionId); if(!old) continue;
      s.accounts=s.accounts.map(a=>a.id===old.accountId?{...a,balance:a.balance-accountDelta(old)}:a);
      const accountId=op.patch.accountName?findAccountId(s,op.patch.accountName):old.accountId;
      const {accountName,...patch}=op.patch;
      const updated={...old,...patch,accountId} as Transaction;
      s.transactions=s.transactions.map(t=>t.id===old.id?updated:t);
      s.accounts=s.accounts.map(a=>a.id===updated.accountId?{...a,balance:a.balance+accountDelta(updated)}:a);
    }
    if(op.type==="delete_transaction"){
      const old=s.transactions.find(t=>t.id===op.transactionId); if(!old) continue;
      s.accounts=s.accounts.map(a=>a.id===old.accountId?{...a,balance:a.balance-accountDelta(old)}:a);
      s.transactions=s.transactions.filter(t=>t.id!==old.id);
    }
    if(op.type==="set_budget") s.budgets[op.category]=op.amount;
    if(op.type==="add_goal") s.goals=[...s.goals,{id:uid(),name:op.name,target:op.target,saved:op.saved||0,targetDate:op.targetDate}];
    if(op.type==="update_goal") s.goals=s.goals.map(g=>g.name.toLowerCase()===op.goalName.toLowerCase()?{...g,...(op.saved!==undefined?{saved:op.saved}:{}),...(op.target!==undefined?{target:op.target}:{}),...(op.targetDate?{targetDate:op.targetDate}:{})}:g);
    if(op.type==="remember_category") s.preferences.categoryMemory[op.merchant.toLowerCase()]=op.category;
  }
  return s;
}

export function summarize(state:AppState){
  const cash=state.accounts.filter(a=>a.type==="cash").reduce((a,b)=>a+b.balance,0);
  const bank=state.accounts.filter(a=>a.type!=="cash"&&a.type!=="credit").reduce((a,b)=>a+b.balance,0);
  const [from,to]=Object.values(datePresetRange("month"));
  const month=filterTransactions(state.transactions,from,to);
  return {cash,bank,netMoney:state.accounts.filter(a=>a.type!=="credit").reduce((a,b)=>a+b.balance,0),monthSpend:month.filter(t=>t.type==="expense").reduce((a,b)=>a+b.amount,0),monthIncome:month.filter(t=>t.type==="income").reduce((a,b)=>a+b.amount,0)};
}

export function datePresetRange(preset:string){
  const now=new Date(); let from=new Date(now); let to=new Date(now);
  if(preset==="week") from.setDate(now.getDate()-6);
  else if(preset==="30d") from.setDate(now.getDate()-29);
  else if(preset==="month") from=new Date(now.getFullYear(),now.getMonth(),1);
  else if(preset==="lastMonth"){from=new Date(now.getFullYear(),now.getMonth()-1,1);to=new Date(now.getFullYear(),now.getMonth(),0);}
  else if(preset==="3m") from=new Date(now.getFullYear(),now.getMonth()-2,1);
  const f=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  return {from:f(from),to:f(to)};
}
export function filterTransactions(tx:Transaction[],from:string,to:string){return tx.filter(t=>t.date>=from&&t.date<=to)}
export function categoryTotals(tx:Transaction[]){
  const m=new Map<string,number>(); tx.filter(t=>t.type==="expense").forEach(t=>m.set(t.category,(m.get(t.category)||0)+t.amount));
  return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}
