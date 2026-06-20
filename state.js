const STORAGE_KEY = "gestor_imp3d_v1";

const DEFAULT = {
  // Contas exclusivas para a gestão da Loja 3D (Substitui Nubank, Caju, etc.)
  accounts: [
    { id: "caixa_fisico", name: "Caixa / Dinheiro Físico", saldo: 0 },
    { id: "banco_loja", name: "Conta Bancária da Loja", saldo: 0 },
    { id: "plataforma_1", name: "Saldo Plataforma (Shopee/ML)", saldo: 0 }
  ],
  // Configurações personalizáveis por cada usuário
  settings: {
    platformFeePct: 0.20,     // 20%
    platformFeeFixed: 4.00,   // R$ 4,00
    energyCostKwh: 0.95       // Preço do kWh 
  },
  
  storeExpenses: [],  // Substitui o array 'expenses' de finanças pessoais
  filaments: [],      // {id, color, type, weight, initialWeight, price}
  productBoxes: [{ id: 'box-default', name: 'Geral', emoji: '📦' }],
  products: [],       // {id, boxId, name, hours, fil_g, energy_h, pack, price, desc, variants}
  impSales: [],       // {id, date, productId, filamentId, accountId, qty, amountGross, feeTotal, netReceived, materialCost, profit}
  impLosses: [],      // {id, date, filamentId, grams, cost, reason, mode}
  impExternalSales: [],
  impStock: [],       // {id, date, productId, variantId, filamentId, qty, snapshot}
  meta: { baseMonth: null, activeOffset: 0 }
};

let state = loadState();
window.state = state;

function money(v){ 
  v = Number(v||0); 
  return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); 
}

const sum = (arr, fn)=> arr.reduce((s,x)=> s + (Number(fn?fn(x):x)||0), 0);

function todayISO(){ 
  return new Date().toISOString().slice(0,10); 
}

/* Mês lógico contábil da loja: Padrão calendário (YYYY-MM) */
function billingMonthOf(d){
  if(!d) return '';
  const parts = d.split('-');
  if(parts.length < 2) return '';
  return `${parts[0]}-${parts[1].padStart(2,'0')}`;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const s = JSON.parse(raw);
      
      // 1. Garantir que as estruturas base do novo app existam
      if(!s.accounts || s.accounts.length === 0) s.accounts = JSON.parse(JSON.stringify(DEFAULT.accounts));
      if(!s.settings) s.settings = JSON.parse(JSON.stringify(DEFAULT.settings));
      if(!s.storeExpenses) s.storeExpenses = [];
      if(!s.meta) s.meta = DEFAULT.meta;
      
      if(!s.filaments) s.filaments = [];
      if(!s.products) s.products = [];
      if(!s.impSales) s.impSales = [];
      if(!s.impLosses) s.impLosses = [];
      if(!s.impExternalSales) s.impExternalSales = [];
      if(!s.impStock) s.impStock = [];

      // 2. Migração de Produtos Antigos
      if(Array.isArray(s.products)){
        s.products.forEach(p => {
          if(p && p.energy_h === undefined) p.energy_h = 0;
          if(p && p.pack === undefined) p.pack = 0;
        });
      }

      // 3. Reconstrução de Snapshots do Estoque (Segurança Extrema)
      if(Array.isArray(s.impStock)){
        s.impStock.forEach(stock=>{
          if(!stock.snapshot){
            const prod = (s.products || []).find(p=>p.id===stock.productId);
            const fil = (s.filaments || []).find(f=>f.id===stock.filamentId);
            if(prod && fil){
              const qty = Number(stock.qty || 1) || 1;
              const initial = Number(fil.initialWeight || fil.weight || 0);
              const pricePerGram = initial > 0 ? Number(fil.price || 0) / initial : 0;
      
              const unitMaterialCost = stock.materialCost !== undefined
                ? Number(stock.materialCost || 0) / qty
                : Number(prod.fil_g || 0) * pricePerGram;
      
              const unitHourlyCost = stock.hourlyCost !== undefined
                ? Number(stock.hourlyCost || 0) / qty
                : Number(prod.hours || 0) * Number(prod.energy_h || 0);
      
              const unitPackagingCost = stock.packagingCost !== undefined
                ? Number(stock.packagingCost || 0) / qty
                : Number(prod.pack || 0);
      
              stock.snapshot = {
                salePricePerUnit: Number(prod.price || 0),
                unitMaterialCost,
                unitHourlyCost,
                unitPackagingCost,
                variantId: 'default',
                variantLabel: 'Padrão',
                filamentSnapshot: {
                  id: fil.id,
                  color: fil.color,
                  type: fil.type,
                  price: Number(fil.price || 0),
                  initialWeight: initial,
                  pricePerGram
                }
              };
            }
          }
        });
      }

      // 4. Compatibilidade de Peso Inicial do Filamento
      if(Array.isArray(s.filaments)){
        s.filaments.forEach(f => {
          if(f && (f.initialWeight === undefined || f.initialWeight === null)){
            f.initialWeight = Number(f.weight || 0);
          }
        });
      }

      // 5. Conversão das antigas Categorias de Texto para o novo sistema de Caixas
      if(!s.productBoxes) {
        s.productBoxes = [{ id: 'box-default', name: 'Geral', emoji: '📦' }];
        
        if(Array.isArray(s.products)){
          const catNames = [...new Set(s.products.map(p => p.category).filter(c => c && c !== 'Geral'))];
          catNames.forEach((catName, idx) => {
            s.productBoxes.push({ id: 'box-mig-' + idx, name: catName, emoji: '📁' });
          });
          
          s.products.forEach(p => {
            const catName = p.category || 'Geral';
            const box = s.productBoxes.find(b => b.name === catName);
            p.boxId = box ? box.id : 'box-default';
            delete p.category; // Limpa o dado velho
          });
        }
      }

      // Define o mês base sempre que abre
      s.meta.baseMonth = billingMonthOf(todayISO());
      return s;
    }
  }catch(e){console.error(e);}
  
  const copy = JSON.parse(JSON.stringify(DEFAULT));
  copy.meta.baseMonth = billingMonthOf(todayISO());
  return copy;
}

function saveState(){ 
  window.state = state; 
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); 
}

function computeMonthFromOffset(offset){
  const base = state.meta.baseMonth || billingMonthOf(todayISO());
  const [y,m] = base.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getActiveMonth(){ 
  return computeMonthFromOffset(state.meta.activeOffset); 
}

function exportBackup(){
  try{
    const dataStr = JSON.stringify(state);
    const blob = new Blob([dataStr], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.href = url;
    a.download = `gestor-imp3d-backup-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    alert('Não foi possível gerar o backup.');
  }
}

function handleBackupImport(e){
  const file = e.target.files[0];
  if(!file){
    e.target.value='';
    return;
  }
  if(!confirm('Atenção: Importar este backup apagará e substituirá TODOS os dados atuais da sua Loja 3D. Continuar?')){
    e.target.value='';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev =>{
    try{
      const data = JSON.parse(ev.target.result);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      state = loadState();
      alert('Backup importado com sucesso!');
      location.reload();
    }catch(err){
      console.error(err);
      alert('Arquivo de backup inválido ou corrompido.');
    }finally{
      e.target.value='';
    }
  };
  reader.readAsText(file);
}