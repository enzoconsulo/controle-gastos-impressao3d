/* ========================================================
   NAVEGAÇÃO SPA (Troca de Abas)
   ======================================================== */
function activateTab(tabName){
  // Atualiza os botões
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  // Atualiza as telas (panels)
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === 'tab-' + tabName);
  });
}

// Fecha menus de opções se clicar fora deles (Lista de Produtos)
if(!window.actionMenuListenerAdded) {
  window.addEventListener('click', (e) => {
    if(!e.target.closest('.prod-action-menu')) {
      document.querySelectorAll('.action-dropdown').forEach(m => m.style.display = 'none');
    }
  });
  window.actionMenuListenerAdded = true;
}

/* ========================================================
   INICIALIZAÇÃO DO APLICATIVO
   ======================================================== */
document.addEventListener('DOMContentLoaded', () => {

  // 1. Configura os cliques nas abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // 2. Controle do seletor de meses
  const monthIndexEl = document.getElementById('month-index');
  const monthLabelEl = document.getElementById('month-label');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  
  function renderMonthIndex(){
    if(monthIndexEl) monthIndexEl.textContent = state.meta.activeOffset;
    if(monthLabelEl) monthLabelEl.textContent = computeMonthFromOffset(state.meta.activeOffset);
  }
  
  if(prevMonthBtn){
    prevMonthBtn.addEventListener('click', ()=>{
      state.meta.activeOffset = Number(state.meta.activeOffset || 0) - 1;
      saveState();
      renderMonthIndex();
      updateAll();
    });
  }
  
  if(nextMonthBtn){
    nextMonthBtn.addEventListener('click', ()=>{
      state.meta.activeOffset = Number(state.meta.activeOffset || 0) + 1;
      saveState();
      renderMonthIndex();
      updateAll();
    });
  }
  
  renderMonthIndex();

  // 3. Toggle All Time no Dashboard
  const toggleAllTime = document.getElementById('dash-toggle-alltime');
  if (toggleAllTime) {
    toggleAllTime.addEventListener('change', () => {
      if(typeof renderImp3dDashboard === 'function') renderImp3dDashboard();
    });
  }

  // 4. Inicializa os Listeners da nova aba de Configurações
  if(typeof initConfiguracoes === 'function') initConfiguracoes();

  // 5. Pinta a tela pela primeira vez
  updateAll();
});


/* ========================================================
   FUNÇÃO GLOBAL DE RENDERIZAÇÃO
   ======================================================== */
function updateAll(){
  
  // Aba: Dashboard
  if(typeof renderImp3dDashboard === 'function') renderImp3dDashboard();
  if(typeof updateImp3dAccountBalances === 'function') updateImp3dAccountBalances();

  // Aba: Produtos & Caixas
  if(typeof populateProductBoxSelects === 'function') populateProductBoxSelects();
  if(typeof renderProductBoxes === 'function') renderProductBoxes();
  if(typeof renderProducts === 'function') renderProducts();

  // Aba: Filamentos
  if(typeof renderFilaments === 'function') renderFilaments();

  // Aba: Estoque
  if(typeof renderImpStock === 'function') renderImpStock();
  if(typeof populateImp3dStockSelects === 'function') populateImp3dStockSelects();

  // Aba: Vendas
  if(typeof renderImpSales === 'function') renderImpSales();
  if(typeof renderImpLosses === 'function') renderImpLosses();

  // Aba: Configurações
  if(typeof renderConfigSettings === 'function') renderConfigSettings();
  if(typeof renderAccountsConfig === 'function') renderAccountsConfig();
  
  saveState();
}