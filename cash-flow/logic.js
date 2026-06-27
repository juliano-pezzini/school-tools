// cash-flow/logic.js — lógica pura do Fluxo de Caixa.
//
// Padrão dual-environment: este arquivo precisa rodar tanto no Node (para os
// testes Vitest) quanto no Apps Script (deploy via clasp, que converte .js → .gs).
// - No Apps Script NÃO existe `module`/`require`; o arquivo compartilha o escopo
//   global com Code.gs (sem `import`/`export`). Por isso o guard abaixo testa
//   `typeof module` antes de tocar em `module.exports` — assim não há ReferenceError.
// - No Node, o guard popula `module.exports` e os testes importam as funções puras.
//
// As funções puras são adicionadas na Phase 2; este stub fica intencionalmente vazio.

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}
