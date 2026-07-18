# Comprovantes Context

**Gathered:** 2026-07-16
**Spec:** `.specs/features/comprovantes/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Anexar **um** comprovante (foto do celular, imagem da galeria ou PDF) a um lançamento do Fluxo de Caixa, guardá-lo no Google Drive e visualizá-lo depois. Anexo é opcional. Não inclui NFe/NFC-e, OCR, múltiplos anexos, nem renderização dentro do relatório público (só grava a referência/link com permissão pública).

---

## Implementation Decisions

### Meios de captura e tipos de arquivo

- Foto pela câmera nativa do celular via `<input type="file" accept="image/*,application/pdf" capture="environment">` (B-005: câmera ao vivo bloqueada no HtmlService, mas o `<input capture>` nativo funciona).
- Também aceita imagem da galeria e PDF.
- Whitelist server-side: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `application/pdf`. Máx. 10 MB.

### Quantidade por lançamento

- **Exatamente um** comprovante por lançamento.
- Anexar um novo quando já existe = **substituir** (o anterior vai para a lixeira do Drive `setTrashed(true)`).

### Quando anexar / substituir / remover

- No registro do lançamento **e** depois — mas **só enquanto o mês estiver aberto**.
- Mês fechado → anexar/substituir/remover bloqueado, revalidado no servidor (reusa `assertPeriodOpen_`).

### Visibilidade / privacidade

- Arquivo gravado com permissão **"qualquer pessoa com o link pode ver"** (público), para aparecer nos relatórios dos pais (B-006), reusando o padrão do spike `m0-reports`.
- ⚠️ Trade-off aceito pelo usuário: comprovante acessível por link sem login. Diverge conscientemente de "evitar link público" (AD-005). A UI deve avisar discretamente para não anexar documentos com dados pessoais sensíveis.

### Ciclo de vida ao excluir o lançamento

- Soft-delete do lançamento → arquivo do comprovante vai para a **lixeira** do Drive (recuperável ~30 dias), referência da linha limpa.

### Obrigatoriedade

- Comprovante **opcional** para todos os lançamentos (MVP). Nunca bloqueia o registro.

### Storage e schema (derivado)

- Pasta dedicada no Drive criada sob demanda; id em `PropertiesService` (`COMPROVANTES_FOLDER_ID`).
- Arquivo nomeado `<lancamentoId>_<timestamp>.<ext>`.
- Duas novas colunas na aba `Lancamentos`: `ComprovanteId`, `ComprovanteUrl` (aditivas, ao final; linhas antigas = "sem comprovante").

### Falha, concorrência e auditoria (derivado)

- Falha de upload não bloqueia nem perde o lançamento (anexo opcional) — informa e permite retry.
- Anexo/substituição/remoção sob `LockService`; substituição idempotente (sem arquivo órfão/duplicado).
- Auditoria append-only para `anexar` / `substituir` / `remover_comprovante`, consistente com LANC-12.

### Agent's Discretion

- Layout exato do controle de upload e do indicador "com/sem comprovante" na UI (dentro do estilo pt-BR já usado em `Index.html`).
- Formato do resumo gravado na coluna `Detalhe` da aba `Auditoria`.
- Ícone/rótulo do link de visualização.

### Declined / Undiscussed Gray Areas → Assumptions

- Nenhuma área foi declinada; todos os gray areas apresentados foram respondidos. Defaults derivados (tipos, tamanho, pasta, colunas, falha, concorrência, papéis) estão registrados na tabela **Assumptions & Open Questions** do `spec.md`.

---

## Specific References

- Padrão de storage + link público do Drive: spike `spikes/m0-reports/` (Chart/PDF/relatório com `DriveApp.Access.ANYONE_WITH_LINK + Permission.VIEW`).
- Câmera nativa por `<input capture>`: lição B-005 do STATE.
- Auth seam, `LockService`, aba `Auditoria`: feature `lancamentos-saldo` (`cash-flow/Code.gs`).

---

## Deferred Ideas

- Múltiplos comprovantes por lançamento (galeria de anexos) — fora do MVP.
- OCR/extração de valor do comprovante — pertence à feature "Captura por NFe/NFC-e".
- Miniatura (thumbnail) inline na lista em vez de só link — melhoria de UX futura.
