# Duetto CRM — Frontend

Frontend do Duetto CRM: cadastro de empresa (tenant), login com MFA (TOTP) e
um painel inicial com a lista de usuários da empresa. Fala com a API já
publicada em produção em `https://duetto-9cbi.onrender.com` (repositório
`crm-saas`).

Stack: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4. Sem
bibliotecas externas de estado/formulário — Context API própria
(`src/contexts/AuthContext.tsx`) e um cliente HTTP mínimo
(`src/lib/api.ts`), para manter a superfície de dependências pequena.

## Como a sessão funciona (resumo de segurança)

- **Access token**: só em memória (nunca em `localStorage`/cookie). Curto
  prazo de vida — se vazar via XSS, a janela de uso é pequena.
- **Refresh token**: em `localStorage`. É de uso único — o backend o invalida
  e emite um novo a cada renovação — então mesmo vazado o dano fica limitado
  à próxima renovação.
- Ao recarregar a página, o access token (só em memória) se perde de
  propósito; a sessão é restaurada automaticamente chamando `/auth/refresh`
  com o refresh token salvo.
- Chamada autenticada que recebe 401 (access token expirado) tenta renovar a
  sessão uma vez via refresh token antes de desistir — o usuário não é
  deslogado a cada ~15 minutos (TTL do access token).
- **Melhoria futura já identificada**: mover o refresh token para um cookie
  `httpOnly` exigiria colocar frontend e API no mesmo domínio (ou configurar
  `SameSite=None; Secure` entre o domínio da Vercel e o do Render) — adiado
  deliberadamente para não somar mais uma variável à primeira publicação.

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local   # já vem apontando para a API de produção
npm run dev
```

Abra http://localhost:3000 (ou a porta que você passar com `-p`).

**Importante — CORS**: a API em produção só aceita requisições vindas da
origem configurada em `CORS_ORIGIN` (variável de ambiente no Render). Ela
está configurada para uma origem só (sem lista/coringa). Antes de testar
localmente contra a API de produção, confirme no Render que `CORS_ORIGIN`
está com a origem que você vai usar (ex.: `http://localhost:3000`) — do
contrário o navegador bloqueia as respostas com erro de CORS (a UI mostra
"Não foi possível conectar à API"). Quando publicar este frontend na Vercel,
atualize `CORS_ORIGIN` no Render de novo, para o domínio da Vercel.

Para rodar contra uma API local (`crm-saas` rodando na sua máquina), troque
`NEXT_PUBLIC_API_URL` em `.env.local` para `http://localhost:3000` (ajuste a
porta se a API local usar outra) e ajuste `CORS_ORIGIN` da API local para a
porta do frontend.

## Testado

Fluxo completo (cadastro → painel → lista de usuários → logout → login →
sessão restaurada após F5 → tentativa de login com senha errada) validado de
ponta a ponta com um navegador automatizado contra uma instância local da
API antes da entrega. `npm run lint` e `npm run build` passam limpos.

## Build e deploy

```bash
npm run build
npm run start   # smoke test do build de produção localmente
```

Publicação recomendada: **Vercel**, importando este repositório e
configurando a env var `NEXT_PUBLIC_API_URL=https://duetto-9cbi.onrender.com`
no painel do projeto (Settings → Environment Variables). Depois do primeiro
deploy, atualize `CORS_ORIGIN` na API (Render) para o domínio gerado pela
Vercel.

## Estrutura

```
src/
  app/
    page.tsx          redireciona para /login ou /dashboard conforme a sessão
    login/page.tsx     login + segunda etapa de MFA (mesma página)
    signup/page.tsx     cadastro da empresa + usuário dono
    dashboard/page.tsx  painel autenticado: dados da conta + lista de usuários
  contexts/
    AuthContext.tsx    sessão (login/signup/MFA/refresh/logout), authFetch()
  lib/
    api.ts             cliente HTTP fino sobre fetch, tratamento de erro
    types.ts           tipos das respostas da API (mantidos manualmente)
```
