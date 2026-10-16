# BELEZI & NEXADASH — Roadmap de Modernização & Expansão

## Status Geral das Etapas

- [x] **Etapa 1 — Auditar o BELEZI atual**
  - Mapeamento completo de rotas, componentes, comandas, comissões imutáveis, estoque auditado e isolamento multiempresa.
  - Levantamento de riscos, dependências externas e permissões.

- [x] **Etapa 2 — Proteger e preparar a arquitetura**
  - Backup recuperável do banco de dados e arquivos em `/backup/`.
  - Isolamento rigoroso multiempresa com RLS (`owner_id = auth.uid()`).
  - Roles definidos: Master NEXADASH, Dono de Barbearia, Barbeiro e Cliente.
  - Testes unitários de isolamento aprovados (`src/test/multi-tenant-isolation.test.ts`).

- [x] **Etapa 3 — Criar o painel exclusivo da NEXADASH**
  - Identidade institucional completa: Azul-Marinho (#0B192C), Laranja (#FF6500) e Branco.
  - CRM de negociações e pipeline de vendas (etapas: novo, demo, proposta, negociação, ganho, perdido).
  - Cadastro de interessados (leads), empresas compradoras e histórico de interações multicanal.
  - Propostas comerciais e gestão de suporte/implantação/consultorias.

- [x] **Etapa 4 — Implementar assinaturas comerciais e vendas**
  - Gestão de contratos B2B pagos pelas barbearias à NEXADASH (planos START, PRO, IA, BUSINESS).
  - Ciclos de faturamento (mensal, trimestral, semestral, anual) e condições especiais.
  - Emissão de faturas e conciliação rigorosa de pagamentos com autenticação bancária.
  - Relatórios executivos de MRR, ARR, volume faturado e inadimplência.
  - Testes de regras de negócio aprovados (`src/test/nexadash-billing.test.ts`).

- [x] **Etapa 5 — Criar a liberação manual de acesso**
  - Ciclo de ativação controlado pela NEXADASH em 8 passos:
    1. Registrar a contratação.
    2. Conferir as condições acordadas (checklist completo).
    3. Registrar a situação do pagamento conforme contrato (manual ou online).
    4. Preparar a conta da barbearia (catálogo e dados).
    5. Autorizar manualmente a ativação (botão exclusivo para admin credenciado).
    6. Registrar o responsável, a data, o plano e a vigência em auditoria permanente.
    7. Acompanhar vencimentos e pendências (alertas preventivos).
    8. Deliberação manual fundamentada para suspensão ou reativação.
  - **Critérios Fundamentais Cumpridos**:
    - Nenhum interessado consegue liberar sozinho o sistema (mesmo pagamento online aprovado exige autorização manual).
    - Nenhum vencimento provoca suspensão automática (corte operacional exige deliberação humana registrada).
  - Tela de bloqueio e acompanhamento para barbearias pendentes (`AccessActivationGate.tsx`).
  - Testes unitários do ciclo em 8 passos aprovados (`src/test/nexadash-manual-activation.test.ts`).
