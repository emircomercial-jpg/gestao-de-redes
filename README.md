# Social Automation Prototype

Pequeno protótipo para geração de conteúdo, revisão humana e agendamento de publicações em redes sociais.

Pré-requisitos
- Node.js 18+ / 20+
- npm
- (opcional) Redis para fila (via `REDIS_URL`)

Instalação

```bash
npm install
```

Variables de ambiente (veja `.env.example`)

Execução

```bash
# iniciar servidor
npm start

# rodar testes
npm test
```

Endpoints principais
- `POST /generate` — gera conteúdo. Use header `X-Tenant-Id` para tenant e query `?dry=1` para dry-run.
- `GET /prometheus` — métricas Prometheus.
- `POST /schedule` — agendar publicação. Body: `{ platform, credentials, message, publishAt }`.
- `POST /drafts` — criar draft para revisão humana.

Configuração de provedores de IA
- Defina `REAL_AI_URL` e `REAL_AI_KEY` para usar um provedor real. Caso não configurado, o sistema usa um simulador local.

Finalização e economia de créditos
- O protótipo está configurado por padrão para NÃO utilizar provedores reais (use o simulador). Não defina `REAL_AI_URL`/`REAL_AI_KEY` em ambientes de teste.
- Use `?dry=1` em `/generate` para obter estimativas sem consumir créditos.
- Ajuste `src/config.js` por tenant para reduzir `maxChars` e `summaryThreshold` quando quiser reduzir tokens.
- Habilite `USE_MODEL_SUMMARY=1` apenas para tenants com orçamento, pois gera chamadas adicionais ao provedor.
- Sempre teste com `npm test` antes de executar chamadas reais.


Conectores de redes sociais
- Meta (Facebook/Instagram): OAuth endpoints em `/auth/meta` e worker para publicar em páginas.
- LinkedIn: use `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` para OAuth; worker publica via `src/connectors/linkedin.js`.
- X (Twitter): worker publica via `src/connectors/x.js` usando `bearerToken` armazenado nas credenciais.

Segurança e produção
- Não coloque chaves em repositórios. Use um cofre de segredos em produção.
- Configure limites de orçamento por tenant e alertas (`/alerts/threshold`).

Mais detalhes estão nos arquivos em `src/`.
Protótipo Node.js — Gerenciador de redes com cache e rate-limiter

Rápido:

1. Instalar dependências

```bash
cd "c:\Users\EMIR PC\Documents\Site\novo progeto"
npm install
```

2. Executar

```bash
npm start
```

Endpoints:
- `GET /` — status
- `POST /generate` — gerar conteúdo simulado
  - Headers: `X-Tenant-Id`
  - Body JSON: `{ "prompt": "texto", "type": "summary|final|image" }`

Conector Meta (Facebook/Instagram):
- Para publicar em páginas Facebook, configure `PAGE_ACCESS_TOKEN` e `PAGE_ID` ou envie o token na chamada.
- Endpoint de exemplo (simulação): use o módulo `src/connectors/facebook.js` com a função `publishToFacebookPage(pageAccessToken, pageId, message)`.

Agendador:
- O agendador em `src/scheduler.js` é em memória e serve apenas para testes; para produção use BullMQ + Redis.

Fila e worker (Redis + BullMQ):
- O protótipo suporta `BullMQ` via `src/queue.js`. Se `REDIS_URL` estiver configurado, jobs são adicionados à fila `publish-queue`.
- Um worker está em `src/worker.js` e processa jobs do tipo `publish` chamando o conector `src/connectors/facebook.js`.
- Para usar BullMQ em produção instale Redis e forneça `REDIS_URL` no `.env`.

Persistência de jobs e OAuth:
- Quando o Redis não está configurado, jobs agendados são persistidos em `data/jobs.json` e recarregados na inicialização.
- OAuth Meta (Facebook/Instagram): `GET /auth/meta` e callback `GET /auth/meta/callback`.
- OAuth LinkedIn: `GET /auth/linkedin` e callback `GET /auth/linkedin/callback`.
- OAuth X (Twitter): `GET /auth/x` e callback `GET /auth/x/callback`.
- Credenciais armazenadas podem ser listadas em `GET /credentials?tenant=<tenant>`.

Interface de revisão de rascunhos:
- A interface web fica em `public/index.html` e é servida pelo servidor. Acesse `http://localhost:3000/` para revisar e aprovar rascunhos.

Rodando worker (quando Redis estiver configurado):

```bash
cd "c:\Users\EMIR PC\Documents\Site\novo progeto"
node src/worker.js
```

Observações:
- Implementa cache em memória e limitação por token bucket por tenant.
- Pode ser estendido para usar Redis, BullMQ e integração com APIs oficiais de redes sociais.
