# Chatbot de Atendimento — Portal TotalPass
## Especificação Técnica: MVP e Solução Definitiva

**Versão:** 3.0
**Data:** setembro de 2026
**Autor:** Kliente 360

---

## 1. Contexto e objetivo

A TotalPass precisa de um canal de autoatendimento para o cliente final dentro do seu portal interno. O assistente responde dúvidas sobre o produto com base em uma base de conhecimento curada, e quando não tem a informação, abre um chamado no Salesforce.

O produto é desenvolvido, hospedado e mantido pela Kliente 360, **fora da plataforma Salesforce**. O Salesforce entra apenas como destino de chamados e, na solução definitiva, como fonte dos artigos.

O produto é pensado para ser reaproveitável em outros clientes. Decisões de arquitetura consideram multi-tenant desde o início, ainda que a implementação do MVP atenda um tenant só.

### Posicionamento em relação ao Agentforce

A TotalPass já opera um agente Agentforce ("Theo") no mesmo org. As razões para a solução externa precisam estar documentadas, porque serão questionadas:

- **Custo por conversa.** Agentforce é consumption-based. Volume de cliente final em portal é significativamente maior que os casos de uso atuais do Theo.
- **Controle sobre a qualidade da resposta.** O retriever nativo oferece pouca alavanca sobre seleção de contexto e prompt. A ambiguidade já reportada nas respostas do Theo é sintoma disso.
- **Propriedade do produto.** O ativo é da Kliente 360 e reaproveitável na base de clientes.

**Pendência:** definir se este assistente coexiste com o Theo (contextos distintos) ou o substitui no atendimento ao cliente final. Se não for decidido explicitamente, será decidido por inércia.

---

## 2. Escopo do MVP

### Dentro

| # | Funcionalidade |
|---|---|
| 1 | Página que simula o portal do cliente, com o assistente em balão no canto inferior direito |
| 2 | Saudação e abertura da conversa |
| 3 | Resposta a dúvidas com base exclusiva em artigos markdown versionados no repositório |
| 4 | Abstenção explícita quando não há informação, com oferta de abrir chamado |
| 5 | Abertura de Case em org Developer Edition, coletando e confirmando e-mail |
| 6 | Métricas: taxa de deflexão e log de perguntas não respondidas |

### Fora

- Leitura de artigos via API do Salesforce Knowledge
- Consulta de chamados existentes
- Widget distribuível (loader externo + iframe) e integração real no portal
- Identidade do usuário logado
- Citação de artigos e links (decisão de produto: **não citar**)
- CSAT, thumbs, painel administrativo, billing, onboarding self-service

### Decisões de produto travadas

- **Sem citação de fonte.** O assistente elabora a resposta a partir dos artigos, mas não menciona nem linka o artigo. Os trechos utilizados são registrados apenas em log interno.
- **Base fechada.** O assistente só sabe o que está nos artigos. Não usa conhecimento geral sobre o assunto.

---

## 3. Dimensionamento: a decisão que simplifica tudo

A base é de aproximadamente **30 artigos de 4 a 5 parágrafos**. Isso são, grosso modo, 15 mil palavras, algo entre 20 e 25 mil tokens.

**A base inteira cabe no contexto de uma única chamada.**

Isso elimina, para o MVP:

- Banco vetorial (pgvector)
- Geração de embeddings
- Estratégia de chunking
- Busca híbrida e reranking

O assistente recebe os artigos completos no system prompt, com **prompt caching** ativado no bloco da base. Não há etapa de seleção de contexto, e portanto não há a principal fonte de erro de sistemas RAG: recuperar o trecho errado.

Esta é uma reversão consciente de recomendações feitas quando o volume da base era desconhecido. Com 30 artigos curtos, montar infraestrutura de recuperação vetorial seria complexidade sem retorno.

### Quando essa decisão deixa de valer

Revisar quando qualquer uma destas ocorrer:

- A base passar de ~150 artigos ou ~100 mil tokens
- O custo por conversa se tornar relevante frente ao volume
- A latência da primeira resposta incomodar

---

## 4. Arquitetura do MVP

```
┌─────────────────────────────────────────────────┐
│  Navegador                                      │
│  Página simulando o portal (estática)           │
│    └─ Balão de chat — componente React          │
│  Next.js App Router + Tailwind                  │
└───────────────────┬─────────────────────────────┘
                    │ HTTPS (streaming SSE)
┌───────────────────▼─────────────────────────────┐
│  API — Next.js Route Handlers no Netlify        │
│                                                 │
│  /api/chat   edge runtime, conversa + tool use  │
│                                                 │
│  Tools expostas ao modelo:                      │
│    · abrir_caso                                 │
│    · registrar_nao_respondida                   │
└──────┬─────────────────────┬────────────────────┘
       │                     │
┌──────▼──────────┐   ┌──────▼──────────────────┐
│  Claude API     │   │  Salesforce REST API    │
│  prompt caching │   │  Client Creds — DEV ED. │
└──────▲──────────┘   │  · Case / CaseComment   │
       │              └─────────────────────────┘
┌──────┴──────────────────────────────────────────┐
│  /content/kb/*.md                               │
│  artigos versionados no repositório             │
│  carregados na inicialização                    │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  Netlify Blobs                                  │
│  conversations · metrics · rate_limits          │
└─────────────────────────────────────────────────┘
```

### 4.1 Base de conhecimento

Arquivos markdown no repositório, um por artigo:

```
/content/kb/kb-001-<slug>.md
```

```markdown
---
id: KB-001
titulo: Como funciona o plano Corporativo
---

Conteúdo do artigo.
```

Markdown foi escolhido sobre docx e pdf porque não exige biblioteca de parsing (modo de falha a menos), não perde estrutura na conversão, já é o formato que entra no prompt, e fica versionado no git com histórico e diff de conteúdo.

Carga na inicialização do processo, com cache em memória. Atualização de conteúdo é commit e deploy, o que no MVP é desejável: nenhuma alteração de conteúdo sem rastro.

**A origem da base deve estar atrás de uma interface** (`KnowledgeSource`), com implementação `FilesystemSource` no MVP. A troca para leitura do Salesforce Knowledge passa a ser uma implementação nova, sem tocar no motor de conversa.

### 4.2 Prompt e controle de alucinação

Proteções combinadas:

1. **Base completa no contexto**, dentro de tag de dados (`<base_conhecimento>`), com instrução explícita de que conteúdo fora dali não existe
2. **Instrução de abstenção**: se a resposta não estiver na base, o assistente declara que não tem a informação e oferece abrir chamado. Nunca infere, nunca completa por plausibilidade
3. **Prompt injection**: artigos são conteúdo semi-confiável. Qualquer instrução escrita dentro de um artigo é tratada como texto, não como comando
4. **Registro dos artigos utilizados** em cada resposta, gravado em log

Sem citação para o usuário, o log dos artigos consultados é o **único** meio de investigar uma reclamação de resposta incorreta. É obrigatório.

### 4.3 Interface

O cliente pediu para visualizar no MVP como o assistente ficará em produção. A entrega são duas partes, na mesma aplicação:

**Página simulando o portal.** Estática, sem funcionalidade: header com logo e menu, navegação lateral, cards de conteúdo genérico. Existe como pano de fundo para dar contexto visual. Ganha muito em realismo se o cliente fornecer logo, cores e prints do portal real.

**Balão de chat no canto inferior direito.** Botão flutuante que abre e fecha o painel de conversa.

**Decisão de arquitetura:** o balão é um componente React na própria aplicação, e não a arquitetura final de loader externo com iframe e `postMessage`. Visualmente o resultado é idêntico ao de produção, que é o que o cliente pediu ver, a um custo muito menor. O componente do painel é o mesmo nos dois cenários: na integração real, muda apenas o invólucro.

Para que essa extração seja limpa depois, o painel não deve depender de estilos ou estado da página simulada.

Estados a cobrir: fechado, aberto vazio, digitando, resposta em streaming, erro de rede, confirmação de e-mail. Responsivo, com painel em tela cheia em viewport estreito.

**Risco de comunicação:** cliente vendo algo parecido com o próprio portal tende a assumir que a integração já existe. A natureza de simulação precisa estar explícita na apresentação.

### 4.4 Fluxo conversacional

```
saudação
  │
  ├─ pergunta sobre o produto
  │     ├─ há resposta na base → responde
  │     └─ não há → declara que não sabe
  │           └─ oferece abrir chamado
  │
  └─ "abrir um chamado"
        └─ pede e-mail → CONFIRMA o e-mail digitado
              └─ cria Case com transcript → devolve número
```

A confirmação do e-mail antes da criação não é opcional: erro de digitação em e-mail é a principal causa de o cliente nunca receber o retorno do chamado.

### 4.5 Integração Salesforce

Apenas criação de Case. Nenhuma leitura no MVP.

A org do MVP é uma **Developer Edition da Kliente 360**, usada para prova de conceito. A org do cliente entra depois, por troca de variável de ambiente. Isso remove a dependência de liberação de acesso e de autorização de Connected App pelo admin do cliente no caminho crítico.

**Autenticação.** Connected App com **OAuth Client Credentials Flow**, executando sob um usuário de integração dedicado com permissões mínimas de criação em Case e CaseComment.

```
POST {SF_LOGIN_URL}/services/oauth2/token
grant_type=client_credentials
client_id={SF_CLIENT_ID}
client_secret={SF_CLIENT_SECRET}
```

A resposta traz `access_token` e `instance_url`. As chamadas seguintes usam a `instance_url` retornada, não uma URL fixa. Token em cache até a expiração, renovado no primeiro 401.

Client Credentials e não username-password: o fluxo de senha vem desabilitado por padrão em orgs recentes e é tratado como legado. Client Credentials é fluxo server-to-server suportado em produção.

**Por que não JWT Bearer no MVP.** JWT exige gerar certificado, carregá-lo no Connected App, pré-autorizar o perfil e transportar a chave privada em variável de ambiente. Client Credentials entrega a mesma classe de autenticação server-to-server com uma requisição HTTP. A troca é a chave privada por um client secret simétrico.

**Consequências a registrar:**

- O client secret é segredo simétrico. Fica apenas no servidor, e sua rotação é procedimento manual. Em produção com dado de cliente, este é o ponto que a área de segurança da TotalPass vai querer discutir, e JWT pode ser exigido.
- O **Run As User** define as permissões de toda chamada da integração. Usuário dedicado com perfil mínimo é obrigatório, não recomendação.

Por isso a autenticação fica isolada num módulo `SalesforceAuth`, com implementação `ClientCredentialsAuth`. Se a org de produção exigir JWT Bearer, troca-se a implementação sem impacto no restante do sistema.

**Particularidades por tipo de org:**

| | Developer Edition | Sandbox |
|---|---|---|
| URL de login | `login.salesforce.com` | `test.salesforce.com` |

A URL de login é variável de ambiente, nunca constante.

**Criação de Case:**

| Campo | Valor |
|---|---|
| `Origin` | `Webchat` |
| `Subject` | resumo gerado pelo assistente |
| `Description` | descrição do problema pelo cliente |
| `SuppliedEmail` | e-mail informado (não verificado) |
| `Identidade_Verificada__c` | `false` |
| `Conversation_Id__c` | correlação com o log interno |

Transcript completo gravado como `CaseComment` com `IsPublished = false`.

Campos customizados devem ser opcionais na configuração: se não existirem na org, o sistema registra aviso e cria o Case sem eles, em vez de falhar.

### 4.6 Segurança e privacidade

**Abertura de chamado com e-mail autodeclarado** é risco aceito e documentado. O pior cenário é chamado aberto em nome errado ou spam, tratável pelo time de atendimento. O campo `Identidade_Verificada__c = false` sinaliza isso ao atendente.

**Consulta de chamados está fora do MVP** justamente porque exigiria identidade. Quando entrar, vale a regra da seção 7.2.

**Rate limiting** por IP na abertura de chamados. Sem isso, o primeiro bot que encontrar o endpoint enche a fila de atendimento do cliente.

**Retenção.** Transcripts contêm dado pessoal. Definir prazo de retenção e rotina de expurgo antes de subir em produção. LGPD se aplica mesmo em piloto.

**Credenciais** de Salesforce e Anthropic exclusivamente no servidor. Nenhuma chamada direta do navegador a qualquer uma das duas APIs.

### 4.7 Métricas

Somente duas, ambas com propósito operacional definido:

- **Taxa de deflexão** — conversas encerradas sem abertura de chamado, sobre o total. É o indicador de valor do produto.
- **Perguntas não respondidas** — toda abstenção grava a pergunta original. Esta lista é o roadmap de conteúdo do time de Knowledge da TotalPass e o principal insumo da conversa de renovação.

---

## 5. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind | |
| Hospedagem | Netlify, conectado ao GitHub | rota de chat em edge runtime |
| Persistência | Netlify Blobs | sem banco, sem migrations |
| Base de conhecimento | arquivos markdown no repositório | sem banco, sem API |
| LLM | Claude, via SDK oficial da Anthropic | modelo e preços a confirmar em docs.claude.com |
| Salesforce | REST API, OAuth Client Credentials | `fetch` puro, sem SDK e sem lib de JWT |

### Restrição do Netlify

Função síncrona no Netlify tem timeout de 10 segundos. Resposta de chat com streaming segura a conexão aberta além disso, então a rota `/api/chat` roda em **edge runtime** (`export const runtime = 'edge'`), onde o limite não se aplica.

Consequência: dependências que exigem o módulo `crypto` do Node devem ser evitadas. Com Client Credentials isso deixa de ser restritivo, já que a autenticação é uma requisição HTTP simples, sem assinatura local.

Quando o job de sincronização do Knowledge entrar (seção 7.4), ele roda como Scheduled Function do Netlify, em Node runtime, onde a restrição não se aplica.

Prompt caching ativado no bloco da base de conhecimento. Com a base inteira no contexto, é o que mantém o custo por mensagem baixo. Confirmar comportamento e TTL do cache na documentação oficial antes de dimensionar custo.

---

## 6. Persistência

O MVP não usa banco de dados. Toda a persistência é feita em **Netlify Blobs**, que já vem com a plataforma, funciona em edge runtime e dispensa conta, setup e migrations.

Gravar em arquivo local não é alternativa: edge runtime não tem disco persistente e cada requisição pode ser servida por uma instância diferente.

| Store | Chave | Conteúdo |
|---|---|---|
| `conversations` | `<tenant>/<conversation_id>` | conversa completa: mensagens, artigos usados por resposta, e-mail informado, se abriu caso, número do caso, timestamps |
| `metrics` | `<tenant>/unanswered/<YYYY-MM-DD>` | perguntas não respondidas do dia, com id da conversa |
| `rate_limits` | `<ip>/<janela>` | contagem aproximada |

A conversa é gravada inteira ao fim de cada turno, sobrescrevendo a chave. Uma escrita por turno, não por mensagem.

A taxa de deflexão é derivada na leitura, percorrendo as conversas e contando as que não geraram chamado. Contador incremental produz divergência e não se justifica neste volume.

**Prefixo de tenant em toda chave** desde o início. O produto será reaproveitado em outros clientes, e isso é trivial agora e retrofit chato depois.

A persistência fica atrás de uma interface `ConversationStore`, com implementação `BlobStore`. Quando o volume justificar Postgres, troca-se a implementação sem tocar no restante do sistema. Mesma estratégia aplicada à `KnowledgeSource` (seção 4.1).

### Limites conhecidos

Blobs não têm consulta relacional nem agregação no servidor. Cálculo de métrica é leitura e varredura em memória. Isso é adequado para volume de piloto e deixa de ser quando o número de conversas tornar a varredura lenta. O gatilho de migração está na seção 7.5.

---

## 7. Solução definitiva

### 7.1 Widget embedado

O MVP entrega o balão dentro de uma página simulada, na própria aplicação. A versão definitiva é o mesmo balão embutido no portal real do cliente, o que exige empacotamento distribuível.

**Arquitetura em duas partes:**

1. **Loader** — script de ~3kb servido por CDN, incluído uma vez no portal. Cria o botão flutuante em Shadow DOM.
2. **Painel** — iframe apontando para o domínio da Kliente 360. Comunicação com o loader via `postMessage`.

**Por que iframe e não Shadow DOM puro para o painel:** isolamento real nos dois sentidos. O CSS e o JS do portal não interferem no widget, e o JS do portal não consegue ler o conteúdo da conversa. Com Shadow DOM apenas, a segunda garantia não existe.

**Vantagem operacional:** o loader é versionado e servido pela Kliente 360. A TotalPass integra uma vez, e as atualizações não dependem de deploy no portal deles.

**Pontos de atenção:** comportamento do teclado virtual em mobile, e sobrevivência do loader à navegação do portal caso seja uma SPA.

**Requisitos a solicitar ao time do portal, junto com o snippet:**

- CSP liberando o domínio da Kliente 360 em `script-src`, `connect-src` e `frame-src`
- Confirmação da origem para configuração de CORS

Este pedido precisa ser feito com antecedência. É a causa mais comum de o widget não carregar no dia da demonstração.

### 7.2 Identidade e consulta de chamados

Consulta de chamados só entra com identidade resolvida. Há dois níveis possíveis:

**Nível intermediário, sem depender do portal:** e-mail **mais** número do chamado. Sem listagem. Aceitar apenas o e-mail transformaria o endpoint em um listador de chamados de qualquer pessoa cujo endereço fosse adivinhado, o que em contexto B2B2C com e-mail corporativo previsível é vazamento de dado pessoal em escala. Quando o par não corresponder, a mensagem é sempre idêntica, independentemente de o e-mail existir, para não reintroduzir enumeração.

**Nível completo, com identidade do portal:** a listagem de chamados deixa de ser um risco, porque o identificador não é digitado, é lido de uma credencial assinada. Não há o que enumerar.

| Opção | Como funciona | Esforço do time do portal |
|---|---|---|
| Endpoint `/api/chat-token` | Widget chama same-origin, cookie de sessão vai junto, backend devolve JWT curto | endpoint novo |
| Segredo compartilhado | Backend assina JWT HS256 e injeta em `window` | ~10 linhas no template |
| OIDC contra o IdP | Kliente 360 como client OIDC, autenticação silenciosa | registro de app no IdP |

A terceira opção costuma ser **politicamente mais fácil**: registrar aplicação no IdP é tarefa curta do time de IAM, enquanto conseguir sprint do time do portal pode levar meses. Levantar qual IdP a TotalPass utiliza.

**Regra inegociável de implementação:** a query filtra pelo identificador **da claim do token**, jamais por parâmetro recebido na requisição. Aceitar `?contactId=` "para facilitar testes" reintroduz a vulnerabilidade inteira, com token e tudo. A consulta de detalhe também valida que o chamado pertence à claim antes de retornar.

### 7.3 Preparação já feita no MVP

Para que a transição não exija reescrita, o MVP já carrega no estado da conversa:

```ts
identity: {
  level: 'unverified' | 'verified'
  email?: string
  contactId?: string
}
```

No MVP existe apenas `unverified`. Quando o token entrar, o nível passa a ser preenchido pela claim e as funcionalidades dependentes acendem sem alteração na lógica.

### 7.4 Migração da base para o Salesforce Knowledge

Trocar `FilesystemSource` por `SalesforceSource`. O que a implementação nova precisa:

```sql
SELECT Id, ArticleNumber, Title, Summary, UrlName, LastPublishedDate,
       <CAMPO_CONTEUDO_CUSTOMIZADO__c>
FROM Knowledge__kav
WHERE PublishStatus = 'Online' AND Language = 'pt_BR'
WITH DATA CATEGORY <Grupo__c> ABOVE_OR_BELOW <Categoria__c>
```

Dependências a levantar antes:

- Nome da API do campo de conteúdo (customizado por org, nunca hardcoded)
- Feature license de **Knowledge User** no usuário de integração
- Grupo e nome da Data Category

Job de sincronização a cada 15 minutos, snapshot global por tenant (nunca por sessão), rich text convertido para markdown, checksum por artigo, e endpoint protegido de recarga manual.

### 7.5 Demais evoluções

| Item | Gatilho |
|---|---|
| pgvector + busca híbrida + reranking | base acima de ~150 artigos ou ~100k tokens |
| Sincronização via CDC / Platform Events | necessidade de publicação refletida em tempo real |
| Multi-tenant completo (painel, credenciais por tenant, branding) | segundo cliente contratado |
| Migração de Blobs para Postgres | varredura de métricas ficar lenta, ou necessidade de consulta ad hoc |
| CSAT e thumbs inline | após MVP estabilizado |
| Verificação de groundedness em segunda chamada | se houver reclamação recorrente de resposta incorreta |

Sobre CSAT, quando entrar: webchat não tem "encerrar". A maioria dos usuários resolve e fecha a aba. CSAT disparado apenas no fim coleta pouco e com viés negativo. O padrão que funciona é thumbs inline em cada resposta, mais **uma** pergunta de nota disparada por botão de encerrar ou por inatividade.

---

## 8. Ordem de implementação

1. **Integração Salesforce isolada** — autenticação JWT contra a sandbox, criação de Case com CaseComment, validada por script de linha de comando.
2. **Carga da base e montagem do prompt** — script que imprime o prompt final e a contagem de tokens.
3. **Motor de conversa** — tools, abstenção, confirmação de e-mail. Testado por script com perguntas reais, incluindo perguntas que a base não cobre.
4. **API de chat** com streaming.
5. **Painel de chat, depois página simulando o portal.** Nessa ordem: a página é cenário, não produto.
6. **Métricas e logs.**
7. **Rate limiting.**

A persistência entra apenas na etapa 6, mas o `ConversationStore` deve existir desde a etapa 3 com implementação em memória, para não acoplar o motor de conversa ao armazenamento.

Interface bonita sobre um motor que responde mal é demonstração que morre na primeira pergunta específica do cliente. A ordem importa.

---

## 9. Dependências e pendências

**Bloqueiam o início do desenvolvimento:**

- [ ] Developer Edition provisionada
- [ ] Connected App com Client Credentials Flow ativado e Run As User definido
- [ ] Usuário de integração com permissão de criação em Case e CaseComment
- [ ] 4 a 5 artigos provisórios em markdown, redigidos internamente, para não bloquear o build

**Bloqueiam a qualidade da demonstração (não o início):**

- [ ] Os 30 artigos reais, fornecidos pela TotalPass
- [ ] Logo, cores e prints do portal real, para a página simulada
- [ ] Responsável nomeado do lado da TotalPass para validar as respostas
- [ ] Nome, tom de voz e mensagem de abertura do assistente
- [ ] Comportamento definido para perguntas fora do escopo

**Configuração na Developer Edition:**

- [ ] Valor `Webchat` na picklist de `Origin` do Case
- [ ] Campos customizados (`Identidade_Verificada__c`, `Conversation_Id__c`) ou decisão de seguir sem eles

**Bloqueiam o go-live em produção:**

- [ ] Prazo de retenção de transcript definido
- [ ] Aceite formal do risco de e-mail autodeclarado na abertura de chamado
- [ ] Org de produção e usuário de integração definitivos
- [ ] Migração da org: troca de `SF_LOGIN_URL`, `SF_CLIENT_ID` e `SF_CLIENT_SECRET`
- [ ] Decisão sobre manter Client Credentials ou migrar para JWT Bearer, conforme exigência de segurança do cliente
- [ ] Procedimento de rotação do client secret definido

**Decisões pendentes:**

- [ ] Coexistência ou substituição em relação ao agente Theo
- [ ] IdP utilizado no portal, para planejamento da fase de identidade
- [ ] Responsável pela manutenção do conteúdo do lado da TotalPass
