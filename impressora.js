// Variáveis globais para os gráficos (colocadas junto com a função para facilitar)
let impTrendChart = null;
let impCostsChart = null;

/* ========================================================
                       HELPERS:
   ======================================================== */

function getFilamentPricePerGram(f){
  const initial = Number(f.initialWeight || f.weight || 0);
  const price = Number(f.price || 0);
  return initial > 0 ? (price / initial) : 0;
}

function closeAllProductPanels() {
  // Fecha todas as caixas de edição (oculta)
  document.querySelectorAll('.prod-edit-box').forEach(box => box.style.display = 'none');
  // Remove todos os painéis de cálculo de lucro
  document.querySelectorAll('[id^="imp3d-profit-preview-"]').forEach(box => box.remove());
  // Remove todos os painéis de venda rápida
  document.querySelectorAll('[id^="imp3d-sell-form-"]').forEach(box => box.remove());
}

function ensureProductVariants(prod){
  if(!prod) return [];

  if(!Array.isArray(prod.variants) || !prod.variants.length){
    prod.variants = [{
      id: 'default',
      label: 'Padrão',
      price: Number(prod.price || 0)
    }];
  }

  prod.variants = prod.variants.map((v, idx)=>({
    id: v.id || (idx === 0 ? 'default' : `var-${idx}`),
    label: String(v.label || v.name || `Variação ${idx + 1}`).trim() || `Variação ${idx + 1}`,
    price: Number(v.price ?? prod.price ?? 0)
  }));

  if(!prod.variants.some(v => v.id === 'default')){
    prod.variants.unshift({
      id: 'default',
      label: 'Padrão',
      price: Number(prod.price || 0)
    });
  }

  return prod.variants;
}

function getProductVariant(prod, variantId){
  const variants = ensureProductVariants(prod);
  return variants.find(v => v.id === variantId) || variants[0];
}

// RESTAURADO: Função auxiliar mantida por segurança
function getProductVariantPrice(prod, variantId){
  const v = getProductVariant(prod, variantId);
  return Number(v?.price ?? prod?.price ?? 0);
}

// RESTAURADO: Função auxiliar mantida por segurança
function getProductVariantLabel(prod, variantId){
  const v = getProductVariant(prod, variantId);
  return v ? v.label : 'Padrão';
}

function matchVariantToFilament(prod, filamentId){
  const fil = state.filaments.find(f => f.id === filamentId);
  const variants = ensureProductVariants(prod);

  if(!fil || !variants.length) return variants[0]?.id || 'default';

  const needle = String(fil.color || fil.type || '').toLowerCase().trim();

  if(!needle) return variants[0]?.id || 'default';

  const exact = variants.find(v =>
    String(v.label || '').toLowerCase().includes(needle) ||
    String(v.id || '').toLowerCase().includes(needle)
  );

  return exact ? exact.id : (variants[0]?.id || 'default');
}

function fillVariantSelect(selectEl, prod, selectedId){
  if(!selectEl || !prod) return;

  const variants = ensureProductVariants(prod);
  selectEl.innerHTML = '';

  variants.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.label} — ${money(v.price)}`;
    selectEl.appendChild(opt);
  });

  if(selectedId && variants.some(v => v.id === selectedId)){
    selectEl.value = selectedId;
  } else if(variants.some(v => v.id === 'default')){
    selectEl.value = 'default';
  } else if(variants.length){
    selectEl.value = variants[0].id;
  }
}

/* ========================================================
                        FILAMENTOS:
   ======================================================== */

/* Render lista de filamentos */
function renderFilaments(){
  const container = document.getElementById('filaments-list');
  const total = sum(state.filaments, x=>x.weight||0);
  const totalEl = document.getElementById('imp3d-total-fil');
  
  if(totalEl) totalEl.textContent = `${total.toFixed(2)} g`;
  if(!container) return;
  
  container.innerHTML = '';
  if(!state.filaments.length){
    const p = document.createElement('p'); 
    p.className='muted'; 
    p.textContent = 'Nenhum filamento no estoque.';
    container.appendChild(p);
    if(document.getElementById('imp3d-total-fil')) document.getElementById('imp3d-total-fil').textContent = '0 g';
    return;
  }
  
  state.filaments.forEach(f=>{
    const el = document.createElement('div');
    el.className = 'box-card';
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';
    el.innerHTML = `
      <div>
        <div style="font-weight:700">${f.color} — ${f.type}</div>
        <div style="font-size:0.85rem;color:var(--muted);">ID: ${f.id}</div>
        <div style="font-size:0.85rem;color:var(--muted); margin-top:6px">Preço: ${money(Number(f.price||0))}</div>
        <div style="font-size:0.85rem;color:var(--muted); margin-top:2px">Rolo inicial: ${Number(f.initialWeight||0).toFixed(2)} g</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">${(Number(f.weight)||0).toFixed(2)} g</div>
        <div style="margin-top:6px">
          <button class="btn small fil-edit" data-id="${f.id}">Editar</button>
          <button class="btn small fil-withdraw" data-id="${f.id}">Retirar</button>
          <button class="btn small fil-del" data-id="${f.id}">Remover</button>
        </div>
      </div>
    `;
    container.appendChild(el);
  });

  // events
  container.querySelectorAll('.fil-del').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      if(!confirm('Remover filamento do estoque? Esta ação não pode ser desfeita.')) return;
      state.filaments = state.filaments.filter(x=>x.id !== id);
      saveState(); 
      updateAll();
    });
  });

  container.querySelectorAll('.fil-edit').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      const f = state.filaments.find(x=>x.id===id);
      if(!f) return;
      
      const newColor = prompt('Cor:', f.color);
      if(newColor === null) return;
      const newType = prompt('Tipo:', f.type);
      if(newType === null) return;
      const newWeight = prompt('Peso atual (g):', f.weight);
      if(newWeight === null) return;
      const newInitial = prompt('Peso inicial do rolo (g):', f.initialWeight || f.weight || 0);
      if(newInitial === null) return;
      const newPrice = prompt('Preço (R$):', f.price || '0');
      if(newPrice === null) return;
      
      f.color = newColor.trim();
      f.type = newType.trim();
      f.weight = Number(newWeight || 0);
      f.initialWeight = Number(newInitial || f.weight || 0);
      f.price = Number(newPrice || 0);
      saveState(); 
      updateAll();
    });
  });

  container.querySelectorAll('.fil-withdraw').forEach(b => {
    b.addEventListener('click', e => {
      const id = e.target.dataset.id;
      openWithdrawFormForFilament(id, e.target);
    });
  });
}

/* Add filamento */
function handleAddFilament(){
  const color = document.getElementById('fil-color').value.trim();
  const type = document.getElementById('fil-type').value.trim();
  const weight = Number(document.getElementById('fil-weight').value || 0);
  const price = Number(document.getElementById('fil-price').value || 0);
  
  if(!color || !type || !weight || weight <= 0){ 
    alert('Preencha cor, tipo e peso (g) válidos.'); 
    return; 
  }
  
  const f = { 
    id: Date.now().toString(), 
    color, 
    type, 
    weight: Number(weight), 
    initialWeight: Number(weight), 
    price: Number(price||0) 
  };
  
  state.filaments.push(f);
  saveState();
  
  document.getElementById('fil-color').value='';
  document.getElementById('fil-type').value='';
  document.getElementById('fil-weight').value='';
  document.getElementById('fil-price').value='';
  updateAll();
}

/* abre formulário de retirada/perda de filamento inline */
function openWithdrawFormForFilament(filamentId, anchorBtn) {
  const existing = document.getElementById('imp3d-withdraw-form-' + filamentId);
  if (existing) { existing.remove(); return; }

  const f = state.filaments.find(x => x.id === filamentId);
  if (!f) return;

  const form = document.createElement('div');
  form.id = 'imp3d-withdraw-form-' + filamentId;
  form.style.marginTop = '8px';
  form.style.padding = '12px';
  form.style.background = 'rgba(0,0,0,0.06)';
  form.style.borderRadius = '8px';
  form.style.border = '1px solid rgba(255,255,255,0.03)';

  // Gera as opções de contas dinamicamente para o select
  let accountsOptions = state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  let defaultAcc = state.accounts[0]?.id || '';

  form.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
        <div style="flex:1; min-width:160px;">
          <label style="font-size:0.85rem;color:var(--muted)">Motivo / Tipo</label>
          <select id="withdraw-mode-${filamentId}" style="width:100%;padding:8px;border-radius:8px;background:#020617;border:1px solid rgba(255,255,255,0.03)">
            <option value="1">Perda / Prejuízo / Falha</option>
            <option value="2">Venda Externa (Fora da Plataforma Padrão)</option>
          </select>
        </div>
        <div style="width:120px;">
          <label style="font-size:0.85rem;color:var(--muted)">Gramas (g)</label>
          <input id="withdraw-grams-${filamentId}" type="number" step="0.1" placeholder="Ex: 50" style="width:100%;padding:8px;border-radius:8px;background:#020617;border:1px solid rgba(255,255,255,0.03)"/>
        </div>
      </div>

      <div id="withdraw-loss-fields-${filamentId}" style="display:flex; gap:8px; flex-wrap:wrap;">
        <div style="flex:1;">
          <label style="font-size:0.85rem;color:var(--muted)">Detalhe da perda (Opcional)</label>
          <input id="withdraw-reason-${filamentId}" type="text" placeholder="Ex: Falha na base, suporte quebrado..." style="width:100%;padding:8px;border-radius:8px;background:#020617;border:1px solid rgba(255,255,255,0.03)"/>
        </div>
      </div>

      <div id="withdraw-sale-fields-${filamentId}" style="display:none; gap:8px; flex-wrap:wrap;">
        <div style="flex:1; min-width:120px;">
          <label style="font-size:0.85rem;color:var(--muted)">Valor pago (R$)</label>
          <input id="withdraw-gross-${filamentId}" type="number" step="0.01" placeholder="Ex: 45.00" style="width:100%;padding:8px;border-radius:8px;background:#020617;border:1px solid rgba(255,255,255,0.03)"/>
        </div>
        <div style="flex:1; min-width:120px;">
          <label style="font-size:0.85rem;color:var(--muted)">Frete (R$) - Opcional</label>
          <input id="withdraw-freight-${filamentId}" type="number" step="0.01" placeholder="Ex: 15.00" style="width:100%;padding:8px;border-radius:8px;background:#020617;border:1px solid rgba(255,255,255,0.03)"/>
        </div>
        <div style="flex:1; min-width:150px;">
          <label style="font-size:0.85rem;color:var(--muted)">Conta Destino</label>
          <select id="withdraw-acc-${filamentId}" style="width:100%;padding:8px;border-radius:8px;background:#020617;border:1px solid rgba(255,255,255,0.03)">
            ${accountsOptions}
          </select>
        </div>
      </div>

      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:4px;">
        <button id="withdraw-confirm-${filamentId}" class="btn-primary">Confirmar retirada</button>
        <button id="withdraw-cancel-${filamentId}" class="btn ghost">Cancelar</button>
      </div>
    </div>
  `;

  // Insere o formulário logo abaixo do card do filamento
  const card = anchorBtn.closest('.box-card');
  card.parentNode.insertBefore(form, card.nextSibling);

  const modeSel = document.getElementById(`withdraw-mode-${filamentId}`);
  const lossFields = document.getElementById(`withdraw-loss-fields-${filamentId}`);
  const saleFields = document.getElementById(`withdraw-sale-fields-${filamentId}`);
  const accSel = document.getElementById(`withdraw-acc-${filamentId}`);
  
  if (accSel) accSel.value = defaultAcc;

  modeSel.addEventListener('change', (e) => {
    if (e.target.value === '1') {
      lossFields.style.display = 'flex';
      saleFields.style.display = 'none';
    } else {
      lossFields.style.display = 'none';
      saleFields.style.display = 'flex';
    }
  });

  // Lógica do botão Cancelar
  document.getElementById(`withdraw-cancel-${filamentId}`).addEventListener('click', () => {
    form.remove();
  });

  // Lógica do botão Confirmar
  document.getElementById(`withdraw-confirm-${filamentId}`).addEventListener('click', () => {
    const mode = modeSel.value;
    const grams = Number(document.getElementById(`withdraw-grams-${filamentId}`).value || 0);

    if (!grams || grams <= 0) {
      alert('Preencha uma quantidade válida de gramas.');
      return;
    }

    const unitCost = getFilamentPricePerGram(f);
    const autoCost = grams * unitCost;

    if (Number(f.weight || 0) < grams) {
      if (!confirm(`Este rolo tem apenas ${Number(f.weight || 0).toFixed(2)} g. Deseja registrar mesmo assim (ficará negativo)?`)) return;
    }

    if (mode === '1') {
      // 1) LÓGICA DE PERDA
      const reason = document.getElementById(`withdraw-reason-${filamentId}`).value.trim() || 'Perda / falha de impressão';
      
      f.weight = Number(f.weight || 0) - grams;
      state.impLosses.push({
        id: 'loss-' + Date.now().toString(),
        date: todayISO(),
        filamentId: filamentId,
        grams: Number(grams),
        unitCost: Number(unitCost),
        cost: Number(autoCost),
        reason: reason,
        mode: 'perda'
      });

      saveState();
      updateAll();
      alert(`Perda registrada com sucesso.\n${grams} g retirados.\nCusto: ${money(autoCost)}`);

    } else if (mode === '2') {
      // 2) LÓGICA DE VENDA EXTERNA
      const gross = Number(document.getElementById(`withdraw-gross-${filamentId}`).value || 0);
      const freightCost = Number(document.getElementById(`withdraw-freight-${filamentId}`).value || 0);
      const accId = accSel.value;

      if (!gross || gross <= 0) {
        alert('Para venda externa, o valor pago deve ser maior que zero.');
        return;
      }

      f.weight = Number(f.weight || 0) - grams;

      // ADAPTAÇÃO GENÉRICA: Adiciona o valor direto no saldo da conta do usuário.
      const acc = state.accounts.find(a => a.id === accId);
      if(acc) {
        acc.saldo = Number(acc.saldo || 0) + Number(gross - freightCost);
      }

      // Registra a venda no painel da Impressora3D
      state.impSales.push({
        id: 'imp3d-ext-' + Date.now().toString(),
        date: todayISO(),
        productId: 'Venda externa',
        filamentId: filamentId,
        accountId: accId,
        qty: Number(grams),
        amountGross: Number(gross),
        feeTotal: 0,
        netReceived: Number(gross - freightCost),
        materialCost: Number(autoCost),
        hourlyCost: 0,
        packagingCost: 0,
        mandatoryReinvest: Number(autoCost + freightCost),
        profit: Number(gross - freightCost - autoCost),
        channel: 'externa'
      });

      saveState();
      updateAll();
      alert(`Venda externa registrada!\nLíquido: ${money(gross - freightCost)}\nLucro: ${money(gross - freightCost - autoCost)}`);
    }
  });
}

/* ========================================================
                       CAIXAS/CATEGORIAS: 
   ======================================================== */

function updateCategoryDatalist() {
  const dl = document.getElementById('box-options');
  if(!dl) return;
  
  const cats = new Set();
  state.products.forEach(p => {
    const c = (p.category || '').trim();
    if(c && c.toLowerCase() !== 'geral') cats.add(c);
  });
  
  dl.innerHTML = '';
  Array.from(cats).sort().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    dl.appendChild(opt);
  });
}

// Alimenta o Select na página de Produtos
function populateProductBoxSelects() {
  const selectMain = document.getElementById('prod-box');
  if(selectMain) {
    const current = selectMain.value;
    selectMain.innerHTML = '';
    state.productBoxes.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.emoji} ${b.name}`;
      selectMain.appendChild(opt);
    });
    if(current && state.productBoxes.some(b => b.id === current)) selectMain.value = current;
  }
}

// Renderiza a lista na página de Caixas
function renderProductBoxes() {
  const container = document.getElementById('box-list');
  const countEl = document.getElementById('imp3d-count-boxes');
  if(!container) return;

  container.innerHTML = '';
  if(countEl) countEl.textContent = state.productBoxes.length;

  state.productBoxes.forEach(box => {
    // Conta quantos produtos estão nesta caixa
    const count = state.products.filter(p => p.boxId === box.id).length;

    const card = document.createElement('div');
    card.className = 'box-card';
    card.style.background = 'rgba(15, 23, 42, 0.4)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    card.style.transition = 'all 0.3s ease';
    
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.15)); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 14px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; box-shadow: inset 0 2px 4px rgba(255,255,255,0.05);">
            ${box.emoji}
          </div>
          <div>
            <div style="font-weight:700; font-size: 1.1rem; color:#f8fafc; letter-spacing:-0.02em;">${box.name}</div>
            <div style="font-size:0.8rem; color:#94a3b8; display:flex; align-items:center; gap:4px; margin-top:2px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
              ${count} Itens Vinculados
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn small box-edit" data-id="${box.id}" style="background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.1); color:#fff; padding:8px 12px; border-radius:10px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          ${box.id !== 'box-default' ? `
          <button class="btn small danger box-del" data-id="${box.id}" style="padding:8px 12px; border-radius:10px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>` : ''}
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  // Excluir Caixa
  container.querySelectorAll('.box-del').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.id;
      const count = state.products.filter(p => p.boxId === id).length;
      if(count > 0) {
        if(!confirm(`Esta caixa possui ${count} produto(s). Se excluir, eles serão movidos para a caixa "Geral". Confirmar?`)) return;
        state.products.forEach(p => { if(p.boxId === id) p.boxId = 'box-default'; });
      } else {
        if(!confirm('Excluir esta caixa?')) return;
      }
      state.productBoxes = state.productBoxes.filter(b => b.id !== id);
      saveState();
      updateAll();
    });
  });

  // Editar Caixa
  container.querySelectorAll('.box-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.id;
      const box = state.productBoxes.find(b => b.id === id);
      if(!box) return;
      
      const newEmoji = prompt('Novo Emoji (deixe em branco para manter):', box.emoji);
      if(newEmoji === null) return;
      const newName = prompt('Novo Nome (deixe em branco para manter):', box.name);
      if(newName === null) return;

      if(newEmoji.trim()) box.emoji = newEmoji.trim();
      if(newName.trim()) box.name = newName.trim();
      
      saveState();
      updateAll();
    });
  });
}

/* ========================================================
                       PRODUTOS: 
   ======================================================== */

function handleAddProduct(){
  const boxId = document.getElementById('prod-box')?.value || 'box-default';
  const name = document.getElementById('prod-name').value.trim();
  const hours = Number(document.getElementById('prod-hours').value || 0);
  const fil_g = Number(document.getElementById('prod-fil-g').value || 0);
  const energy_h = Number(document.getElementById('prod-energy-h').value || 0);
  const pack = Number(document.getElementById('prod-pack').value || 0);
  const price = Number(document.getElementById('prod-price').value || 0);
  const desc = document.getElementById('prod-desc').value.trim();

  if(!name || fil_g <= 0 || price <= 0){
    alert('Nome, filamento por unidade (g) e preço são obrigatórios e devem ser válidos.');
    return;
  }

  const p = {
    id: Date.now().toString(),
    boxId: boxId,
    name,
    hours: Number(hours),
    fil_g: Number(fil_g),
    energy_h: Number(energy_h),
    pack: Number(pack),
    price: Number(price),
    desc,
    variants: [{ id: 'default', label: 'Padrão', price: Number(price) }]
  };

  state.products.push(p);
  saveState();

  // Limpa campos, mas mantém a caixa pré-selecionada para facilitar o fluxo
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-hours').value = '';
  document.getElementById('prod-fil-g').value = '';
  document.getElementById('prod-energy-h').value = '';
  document.getElementById('prod-pack').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-desc').value = '';

  updateAll();
  
  const searchInput = document.getElementById('prod-search');
  if(searchInput) searchInput.value = '';
  renderProducts();
}

function renderProducts(){
  // Atualiza as opções dinâmicas do menu de caixas sempre que renderizar
  updateCategoryDatalist();

  const container = document.getElementById('prod-list');
  const countEl = document.getElementById('imp3d-count-prod');
  if(!container) return;
  
  container.innerHTML='';

  // 1. Pesquisa
  const searchInput = document.getElementById('prod-search');
  const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();

  let filtered = state.products;
  if (searchTerm) {
    filtered = state.products.filter(p => {
      const matchName = p.name.toLowerCase().includes(searchTerm);
      const box = state.productBoxes.find(b => b.id === p.boxId) || { name: 'Geral' };
      const matchBox = box.name.toLowerCase().includes(searchTerm);
      return matchName || matchBox;
    });
  }

  if(countEl) countEl.textContent = String(filtered.length);

  if(!filtered.length){
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; background:rgba(0,0,0,0.2); border-radius:16px; border:1px dashed rgba(255,255,255,0.1);">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <p style="color:#94a3b8; font-size:0.9rem;">${searchTerm ? 'Nenhum item bate com a sua pesquisa.' : 'Seu catálogo de engenharia está vazio.'}</p>
      </div>`;
    return;
  }

  // 2. Agrupa pelas Caixas baseando-se no state.productBoxes
  const grouped = {};
  state.productBoxes.forEach(b => grouped[b.id] = { box: b, products: [] });
  if(!grouped['box-default']) grouped['box-default'] = { box: {id: 'box-default', name: 'Geral', emoji: '📦'}, products: [] };

  filtered.forEach(prod => {
    const bId = prod.boxId || 'box-default';
    if(!grouped[bId]) grouped[bId] = { box: {id: bId, name: 'Desconhecida', emoji: '❓'}, products: [] };
    grouped[bId].products.push(prod);
  });

  // 3. Renderiza Caixas Retráteis
  Object.values(grouped).filter(g => g.products.length > 0).forEach(group => {
    const catWrapper = document.createElement('div');
    catWrapper.style.marginBottom = '24px';
    catWrapper.style.background = 'rgba(15, 23, 42, 0.4)';
    catWrapper.style.border = '1px solid rgba(255,255,255,0.06)';
    catWrapper.style.borderRadius = '24px';
    catWrapper.style.padding = '16px';
    catWrapper.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
    
    // Cabeçalho Clicável
    catWrapper.innerHTML = `
      <div class="box-header-toggle" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; margin-bottom: 16px; padding: 4px;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.1)); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">${group.box.emoji}</div>
          <div>
            <h4 style="font-weight: 800; font-size: 1.1rem; color: #fff; line-height: 1.2; letter-spacing:-0.02em;">${group.box.name}</h4>
            <span style="font-size: 0.75rem; color: #94a3b8; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;">${group.products.length} Produto(s)</span>
          </div>
        </div>
        <div class="toggle-icon" style="display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.05); color:#94a3b8; transition:0.3s;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      <div class="cat-list" style="display:flex; flex-direction:column; gap:14px;"></div>
    `;

    const headerToggle = catWrapper.querySelector('.box-header-toggle');
    const catList = catWrapper.querySelector('.cat-list');
    const toggleIcon = catWrapper.querySelector('.toggle-icon');

    headerToggle.addEventListener('click', () => {
      if(catList.style.display === 'none'){
        catList.style.display = 'flex';
        toggleIcon.style.transform = 'rotate(0deg)';
        toggleIcon.style.background = 'rgba(255,255,255,0.05)';
      } else {
        catList.style.display = 'none';
        toggleIcon.style.transform = 'rotate(-90deg)';
        toggleIcon.style.background = 'transparent';
      }
    });

    group.products.forEach(prod => {
      ensureProductVariants(prod);
      const variantSummary = prod.variants.map(v => `${v.label}: ${money(v.price)}`).join(' • ');

      const boxOptionsHtml = state.productBoxes.map(b => 
        `<option value="${b.id}" ${b.id === prod.boxId ? 'selected' : ''}>${b.emoji} ${b.name}</option>`
      ).join('');

      const card = document.createElement('div');
      card.className = 'box-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '0';
      card.style.background = 'rgba(2, 6, 23, 0.7)';
      card.style.border = '1px solid rgba(255,255,255,0.08)';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div style="min-width:0;">
            <div style="font-weight:800; font-size:1.15rem; color:#f8fafc; letter-spacing:-0.02em;">${prod.name}</div>
            <div style="font-weight:900; font-size:1.25rem; color:#10b981; margin-top:4px; display:flex; align-items:center; gap:6px;">
              ${money(prod.price)} 
              <span style="font-size:0.65rem; color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:2px 6px; border-radius:6px; background:rgba(16,185,129,0.1); text-transform:uppercase; letter-spacing:0.5px;">Base</span>
            </div>
          </div>

          <div class="prod-action-menu" style="position:relative; flex:none;">
            <button class="action-menu-toggle" data-id="${prod.id}" style="width:36px; height:36px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:#cbd5e1; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:0.2s;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
            </button>
            
            <div id="menu-${prod.id}" class="action-dropdown" style="display:none; position:absolute; right:0; top:calc(100% + 8px); background:rgba(15, 23, 42, 0.95); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:8px; z-index:100; min-width:200px; box-shadow:0 20px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05); flex-direction:column; gap:4px;">
              <button class="prod-edit-toggle" data-id="${prod.id}" style="width:100%; text-align:left; background:transparent; border:none; color:#f8fafc; font-size:0.85rem; font-weight:500; padding:10px 12px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Editar Setup
              </button>
              <button class="prod-preview" data-id="${prod.id}" style="width:100%; text-align:left; background:transparent; border:none; color:#f8fafc; font-size:0.85rem; font-weight:500; padding:10px 12px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> Simulador de Lucro
              </button>
              <button class="prod-sell" data-id="${prod.id}" style="width:100%; text-align:left; background:transparent; border:none; color:#f8fafc; font-size:0.85rem; font-weight:500; padding:10px 12px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> Lançar Venda Rápida
              </button>
              <button class="prod-stock" data-id="${prod.id}" style="width:100%; text-align:left; background:transparent; border:none; color:#f8fafc; font-size:0.85rem; font-weight:500; padding:10px 12px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> Enviar ao Estoque
              </button>
              <div style="height:1px; background:rgba(255,255,255,0.1); margin: 6px 0;"></div>
              <button class="prod-del" data-id="${prod.id}" style="width:100%; text-align:left; background:transparent; border:none; color:#ef4444; font-size:0.85rem; font-weight:600; padding:10px 12px; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='transparent'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Excluir Produto
              </button>
            </div>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:16px;">
          <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding:6px 10px; border-radius:10px; font-size:0.75rem; color:#cbd5e1; font-weight:500;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${Number(prod.hours || 0).toFixed(2)}h
          </span>
          <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding:6px 10px; border-radius:10px; font-size:0.75rem; color:#cbd5e1; font-weight:500;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
            ${Number(prod.fil_g || 0).toFixed(2)}g
          </span>
          <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding:6px 10px; border-radius:10px; font-size:0.75rem; color:#cbd5e1; font-weight:500;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            ${money(prod.energy_h || 0)}/h
          </span>
          <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); padding:6px 10px; border-radius:10px; font-size:0.75rem; color:#cbd5e1; font-weight:500;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>
            ${money(prod.pack || 0)} Pack
          </span>
        </div>

        ${prod.desc ? `<div style="font-size:0.8rem; color:#94a3b8; margin-top:14px; line-height:1.5; background:rgba(0,0,0,0.3); padding:10px 12px; border-radius:10px; border-left:3px solid #3b82f6;">${prod.desc}</div>` : ''}
        
        <div style="font-size:0.75rem; color:#64748b; margin-top:14px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Variações Dinâmicas</div>
        <div style="font-size:0.85rem; color:#e2e8f0; margin-top:4px; font-weight:500;">${variantSummary}</div>

        <div class="prod-edit-box" id="edit-${prod.id}" style="display:none; margin-top:20px; padding-top:20px; border-top: 1px dashed rgba(255,255,255,0.1);">
          <div class="form-grid">
            
            <div class="form-field" style="grid-column:1/-1">
              <label>Mover para Caixa</label>
              <select class="edit-box" data-id="${prod.id}">
                ${boxOptionsHtml}
              </select>
            </div>
            
            <div class="form-field">
              <label>Nome do Produto</label>
              <input class="edit-name" data-id="${prod.id}" value="${prod.name}">
            </div>

            <div class="form-field">
              <label>Horas</label>
              <input type="number" step="0.1" class="edit-hours" data-id="${prod.id}" value="${prod.hours}">
            </div>

            <div class="form-field">
              <label>Filamento (g)</label>
              <input type="number" step="0.01" class="edit-fil" data-id="${prod.id}" value="${prod.fil_g}">
            </div>

            <div class="form-field">
              <label>Energia (R$/h)</label>
              <input type="number" step="0.01" class="edit-energy" data-id="${prod.id}" value="${prod.energy_h}">
            </div>

            <div class="form-field">
              <label>Embalagem</label>
              <input type="number" step="0.01" class="edit-pack" data-id="${prod.id}" value="${prod.pack}">
            </div>

            <div class="form-field">
              <label>Preço base</label>
              <input type="number" step="0.01" class="edit-price" data-id="${prod.id}" value="${prod.price}">
            </div>

            <div class="form-field" style="grid-column:1/-1">
              <label>Descrição</label>
              <input class="edit-desc" data-id="${prod.id}" value="${prod.desc || ''}">
            </div>

            <div class="prod-variants-panel" style="grid-column:1/-1; padding:20px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.3); margin-top: 8px;">
              <div style="font-weight:700; margin-bottom:16px; font-size:1rem; color:#fff; display:flex; align-items:center; gap:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Tabela de Variações
              </div>
              <div class="variant-list" id="variant-list-${prod.id}" style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
                ${prod.variants.map(v => `
                  <div class="variant-row" data-variant-id="${v.id}" style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; padding:12px 16px; border-radius:16px; background:rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.05);">
                    <div class="form-field" style="margin:0; flex:1; min-width:140px;">
                      <label style="font-size:0.75rem;">Nome (Ex: Pintado a Mão)</label>
                      <input class="variant-label" data-product="${prod.id}" data-variant="${v.id}" type="text" value="${v.label}"/>
                    </div>
                    <div class="form-field" style="margin:0; flex:1; min-width:100px;">
                      <label style="font-size:0.75rem;">Preço Ajustado (R$)</label>
                      <input class="variant-price" data-product="${prod.id}" data-variant="${v.id}" type="number" step="0.01" value="${v.price}"/>
                    </div>
                    <div style="display:flex; flex:none;">
                      ${v.id === 'default' ? '<div style="display:flex; align-items:center; justify-content:center; height: 50px; padding: 0 16px; border-radius: 12px; background: rgba(255,255,255,0.05); color:#64748b; font-size:0.8rem; font-weight:600;">Padrão Base</div>' : `<button class="btn small danger prod-variant-del" data-product="${prod.id}" data-variant="${v.id}" type="button" style="height: 50px; border-radius: 12px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`}
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="padding: 20px; border-radius: 16px; border: 1px dashed rgba(255,255,255,0.15); background: rgba(15,23,42,0.4);">
                <div style="font-weight:600; font-size:0.85rem; color: #cbd5e1; margin-bottom: 12px; display:flex; align-items:center; gap:6px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Inserir Nova Variação
                </div>
                <div style="display:flex; flex-wrap:wrap; gap: 12px; align-items: flex-end;">
                  <div class="form-field" style="margin:0; flex:1; min-width:140px;">
                    <label>Nome (Ex: Kit 2 Unid.)</label>
                    <input type="text" class="variant-new-label" data-id="${prod.id}" placeholder="Defina o nome">
                  </div>
                  <div class="form-field" style="margin:0; flex:1; min-width:100px;">
                    <label>Preço (R$)</label>
                    <input type="number" step="0.01" class="variant-new-price" data-id="${prod.id}" placeholder="0.00">
                  </div>
                  <div class="form-actions" style="margin:0; flex:none;">
                    <button class="btn-primary small prod-variant-add" data-id="${prod.id}" type="button" style="height: 50px; border-radius: 12px; padding: 0 24px;">Adicionar</button>
                  </div>
                </div>
              </div>
            </div>

            <div style="grid-column:1/-1; display:flex; gap:12px; flex-wrap:wrap; margin-top: 16px;">
              <button class="btn-primary prod-save" data-id="${prod.id}" style="border-radius:12px;">Salvar Alterações do Produto</button>
              <button class="btn ghost prod-cancel" data-id="${prod.id}" style="border-radius:12px;">Descartar e Fechar</button>
            </div>
          </div>
        </div>
      `;

      catList.appendChild(card);
    });

    container.appendChild(catWrapper);
  });

  // LÓGICA DO MENU DROPDOWN DE AÇÕES
  container.querySelectorAll('.action-menu-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const menu = document.getElementById(`menu-${id}`);
      const isCurrentlyVisible = menu.style.display === 'flex';

      // Esconde todos os menus antes de abrir um novo
      document.querySelectorAll('.action-dropdown').forEach(m => m.style.display = 'none');

      if(!isCurrentlyVisible) {
        menu.style.display = 'flex';
      }
    });
  });

  // Se clicar em qualquer opção do menu, ele fecha sozinho
  container.querySelectorAll('.action-dropdown button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.action-dropdown').forEach(m => m.style.display = 'none');
    });
  });

  // Eventos das ações
  container.querySelectorAll('.prod-del').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      if(!confirm('Excluir produto?')) return;
      state.products = state.products.filter(p=>p.id !== id);
      saveState();
      updateAll();
    });
  });

  container.querySelectorAll('.prod-edit-toggle').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      const box = document.getElementById(`edit-${id}`);
      const isCurrentlyOpen = box && box.style.display === 'block';
      if(typeof closeAllProductPanels === 'function') closeAllProductPanels();
      if(box && !isCurrentlyOpen) box.style.display = 'block'; 
    });
  });

  container.querySelectorAll('.prod-cancel').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      const box = document.getElementById(`edit-${id}`);
      if(box) box.style.display = 'none';
    });
  });

  container.querySelectorAll('.prod-save').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      const prod = state.products.find(p=>p.id === id);
      if(!prod) return;

      const boxIdEl = document.querySelector(`.edit-box[data-id="${id}"]`);
      const nameEl = document.querySelector(`.edit-name[data-id="${id}"]`);
      const hoursEl = document.querySelector(`.edit-hours[data-id="${id}"]`);
      const filEl = document.querySelector(`.edit-fil[data-id="${id}"]`);
      const energyEl = document.querySelector(`.edit-energy[data-id="${id}"]`);
      const packEl = document.querySelector(`.edit-pack[data-id="${id}"]`);
      const priceEl = document.querySelector(`.edit-price[data-id="${id}"]`);
      const descEl = document.querySelector(`.edit-desc[data-id="${id}"]`);

      const boxId = boxIdEl?.value || 'box-default';
      const name = (nameEl?.value || '').trim();
      const hours = Number(hoursEl?.value || 0);
      const fil_g = Number(filEl?.value || 0);
      const energy_h = Number(energyEl?.value || 0);
      const pack = Number(packEl?.value || 0);
      const price = Number(priceEl?.value || 0);
      const desc = (descEl?.value || '').trim();

      if(!name || fil_g <= 0 || price <= 0){
        alert('Nome, filamento por unidade (g) e preço precisam ser maiores que zero.');
        return;
      }

      prod.boxId = boxId;
      prod.name = name;
      prod.hours = hours;
      prod.fil_g = fil_g;
      prod.energy_h = energy_h;
      prod.pack = pack;
      prod.price = price;
      prod.desc = desc;

      ensureProductVariants(prod);
      const base = prod.variants.find(v => v.id === 'default');
      if(base) base.price = price;
      if(base && (!base.label || base.label.trim() === '')) base.label = 'Padrão';

      const variantRows = document.querySelectorAll(`#edit-${id} .variant-row`);
      const variants = [];
      variantRows.forEach(row=>{
        const vid = row.dataset.variantId;
        const labelEl = row.querySelector('.variant-label');
        const priceElRow = row.querySelector('.variant-price');
        const label = (labelEl?.value || '').trim();
        const vPrice = Number(priceElRow?.value || 0);
        if(!label || vPrice <= 0) return;
        variants.push({ id: vid || `var-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, label, price: vPrice });
      });

      if(!variants.some(v => v.id === 'default')){
        variants.unshift({ id: 'default', label: base?.label || 'Padrão', price: Number(base?.price ?? price) });
      } else {
        const def = variants.find(v => v.id === 'default');
        if(def && !def.label) def.label = base?.label || 'Padrão';
      }

      prod.variants = variants;
      saveState();
      updateAll();
    });
  });

  container.querySelectorAll('.prod-variant-add').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      const prod = state.products.find(p=>p.id === id);
      if(!prod) return;
      ensureProductVariants(prod);

      const labelEl = document.querySelector(`.variant-new-label[data-id="${id}"]`);
      const priceEl = document.querySelector(`.variant-new-price[data-id="${id}"]`);
      const label = (labelEl?.value || '').trim();
      const price = Number(priceEl?.value || 0);

      if(!label || price <= 0) return alert('Dados da variação inválidos.');

      prod.variants.push({ id: `var-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, label, price });
      saveState();
      updateAll();
    });
  });

  container.querySelectorAll('.prod-variant-del').forEach(b=>{
    b.addEventListener('click', e=>{
      const productId = e.target.dataset.product;
      const variantId = e.target.dataset.variant;
      const prod = state.products.find(p=>p.id === productId);
      if(!prod) return;

      ensureProductVariants(prod);
      if(variantId === 'default') return alert('A variação padrão não pode ser removida.');

      prod.variants = prod.variants.filter(v => v.id !== variantId);
      saveState();
      updateAll();
    });
  });

  container.querySelectorAll('.prod-preview').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      if(typeof openProfitCalcPreviewForProduct === 'function') openProfitCalcPreviewForProduct(id, e.target);
    });
  });

  container.querySelectorAll('.prod-sell').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      if(typeof openSellFormForProduct === 'function') openSellFormForProduct(id, e.target);
    });
  });

  container.querySelectorAll('.prod-stock').forEach(b=>{
    b.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      if(typeof activateTab === 'function') activateTab('estoque');
      const stockProdSel = document.getElementById('stock-prod');
      if (stockProdSel) {
        stockProdSel.value = id;
        populateImp3dStockSelects(); 
      }
    });
  });

  if(countEl) countEl.textContent = String(filtered.length);
}

// RESTAURADO: Função legada de edição mantida por segurança
function editProduct(productId){
  const prod = state.products.find(p => p.id === productId);
  if(!prod){
    alert('Produto não encontrado.');
    return;
  }

  const newName = prompt('Nome do produto:', prod.name);
  if(newName === null) return;

  const newHours = prompt('Horas de impressão:', String(prod.hours ?? 0));
  if(newHours === null) return;

  const newFilG = prompt('Filamento por unidade (g):', String(prod.fil_g ?? 0));
  if(newFilG === null) return;

  const newEnergy = prompt('Custo energia (R$/h):', String(prod.energy_h ?? 0));
  if(newEnergy === null) return;

  const newPack = prompt('Custo embalagem (R$):', String(prod.pack ?? 0));
  if(newPack === null) return;

  const newPrice = prompt('Preço de venda (R$):', String(prod.price ?? 0));
  if(newPrice === null) return;

  const newDesc = prompt('Descrição (opcional):', prod.desc || '');
  if(newDesc === null) return;

  const name = newName.trim();
  const hours = Number(newHours || 0);
  const fil_g = Number(newFilG || 0);
  const energy_h = Number(newEnergy || 0);
  const pack = Number(newPack || 0);
  const price = Number(newPrice || 0);
  const desc = newDesc.trim();

  if(!name){
    alert('Nome inválido.');
    return;
  }
  if(fil_g <= 0 || price <= 0){
    alert('Filamento por unidade e preço de venda precisam ser maiores que zero.');
    return;
  }

  prod.name = name;
  prod.hours = hours;
  prod.fil_g = fil_g;
  prod.energy_h = energy_h;
  prod.pack = pack;
  prod.price = price;
  prod.desc = desc;

  saveState();
  updateAll();
}

/* ========================================================
                       ESTOQUE E VENDAS: 
   ======================================================== */

function populateImp3dStockSelects(){
  const stockProd = document.getElementById('stock-prod');
  const stockVariant = document.getElementById('stock-variant');
  const stockFil = document.getElementById('stock-fil');

  if(stockProd){
    const current = stockProd.value;
    stockProd.innerHTML = '';
    if(!state.products.length){
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Nenhum produto';
      stockProd.appendChild(o);
    } else {
      state.products.forEach(prod=>{
        const o = document.createElement('option');
        o.value = prod.id;
        o.textContent = `${prod.name} — ${money(prod.price)}`;
        stockProd.appendChild(o);
      });
      if(current) stockProd.value = current;
    }
  }

  if(stockVariant){
    const prod = state.products.find(p => p.id === (stockProd?.value || ''));
    const currentVariant = stockVariant.value;
    stockVariant.innerHTML = '';

    if(!prod){
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Selecione um produto';
      stockVariant.appendChild(o);
    } else {
      ensureProductVariants(prod);

      prod.variants.forEach(v=>{
        const o = document.createElement('option');
        o.value = v.id;
        o.textContent = `${v.label} — ${money(v.price)}`;
        stockVariant.appendChild(o);
      });

      if(currentVariant && prod.variants.some(v => v.id === currentVariant)){
        stockVariant.value = currentVariant;
      } else {
        stockVariant.value = prod.variants[0]?.id || 'default';
      }
    }
  }

  if(stockFil){
    const current = stockFil.value;
    stockFil.innerHTML = '';
    if(!state.filaments.length){
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Nenhum filamento';
      stockFil.appendChild(o);
    } else {
      state.filaments.forEach(f=>{
        const o = document.createElement('option');
        o.value = f.id;
        o.textContent = `${f.color} — ${f.type} (${Number(f.weight || 0).toFixed(2)} g)`;
        stockFil.appendChild(o);
      });
      if(current) stockFil.value = current;
    }
  }

  const sellStockItem = document.getElementById('sell-stock-item');
  if(sellStockItem){
    const current = sellStockItem.value;
    sellStockItem.innerHTML = '';
    const items = state.impStock || [];

    if(!items.length){
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'Nenhum item em estoque';
      sellStockItem.appendChild(o);
    } else {
      items.forEach(stock=>{
        const prod = state.products.find(p=>p.id===stock.productId) || { name: stock.productId };
        const o = document.createElement('option');
        o.value = stock.id;
        o.textContent = `${prod.name} — lote ${stock.id} — ${stock.qty} un`;
        sellStockItem.appendChild(o);
      });
      if(current) sellStockItem.value = current;
    }
  }
}

function buildImp3dUnitSnapshot(prod, fil, salePricePerUnit, variant = null){
  const salePrice = Number(salePricePerUnit || prod.price || 0);
  const initial = Number(fil.initialWeight || fil.weight || 0);
  const pricePerGram = initial > 0 ? Number(fil.price || 0) / initial : 0;

  return {
    salePricePerUnit: salePrice,
    unitMaterialCost: Number(prod.fil_g || 0) * pricePerGram,
    unitHourlyCost: Number(prod.hours || 0) * Number(prod.energy_h || 0),
    unitPackagingCost: Number(prod.pack || 0),

    variantId: variant?.id || 'default',
    variantLabel: variant?.label || 'Padrão',
    
    // O filamentSnapshot PRECISA estar aqui para manter o histórico de custo e material
    filamentSnapshot: {
      id: fil.id,
      color: fil.color,
      type: fil.type,
      price: Number(fil.price || 0),
      initialWeight: Number(fil.initialWeight || fil.weight || 0),
      pricePerGram
    }
  };
}

function stockProduct(productId, variantId, filamentId, qty, note){
  const prod = state.products.find(p => p.id === productId);
  const fil = state.filaments.find(f => f.id === filamentId);

  if(!prod || !fil) return alert('Produto ou filamento inválido');

  ensureProductVariants(prod);

  const variant = getProductVariant(prod, variantId || 'default') || getProductVariant(prod, 'default');
  if(!variant) return alert('Variação inválida');

  qty = Number(qty || 0);
  if(qty <= 0) return alert('Quantidade inválida');

  const totalFilNeeded = Number(prod.fil_g || 0) * qty;

  if(Number(fil.weight || 0) < totalFilNeeded){
    if(!confirm('Filamento insuficiente. Deseja permitir negativo?')) return;
  }

  const snapshot = buildImp3dUnitSnapshot(prod, fil, variant.price, variant);

  fil.weight = Number(fil.weight || 0) - totalFilNeeded;

  state.impStock.push({
    id: Date.now().toString(),
    date: todayISO(),
    productId,
    variantId: variant.id,
    variantLabel: variant.label,
    variantPrice: Number(variant.price || 0),
    filamentId,
    qty: Number(qty),
    note: note || '',
    snapshot
  });

  saveState();
  updateAll();
  alert(`Item estocado com sucesso!\nQuantidade: ${qty}`);
}

function calcImp3dSaleMetrics(prod, fil, qty, pricePerUnit){
  qty = Number(qty || 0);
  pricePerUnit = Number(pricePerUnit || 0);

  const totalFilNeeded = Number(prod.fil_g || 0) * qty;

  // custo do filamento
  const initial = Number(fil.initialWeight || fil.weight || 0);
  const priceRolo = Number(fil.price || 0);
  const pricePerGram = initial > 0 ? (priceRolo / initial) : 0;
  const materialCostUnit = Number(prod.fil_g || 0) * pricePerGram;
  const materialCostTotal = materialCostUnit * qty;

  // custo por hora
  const hourlyCostUnit = Number(prod.hours || 0) * Number(prod.energy_h || 0);
  const hourlyCostTotal = hourlyCostUnit * qty;

  // custo de embalagem
  const packagingCostUnit = Number(prod.pack || 0);
  const packagingCostTotal = packagingCostUnit * qty;

  // ADAPTAÇÃO GENÉRICA: Taxas dinâmicas da plataforma
  const feeFixed = Number(state.settings?.platformFeeFixed || 0);
  const feePct = Number(state.settings?.platformFeePct || 0);
  const feePerUnit = feeFixed + (feePct * pricePerUnit);
  const feeTotal = feePerUnit * qty;

  // valores
  const amountGross = pricePerUnit * qty;
  const netReceived = amountGross - feeTotal;
  const mandatoryReinvest = materialCostTotal + hourlyCostTotal + packagingCostTotal;
  const profit = netReceived - mandatoryReinvest;

  return {
    totalFilNeeded,
    materialCostTotal,
    hourlyCostTotal,
    packagingCostTotal,
    feeTotal,
    amountGross,
    netReceived,
    mandatoryReinvest,
    profit
  };
}

/* vendendo: determinístico, atualiza contas corretas */
function sellProduct(productId, filamentId, accountId, qty, pricePerUnit){
  const result = processImp3dSale({
    productId,
    filamentId,
    accountId,
    qty,
    pricePerUnit,
    skipFilamentDebit: false,
    channel: 'normal'
  });

  if(!result) return;

  saveState();
  updateAll();

  alert(
    `Venda registrada.\n` +
    `Bruto: ${money(result.amountGross)}\n` +
    `Taxa Plataforma: ${money(result.feeTotal)}\n` +
    `Líquido recebido na conta: ${money(result.netReceived)}\n` +
    `Reinvestimento obrigatório: ${money(result.mandatoryReinvest)}\n` +
    ` - Filamento: ${money(result.materialCostTotal)}\n` +
    ` - Custo por hora: ${money(result.hourlyCostTotal)}\n` +
    ` - Embalagem: ${money(result.packagingCostTotal)}\n` +
    `Lucro limpo: ${money(result.profit)}`
  );
}

function processImp3dSale({
  productId,
  filamentId,
  accountId,
  qty,
  pricePerUnit,
  snapshot,
  skipFilamentDebit = false,
  channel = 'normal',
  filamentSnapshot = null
}){
  const prod = state.products.find(p => p.id === productId);
  const acc = state.accounts.find(a => a.id === accountId);
  const liveFil = state.filaments.find(f => f.id === filamentId);

  const fil = liveFil || filamentSnapshot || snapshot?.filamentSnapshot || null;

  if(!prod || !acc){
    alert('Produto ou conta de destino inválidos.');
    return null;
  }

  qty = Number(qty || 0);
  pricePerUnit = Number(pricePerUnit || 0);

  if(qty <= 0 || pricePerUnit <= 0){
    alert('Quantidade ou preço inválidos.');
    return null;
  }

  if(!snapshot && !fil){
    alert('Não foi possível localizar os dados do filamento para calcular a venda.');
    return null;
  }

  let currentPricePerGram = 0;
  if(fil){
    if(fil.pricePerGram !== undefined){
      currentPricePerGram = Number(fil.pricePerGram);
    } else {
      const initial = Number(fil.initialWeight || fil.weight || 0);
      currentPricePerGram = initial > 0 ? Number(fil.price || 0) / initial : 0;
    }
  }

  const snap = snapshot || {
    salePricePerUnit: pricePerUnit,
    unitMaterialCost: Number(prod.fil_g || 0) * currentPricePerGram,
    unitHourlyCost: Number(prod.hours || 0) * Number(prod.energy_h || 0),
    unitPackagingCost: Number(prod.pack || 0),
    filamentSnapshot: fil ? {
      id: fil.id || '',
      color: fil.color || 'Filamento',
      type: fil.type || '',
      pricePerGram: currentPricePerGram
    } : null
  };

  const totalFilNeeded = Number(prod.fil_g || 0) * qty;

  if(!skipFilamentDebit){
    if(!liveFil){
      alert('Filamento ativo não encontrado para esta venda.');
      return null;
    }

    if(Number(liveFil.weight || 0) < totalFilNeeded){
      if(!confirm(`Filamento selecionado tem ${Number(liveFil.weight || 0).toFixed(2)} g — precisa de ${totalFilNeeded.toFixed(2)} g. Continuar e permitir estoque negativo?`)) return null;
    }

    liveFil.weight = Number(liveFil.weight || 0) - totalFilNeeded;
  }

  const unitSalePrice = Number(snap.salePricePerUnit || pricePerUnit || 0);
  const amountGross = unitSalePrice * qty;

  // ADAPTAÇÃO GENÉRICA: Uso dinâmico de taxas
  const feeFixed = Number(state.settings?.platformFeeFixed || 0);
  const feePct = Number(state.settings?.platformFeePct || 0);
  const feePerUnit = feeFixed + (feePct * unitSalePrice);
  const feeTotal = feePerUnit * qty;

  const materialCostTotal = Number(snap.unitMaterialCost || 0) * qty;
  const hourlyCostTotal = Number(snap.unitHourlyCost || 0) * qty;
  const packagingCostTotal = Number(snap.unitPackagingCost || 0) * qty;

  const mandatoryReinvest = materialCostTotal + hourlyCostTotal + packagingCostTotal;
  const netReceived = amountGross - feeTotal;
  const profit = netReceived - mandatoryReinvest;

  // ADAPTAÇÃO GENÉRICA: Adiciona o saldo diretamente na conta do usuário, 
  // eliminando a bagunça de jogar cada centavo no state.expenses da vida pessoal
  acc.saldo = Number(acc.saldo || 0) + netReceived;

  const sale = {
    id: Date.now().toString(),
    date: todayISO(),
    productId,
    filamentId: filamentId || fil?.id || '',
    accountId: accountId,
    qty,
    amountGross,
    feeTotal,
    netReceived,
    materialCost: materialCostTotal,
    hourlyCost: hourlyCostTotal,
    packagingCost: packagingCostTotal,
    mandatoryReinvest,
    profit,
    channel
  };
  state.impSales.push(sale);

  return {
    amountGross,
    feeTotal,
    netReceived,
    materialCostTotal,
    hourlyCostTotal,
    packagingCostTotal,
    mandatoryReinvest,
    profit
  };
}

function sellFromStock(stockId, qtyToSell){
  const stock = state.impStock.find(s => s.id === stockId);
  if(!stock){
    alert('Item não encontrado.');
    return;
  }

  const prod = state.products.find(p => p.id === stock.productId);
  if(!prod){
    alert('Produto inválido.');
    return;
  }

  qtyToSell = Number(qtyToSell || 0);
  const available = Number(stock.qty || 0);

  if(qtyToSell <= 0 || qtyToSell > available){
    alert('Quantidade inválida.');
    return;
  }

  // snapshot salvo no lote, se existir
  let snapshot = stock.snapshot ? JSON.parse(JSON.stringify(stock.snapshot)) : null;

  const currentMaterialCost = Number(snapshot?.unitMaterialCost || 0);
  const currentPricePerGram = snapshot?.filamentSnapshot?.pricePerGram;

  let manualPricePerGram = null;

  if(!snapshot || !currentMaterialCost || currentMaterialCost <= 0){
    const defaultVal =
      (currentPricePerGram !== undefined && currentPricePerGram !== null && currentPricePerGram !== '')
        ? String(currentPricePerGram)
        : '0';

    const val = prompt(
      'Esse item do estoque não tem custo de filamento válido.\nDigite o preço por grama do filamento para esta venda:',
      defaultVal
    );

    if(val === null) return;

    manualPricePerGram = Number(val || 0);
    if(!manualPricePerGram || manualPricePerGram <= 0){
      alert('Preço por grama inválido.');
      return;
    }
  }

  // Se o usuário precisou informar manualmente, recria um snapshot temporário
  if(manualPricePerGram !== null){
    snapshot = {
      salePricePerUnit: Number(snapshot?.salePricePerUnit || prod.price || 0),
      unitMaterialCost: Number(prod.fil_g || 0) * manualPricePerGram,
      unitHourlyCost: Number(prod.hours || 0) * Number(prod.energy_h || 0),
      unitPackagingCost: Number(prod.pack || 0),
      variantId: snapshot?.variantId || 'default',
      variantLabel: snapshot?.variantLabel || 'Padrão',
      filamentSnapshot: {
        id: stock.snapshot?.filamentSnapshot?.id || stock.filamentId || 'manual',
        color: stock.snapshot?.filamentSnapshot?.color || 'Manual',
        type: stock.snapshot?.filamentSnapshot?.type || 'Manual',
        pricePerGram: manualPricePerGram
      }
    };
  }

  // ADAPTAÇÃO GENÉRICA: Escolher conta destino dinamicamente para o estoque
  const accSelect = document.getElementById('sell-stock-acc');
  const accId = accSelect ? accSelect.value : (state.accounts[0]?.id || 'default');

  const result = processImp3dSale({
    productId: stock.productId,
    filamentId: stock.filamentId || stock.snapshot?.filamentSnapshot?.id || 'filamento_removido',
    accountId: accId,
    qty: qtyToSell,
    pricePerUnit: Number(snapshot?.salePricePerUnit || prod.price || 0),
    snapshot,
    skipFilamentDebit: true,
    channel: 'estoque'
  });

  if(!result) return;

  stock.qty = available - qtyToSell;
  if(stock.qty <= 0){
    state.impStock = state.impStock.filter(s => s.id !== stockId);
  }

  saveState();
  updateAll();

  alert(
    `Venda do estoque realizada.\n` +
    `Bruto: ${money(result.amountGross)}\n` +
    `Taxas: ${money(result.feeTotal)}\n` +
    `Líquido recebido na conta: ${money(result.netReceived)}\n` +
    `Lucro real: ${money(result.profit)}`
  );
}

function openSellFormForProduct(productId, anchorBtn){
  const existing = document.getElementById('imp3d-sell-form-'+productId);
  closeAllProductPanels();
  if(existing) return; 

  const prod = state.products.find(p=>p.id===productId);
  if(!prod) return;
  ensureProductVariants(prod);

  const form = document.createElement('div');
  form.id = 'imp3d-sell-form-'+productId;
  form.style.marginTop = '16px';
  form.style.padding = '20px';
  form.style.background = 'rgba(2, 6, 23, 0.8)';
  form.style.borderRadius = '16px';
  form.style.border = '1px solid rgba(255,255,255,0.08)';
  form.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
  
  form.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px; color:#fff; font-weight:700;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
      Checkout Rápido Direto
    </div>
    <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
      <div style="flex:1; min-width:160px; display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:0.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Variação Selecionada</label>
        <select id="sell-variant-${productId}" style="padding:12px; background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff;"></select>
      </div>
      <div style="flex:1; min-width:160px; display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:0.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Rolo Consumido</label>
        <select id="sell-fil-${productId}" style="padding:12px; background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff;"></select>
      </div>
      <div style="width:100px; display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:0.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Unid.</label>
        <input id="sell-qty-${productId}" type="number" step="1" value="1" style="padding:12px; background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff; text-align:center;"/>
      </div>
      <div style="flex:1; min-width:150px; display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:0.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Recebedor (Wallet)</label>
        <select id="sell-acc-${productId}" style="padding:12px; background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff;"></select>
      </div>
      <div style="width:120px; display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:0.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Preço C/ Cliente</label>
        <input id="sell-price-${productId}" type="number" step="0.01" value="${Number(prod.price || 0)}" style="padding:12px; background:rgba(15,23,42,0.8); border:1px solid rgba(16,185,129,0.3); border-radius:12px; color:#10b981; font-weight:700;"/>
      </div>
      <div style="display:flex; flex-direction:row; gap:10px; align-items:center; width:100%; margin-top:8px;">
        <button id="sell-confirm-${productId}" class="btn-primary" style="flex:1; border-radius:12px; padding:12px;">Confirmar e Receber Fundos</button>
        <button id="sell-cancel-${productId}" class="btn ghost" style="border-radius:12px; padding:12px;">Cancelar</button>
      </div>
    </div>
  `;
  const card = anchorBtn.closest('.box-card');
  card.parentNode.insertBefore(form, card.nextSibling);

  const variantSel = document.getElementById(`sell-variant-${productId}`);
  const filSel = document.getElementById(`sell-fil-${productId}`);
  const accSel = document.getElementById(`sell-acc-${productId}`);
  const qtyInput = document.getElementById(`sell-qty-${productId}`);
  const priceInput = document.getElementById(`sell-price-${productId}`);

  fillVariantSelect(variantSel, prod, 'default');

  filSel.innerHTML = '';
  state.filaments.forEach(f=>{
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.color} — ${f.type} (${Number(f.weight).toFixed(2)} g) — ${money(f.price||0)}`;
    filSel.appendChild(opt);
  });
  if(!state.filaments.length){
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Nenhum filamento';
    filSel.appendChild(opt);
  }

  accSel.innerHTML = '';
  state.accounts.forEach(a=>{
    const o = document.createElement('option');
    o.value = a.id;
    o.textContent = a.name;
    accSel.appendChild(o);
  });

  function syncPriceFromVariant(){
    const v = getProductVariant(prod, variantSel.value);
    if(v) priceInput.value = Number(v.price || 0).toFixed(2);
  }

  variantSel.addEventListener('change', syncPriceFromVariant);

  filSel.addEventListener('change', ()=>{
    const autoVariantId = matchVariantToFilament(prod, filSel.value);
    if(autoVariantId) variantSel.value = autoVariantId;
    syncPriceFromVariant();
  });

  document.getElementById(`sell-cancel-${productId}`).addEventListener('click', ()=>{
    form.remove();
  });

  document.getElementById(`sell-confirm-${productId}`).addEventListener('click', ()=>{
    const filId = filSel.value;
    const qty = Number(qtyInput.value || 0);
    const accId = accSel.value;
    const price = Number(priceInput.value || 0);

    if(!filId || qty <= 0 || !accId || price <= 0){
      alert('Preencha filamento, quantidade, conta e preço corretos.');
      return;
    }

    sellProduct(productId, filId, accId, qty, price);
    form.remove();
  });

  syncPriceFromVariant();
}

function openProfitCalcPreviewForProduct(productId, anchorBtn){
  const existing = document.getElementById('imp3d-profit-preview-' + productId);
  closeAllProductPanels(); 
  if(existing) return;

  const prod = state.products.find(p=>p.id === productId);
  if(!prod) return;
  ensureProductVariants(prod);

  const form = document.createElement('div');
  form.id = 'imp3d-profit-preview-' + productId;
  form.style.marginTop = '16px'; form.style.padding = '20px'; form.style.borderRadius = '16px'; 
  form.style.background = 'rgba(2, 6, 23, 0.8)'; form.style.border = '1px solid rgba(255,255,255,0.08)';

  form.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:16px;">
      <strong style="font-size:1.05rem; color:#fff; display:flex; align-items:center; gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        Simulador de Engenharia Financeira
      </strong>
      <button type="button" class="btn ghost small" id="${form.id}-close" style="border-radius:8px;">Fechar X</button>
    </div>
    <div class="form-grid">
      <div class="form-field"><label>Simular Variação</label><select id="${form.id}-variant" style="padding:12px; border-radius:12px;"></select></div>
      <div class="form-field"><label>Insumo Gasto</label><select id="${form.id}-fil" style="padding:12px; border-radius:12px;"></select></div>
      <div class="form-field"><label>Tamanho do Lote (Unid.)</label><input id="${form.id}-qty" type="number" step="1" value="1" style="padding:12px; border-radius:12px;"></div>
      <div class="form-field"><label>Preço Sugerido (R$)</label><input id="${form.id}-price" type="number" step="0.01" value="${Number(prod.price || 0)}" style="padding:12px; border-radius:12px;"></div>
    </div>
    <div style="margin-top:20px; padding:16px; border-radius:16px; background:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.15); display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:12px;">
      <div style="background:rgba(2, 6, 23, 0.8); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);"><span style="color:#94a3b8; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; display:block;">Custo (Mat+Hr+Pk)</span><span style="font-weight:800; font-size:1.1rem; color:#fff; margin-top:4px; display:block;" id="${form.id}-mat">R$ 0,00</span></div>
      <div style="background:rgba(2, 6, 23, 0.8); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);"><span style="color:#94a3b8; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; display:block;">Fee Plataforma</span><span style="font-weight:800; font-size:1.1rem; color:#f59e0b; margin-top:4px; display:block;" id="${form.id}-fee">R$ 0,00</span></div>
      <div style="background:rgba(2, 6, 23, 0.8); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);"><span style="color:#94a3b8; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; display:block;">Receita na Conta</span><span style="font-weight:800; font-size:1.1rem; color:#fff; margin-top:4px; display:block;" id="${form.id}-net">R$ 0,00</span></div>
      <div style="background:rgba(16, 185, 129, 0.1); padding:12px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);"><span style="color:#10b981; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; font-weight:800; display:block;">Lucro Líquido Limpo</span><span style="font-weight:900; font-size:1.3rem; color:#10b981; margin-top:2px; display:block; text-shadow:0 0 10px rgba(16,185,129,0.3);" id="${form.id}-profit">R$ 0,00</span></div>
    </div>
  `;
  const card = anchorBtn.closest('.box-card');
  card.parentNode.insertBefore(form, card.nextSibling);

  const variantSel = document.getElementById(`${form.id}-variant`);
  const filSel = document.getElementById(`${form.id}-fil`);
  const qtyInput = document.getElementById(`${form.id}-qty`);
  const priceInput = document.getElementById(`${form.id}-price`);
  const closeBtn = document.getElementById(`${form.id}-close`);

  fillVariantSelect(variantSel, prod, 'default');

  filSel.innerHTML = '';
  state.filaments.forEach(f=>{
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.color} — ${f.type} (${Number(f.weight || 0).toFixed(2)} g)`;
    filSel.appendChild(opt);
  });

  if(!state.filaments.length){
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Nenhum filamento';
    filSel.appendChild(opt);
  }

  function syncPrice(){
    const v = getProductVariant(prod, variantSel.value);
    if(v) priceInput.value = Number(v.price || 0).toFixed(2);
  }

  function recompute(){
    const fil = state.filaments.find(f => f.id === filSel.value);
    const qty = Number(qtyInput.value || 0);
    const price = Number(priceInput.value || 0);

    const matEl = document.getElementById(`${form.id}-mat`);
    const feeEl = document.getElementById(`${form.id}-fee`);
    const netEl = document.getElementById(`${form.id}-net`);
    const profitEl = document.getElementById(`${form.id}-profit`);

    if(!fil || qty <= 0 || price <= 0){
      matEl.textContent = money(0);
      feeEl.textContent = money(0);
      netEl.textContent = money(0);
      profitEl.textContent = money(0);
      return;
    }

    const initial = Number(fil.initialWeight || fil.weight || 0);
    const priceRolo = Number(fil.price || 0);
    const pricePerGram = initial > 0 ? (priceRolo / initial) : 0;

    const materialCostUnit = Number(prod.fil_g || 0) * pricePerGram;
    const hourlyCostUnit = Number(prod.hours || 0) * Number(prod.energy_h || 0);
    const packagingCostUnit = Number(prod.pack || 0);

    const gross = price * qty;
    
    // ADAPTAÇÃO GENÉRICA: Uso dinâmico de taxas
    const feeFixed = Number(state.settings?.platformFeeFixed || 0);
    const feePct = Number(state.settings?.platformFeePct || 0);
    const feePerUnit = feeFixed + (feePct * price);
    const feeTotal = feePerUnit * qty;

    const materialCostTotal = materialCostUnit * qty;
    const hourlyCostTotal = hourlyCostUnit * qty;
    const packagingCostTotal = packagingCostUnit * qty;

    const net = gross - feeTotal;
    const profit = net - (materialCostTotal + hourlyCostTotal + packagingCostTotal);

    matEl.textContent = money(materialCostTotal);
    feeEl.textContent = money(feeTotal);
    netEl.textContent = money(net);
    profitEl.textContent = money(profit);
  }

  variantSel.addEventListener('change', ()=>{
    syncPrice();
    recompute();
  });

  filSel.addEventListener('change', ()=>{
    const autoVariantId = matchVariantToFilament(prod, filSel.value);
    if(autoVariantId) variantSel.value = autoVariantId;
    syncPrice();
    recompute();
  });
  
  qtyInput.addEventListener('input', recompute);
  priceInput.addEventListener('input', recompute);

  closeBtn.addEventListener('click', ()=>{
    form.remove();
  });

  syncPrice();
  setTimeout(recompute, 50);
}

function getGroupedStock(){
  const map = {};

  state.impStock.forEach(s => {
    const qty = Number(s.qty || 0);
    const unitMaterial = Number(s.snapshot?.unitMaterialCost || 0);
    const unitHourly = Number(s.snapshot?.unitHourlyCost || 0);
    const unitPackaging = Number(s.snapshot?.unitPackagingCost || 0);
    const unitTotalCost = unitMaterial + unitHourly + unitPackaging;
    const totalCost = unitTotalCost * qty;

    // Agrupa por Produto + Variação para não misturar
    const groupKey = s.productId + '_' + (s.variantId || 'default');

    if(!map[groupKey]){
      map[groupKey] = {
        productId: s.productId,
        variantId: s.variantId || 'default',
        variantLabel: s.variantLabel || 'Padrão',
        qty: 0,
        totalCost: 0,
        lotIds: []
      };
    }

    map[groupKey].qty += qty;
    map[groupKey].totalCost += totalCost;
    map[groupKey].lotIds.push(s.id);
  });

  return Object.values(map);
}

function renderImpStock(){
  const tbody = document.getElementById('imp3d-stock-body');
  if(!tbody) return;

  tbody.innerHTML = '';
  const grouped = getGroupedStock();

  if(!grouped.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="text-align:center; padding:30px; color:#64748b;">Seu galpão de estoque está vazio no momento.</td>`;
    tbody.appendChild(tr);
    return;
  }

  grouped.forEach(g => {
    const prod = state.products.find(p => p.id === g.productId) || { name: g.productId };
    const avgUnit = g.qty > 0 ? (g.totalCost / g.qty) : 0;
    const firstLot = state.impStock.find(s => s.productId === g.productId && s.variantId === g.variantId);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600; color:#f8fafc;">${prod.name}</td>
      <td><span style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; font-size:0.8rem;">${g.variantLabel}</span></td>
      <td><span style="color:#3b82f6; font-weight:800; background:rgba(59,130,246,0.1); padding:4px 10px; border-radius:8px;">${g.qty} un</span></td>
      <td style="color:#94a3b8;">${money(avgUnit)}</td>
      <td style="font-weight:700;">${money(g.totalCost)}</td>
      <td style="text-align:right;">
        <button class="btn small stock-open" data-product="${g.productId}" data-lot="${firstLot ? firstLot.id : ''}" style="background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:6px 12px; display:inline-flex; align-items:center; gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Checkout Rápido
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Re-anexa os eventos do botão "Vender" da tabela
  tbody.querySelectorAll('.stock-open').forEach(btn => {
    btn.addEventListener('click', e => {
      const lotId = e.target.dataset.lot || '';
      const sellSel = document.getElementById('sell-stock-item');
      if(sellSel && lotId){
        sellSel.value = lotId;
      }
      const qtyInput = document.getElementById('sell-stock-qty');
      if(qtyInput) qtyInput.focus();
    });
  });
}

/* ========================================================
                       METRICAS E DASHBOARD:
   ======================================================== */

function renderImpSales(){
  const tbody = document.getElementById('imp3d-sales-body');
  const month = getActiveMonth();
  
  const arr = state.impSales.filter(s => billingMonthOf(s.date) === month).sort((a,b)=> a.date < b.date ? 1 : -1);
  const lossesArr = state.impLosses.filter(l => billingMonthOf(l.date) === month);

  let totalReceived = 0, totalProfit = 0, totalMandatoryReinvest = 0, totalLosses = 0;
  lossesArr.forEach(l => totalLosses += Number(l.cost || 0));

  if(tbody){
    tbody.innerHTML = '';
    arr.forEach(s=>{
      const prod = state.products.find(p=>p.id===s.productId) || {name:s.productId};
      const fil = state.filaments.find(f=>f.id===s.filamentId) || {color:s.filamentId};

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:#94a3b8; font-size:0.8rem;">${s.date.split('-').reverse().join('/')}</td>
        <td style="font-weight:600; color:#f8fafc;">${prod.name}</td>
        <td><span style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; font-size:0.75rem;">${fil.color||fil.id}</span></td>
        <td style="font-weight:700;">${s.qty}</td>
        <td>${money(s.amountGross||0)}</td>
        <td style="color:#f59e0b;">${money(s.feeTotal||0)}</td>
        <td style="font-weight:700; color:#fff;">${money(s.netReceived||0)}</td>
        <td style="color:#94a3b8;">${money(s.materialCost||0)}</td>
        <td style="color:#94a3b8;">${money(s.hourlyCost||0)}</td>
        <td style="color:#94a3b8;">${money(s.packagingCost||0)}</td>
        <td style="color:#3b82f6;">${money(s.mandatoryReinvest||0)}</td>
        <td><span style="background:rgba(16,185,129,0.1); color:#10b981; padding:6px 10px; border-radius:8px; font-weight:800; border:1px solid rgba(16,185,129,0.2); display:inline-block;">${money(s.profit||0)}</span></td>
        <td style="text-align:right;">
          <button class="btn small danger imp-refund-btn" data-id="${s.id}" style="padding:6px 12px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
            Estorno
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Anexa evento aos botões de estorno
    tbody.querySelectorAll('.imp-refund-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        handleImpRefund(e.target.dataset.id);
      });
    });
  }

  arr.forEach(s=>{
    totalReceived += Number(s.netReceived || 0);
    totalProfit += Number(s.profit || 0);
    totalMandatoryReinvest += Number(s.mandatoryReinvest || 0);
  });

  const realProfit = totalProfit - totalLosses;
  const recEl = document.getElementById('imp3d-total-received');
  const reinvEl = document.getElementById('imp3d-total-reinvest');
  const salesProfEl = document.getElementById('imp3d-total-sales-profit');
  const lossesEl = document.getElementById('imp3d-total-losses');
  const profEl = document.getElementById('imp3d-total-profit');

  if(recEl) recEl.textContent = money(totalReceived);
  if(reinvEl) reinvEl.textContent = money(totalMandatoryReinvest);
  if(salesProfEl) salesProfEl.textContent = money(totalProfit);
  if(lossesEl) lossesEl.textContent = money(totalLosses);
  if(profEl) {
    profEl.textContent = money(realProfit);
    profEl.style.color = realProfit < 0 ? 'var(--danger)' : 'var(--accent)';
  }
}

function renderImpLosses(){
  const tbody = document.getElementById('imp3d-losses-body');
  if(!tbody) return;
  tbody.innerHTML = '';
  const arr = [...state.impLosses].sort((a,b)=> a.date < b.date ? 1 : -1);
  arr.forEach(l=>{
    const fil = state.filaments.find(f=>f.id===l.filamentId) || {color:l.filamentId};
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${l.date}</td><td>${fil.color||fil.id}</td><td>${Number(l.grams).toFixed(2)}</td><td>${money(l.cost)}</td><td>${l.reason||''}</td>`;
    tbody.appendChild(tr);
  });
}

// ADAPTAÇÃO GENÉRICA: O Dashboard agora lista todas as contas criadas dinamicamente
function updateImp3dAccountBalances() {
  const balancesContainer = document.getElementById('dash-account-balances');
  if (balancesContainer) {
    balancesContainer.innerHTML = state.accounts.map(a => 
      `<div class="y-row" style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span>${a.name}</span>
        <strong>${money(a.saldo)}</strong>
      </div>`
    ).join('');
  }
}

function renderImp3dDashboard() {
  const dashContainer = document.getElementById('imp3d-dashboard-container');
  if (!dashContainer) return; 

  const month = getActiveMonth();
  updateImp3dAccountBalances();

  // Fundo de Reinvestimento (Sempre "All Time" para tracking contínuo)
  let allTimeReinvest = 0;
  state.impSales.forEach(s => allTimeReinvest += Number(s.mandatoryReinvest || 0));

  let allTimeStoreExpenses = 0;
  state.storeExpenses.forEach(e => {
    allTimeStoreExpenses += Number(e.amount || 0);
  });

  const fundBalance = allTimeReinvest - allTimeStoreExpenses;

  const elFundIn = document.getElementById('dash-fund-in');
  const elFundOut = document.getElementById('dash-fund-out');
  const elFundBal = document.getElementById('dash-fund-balance');
  const elFundStatus = document.getElementById('dash-fund-status');

  if (elFundIn) elFundIn.textContent = money(allTimeReinvest);
  if (elFundOut) elFundOut.textContent = money(allTimeStoreExpenses);
  
  if (elFundBal) {
    elFundBal.textContent = money(fundBalance);
    elFundBal.style.color = fundBalance < 0 ? 'var(--danger)' : 'var(--accent)';
  }
  
  if (elFundStatus) {
    if (fundBalance >= 0) {
      elFundStatus.innerHTML = `✅ Tem <strong>${money(fundBalance)}</strong> livres do fundo guardados para comprar material.`;
      elFundStatus.style.border = '1px solid rgba(34, 197, 94, 0.2)';
      elFundStatus.style.color = 'var(--accent)';
    } else {
      elFundStatus.innerHTML = `⚠️ <strong>Fundo Esgotado!</strong> Você tirou <strong>${money(Math.abs(fundBalance))}</strong> do seu lucro (bolso) para pagar insumos.`;
      elFundStatus.style.border = '1px solid rgba(239, 68, 68, 0.2)';
      elFundStatus.style.color = 'var(--danger)';
    }
  }
  
  // Lê o estado do novo Toggle
  const isAllTime = document.getElementById('dash-toggle-alltime')?.checked || false;

  // Atualiza os títulos no HTML dinamicamente
  document.querySelectorAll('.dash-time-label').forEach(el => {
    el.textContent = isAllTime ? '(Todo o Tempo)' : '(Mês Atual)';
  });

  // Filtra as Vendas e Perdas consoante o Toggle
  let targetSales = state.impSales;
  let targetLosses = state.impLosses;

  if (!isAllTime) {
    targetSales = targetSales.filter(s => billingMonthOf(s.date) === month);
    targetLosses = targetLosses.filter(l => billingMonthOf(l.date) === month);
  }

  let gross = 0, profit = 0, fees = 0, matCost = 0, hourCost = 0, packCost = 0;
  
  targetSales.forEach(s => {
    gross += Number(s.amountGross || 0);
    profit += Number(s.profit || 0);
    fees += Number(s.feeTotal || 0);
    matCost += Number(s.materialCost || 0);
    hourCost += Number(s.hourlyCost || 0);
    packCost += Number(s.packagingCost || 0);
  });

  let lossesCost = 0;
  targetLosses.forEach(l => {
    lossesCost += Number(l.cost || 0);
  });

  const realProfit = profit - lossesCost;

  const elGross = document.getElementById('dash-imp-gross');
  const elProfit = document.getElementById('dash-imp-profit');
  const elFees = document.getElementById('dash-imp-fees');
  const elLosses = document.getElementById('dash-imp-losses');
  const elMat = document.getElementById('dash-imp-mat');

  if(elGross) elGross.textContent = money(gross);
  if(elProfit) {
    elProfit.textContent = money(realProfit);
    elProfit.style.color = realProfit < 0 ? 'var(--danger)' : 'var(--accent)';
  }
  if(elFees) elFees.textContent = money(fees);
  if(elLosses) elLosses.textContent = money(lossesCost);
  
  if(elMat) {
    elMat.innerHTML = `
      ${money(matCost + hourCost + packCost)}
      <div style="font-size:0.75rem; color:var(--muted); margin-top:8px; font-weight:normal; display:flex; justify-content:center; gap:8px; flex-wrap:wrap; text-transform:none; letter-spacing:0;">
        <span title="Filamento" style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px;">🧵 ${money(matCost)}</span>
        <span title="Energia/Hora" style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px;">⚡ ${money(hourCost)}</span>
        <span title="Embalagem" style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px;">📦 ${money(packCost)}</span>
      </div>
    `;
  }

  // Gráfico de Custos
  const ctxCosts = document.getElementById('imp3d-costs-chart');
  if (ctxCosts) {
    if(impCostsChart) impCostsChart.destroy();
    impCostsChart = new Chart(ctxCosts.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Material', 'Energia (Horas)', 'Embalagem', 'Taxas Shopee', 'Perdas/Falhas'],
        datasets: [{
          data: [matCost, hourCost, packCost, fees, lossesCost],
          backgroundColor: ['#60a5fa', '#facc15', '#a78bfa', '#fb923c', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, aspectRatio: 1.4,
        plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 10 } } } }
      }
    });
  }

  // Gráfico Histórico (não é afetado pelo toggle, pois é uma "linha do tempo")
  const ctxTrend = document.getElementById('imp3d-trend-chart');
  if (ctxTrend) {
    const labels = [];
    const dataGross = [];
    const dataProfit = [];

    for(let i = state.meta.activeOffset - 5; i <= state.meta.activeOffset; i++){
      const m = computeMonthFromOffset(i);
      labels.push(m);

      const mSales = state.impSales.filter(s => billingMonthOf(s.date) === m);
      const mLosses = state.impLosses.filter(l => billingMonthOf(l.date) === m);

      let mG = 0, mP = 0, mL = 0;
      mSales.forEach(s => { mG += Number(s.amountGross||0); mP += Number(s.profit||0); });
      mLosses.forEach(l => { mL += Number(l.cost||0); });

      dataGross.push(mG);
      dataProfit.push(mP - mL);
    }

    if(impTrendChart) impTrendChart.destroy();
    impTrendChart = new Chart(ctxTrend.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Receita Bruta', data: dataGross, backgroundColor: '#3b82f6', borderRadius: 4 },
          { label: 'Lucro Líquido', data: dataProfit, backgroundColor: '#22c55e', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, aspectRatio: 1.8,
        plugins: { legend: { labels: { color: '#cbd5e1' } } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.1)' } }
        }
      }
    });
  }

  // Tabela Ranking de Produtos
  const tbodyTop = document.getElementById('dash-top-products-body');
  if (tbodyTop) {
    tbodyTop.innerHTML = '';
    const prodStats = {};

    targetSales.forEach(s => {
      if(!prodStats[s.productId]) prodStats[s.productId] = { qty: 0, gross: 0, profit: 0 };
      prodStats[s.productId].qty += Number(s.qty || 0);
      prodStats[s.productId].gross += Number(s.amountGross || 0);
      prodStats[s.productId].profit += Number(s.profit || 0);
    });

    const sortedIds = Object.keys(prodStats).sort((a,b) => prodStats[b].gross - prodStats[a].gross).slice(0, 5);

    if(sortedIds.length === 0) {
      tbodyTop.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;">Nenhuma venda neste período.</td></tr>`;
    } else {
      sortedIds.forEach(id => {
        const pObj = state.products.find(p => p.id === id) || { name: 'Excluído/Desconhecido' };
        const st = prodStats[id];
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 600;">${pObj.name}</td>
          <td style="text-align: center;">${st.qty}</td>
          <td style="color: #60a5fa;">${money(st.gross)}</td>
          <td style="color: #4ade80;">${money(st.profit)}</td>
        `;
        tbodyTop.appendChild(tr);
      });
    }
  }
}

// ADAPTAÇÃO GENÉRICA: Transferência livre entre qualquer conta criada na loja
function openTransferForm() {
  const existing = document.getElementById('imp3d-transfer-modal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'imp3d-transfer-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.background = 'rgba(0,0,0,0.85)';
  modal.style.zIndex = '9999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.padding = '20px';

  let accOptions = state.accounts.map(a => `<option value="${a.id}">${a.name} (Saldo: ${money(a.saldo)})</option>`).join('');

  modal.innerHTML = `
    <div class="panel-card glass-card" style="width:100%; max-width:400px; padding: 24px;">
      <h3 class="card-title" style="font-size:1.1rem;">🔄 Transferir Dinheiro</h3>
      <p class="panel-subtitle" style="font-size:0.8rem;">Mover saldos entre as caixas/contas da loja.</p>
      <div class="form-grid" style="grid-template-columns:1fr; gap:14px; margin-top:16px;">
        <div class="form-field">
          <label>Conta Origem (Retirar de)</label>
          <select id="tr-from">${accOptions}</select>
        </div>
        <div class="form-field">
          <label>Conta Destino (Enviar para)</label>
          <select id="tr-to">${accOptions}</select>
        </div>
        <div class="form-field">
          <label>Valor (R$)</label>
          <input type="number" step="0.01" id="tr-amount" placeholder="0.00">
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
          <button id="tr-confirm" class="btn-primary">Confirmar</button>
          <button id="tr-cancel" class="btn ghost">Cancelar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('tr-cancel').addEventListener('click', () => modal.remove());
  document.getElementById('tr-confirm').addEventListener('click', () => {
    const fromId = document.getElementById('tr-from').value;
    const toId = document.getElementById('tr-to').value;
    const amount = Number(document.getElementById('tr-amount').value || 0);
    
    if(!amount || amount <= 0) return alert('Valor inválido para transferência.');
    if(fromId === toId) return alert('A conta de origem e destino não podem ser iguais.');
    
    const fromAcc = state.accounts.find(a => a.id === fromId);
    const toAcc = state.accounts.find(a => a.id === toId);
    
    if(!fromAcc || !toAcc) return alert('Contas não encontradas.');
    if(Number(fromAcc.saldo || 0) < amount){
      if(!confirm(`O saldo de ${fromAcc.name} (${money(fromAcc.saldo)}) é insuficiente. Deseja permitir que fique negativo?`)) return;
    }
    
    fromAcc.saldo -= amount;
    toAcc.saldo += amount;
    saveState();
    updateAll();
    alert(`Sucesso! Foram transferidos ${money(amount)} de ${fromAcc.name} para ${toAcc.name}.`);
    modal.remove();
  });
}

function addStoreExpense(desc, amount, accId) {
  amount = Number(amount || 0);
  if(!amount || amount <= 0 || !desc) return alert('Valor ou descrição inválidos.');
  
  const acc = state.accounts.find(a=>a.id===accId);
  if(!acc) return alert('Conta não encontrada.');

  if(Number(acc.saldo || 0) < amount){
    if(!confirm(`O saldo da conta ${acc.name} é ${money(acc.saldo)}. A conta ficará negativa. Queres continuar?`)) return;
  }

  acc.saldo = Number(acc.saldo || 0) - amount;

  // ADAPTAÇÃO GENÉRICA: Grava exclusivamente no storeExpenses (Fundo de Reinvestimento)
  const exp = {
    id: 'imp3d-desp-' + Date.now().toString(),
    date: todayISO(),
    desc: desc,
    amount: amount,
    accountId: accId
  };

  state.storeExpenses.push(exp);
  saveState();
  updateAll();
  alert(`A despesa "${desc}" no valor de ${money(amount)} foi registada com sucesso na conta ${acc.name}.`);
}

function openStoreExpenseForm() {
  const existing = document.getElementById('imp3d-expense-modal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'imp3d-expense-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.background = 'rgba(0,0,0,0.85)';
  modal.style.zIndex = '9999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.padding = '20px';

  let accOptions = state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

  modal.innerHTML = `
    <div class="glass-card" style="width:100%; max-width:420px; padding:30px; border:1px solid rgba(255,255,255,0.15); box-shadow:0 25px 50px -12px rgba(0,0,0,0.8); animation: slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
      <h3 style="font-size:1.25rem; font-weight:800; color:#fff; display:flex; align-items:center; gap:10px; margin-bottom:6px;">
        <div style="background:rgba(245,158,11,0.15); color:#f59e0b; padding:8px; border-radius:10px; display:flex;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
        Lançar Despesa da Loja
      </h3>
      <p style="font-size:0.85rem; color:#94a3b8; margin-bottom:24px; line-height:1.5;">Desconte pagamentos de fornecedores, insumos ou peças. Este valor será deduzido do seu Fundo de Reinvestimento e da sua conta física.</p>
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:0.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Descrição do Documento</label>
          <input type="text" id="se-desc" placeholder="Ex: Filamento PETG Preto Voolt3D" style="padding:14px; background:rgba(2,6,23,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff;">
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:0.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Valor Pago (R$)</label>
          <input type="number" step="0.01" id="se-amount" placeholder="0.00" style="padding:14px; background:rgba(2,6,23,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff; font-size:1.1rem; font-weight:700;">
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:0.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase;">Conta Deduzida</label>
          <select id="se-acc" style="padding:14px; background:rgba(2,6,23,0.8); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff;">${accOptions}</select>
        </div>
        <div style="display:flex; gap:10px; margin-top:12px;">
          <button id="se-cancel" class="btn ghost" style="flex:1; border-radius:12px; padding:14px;">Cancelar</button>
          <button id="se-confirm" class="btn-primary" style="flex:1.5; border-radius:12px; padding:14px; background:linear-gradient(135deg, #f59e0b, #d97706); border-color:rgba(245,158,11,0.5); box-shadow:0 8px 20px rgba(245,158,11,0.2);">Confirmar Saída</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('se-cancel').addEventListener('click', () => modal.remove());
  document.getElementById('se-confirm').addEventListener('click', () => {
    const desc = document.getElementById('se-desc').value.trim();
    const amount = Number(document.getElementById('se-amount').value || 0);
    const accId = document.getElementById('se-acc').value;
    if(!desc || amount <= 0) return alert('Preenche uma descrição e um valor superior a zero.');
    addStoreExpense(desc, amount, accId);
    modal.remove();
  });
}

/* ========================================================
                       Gerais da 3D:
   ======================================================== */

function imp3dExport(){
  const data = {
    settings: state.settings,
    accounts: state.accounts,
    filaments: state.filaments,
    products: state.products,
    impSales: state.impSales,
    impLosses: state.impLosses,
    impStock: state.impStock,
    storeExpenses: state.storeExpenses
  };
  const blob = new Blob([JSON.stringify(data)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gestor-imp3d-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function imp3dClearAll(){
  if(!confirm('Atenção: Tem certeza que deseja LIMPAR TODOS os dados da loja (Estoque, produtos, vendas, perdas, despesas)? Os saldos das contas também voltarão a zero.')) return;
  state.filaments = []; 
  state.products = []; 
  state.impSales = []; 
  state.impLosses = []; 
  state.impStock = []; 
  state.storeExpenses = [];
  state.accounts.forEach(a => a.saldo = 0);
  saveState(); 
  updateAll();
}

function handleImpRefund(saleId) {
  if (!confirm('Deseja realmente processar o REEMBOLSO desta venda?\n\n- O valor recebido será retirado da sua conta na loja.\n- A entrada e o lucro serão anulados.\n- O custo total da peça será lançado como PREJUÍZO.')) return;

  const saleIdx = state.impSales.findIndex(s => s.id === saleId);
  if (saleIdx === -1) return;
  const sale = state.impSales[saleIdx];

  // ADAPTAÇÃO GENÉRICA: Apenas debita o saldo direto da conta que havia recebido
  const accSale = state.accounts.find(a => a.id === sale.accountId);
  if (accSale) {
    accSale.saldo = Number(accSale.saldo || 0) - Number(sale.netReceived || 0);
  }

  // Pega todo o custo operacional da peça e lança nas Perdas
  const totalCost = Number(sale.materialCost || 0) + Number(sale.hourlyCost || 0) + Number(sale.packagingCost || 0);
  const prodName = state.products.find(p => p.id === sale.productId)?.name || 'Produto Reembolsado';
  
  state.impLosses.push({
    id: 'loss-refund-' + Date.now().toString(),
    date: todayISO(),
    filamentId: sale.filamentId,
    grams: 0, // Como já temos o custo exato da venda original, não precisamos calcular por peso
    cost: totalCost,
    reason: `Reembolso / Devolução: ${prodName}`,
    mode: 'perda'
  });

  // Exclui a venda do histórico de receitas
  state.impSales.splice(saleIdx, 1);

  saveState();
  updateAll();
  alert('Reembolso concluído. A venda foi anulada e os custos da peça foram movidos para o seu quadro de Perdas/Prejuízos.');
}