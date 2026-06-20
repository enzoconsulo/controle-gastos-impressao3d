/* ========================================================
   GESTOR DE CONFIGURAÇÕES E CONTAS DA LOJA
   ======================================================== */

// Preenche os campos de input com as definições salvas no state
function renderConfigSettings() {
  const pctInput = document.getElementById('config-fee-pct');
  const fixedInput = document.getElementById('config-fee-fixed');
  const energyInput = document.getElementById('config-energy-kwh');

  if (pctInput) pctInput.value = state.settings.platformFeePct || 0;
  if (fixedInput) fixedInput.value = state.settings.platformFeeFixed || 0;
  if (energyInput) energyInput.value = state.settings.energyCostKwh || 0;
}

// Guarda as configurações escritas pelo usuário
function saveConfigSettings() {
  const pctInput = document.getElementById('config-fee-pct');
  const fixedInput = document.getElementById('config-fee-fixed');
  const energyInput = document.getElementById('config-energy-kwh');

  if (pctInput) state.settings.platformFeePct = Number(pctInput.value) || 0;
  if (fixedInput) state.settings.platformFeeFixed = Number(fixedInput.value) || 0;
  if (energyInput) state.settings.energyCostKwh = Number(energyInput.value) || 0;

  saveState();
  updateAll();
  alert('Configurações salvas com sucesso!');
}

// Renderiza a lista de Contas / Caixas disponíveis
function renderAccountsConfig() {
  const container = document.getElementById('config-accounts-list');
  if (!container) return;
  
  container.innerHTML = '';

  state.accounts.forEach(acc => {
    const div = document.createElement('div');
    div.className = 'box-card';
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';
    div.style.marginBottom = '8px';
    
    div.innerHTML = `
      <div>
        <strong style="font-size: 1.05rem;">${acc.name}</strong>
        <div style="font-size:0.8rem; color:var(--muted); margin-top: 4px;">Saldo atual: ${money(acc.saldo)}</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn small edit-acc" data-id="${acc.id}">Editar Nome</button>
        <button class="btn small danger del-acc" data-id="${acc.id}" style="color:var(--danger); border-color:rgba(239,68,68,0.2);">Excluir</button>
      </div>
    `;
    container.appendChild(div);
  });

  // Evento: Editar Nome da Conta
  container.querySelectorAll('.edit-acc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const acc = state.accounts.find(a => a.id === id);
      if (!acc) return;
      
      const newName = prompt('Novo nome para a conta/caixa:', acc.name);
      if (newName && newName.trim()) {
        acc.name = newName.trim();
        saveState();
        updateAll();
      }
    });
  });

  // Evento: Excluir Conta
  container.querySelectorAll('.del-acc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const acc = state.accounts.find(a => a.id === id);
      if (!acc) return;
      
      if (state.accounts.length <= 1) {
        return alert('A loja precisa ter pelo menos uma conta registrada.');
      }
      
      if (!confirm(`Tem certeza que deseja excluir a conta "${acc.name}"? Se houver saldo nesta conta, o registro financeiro será perdido.`)) return;
      
      state.accounts = state.accounts.filter(a => a.id !== id);
      saveState();
      updateAll();
    });
  });
}

// Adicionar uma nova conta (ex: Mercado Pago, PayPal, Nuvemshop)
function handleAddAccount() {
  const name = prompt('Nome da nova conta/caixa (Ex: Conta Bancária, PayPal, Dinheiro Físico):');
  if (!name || !name.trim()) return;

  const newAcc = {
    id: 'acc-' + Date.now().toString(36),
    name: name.trim(),
    saldo: 0
  };

  state.accounts.push(newAcc);
  saveState();
  updateAll();
}

// Inicializador de eventos desta aba (será chamado no app.js)
function initConfiguracoes() {
  const btnSave = document.getElementById('btn-save-configs');
  if (btnSave) btnSave.addEventListener('click', saveConfigSettings);

  const btnAddAcc = document.getElementById('btn-add-account');
  if (btnAddAcc) btnAddAcc.addEventListener('click', handleAddAccount);
}