# Central do Assinante — Base RAG

## Entrada 1
### Pergunta
Como acessar a Central do Assinante pelo site?
### Resposta
1. Acesse o site oficial da TR Telecom e use o menu superior fixo.
2. Clique na opção `Central`, que direciona para a rota `/portal`.
3. Na página exibida, informe seu documento (CPF ou CNPJ, somente números) e a senha cadastrada.
4. Pressione `Entrar` para carregar o painel da Central do Assinante.
5. Caso existam múltiplos cadastros associados ao documento, selecione o endereço correto na lista apresentada e confirme o login.
### Observações
- O login aceita apenas CPF ou CNPJ e a senha do assinante.
- Não há suporte a contas administrativas nesta orientação pública.

## Entrada 2
### Pergunta
Quais informações aparecem ao entrar na Central do Assinante?
### Resposta
A tela inicial mostra três cartões de resumo:
- `Plano Atual`: nome do plano ativo obtido do cadastro PPPoE.
- `Status da Rede`: estado atual (por exemplo, ONLINE ou OFFLINE).
- `Próximo Vencimento`: data da próxima fatura disponível.
Esses dados são carregados automaticamente após o login com o CPF ou CNPJ do titular.

## Entrada 3
### Pergunta
O que está disponível na aba Financeiro?
### Resposta
A aba `Financeiro` apresenta:
- `Fatura Atual`: valor e data de vencimento da próxima cobrança, com botão para baixar a 2ª via.
- `Liberação em Confiança`: quando o status PPPoE indicar bloqueio, o assinante pode solicitar desbloqueio temporário.
- `Histórico de Faturas`: lista ordenada com status (Pago, Pendente, Vencido) e acesso ao PDF de cada boleto.
- `Formas de Pagamento`:
  - Boleto bancário com código de barras copiável e download do carnê.
  - PIX com QR Code gerado em tempo real e botão para copiar o código.
Todos os dados financeiras são vinculados ao CPF/CNPJ informado no login.

## Entrada 4
### Pergunta
Como funciona a aba Suporte?
### Resposta
A aba `Suporte` possui duas seções:
1. `Diagnóstico`: consulta automática ao status PPPoE do documento informado no login, indicando se a conexão está ONLINE ou OFFLINE, possíveis causas (como falta de energia ou rompimento de fibra), tempo de atividade e acesso rápido ao extrato de conexão. Também há botão para abrir contato via WhatsApp com mensagem pré-preenchida e link externo para teste de velocidade.
2. `Abrir Chamado`: formulário para registrar chamados escolhendo setor, motivo, telefone de contato e descrição (todos obrigatórios). O envio utiliza os dados do CPF/CNPJ do assinante.
Além disso, a tela mostra alertas sobre ordens de serviço abertas ou concluídas vinculadas ao documento.

## Entrada 5
### Pergunta
Quais recursos existem na aba Meu Plano?
### Resposta
A aba `Meu Plano` concentra:
- Resumo do plano atual com nome, valor mensal (com base na fatura mais recente) e velocidade contratada.
- Indicativo do status PPPoE (ONLINE/OFFLINE) e benefícios inclusos como suporte técnico, atendimento 24h e acesso ao aplicativo da Central do Assinante.
- Sugestões de upgrade com planos ativos superiores; ao escolher um, abre-se o WhatsApp da TR Telecom com mensagem que inclui o CPF/CNPJ do assinante.
- Catálogo de serviços adicionais (telefonia fixa/móvel, TV app, segurança, telemedicina, rastreamento etc.), cada um levando ao WhatsApp para manifestar interesse vinculado ao documento do cliente.

## Entrada 6
### Pergunta
O que posso consultar na aba Perfil?
### Resposta
Na aba `Perfil`, o assinante verifica:
- Nome completo e e-mail de contato cadastrados.
- Documento formatado (CPF ou CNPJ) e valor mensal estimado.
- Identificador do cliente usado na rede (ex.: código PPPoE).
- Status do cadastro (Ativo ou Reduzido) e endereço completo vinculado ao contrato.
- Botão `Sair da Conta` para encerrar a sessão com segurança.
Todas as informações são apenas de leitura, refletindo o cadastro associado ao CPF/CNPJ usado no login.

## Entrada 7
### Pergunta
Como abrir o chat da assistente Lia na Central do Assinante?
### Resposta
Após o login, um botão flutuante do chat `Lia` fica disponível em todas as telas do portal. Ele utiliza automaticamente o CPF/CNPJ do usuário autenticado para contextualizar o atendimento. O chat permite tirar dúvidas rápidas, solicitar suporte e receber orientações sem sair da Central.

## Entrada 8
### Pergunta
Como faço logout na Central do Assinante?
### Resposta
Na aba `Perfil`, utilize o botão `Sair da Conta`. Ele encerra a sessão e retorna à tela de login, onde será necessário informar novamente CPF/CNPJ e senha para acessar.


