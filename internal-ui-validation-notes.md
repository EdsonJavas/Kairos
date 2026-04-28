# Validação visual da área interna do Unimar Organiza

- A rota `/app` está acessível e renderiza o dashboard interno autenticado, não apenas a landing page.
- A sidebar interna mostra navegação para **Painel**, **Calendário**, **Agenda** e **Notificações**.
- O cabeçalho exibe alternância entre visões **Ver aluno** e **Ver professor**, além das ações **Hoje** e **Novo evento**.
- O dashboard interno já apresenta blocos reais para métricas, resumo semanal, próximos movimentos e alertas recentes.
- No estado atual de dados, a interface mostra corretamente estados vazios explícitos para eventos, agenda e notificações, o que confirma que a aplicação está preparada para fluxos sem dados.
- Ainda falta validar visualmente a rota de **Calendário** e a exposição do formulário interno do professor dentro do sistema autenticado.

## Validação adicional do interior

A rota `/agenda` está operacional e apresenta métricas reais, barra de pesquisa, filtros por categoria e prioridade, além da lista cronológica da agenda futura com estado vazio explícito quando não há eventos. A rota `/calendario` também está funcional e expõe o calendário mensal, o painel da data selecionada, a legenda cromática correta e o formulário completo do professor com título, categoria, prioridade, data, encerramento, opção de dia inteiro e descrição detalhada.

Com esta verificação, ficou confirmado que o interior do sistema deixou de ser apenas uma home page e passou a incluir, visualmente, as áreas centrais de operação pedidas pelo utilizador. Ainda é recomendável validar a alternância para a experiência de aluno e, idealmente, testar o ciclo completo de criação/visualização de um evento no próprio ambiente.

A alternância entre **Ver aluno** e **Ver professor** está funcional. Na visão de aluno, o bloco lateral do compositor desaparece e é substituído por um painel de foco com compromissos e notificações, enquanto na visão de professor reaparece o formulário completo de publicação de eventos. Isto confirma que os dois perfis agora possuem experiências internas distintas e coerentes com o escopo do produto.
