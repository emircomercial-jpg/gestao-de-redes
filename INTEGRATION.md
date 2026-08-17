Integração com provedor de IA (opcional)

Este projeto pode usar um provedor de IA real se você fornecer as variáveis de ambiente abaixo. Sem elas, o servidor usa um simulador local (sem custos).

Variáveis importantes (adicione em `.env`):

- `REAL_AI_URL` — endpoint HTTP do provedor (POST JSON { model, prompt }).
- `REAL_AI_KEY` — token/API key para autenticação (Bearer).
- `REAL_AI_COST_PER_1K` — custo por 1000 tokens (opcional, default 0.10).
- `USE_MODEL_SUMMARY` — `1` para permitir resumo automático por `small-model` em prompts longos.
- `COMPACT_SUMMARY_THRESHOLD` — tamanho mínimo (chars) para acionar resumo automático.

Exemplo `.env` (minimizado):

PORT=3000
REAL_AI_URL=https://api.example.com/v1/generate
REAL_AI_KEY=sk-xxxxxxxxxxxxxxxx
REAL_AI_COST_PER_1K=0.12
USE_MODEL_SUMMARY=1
COMPACT_SUMMARY_THRESHOLD=3000

Passos para verificar integração:

1. Adicione as variáveis no arquivo `.env` na raiz do projeto.
2. Reinicie o servidor:

```powershell
cd "c:\Users\EMIR PC\Documents\Site\novo progeto"
npm start
```

3. Teste modo dry-run (não consome créditos):

```powershell
curl -X POST "http://localhost:3000/generate?dry=1" -H "Content-Type: application/json" -H "X-Tenant-Id: test-tenant" -d '{"prompt":"Teste de integração","type":"summary"}'
```

4. Teste chamada real (irá usar o provedor se `REAL_AI_URL` estiver definido):

```powershell
curl -X POST "http://localhost:3000/generate" -H "Content-Type: application/json" -H "X-Tenant-Id: test-tenant" -d '{"prompt":"Teste de integração real","type":"summary"}'
```

5. Verifique `/metrics` e `/prometheus` para custos registrados e métricas.

Observações de segurança e custo:
- Testes com `REAL_AI_URL` podem gerar custos. Use `dry=1` para estimar antes.
- Use credenciais com permissões limitadas e monitore `ALERT_DEFAULT_BUDGET`.

Se desejar, posso tentar rodar uma verificação automática usando suas credenciais agora (você precisa colar as variáveis ou configurar o arquivo `.env`).
