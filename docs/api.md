# Documentação da API

URL base: `http://localhost:3000/api`

Todas as respostas são em JSON. Em caso de erro, a resposta tem o formato:

```json
{ "erro": "Data inicial inválida. Use o formato AAAA-MM-DD" }
```

| Código | Quando acontece |
|--------|-----------------|
| 200 | Sucesso |
| 201 | Registro criado |
| 400 | Parâmetro ou corpo inválido |
| 404 | Chamado ou rota não encontrada |
| 500 | Erro inesperado no servidor |

## Filtros

Os endpoints de `/dashboard` e a listagem de `/chamados` aceitam os mesmos filtros pela query string.
Todos são opcionais e podem ser combinados.

| Parâmetro | Exemplo | Descrição |
|-----------|---------|-----------|
| `inicio` | `2026-08-01` | Data inicial (inclusive) |
| `fim` | `2026-08-31` | Data final (inclusive) |
| `status` | `aberto,em_andamento` | Um ou mais status separados por vírgula |
| `prioridade` | `alta,critica` | Uma ou mais prioridades |
| `categoria` | `3` | ID da categoria (tipo do chamado) |
| `tecnico` | `2` | ID do técnico |
| `setor` | `Financeiro` | Setor do solicitante |
| `busca` | `impressora` | Busca no título, solicitante ou número do chamado |

Valores possíveis:

- **status**: `aberto`, `em_andamento`, `aguardando`, `resolvido`, `fechado`, `cancelado`
- **prioridade**: `baixa`, `media`, `alta`, `critica`

O período é aplicado sobre a data de abertura. A exceção é a série "resolvidos" do `por-periodo`, que usa a data de fechamento.

---

## GET /opcoes

Valores para montar os filtros da tela.

```json
{
  "status": [{ "valor": "aberto", "label": "Aberto" }, ...],
  "prioridades": [{ "valor": "baixa", "label": "Baixa", "slaHoras": 72 }, ...],
  "setores": ["Comercial", "Diretoria", ...],
  "categorias": [{ "id": 1, "nome": "Acesso e senhas" }, ...],
  "tecnicos": [{ "id": 5, "nome": "Bruno Alves" }, ...],
  "periodo": { "inicio": "2026-05-17", "fim": "2026-11-13" }
}
```

## GET /dashboard/indicadores

```
GET /api/dashboard/indicadores?inicio=2026-08-16&fim=2026-11-13
```

```json
{
  "total": 249,
  "pendentes": 14,
  "abertos": 7,
  "emAndamento": 6,
  "aguardando": 1,
  "concluidos": 223,
  "resolvidos": 79,
  "fechados": 144,
  "cancelados": 12,
  "semTecnico": 3,
  "atrasados": 7,
  "taxaResolucao": 94.1,
  "percentualNoPrazo": 75.3,
  "tempoMedioResolucaoHoras": 26.4
}
```

- `taxaResolucao`: concluídos / (total - cancelados), em %
- `percentualNoPrazo`: % dos concluídos que foram resolvidos dentro do SLA
- `atrasados`: pendentes que já passaram do SLA
- `tempoMedioResolucaoHoras`: `null` quando não há chamados concluídos no filtro

## GET /dashboard/por-periodo

| Parâmetro | Valores | Padrão |
|-----------|---------|--------|
| `agrupamento` | `dia`, `semana`, `mes` | `dia` |

Na semana, o período é identificado pela data da segunda-feira. Períodos sem chamados vêm com zero.
O agrupamento por dia é limitado a 1 ano.

```
GET /api/dashboard/por-periodo?agrupamento=mes&inicio=2026-09-01&fim=2026-11-13
```

```json
{
  "agrupamento": "mes",
  "dados": [
    { "periodo": "2026-09", "abertos": 75, "resolvidos": 75 },
    { "periodo": "2026-10", "abertos": 92, "resolvidos": 83 },
    { "periodo": "2026-11", "abertos": 47, "resolvidos": 37 }
  ]
}
```

## GET /dashboard/por-status

Sempre retorna os 6 status, mesmo os que estão com zero.

```json
[
  { "status": "aberto", "label": "Aberto", "total": 7 },
  { "status": "em_andamento", "label": "Em andamento", "total": 6 },
  ...
]
```

## GET /dashboard/por-prioridade

```json
[
  { "prioridade": "baixa", "label": "Baixa", "slaHoras": 72, "total": 143, "pendentes": 8, "atrasados": 4 },
  ...
]
```

## GET /dashboard/por-categoria

Ranking dos tipos de chamado, ordenado pelos mais atendidos (resolvidos + fechados).

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `limite` | 10 | Quantidade de categorias retornadas |

```json
[
  {
    "id": 1,
    "nome": "Acesso e senhas",
    "total": 93,
    "atendidos": 88,
    "pendentes": 2,
    "participacao": 20.7,
    "tempoMedioHoras": 27.4
  },
  ...
]
```

`participacao` é o percentual da categoria sobre o total de chamados do filtro.

## GET /dashboard/por-tecnico

```json
[
  {
    "id": 3,
    "nome": "Rafael Souza",
    "total": 102,
    "atendidos": 93,
    "pendentes": 4,
    "percentualNoPrazo": 76.3,
    "tempoMedioHoras": 34.7
  },
  ...
]
```

## GET /chamados

Lista paginada, ordenada da abertura mais recente para a mais antiga.

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `pagina` | 1 | Página |
| `limite` | 10 | Itens por página (máximo 100) |

```json
{
  "dados": [
    {
      "id": 450,
      "titulo": "Usuário bloqueado após várias tentativas",
      "status": "aberto",
      "prioridade": "alta",
      "solicitante": "Aline Moreira",
      "setor": "Comercial",
      "categoria_id": 1,
      "categoria": "Acesso e senhas",
      "tecnico_id": null,
      "tecnico": null,
      "data_abertura": "2026-11-13 15:19:11",
      "data_atualizacao": "2026-11-13 15:19:11",
      "data_fechamento": null,
      "horas_decorridas": 5.1,
      "sla_horas": 8,
      "foraDoPrazo": false
    }
  ],
  "pagina": 1,
  "limite": 10,
  "total": 450,
  "totalPaginas": 45
}
```

## GET /chamados/:id

Mesmos campos da listagem, mais `descricao` e a lista de `consideracoes`:

```json
{
  "id": 5,
  "titulo": "Erro ao abrir o Excel",
  "descricao": "Erro ao abrir o Excel. Outros colegas do setor relatam o mesmo problema.",
  ...
  "consideracoes": [
    {
      "id": 12,
      "texto": "Contato realizado com o usuário para entender o problema.",
      "data_registro": "2026-05-20 11:48:01",
      "tecnico_id": 2,
      "tecnico": "Juliana Rocha"
    }
  ]
}
```

## POST /chamados

```json
{
  "titulo": "Impressora do RH não imprime",
  "descricao": "Fila travada desde cedo",
  "categoria_id": 5,
  "prioridade": "media",
  "solicitante": "Renata Carvalho",
  "setor": "RH"
}
```

Obrigatórios: `titulo`, `categoria_id`, `solicitante`, `setor`. A prioridade padrão é `media`.
O chamado é criado com status `aberto`. Retorna `201` com o chamado criado.

## PATCH /chamados/:id

Atualiza um ou mais campos. Envie só o que for alterar.

```json
{ "status": "resolvido", "tecnico_id": 2 }
```

| Campo | Observação |
|-------|------------|
| `status` | Ao concluir/cancelar grava `data_fechamento`; ao reabrir limpa a data |
| `tecnico_id` | ID do técnico ou `null` para remover |
| `prioridade` | Nova prioridade |

## POST /chamados/:id/consideracoes

```json
{ "texto": "Trocado o cabo de rede, aguardando teste do usuário.", "tecnico_id": 2 }
```

`texto` é obrigatório (até 1000 caracteres). `tecnico_id` é opcional. Retorna `201` com a consideração criada.
