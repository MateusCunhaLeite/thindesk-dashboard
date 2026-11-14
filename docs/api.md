# Documentação da API

URL base: `http://localhost:8080/api`

Os endpoints exigem login (sessão do Spring Security). Pelo navegador, basta estar logado no sistema.

Erros são retornados em JSON:

```json
{ "erro": "A data inicial não pode ser maior que a data final" }
```

| Código | Quando acontece |
|--------|-----------------|
| 200 | Sucesso |
| 201 | Registro criado |
| 400 | Parâmetro ou corpo inválido |
| 404 | Chamado não encontrado |
| 500 | Erro inesperado |

## Filtros

Os endpoints de `/dashboard` e a listagem `/chamados` aceitam os mesmos filtros na query string.
Todos são opcionais e podem ser combinados.

| Parâmetro | Exemplo | Descrição |
|-----------|---------|-----------|
| `inicio` | `2026-08-01` | Data inicial (inclusive), formato AAAA-MM-DD |
| `fim` | `2026-08-31` | Data final (inclusive) |
| `status` | `EM_ANDAMENTO` | `ABERTO`, `EM_ANDAMENTO`, `AGUARDANDO`, `CONCLUIDO`, `CANCELADO` |
| `prioridade` | `ALTA` | `BAIXA`, `MEDIA`, `ALTA`, `CRITICA` |
| `tipo` | `Rede` | Tipo do chamado |
| `tecnico` | `João` | Nome do técnico |

O período é aplicado sobre a data de abertura. A exceção é a série "concluídos" do `por-periodo`, que usa a data de fechamento.

---

## GET /dashboard/opcoes

Valores para montar os filtros da tela.

```json
{
  "status": [{ "valor": "ABERTO", "label": "Aberto" }, ...],
  "prioridades": [{ "valor": "BAIXA", "label": "Baixa (SLA 72h)" }, ...],
  "tipos": ["Acesso e senhas", "E-mail", "Hardware", ...],
  "tecnicos": ["Carlos Mendes", "João", ...]
}
```

## GET /dashboard/indicadores

```
GET /api/dashboard/indicadores?inicio=2026-08-17&fim=2026-11-14
```

```json
{
  "total": 263,
  "pendentes": 14,
  "abertos": 1,
  "emAndamento": 10,
  "aguardando": 3,
  "concluidos": 240,
  "cancelados": 9,
  "semTecnico": 1,
  "atrasados": 9,
  "taxaResolucao": 94.5,
  "percentualNoPrazo": 85.0,
  "tempoMedioResolucaoHoras": 21.3
}
```

- `taxaResolucao`: concluídos / (total - cancelados), em %
- `percentualNoPrazo`: % dos concluídos resolvidos dentro do SLA
- `atrasados`: pendentes que já passaram do SLA
- `tempoMedioResolucaoHoras`: `null` quando não há concluídos no filtro

## GET /dashboard/por-periodo

| Parâmetro | Valores | Padrão |
|-----------|---------|--------|
| `agrupamento` | `dia`, `semana`, `mes` | `semana` |

Na semana, o período é identificado pela data da segunda-feira. Períodos sem chamados vêm com zero.
O agrupamento por dia é limitado a 1 ano.

```
GET /api/dashboard/por-periodo?agrupamento=mes&inicio=2026-09-01&fim=2026-11-14
```

```json
{
  "agrupamento": "mes",
  "dados": [
    { "periodo": "2026-09", "abertos": 86, "concluidos": 81 },
    { "periodo": "2026-10", "abertos": 96, "concluidos": 84 },
    { "periodo": "2026-11", "abertos": 47, "concluidos": 42 }
  ]
}
```

## GET /dashboard/por-status

Retorna sempre todos os status, mesmo com zero.

```json
[
  { "valor": "ABERTO", "label": "Aberto", "total": 2 },
  { "valor": "EM_ANDAMENTO", "label": "Em andamento", "total": 10 },
  ...
]
```

## GET /dashboard/por-prioridade

```json
[
  { "valor": "BAIXA", "label": "Baixa", "slaHoras": 72, "total": 122, "pendentes": 8, "atrasados": 3 },
  ...
]
```

## GET /dashboard/por-tipo

Ranking dos tipos de chamado, do mais atendido (concluídos) para o menos atendido.

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `limite` | 10 | Quantidade de tipos retornados |

```json
[
  {
    "tipo": "Acesso e senhas",
    "total": 86,
    "atendidos": 79,
    "pendentes": 4,
    "participacao": 19.1,
    "tempoMedioHoras": 28.1
  },
  ...
]
```

`participacao` é o percentual do tipo sobre o total de chamados do filtro.

## GET /dashboard/por-tecnico

```json
[
  {
    "tecnico": "Juliana Rocha",
    "total": 98,
    "atendidos": 92,
    "pendentes": 0,
    "percentualNoPrazo": 81.5,
    "tempoMedioHoras": 23.7
  },
  ...
]
```

## GET /chamados

Lista paginada, do chamado mais recente para o mais antigo.

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `pagina` | 1 | Página (começa em 1) |
| `tamanho` | 10 | Itens por página (máximo 100) |

```json
{
  "dados": [
    {
      "id": "6af8b77d1cea7515f157a84c",
      "descricao": "Programa fechando sozinho",
      "status": "ABERTO",
      "tipo": "Software",
      "tecnico": "Rafael Souza",
      "usuario": "Fernanda Costa",
      "prioridade": "CRITICA",
      "dataAbertura": "2026-11-14T15:41:18",
      "dataFechamento": null,
      "consideracoes": [ ... ],
      "horasDecorridas": 0.92,
      "foraDoPrazo": false
    }
  ],
  "pagina": 1,
  "tamanho": 10,
  "total": 450,
  "totalPaginas": 45
}
```

`horasDecorridas` e `foraDoPrazo` são calculados na hora (não ficam salvos no banco).

## GET /chamados/{id}

Retorna o chamado completo, com as considerações técnicas. `404` se não existir.

## POST /chamados

```json
{
  "descricao": "Impressora do RH não imprime",
  "tipo": "Impressora",
  "prioridade": "ALTA",
  "usuario": "Renata Carvalho"
}
```

Se não forem informados: `status` = `ABERTO`, `prioridade` = `MEDIA` e `dataAbertura` = agora.

## PATCH /chamados/{id}/status

Altera o status e/ou o técnico responsável. Envie só o que for mudar.

```json
{ "status": "CONCLUIDO", "tecnico": "João" }
```

- Ao concluir ou cancelar, `dataFechamento` é preenchida automaticamente.
- Ao voltar para um status pendente, `dataFechamento` é apagada.
- `"tecnico": ""` remove o técnico do chamado.

## POST /chamados/{id}/consideracoes

```json
{ "texto": "Trocado o cabo de rede, aguardando teste do usuário.", "tecnico": "João" }
```

`texto` é obrigatório (até 1000 caracteres). Se `tecnico` não for enviado, usa o técnico do chamado.
Retorna `201` com a consideração criada.
