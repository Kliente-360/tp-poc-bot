# Metadados do Salesforce

Tudo que este projeto precisa que exista na org. Versionado para que a migração
da sandbox para a org de produção do cliente seja um deploy, e não uma sequência
de cliques no Setup.

```bash
sf project deploy start -d salesforce/force-app -o <alias-da-org>
```

## Componentes

| Componente | Para quê |
|---|---|
| `StandardValueSet/CaseOrigin` | adiciona `Webchat` à picklist `Origin` do Case |
| `objects/Case/fields/Conversation_Id__c` | Text(64), External ID — liga o chamado à conversa gravada do nosso lado |
| `connectedApps/Kliente360_Chatbot_POC` | OAuth Client Credentials, server-to-server |
| `permissionsets/Kliente360_Chatbot_Integration` | permissões mínimas do usuário de integração |

## Dois passos que o deploy NÃO faz

A Metadata API não expõe nenhum dos dois. São manuais, no Setup:

1. **Run As User** — App Manager → o app → Manage → Edit Policies → seção Client
   Credentials Flow. Aponte para um usuário de integração dedicado com o
   permission set acima. Nunca um administrador.
2. **Consumer Secret** — App Manager → o app → View → Manage Consumer Details.
   Vai para `SF_CLIENT_SECRET`, só no servidor.

## Armadilhas que custaram tempo

- **`SF_LOGIN_URL` é o My Domain da org**, não `login`/`test.salesforce.com`.
  Nos domínios genéricos o Client Credentials responde
  `invalid_grant: request not supported on this domain`.
- **`<permissionSetName>` espera o _label_** ("Kliente360 Chatbot Integration"),
  não o API name. Com o API name o deploy falha dizendo que o permission set não
  existe — mensagem que engana.
- Connected App recém-criado leva de 2 a 10 minutos para propagar. Antes disso o
  token volta `invalid_client_id`.
