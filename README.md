# Controle de Licenças - Zitão

Aplicativo web simples e profissional para controle de licenças, com:

- login com usuário único (`nicolly`)
- módulo **Visão geral** com dashboard interativo
- módulo **Licenças** com cadastro completo
- filtros por empresa e tipo de licença
- inclusão, alteração, exclusão e inativação
- upload de **PDF** das licenças
- persistência em nuvem via **Supabase** para acesso em qualquer computador
- publicação simples via **GitHub Pages**, **Netlify** ou **Vercel**

---

## 1. Estrutura da pasta

```text
zitao-controle-licencas/
├── index.html
├── .nojekyll
├── README.md
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── img/
│   │   ├── logo-zitao.png
│   │   ├── logo-paulistana.png
│   │   └── logo-souza-cardoso.png
│   └── js/
│       ├── app.js
│       ├── config.js
│       ├── config.example.js
│       └── demo-data.js
└── supabase/
    ├── schema.sql
    ├── seed.sql
    └── storage.sql
```

---

## 2. Como o projeto funciona

### Modo demonstração
Ao abrir o `index.html` sem configurar o Supabase, o sistema funciona em **modo local**, usando dados de exemplo carregados a partir da base em Excel.

### Modo online
Para que os dados alterados possam ser acessados em **qualquer computador**, o projeto deve ser ligado a um banco em nuvem.

A solução escolhida foi o **Supabase**, porque é simples, moderno e ideal para este tipo de sistema.

---

## 3. Credenciais solicitadas

- **Usuário:** `nicolly`
- **Senha:** `123456`

### Observação importante
No Supabase Auth, o login precisa ser criado com e-mail.
Por isso, a recomendação é criar o usuário com este e-mail:

- **E-mail:** `nicolly@zitao.local`
- **Senha:** `123456`

Na tela do sistema, o usuário continuará digitando apenas **nicolly**.

---

## 4. Configuração do Supabase

### 4.1 Criar projeto
1. Acesse: https://supabase.com
2. Crie um novo projeto.

### 4.2 Criar as tabelas
No painel do Supabase, abra o **SQL Editor** e execute, nesta ordem:

1. `supabase/schema.sql`
2. `supabase/storage.sql`
3. `supabase/seed.sql`

### 4.3 Criar o usuário de acesso
No menu **Authentication > Users**, crie um usuário manualmente:

- E-mail: `nicolly@zitao.local`
- Senha: `123456`

### 4.4 Atualizar o arquivo de configuração
Abra o arquivo `assets/js/config.js` e preencha:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "SUA_URL_DO_SUPABASE",
  SUPABASE_ANON_KEY: "SUA_CHAVE_ANON",
  STORAGE_BUCKET: "licencas-pdf",
  DEFAULT_LOGIN_USERNAME: "nicolly",
  DEFAULT_LOGIN_EMAIL: "nicolly@zitao.local",
  DEMO_MODE: false
};
```

> Quando `DEMO_MODE` estiver como `false`, o sistema passará a gravar e consultar os dados em nuvem.

---

## 5. Publicação no GitHub

### Opção mais simples: GitHub Pages
1. Crie um repositório no GitHub.
2. Envie todos os arquivos desta pasta.
3. Vá em **Settings > Pages**.
4. Em **Source**, escolha a branch principal e a pasta `/root`.
5. Salve.

Depois da publicação, o sistema ficará acessível pela URL do GitHub Pages.

> Como os dados ficam no Supabase, o sistema poderá ser usado de qualquer computador com internet.

---

## 6. Publicação alternativa

Também funciona muito bem em:

- **Netlify**
- **Vercel**

Nestes casos, basta enviar a mesma pasta como site estático.

---

## 7. Funcionalidades já incluídas

### Visão geral
- total de licenças ativas
- total a vencer nos próximos 30 dias
- total vencidas
- card prioritário: vencidas + a vencer em 30 dias
- filtros por empresa e tipo de licença
- lista crítica de vencimentos
- distribuição por tipo de licença

### Módulo detalhado
- relação completa das licenças
- botão **Abrir** em cada linha
- exibição dos detalhes
- ações de:
  - alterar
  - excluir
  - inativar
- inclusão de nova licença
- campo de observações
- upload de PDF

---

## 8. Observações técnicas

### Sobre PDFs
- Em **modo online**, os PDFs são gravados no bucket `licencas-pdf` do Supabase.
- Em **modo demonstração**, o comportamento é apenas visual/local.

### Sobre segurança
Como o sistema é para apenas 1 usuário, foi adotada uma arquitetura simples.
Ainda assim, o projeto já está preparado com:

- autenticação via Supabase
- Row Level Security (RLS)
- bucket protegido para usuários autenticados

---

## 9. Próximos passos recomendados

Se você quiser, no próximo passo eu posso gerar também:

1. uma **versão 2** com layout ainda mais refinado
2. um **CRUD com backend próprio em FastAPI**
3. versão com **histórico de alterações**
4. versão com **alertas por e-mail** de vencimento
5. versão com **importação direta do Excel**
6. versão pronta para **deploy profissional**

---

## 10. Resumo da arquitetura adotada

### Frontend
- HTML
- CSS
- JavaScript puro

### Backend / dados
- Supabase (PostgreSQL + Storage + Auth)

### Publicação
- GitHub Pages / Netlify / Vercel

Essa arquitetura atende bem ao seu cenário atual:

- simples
- econômica
- fácil de publicar
- fácil de manter
- dados acessíveis em qualquer computador
