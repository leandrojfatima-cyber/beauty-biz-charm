# Guia de Recuperação e Restauração (Disaster Recovery) — BELEZI

Este documento descreve como restaurar integralmente a aplicação e o banco de dados a partir deste backup.

---

## 1. Recuperação do Banco de Dados

### Pré-requisitos
* Um projeto Supabase ativo ou instância PostgreSQL 15+ com a extensão `pgcrypto` ou `gen_random_uuid()` habilitada.

### Passo a passo para restauração do Schema
1. Abra o **SQL Editor** do Supabase (ou conecte via `psql` com a connection string):
   ```bash
   psql "$DATABASE_URL" -f backup/database_complete_schema.sql
   ```
2. O script executará de forma idempotente (`IF NOT EXISTS`, `OR REPLACE`):
   * Criação do enum `app_role` (`master`, `admin`, `barbeiro`, `cliente`).
   * Criação das 13 tabelas essenciais.
   * Criação das funções críticas (`close_order`, `apply_stock_movement`, `claim_master`, `has_role`).
   * Ativação do Row-Level Security (RLS) e aplicação das políticas de isolamento por empresa.
   * Carga inicial dos planos da plataforma na tabela `plans`.

---

## 2. Recuperação das Variáveis de Ambiente

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
2. Preencha as chaves do seu projeto Supabase:
   * `SUPABASE_URL` / `VITE_SUPABASE_URL`
   * `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY` (opcional, para tarefas administrativas)

---

## 3. Recuperação da Aplicação Frontend / Fullstack

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Execute a suíte de validação:
   ```bash
   npm run test
   npm run lint
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## 4. Teste de Integridade Pós-Recuperação

* Acesso à página inicial: `http://localhost:3000/` (deve carregar os planos do banco).
* Acesso à página de login: `http://localhost:3000/auth`.
* Teste de criação de conta e abertura de comanda.
