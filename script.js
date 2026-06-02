/* =====================================================
   CAIXA FORTE — SCRIPT PRINCIPAL
   Controle de Contas a Pagar, Receber e Previsão
   ===================================================== */

'use strict';

// =====================================================
// 1. ESTADO GLOBAL (carregado do localStorage)
// =====================================================

let estado = {
  saldo: null,           // null = não configurado ainda
  pagar: [],             // { id, nome, valor, vencimento, tipo, status, criadoEm }
  receber: [],           // { id, nome, valor, descricao, dataPrevisao, status, criadoEm }
  potes: {               // percentuais dos potes (editáveis)
    'Despesas Fixas':   35,
    'Despesas Variáveis': 15,
    'Investimentos':    20,
    'Lazer':            10,
    'Doação':           5,
    'Sonhos':           15,
  },
  sonhos: [],            // { id, nome, valorTotal, valorGuardado, imagemUrl }
};

// =====================================================
// 2. PERSISTÊNCIA
// =====================================================

function salvarEstado() {
  localStorage.setItem('caixaForte_v1', JSON.stringify(estado));
}

function carregarEstado() {
  const raw = localStorage.getItem('caixaForte_v1');
  if (raw) {
    try {
      const salvo = JSON.parse(raw);
      // Merge profundo para não perder novos campos
      estado = { ...estado, ...salvo };
      // Garantir potes completos
      estado.potes = { ...estado.potes, ...salvo.potes };
    } catch (e) {
      console.error('Erro ao carregar estado:', e);
    }
  }
}

// =====================================================
// 3. UTILITÁRIOS
// =====================================================

/** Gera um ID único simples */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Formata número como moeda BRL */
function moeda(valor) {
  return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formata data DD/MM/AAAA */
function fmtData(str) {
  if (!str) return '—';
  // str pode ser 'AAAA-MM-DD' (do input date)
  const [a, m, d] = str.split('-');
  return `${d}/${m}/${a}`;
}

/** Retorna data local como string 'AAAA-MM-DD' */
function hoje() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Diferença em dias entre data string e hoje (positivo = futuro) */
function diasAteVencimento(str) {
  const agora = new Date(); agora.setHours(0,0,0,0);
  const alvo  = new Date(str + 'T00:00:00');
  return Math.round((alvo - agora) / 86400000);
}

/** Adiciona N dias a uma string 'AAAA-MM-DD' e retorna nova string */
function addDias(str, n) {
  const d = new Date(str + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Retorna array de strings 'AAAA-MM-DD' dos próximos N dias (incluindo hoje) */
function proximosDias(n) {
  return Array.from({ length: n }, (_, i) => addDias(hoje(), i));
}

/** Nome do dia da semana em pt */
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function nomeDia(str) {
  const d = new Date(str + 'T00:00:00');
  return DIAS_SEMANA[d.getDay()];
}

/** Detecta se um item de pagar está vencido */
function estaVencido(item) {
  return item.status === 'pendente' && diasAteVencimento(item.vencimento) < 0;
}

// =====================================================
// 4. CÁLCULOS FINANCEIROS
// =====================================================

/** Soma de todos os itens pendentes de pagar */
function totalPagar() {
  return estado.pagar
    .filter(i => i.status === 'pendente')
    .reduce((s, i) => s + Number(i.valor), 0);
}

/** Soma de todos os itens pendentes de receber */
function totalReceber() {
  return estado.receber
    .filter(i => i.status === 'pendente')
    .reduce((s, i) => s + Number(i.valor), 0);
}

/** Saldo projetado = saldo atual - a pagar pendente + a receber pendente */
function saldoProjetado() {
  return (estado.saldo || 0) - totalPagar() + totalReceber();
}

/**
 * Gera a linha do tempo de previsão:
 * Ordena todas as movimentações (pagar + receber) por data
 * e simula o saldo dia a dia.
 */
function gerarPrevisao() {
  const movimentos = [];

  estado.pagar.filter(i => i.status === 'pendente').forEach(i => {
    movimentos.push({
      data: i.vencimento,
      descricao: i.nome,
      valor: -Number(i.valor),
      tipo: 'saida',
    });
  });

  estado.receber.filter(i => i.status === 'pendente').forEach(i => {
    movimentos.push({
      data: i.dataPrevisao,
      descricao: `Receb. de ${i.nome}`,
      valor: +Number(i.valor),
      tipo: 'entrada',
    });
  });

  movimentos.sort((a, b) => a.data.localeCompare(b.data));

  let saldoCorrente = estado.saldo || 0;
  return movimentos.map(m => {
    saldoCorrente += m.valor;
    return { ...m, saldoApos: saldoCorrente };
  });
}

// =====================================================
// 5. NAVEGAÇÃO
// =====================================================

function navegarPara(secao) {
  // Desativa todos
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  // Ativa a seção correta
  const secEl = document.getElementById(`section-${secao}`);
  if (secEl) secEl.classList.add('active');

  const navEl = document.querySelector(`.nav-link[data-section="${secao}"]`);
  if (navEl) navEl.classList.add('active');

  // Fecha sidebar no mobile
  document.getElementById('sidebar').classList.remove('open');

  // Renderiza a seção
  renderizarSecao(secao);
}

function renderizarSecao(secao) {
  switch (secao) {
    case 'dashboard': renderDashboard(); break;
    case 'pagar':     renderPagar();     break;
    case 'receber':   renderReceber();   break;
    case 'previsao':  renderPrevisao();  break;
    case 'potes':     renderPotes();     break;
    case 'sonhos':    renderSonhos();    break;
  }
}

// =====================================================
// 6. RENDER: DASHBOARD
// =====================================================

function renderDashboard() {
  // Atualiza cards
  const saldoEl    = document.getElementById('dash-saldo');
  const pagarEl    = document.getElementById('dash-pagar');
  const receberEl  = document.getElementById('dash-receber');
  const projetEl   = document.getElementById('dash-projetado');
  const sidebarEl  = document.getElementById('sidebar-saldo');
  const labelEl    = document.getElementById('hoje-label');

  const sp = saldoProjetado();

  saldoEl.textContent    = moeda(estado.saldo);
  pagarEl.textContent    = moeda(totalPagar());
  receberEl.textContent  = moeda(totalReceber());
  projetEl.textContent   = moeda(sp);
  sidebarEl.textContent  = moeda(estado.saldo);

  // Cor do projetado
  const cardProjEl = document.querySelector('.card-projetado');
  if (sp < 0) {
    projetEl.style.color = 'var(--red)';
    cardProjEl.style.borderColor = 'var(--red)';
  } else {
    projetEl.style.color = 'var(--amber)';
    cardProjEl.style.borderColor = 'var(--border)';
  }

  // Data de hoje
  const d = new Date();
  labelEl.textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Alertas
  renderAlertas();

  // Timeline 7 dias
  renderTimeline7Dias();
}

function renderAlertas() {
  const container = document.getElementById('alertas-container');
  container.innerHTML = '';

  const alertas = [];

  // Saldo negativo atual
  if ((estado.saldo || 0) < 0) {
    alertas.push({ tipo: 'danger', icon: '⚠', titulo: 'Saldo Negativo!', msg: `Seu saldo atual está negativo: ${moeda(estado.saldo)}.` });
  }

  // Saldo projetado negativo
  const sp = saldoProjetado();
  if (sp < 0 && (estado.saldo || 0) >= 0) {
    alertas.push({ tipo: 'warning', icon: '◉', titulo: 'Saldo Projetado Negativo', msg: `Considerando tudo que falta pagar e receber, seu saldo ficará em ${moeda(sp)}.` });
  }

  // Contas vencidas
  const vencidas = estado.pagar.filter(i => estaVencido(i));
  if (vencidas.length > 0) {
    alertas.push({ tipo: 'danger', icon: '✕', titulo: `${vencidas.length} conta(s) vencida(s)`, msg: vencidas.map(i => `${i.nome} (${fmtData(i.vencimento)})`).join(', ') });
  }

  // Contas vencendo em até 2 dias
  const urgentes = estado.pagar.filter(i => {
    if (i.status !== 'pendente') return false;
    const dias = diasAteVencimento(i.vencimento);
    return dias >= 0 && dias <= 2;
  });
  if (urgentes.length > 0) {
    alertas.push({ tipo: 'warning', icon: '⏰', titulo: 'Vencendo em breve', msg: urgentes.map(i => {
      const d = diasAteVencimento(i.vencimento);
      const quando = d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `Em ${d} dias`;
      return `${i.nome} — ${quando} (${moeda(i.valor)})`;
    }).join(' | ') });
  }

  // Itens a receber atrasados que impactam contas
  const receberAtrasados = estado.receber.filter(i => {
    return i.status === 'pendente' && diasAteVencimento(i.dataPrevisao) < 0;
  });
  if (receberAtrasados.length > 0) {
    alertas.push({ tipo: 'info', icon: '↓', titulo: 'Recebimentos atrasados', msg: `${receberAtrasados.length} valor(es) ainda não recebido(s) que podem impactar seu fluxo.` });
  }

  // Nenhum alerta
  if (alertas.length === 0) {
    alertas.push({ tipo: 'success', icon: '✓', titulo: 'Tudo sob controle', msg: 'Nenhum alerta financeiro no momento. Continue assim!' });
  }

  alertas.forEach(a => {
    const div = document.createElement('div');
    div.className = `alerta alerta-${a.tipo}`;
    div.innerHTML = `
      <span class="alerta-icon">${a.icon}</span>
      <div class="alerta-text"><strong>${a.titulo}</strong>${a.msg}</div>
    `;
    container.appendChild(div);
  });
}

function renderTimeline7Dias() {
  const container = document.getElementById('timeline-7dias');
  container.innerHTML = '';
  const dias = proximosDias(7);

  dias.forEach(data => {
    // Itens de pagar nessa data
    const saidas = estado.pagar.filter(i => i.vencimento === data && i.status === 'pendente');
    // Itens de receber nessa data
    const entradas = estado.receber.filter(i => i.dataPrevisao === data && i.status === 'pendente');

    const isHoje = data === hoje();
    const labelClasse = isHoje ? 'hoje' : (data < hoje() ? 'vencido' : '');

    const div = document.createElement('div');
    div.className = 'timeline-dia';

    // Saldo acumulado até esse dia (simples)
    const prevRows = gerarPrevisao().filter(r => r.data <= data);
    const saldoDia = prevRows.length > 0
      ? prevRows[prevRows.length - 1].saldoApos
      : (estado.saldo || 0);
    const saldoCor = saldoDia < 0 ? 'var(--red)' : 'var(--green)';

    div.innerHTML = `
      <div class="timeline-dia-header">
        <span class="timeline-dia-label ${labelClasse}">
          ${nomeDia(data)}, ${fmtData(data)}${isHoje ? ' — Hoje' : ''}
        </span>
        <span class="timeline-dia-saldo" style="color:${saldoCor}">${moeda(saldoDia)}</span>
      </div>
      <div class="timeline-dia-body" id="tl-body-${data}"></div>
    `;
    container.appendChild(div);

    const body = document.getElementById(`tl-body-${data}`);

    if (saidas.length === 0 && entradas.length === 0) {
      body.innerHTML = `<span class="timeline-vazio">Nenhuma movimentação</span>`;
    }

    saidas.forEach(i => {
      const row = document.createElement('div');
      row.className = 'timeline-item';
      row.innerHTML = `
        <span class="timeline-item-dot saida"></span>
        <span class="timeline-item-nome">${i.nome}</span>
        <span class="timeline-item-valor saida">−${moeda(i.valor)}</span>
      `;
      body.appendChild(row);
    });

    entradas.forEach(i => {
      const row = document.createElement('div');
      row.className = 'timeline-item';
      row.innerHTML = `
        <span class="timeline-item-dot entrada"></span>
        <span class="timeline-item-nome">${i.descricao || i.nome}</span>
        <span class="timeline-item-valor entrada">+${moeda(i.valor)}</span>
      `;
      body.appendChild(row);
    });
  });
}

// =====================================================
// 7. RENDER: A PAGAR
// =====================================================

let filtroAtualPagar = 'todos';

function renderPagar() {
  const container = document.getElementById('lista-pagar');
  container.innerHTML = '';

  let itens = [...estado.pagar].sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  if (filtroAtualPagar === 'pendente') itens = itens.filter(i => i.status === 'pendente');
  if (filtroAtualPagar === 'pago')    itens = itens.filter(i => i.status === 'pago');

  if (itens.length === 0) {
    container.innerHTML = `<div class="empty-state">Nenhuma conta encontrada. Adicione uma!</div>`;
    return;
  }

  itens.forEach(item => {
    const vencido = estaVencido(item);
    const dias = diasAteVencimento(item.vencimento);

    let dotClasse = item.status === 'pago' ? 'pago' : (vencido ? 'vencido' : 'pendente');
    let metaTexto = `${fmtData(item.vencimento)} · ${item.tipo}`;
    if (item.status === 'pendente') {
      if (vencido) metaTexto += ` · Vencida há ${Math.abs(dias)} dia(s)`;
      else if (dias === 0) metaTexto += ' · Vence hoje!';
      else if (dias <= 2) metaTexto += ` · Vence em ${dias} dia(s)`;
    } else {
      metaTexto += ' · Paga';
    }

    const div = document.createElement('div');
    div.className = `lista-item ${item.status}`;
    div.innerHTML = `
      <span class="item-status-dot ${dotClasse}"></span>
      <div class="item-info">
        <div class="item-nome">${item.nome}</div>
        <div class="item-meta">${metaTexto}</div>
      </div>
      <span class="item-valor text-red">−${moeda(item.valor)}</span>
      <div class="item-actions">
        ${item.status === 'pendente' ? `<button class="btn-icon btn-pagar" data-id="${item.id}" title="Marcar como pago">✓ Pagar</button>` : `<button class="btn-icon" data-undo-pagar="${item.id}" title="Desfazer">↩ Desfazer</button>`}
        <button class="btn-icon" data-edit-pagar="${item.id}" title="Editar">✎</button>
        <button class="btn-icon btn-del" data-del-pagar="${item.id}" title="Excluir">✕</button>
      </div>
    `;
    container.appendChild(div);
  });

  // Eventos dinâmicos
  container.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => marcarPago(btn.dataset.id));
  });
  container.querySelectorAll('[data-undo-pagar]').forEach(btn => {
    btn.addEventListener('click', () => desfazerPago(btn.dataset.undoPagar));
  });
  container.querySelectorAll('[data-edit-pagar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalPagar(btn.dataset.editPagar));
  });
  container.querySelectorAll('[data-del-pagar]').forEach(btn => {
    btn.addEventListener('click', () => deletarPagar(btn.dataset.delPagar));
  });
}

function marcarPago(id) {
  const item = estado.pagar.find(i => i.id === id);
  if (item) {
    item.status = 'pago';
    salvarEstado();
    renderPagar();
    atualizarSidebar();
  }
}

function desfazerPago(id) {
  const item = estado.pagar.find(i => i.id === id);
  if (item) {
    item.status = 'pendente';
    salvarEstado();
    renderPagar();
    atualizarSidebar();
  }
}

function deletarPagar(id) {
  if (!confirm('Excluir esta conta?')) return;
  estado.pagar = estado.pagar.filter(i => i.id !== id);
  salvarEstado();
  renderPagar();
  atualizarSidebar();
}

// =====================================================
// 8. RENDER: A RECEBER
// =====================================================

let filtroAtualReceber = 'todos';

function renderReceber() {
  const container = document.getElementById('lista-receber');
  container.innerHTML = '';

  let itens = [...estado.receber].sort((a, b) => a.dataPrevisao.localeCompare(b.dataPrevisao));

  if (filtroAtualReceber === 'pendente')  itens = itens.filter(i => i.status === 'pendente');
  if (filtroAtualReceber === 'recebido') itens = itens.filter(i => i.status === 'recebido');

  if (itens.length === 0) {
    container.innerHTML = `<div class="empty-state">Nenhum valor cadastrado. Adicione um!</div>`;
    return;
  }

  itens.forEach(item => {
    const atrasado = item.status === 'pendente' && diasAteVencimento(item.dataPrevisao) < 0;
    let dotClasse = item.status === 'recebido' ? 'recebido' : (atrasado ? 'vencido' : 'pendente');
    let metaTexto = `${item.nome} · Prev. ${fmtData(item.dataPrevisao)}`;
    if (item.descricao) metaTexto += ` · ${item.descricao}`;
    if (atrasado) metaTexto += ' · Atrasado!';

    const div = document.createElement('div');
    div.className = `lista-item ${item.status}`;
    div.innerHTML = `
      <span class="item-status-dot ${dotClasse}"></span>
      <div class="item-info">
        <div class="item-nome">${item.nome}</div>
        <div class="item-meta">${metaTexto}</div>
      </div>
      <span class="item-valor text-blue">+${moeda(item.valor)}</span>
      <div class="item-actions">
        ${item.status === 'pendente'
          ? `<button class="btn-icon btn-receber-ok" data-rec="${item.id}" title="Marcar como recebido">✓ Recebido</button>`
          : `<button class="btn-icon" data-undo-rec="${item.id}">↩ Desfazer</button>`}
        <button class="btn-icon" data-edit-rec="${item.id}" title="Editar">✎</button>
        <button class="btn-icon btn-del" data-del-rec="${item.id}" title="Excluir">✕</button>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('[data-rec]').forEach(btn => {
    btn.addEventListener('click', () => marcarRecebido(btn.dataset.rec));
  });
  container.querySelectorAll('[data-undo-rec]').forEach(btn => {
    btn.addEventListener('click', () => desfazerRecebido(btn.dataset.undoRec));
  });
  container.querySelectorAll('[data-edit-rec]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalReceber(btn.dataset.editRec));
  });
  container.querySelectorAll('[data-del-rec]').forEach(btn => {
    btn.addEventListener('click', () => deletarReceber(btn.dataset.delRec));
  });
}

function marcarRecebido(id) {
  const item = estado.receber.find(i => i.id === id);
  if (item) {
    item.status = 'recebido';
    // Adiciona ao saldo
    estado.saldo = (estado.saldo || 0) + Number(item.valor);
    salvarEstado();
    renderReceber();
    atualizarSidebar();
  }
}

function desfazerRecebido(id) {
  const item = estado.receber.find(i => i.id === id);
  if (item) {
    item.status = 'pendente';
    estado.saldo = (estado.saldo || 0) - Number(item.valor);
    salvarEstado();
    renderReceber();
    atualizarSidebar();
  }
}

function deletarReceber(id) {
  if (!confirm('Excluir este recebimento?')) return;
  estado.receber = estado.receber.filter(i => i.id !== id);
  salvarEstado();
  renderReceber();
  atualizarSidebar();
}

// =====================================================
// 9. RENDER: PREVISÃO
// =====================================================

function renderPrevisao() {
  const previsao = gerarPrevisao();
  const alertaEl = document.getElementById('previsao-alerta');
  const timelineEl = document.getElementById('previsao-timeline');

  // Alerta geral
  const negativos = previsao.filter(r => r.saldoApos < 0);
  if (negativos.length > 0) {
    const pior = negativos.reduce((a, b) => a.saldoApos < b.saldoApos ? a : b);
    alertaEl.innerHTML = `
      <div class="alerta alerta-danger">
        <span class="alerta-icon">⚠</span>
        <div class="alerta-text">
          <strong>Atenção: saldo negativo previsto!</strong>
          Em ${fmtData(pior.data)}, após "${pior.descricao}", seu saldo chegará a ${moeda(pior.saldoApos)}.
        </div>
      </div>
    `;
  } else {
    alertaEl.innerHTML = `
      <div class="alerta alerta-success">
        <span class="alerta-icon">✓</span>
        <div class="alerta-text">
          <strong>Fluxo saudável</strong>
          Não há previsão de saldo negativo com os lançamentos cadastrados.
        </div>
      </div>
    `;
  }

  // Tabela de previsão
  if (previsao.length === 0) {
    timelineEl.innerHTML = `<div class="empty-state">Nenhuma movimentação futura cadastrada.</div>`;
    return;
  }

  let html = `
    <div class="previsao-row header">
      <span class="previsao-data">Data</span>
      <span class="previsao-desc">Descrição</span>
      <span class="previsao-valor">Valor</span>
      <span class="previsao-saldo previsao-col-saldo">Saldo após</span>
    </div>
  `;

  previsao.forEach(row => {
    const negativo = row.saldoApos < 0;
    html += `
      <div class="previsao-row ${negativo ? 'negativo' : ''}">
        <span class="previsao-data">${fmtData(row.data)}</span>
        <span class="previsao-desc">${row.descricao}</span>
        <span class="previsao-valor ${row.valor > 0 ? 'pos' : 'neg'}">${row.valor > 0 ? '+' : ''}${moeda(Math.abs(row.valor))}</span>
        <span class="previsao-saldo">${moeda(row.saldoApos)}</span>
      </div>
    `;
  });

  timelineEl.innerHTML = html;
}

// =====================================================
// 10. RENDER: POTES
// =====================================================

function renderPotes() {
  const grid = document.getElementById('potes-grid');
  grid.innerHTML = '';

  const saldoBase = estado.saldo || 0;
  const totalPct = Object.values(estado.potes).reduce((s, v) => s + v, 0);

  Object.entries(estado.potes).forEach(([nome, pct]) => {
    const valorPote = saldoBase * (pct / 100);

    const card = document.createElement('div');
    card.className = 'pote-card';
    card.innerHTML = `
      <div class="pote-header">
        <span class="pote-nome">${nome}</span>
        <input type="number" class="pote-pct-input" data-pote="${nome}"
          value="${pct}" min="0" max="100" step="1" title="Percentual (%)"> %
      </div>
      <div class="pote-valor">${moeda(valorPote)}</div>
      <div class="pote-bar-bg">
        <div class="pote-bar-fill" style="width:${Math.min(pct, 100)}%"></div>
      </div>
    `;

    // Listener para editar o percentual
    card.querySelector('.pote-pct-input').addEventListener('change', function () {
      const novoPct = Math.max(0, Math.min(100, Number(this.value)));
      estado.potes[nome] = novoPct;
      salvarEstado();
      renderPotes();
    });

    grid.appendChild(card);
  });

  // Aviso se total != 100
  if (Math.round(totalPct) !== 100) {
    const aviso = document.createElement('div');
    aviso.className = 'alerta alerta-warning';
    aviso.style.gridColumn = '1/-1';
    aviso.innerHTML = `
      <span class="alerta-icon">◉</span>
      <div class="alerta-text"><strong>Percentuais somam ${totalPct}%</strong>
      Ajuste os potes para que totalizem 100%.</div>
    `;
    grid.insertBefore(aviso, grid.firstChild);
  }
}

// =====================================================
// 11. RENDER: SONHOS
// =====================================================

function renderSonhos() {
  const container = document.getElementById('lista-sonhos');
  container.innerHTML = '';

  if (estado.sonhos.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Nenhum sonho cadastrado ainda. Adicione o primeiro!</div>`;
    return;
  }

  estado.sonhos.forEach(sonho => {
    const pct = sonho.valorTotal > 0
      ? Math.min(100, (sonho.valorGuardado / sonho.valorTotal) * 100)
      : 0;
    const restante = Math.max(0, sonho.valorTotal - sonho.valorGuardado);

    const card = document.createElement('div');
    card.className = 'sonho-card';

    const imgHtml = sonho.imagemUrl
      ? `<img class="sonho-img" src="${sonho.imagemUrl}" alt="${sonho.nome}" onerror="this.style.display='none'">`
      : `<div class="sonho-img-placeholder">★</div>`;

    card.innerHTML = `
      ${imgHtml}
      <div class="sonho-body">
        <div class="sonho-nome">${sonho.nome}</div>
        <div class="sonho-meta">
          Guardado: ${moeda(sonho.valorGuardado)} / Meta: ${moeda(sonho.valorTotal)}<br>
          Restante: ${moeda(restante)}
        </div>
        <div class="sonho-progress-bg">
          <div class="sonho-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="sonho-pct">${pct.toFixed(1)}% concluído</div>
        <div class="sonho-actions">
          <button class="btn-icon" data-edit-sonho="${sonho.id}">✎ Editar</button>
          <button class="btn-icon btn-del" data-del-sonho="${sonho.id}">✕ Excluir</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('[data-edit-sonho]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalSonho(btn.dataset.editSonho));
  });
  container.querySelectorAll('[data-del-sonho]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Excluir este sonho?')) return;
      estado.sonhos = estado.sonhos.filter(s => s.id !== btn.dataset.delSonho);
      salvarEstado();
      renderSonhos();
    });
  });
}

// =====================================================
// 12. MODAIS DE FORMULÁRIO
// =====================================================

let modalCallback = null; // Função a ser chamada ao salvar

function abrirModal(titulo, htmlContent, onSave) {
  document.getElementById('modal-title').textContent = titulo;
  document.getElementById('modal-form-content').innerHTML = htmlContent;
  document.getElementById('form-modal').style.display = 'flex';
  modalCallback = onSave;
}

function fecharModal() {
  document.getElementById('form-modal').style.display = 'none';
  modalCallback = null;
}

// ---- MODAL: PAGAR ----
function abrirModalPagar(id) {
  const item = id ? estado.pagar.find(i => i.id === id) : null;

  const html = `
    <div class="input-group">
      <label>Nome da conta</label>
      <input type="text" id="f-nome" placeholder="Ex: Aluguel, Netflix..." value="${item ? item.nome : ''}" />
    </div>
    <div class="input-group">
      <label>Valor (R$)</label>
      <input type="number" id="f-valor" placeholder="0,00" step="0.01" min="0" value="${item ? item.valor : ''}" />
    </div>
    <div class="input-group">
      <label>Data de vencimento</label>
      <input type="date" id="f-venc" value="${item ? item.vencimento : hoje()}" />
    </div>
    <div class="input-group">
      <label>Tipo</label>
      <select id="f-tipo">
        <option value="fixa"     ${item && item.tipo === 'fixa'     ? 'selected' : ''}>Fixa</option>
        <option value="variável" ${item && item.tipo === 'variável' ? 'selected' : ''}>Variável</option>
      </select>
    </div>
  `;

  abrirModal(item ? 'Editar Conta' : 'Nova Conta a Pagar', html, () => {
    const nome  = document.getElementById('f-nome').value.trim();
    const valor = parseFloat(document.getElementById('f-valor').value);
    const venc  = document.getElementById('f-venc').value;
    const tipo  = document.getElementById('f-tipo').value;

    if (!nome || isNaN(valor) || !venc) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    if (item) {
      Object.assign(item, { nome, valor, vencimento: venc, tipo });
    } else {
      estado.pagar.push({ id: uid(), nome, valor, vencimento: venc, tipo, status: 'pendente', criadoEm: new Date().toISOString() });
    }

    salvarEstado();
    fecharModal();
    renderPagar();
    atualizarSidebar();
  });
}

// ---- MODAL: RECEBER ----
function abrirModalReceber(id) {
  const item = id ? estado.receber.find(i => i.id === id) : null;

  const html = `
    <div class="input-group">
      <label>Nome de quem vai pagar</label>
      <input type="text" id="f-nome" placeholder="Ex: João, Empresa XYZ..." value="${item ? item.nome : ''}" />
    </div>
    <div class="input-group">
      <label>Valor (R$)</label>
      <input type="number" id="f-valor" placeholder="0,00" step="0.01" min="0" value="${item ? item.valor : ''}" />
    </div>
    <div class="input-group">
      <label>Descrição</label>
      <input type="text" id="f-desc" placeholder="Ex: Freela, venda, dívida..." value="${item ? item.descricao : ''}" />
    </div>
    <div class="input-group">
      <label>Data prevista</label>
      <input type="date" id="f-data" value="${item ? item.dataPrevisao : hoje()}" />
    </div>
  `;

  abrirModal(item ? 'Editar Recebimento' : 'Novo Valor a Receber', html, () => {
    const nome  = document.getElementById('f-nome').value.trim();
    const valor = parseFloat(document.getElementById('f-valor').value);
    const desc  = document.getElementById('f-desc').value.trim();
    const data  = document.getElementById('f-data').value;

    if (!nome || isNaN(valor) || !data) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    if (item) {
      Object.assign(item, { nome, valor, descricao: desc, dataPrevisao: data });
    } else {
      estado.receber.push({ id: uid(), nome, valor, descricao: desc, dataPrevisao: data, status: 'pendente', criadoEm: new Date().toISOString() });
    }

    salvarEstado();
    fecharModal();
    renderReceber();
    atualizarSidebar();
  });
}

// ---- MODAL: SONHO ----
function abrirModalSonho(id) {
  const item = id ? estado.sonhos.find(s => s.id === id) : null;

  const html = `
    <div class="input-group">
      <label>Nome do objetivo</label>
      <input type="text" id="f-nome" placeholder="Ex: Viagem, Carro novo..." value="${item ? item.nome : ''}" />
    </div>
    <div class="input-group">
      <label>Valor total necessário (R$)</label>
      <input type="number" id="f-total" placeholder="0,00" step="0.01" min="0" value="${item ? item.valorTotal : ''}" />
    </div>
    <div class="input-group">
      <label>Valor já guardado (R$)</label>
      <input type="number" id="f-guardado" placeholder="0,00" step="0.01" min="0" value="${item ? item.valorGuardado : '0'}" />
    </div>
    <div class="input-group">
      <label>URL da imagem (opcional)</label>
      <input type="url" id="f-img" placeholder="https://..." value="${item ? item.imagemUrl || '' : ''}" />
    </div>
  `;

  abrirModal(item ? 'Editar Sonho' : 'Novo Sonho / Objetivo', html, () => {
    const nome     = document.getElementById('f-nome').value.trim();
    const total    = parseFloat(document.getElementById('f-total').value);
    const guardado = parseFloat(document.getElementById('f-guardado').value) || 0;
    const imgUrl   = document.getElementById('f-img').value.trim();

    if (!nome || isNaN(total)) {
      alert('Preencha nome e valor total.');
      return;
    }

    if (item) {
      Object.assign(item, { nome, valorTotal: total, valorGuardado: guardado, imagemUrl: imgUrl });
    } else {
      estado.sonhos.push({ id: uid(), nome, valorTotal: total, valorGuardado: guardado, imagemUrl: imgUrl });
    }

    salvarEstado();
    fecharModal();
    renderSonhos();
  });
}

// ---- MODAL: SALDO ----
function abrirModalSaldo() {
  const modalEl = document.getElementById('saldo-modal');
  const input   = document.getElementById('saldo-inicial-input');
  input.value   = estado.saldo !== null ? estado.saldo : '';
  modalEl.style.display = 'flex';
}

function fecharModalSaldo() {
  document.getElementById('saldo-modal').style.display = 'none';
}

// =====================================================
// 13. ATUALIZAR SIDEBAR
// =====================================================

function atualizarSidebar() {
  document.getElementById('sidebar-saldo').textContent = moeda(estado.saldo);
  // Também atualiza dashboard se estiver ativo
  if (document.getElementById('section-dashboard').classList.contains('active')) {
    renderDashboard();
  }
}

// =====================================================
// 14. INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  carregarEstado();

  // Mostrar modal de saldo inicial se nunca configurado
  if (estado.saldo === null) {
    document.getElementById('saldo-modal').style.display = 'flex';
  }

  // Navegação
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navegarPara(link.dataset.section);
    });
  });

  // Hamburger (mobile)
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Fecha sidebar ao clicar fora (mobile)
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !hamburger.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });

  // Botões de adicionar
  document.getElementById('btn-add-pagar').addEventListener('click', () => abrirModalPagar(null));
  document.getElementById('btn-add-receber').addEventListener('click', () => abrirModalReceber(null));
  document.getElementById('btn-add-sonho').addEventListener('click', () => abrirModalSonho(null));
  document.getElementById('btn-editar-saldo').addEventListener('click', abrirModalSaldo);

  // Modal genérico: fechar
  document.getElementById('modal-close').addEventListener('click', fecharModal);
  document.getElementById('modal-cancel').addEventListener('click', fecharModal);
  document.getElementById('form-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) fecharModal();
  });

  // Modal genérico: salvar
  document.getElementById('modal-save').addEventListener('click', () => {
    if (modalCallback) modalCallback();
  });

  // Modal saldo inicial
  document.getElementById('salvar-saldo-btn').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('saldo-inicial-input').value);
    if (isNaN(val)) { alert('Digite um valor válido.'); return; }
    estado.saldo = val;
    salvarEstado();
    fecharModalSaldo();
    atualizarSidebar();
    renderDashboard();
  });

  document.getElementById('saldo-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) fecharModalSaldo();
  });

  // Filtros A Pagar
  document.querySelectorAll('[data-filter-pagar]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-pagar]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroAtualPagar = btn.dataset.filterPagar;
      renderPagar();
    });
  });

  // Filtros A Receber
  document.querySelectorAll('[data-filter-receber]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-receber]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroAtualReceber = btn.dataset.filterReceber;
      renderReceber();
    });
  });

  // Render inicial
  navegarPara('dashboard');
});
