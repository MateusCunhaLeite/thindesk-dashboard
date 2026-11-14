// Testes da API usando o test runner nativo do Node (npm test)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { abrirBanco } = require('../src/db');
const { criarApp } = require('../src/app');

let servidor;
let base;

before(async () => {
  const db = abrirBanco(':memory:');
  servidor = criarApp(db).listen(0);
  await once(servidor, 'listening');
  base = `http://localhost:${servidor.address().port}/api`;
});

after(() => {
  servidor.closeAllConnections();
  servidor.close();
});

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(base + caminho, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });
  return { status: resposta.status, corpo: await resposta.json() };
}

test('indicadores somam corretamente', async () => {
  const { status, corpo } = await chamar('/dashboard/indicadores');
  assert.equal(status, 200);
  assert.ok(corpo.total > 0);
  assert.equal(corpo.pendentes + corpo.concluidos + corpo.cancelados, corpo.total);
  assert.equal(corpo.abertos + corpo.emAndamento + corpo.aguardando, corpo.pendentes);
});

test('filtro de status é aplicado nos indicadores', async () => {
  const { corpo } = await chamar('/dashboard/indicadores?status=cancelado');
  assert.equal(corpo.total, corpo.cancelados);
});

test('rejeita datas inválidas e período invertido', async () => {
  let r = await chamar('/dashboard/indicadores?inicio=2026-02-30');
  assert.equal(r.status, 400);

  r = await chamar('/dashboard/indicadores?inicio=2026-05-01&fim=2026-04-01');
  assert.equal(r.status, 400);
});

test('rejeita status desconhecido', async () => {
  const { status, corpo } = await chamar('/dashboard/por-status?status=xyz');
  assert.equal(status, 400);
  assert.match(corpo.erro, /status/);
});

test('por-periodo preenche os dias sem chamados', async () => {
  const { status, corpo } = await chamar('/dashboard/por-periodo?agrupamento=dia&inicio=2020-01-01&fim=2020-01-10');
  assert.equal(status, 200);
  // não existe chamado em 2020, então a API retorna lista vazia
  assert.deepEqual(corpo.dados, []);

  const hoje = new Date();
  const fim = hoje.toISOString().slice(0, 10);
  const inicio = new Date(hoje.getTime() - 13 * 86400000).toISOString().slice(0, 10);
  const recente = await chamar(`/dashboard/por-periodo?agrupamento=dia&inicio=${inicio}&fim=${fim}`);
  assert.ok(recente.corpo.dados.length >= 13);
});

test('por-status retorna todos os status, inclusive com zero', async () => {
  const { corpo } = await chamar('/dashboard/por-status');
  assert.equal(corpo.length, 6);
});

test('ranking de categorias vem ordenado por atendidos', async () => {
  const { corpo } = await chamar('/dashboard/por-categoria');
  for (let i = 1; i < corpo.length; i++) {
    assert.ok(corpo[i - 1].atendidos >= corpo[i].atendidos);
  }
});

test('listagem de chamados é paginada', async () => {
  const { corpo } = await chamar('/chamados?limite=5&pagina=2');
  assert.equal(corpo.dados.length, 5);
  assert.equal(corpo.pagina, 2);
  assert.equal(corpo.totalPaginas, Math.ceil(corpo.total / 5));
});

test('retorna 404 para chamado inexistente', async () => {
  const { status } = await chamar('/chamados/999999');
  assert.equal(status, 404);
});

test('fluxo de abertura, atualização e consideração', async () => {
  const novo = await chamar('/chamados', {
    method: 'POST',
    body: JSON.stringify({
      titulo: 'Teste automatizado',
      categoria_id: 1,
      prioridade: 'alta',
      solicitante: 'Fulano',
      setor: 'TI',
    }),
  });
  assert.equal(novo.status, 201);
  assert.equal(novo.corpo.status, 'aberto');

  const id = novo.corpo.id;

  const resolvido = await chamar(`/chamados/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'resolvido', tecnico_id: 1 }),
  });
  assert.equal(resolvido.status, 200);
  assert.ok(resolvido.corpo.data_fechamento, 'deveria preencher a data de fechamento');

  const reaberto = await chamar(`/chamados/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'em_andamento' }),
  });
  assert.equal(reaberto.corpo.data_fechamento, null);

  const vazia = await chamar(`/chamados/${id}/consideracoes`, {
    method: 'POST',
    body: JSON.stringify({ texto: '   ' }),
  });
  assert.equal(vazia.status, 400);

  const nota = await chamar(`/chamados/${id}/consideracoes`, {
    method: 'POST',
    body: JSON.stringify({ texto: 'Verificado com o usuário', tecnico_id: 1 }),
  });
  assert.equal(nota.status, 201);

  const detalhe = await chamar(`/chamados/${id}`);
  assert.equal(detalhe.corpo.consideracoes.length, 1);
});
