# Spike M0 — Autorização por Papéis & Privacidade (servidor)

**O que este teste prova (desafio D do AD-007):**

- **Papéis enforçados no SERVIDOR** (não escondidos na UI): `admin`, `tesoureiro`, `leitor`, `funcionario`.
  Cada ação privilegiada chama `requireRole_()` antes de fazer qualquer coisa — se o papel
  não bate, o servidor lança erro, **mesmo que o cliente chame a função direto**.
- **Isolamento por linha (row-level):** no Banco de Horas, o funcionário enxerga **só o próprio**
  extrato/saldo; só `admin` vê o de todos. O filtro acontece no servidor — o visitante nunca
  toca na planilha.
- **Identidade do SSO como âncora:** `Session.getActiveUser().getEmail()` identifica quem chama
  (confiável dentro do domínio Google — já validado no spike Hello World / B-005).

> Spike descartável. Na 1ª execução cria uma planilha de exemplo com usuários, lançamentos
> e banco de horas fictícios. **Nenhum dado real.**

---

## Modelo de segurança (por que funciona)

| Decisão | Efeito |
| --- | --- |
| Web app **"Executar como: Eu (implantador)"** + acesso ao **domínio** | O script roda com a conta dona da planilha (tem a base); o **visitante não tem acesso direto ao Sheets** — só recebe o que as funções liberam. |
| Identidade vem de `Session.getActiveUser().getEmail()` | Âncora imutável; o cliente não consegue forjar quem é. |
| Toda função privilegiada começa com `requireRole_([...])` | Barreira **server-side**; esconder botões na UI é só cosmético. |
| **"Ver como"** (simulação) é privilégio de **admin** | Permite testar todos os papéis numa **única conta**. Um não-admin não simula. |
| Sair da simulação usa a identidade **real** | O admin nunca fica preso num papel menor. |
| Trava do **último admin** | `setRole` não deixa rebaixar o único admin (evita lockout). |

### Matriz de permissões

| Ação | admin | tesoureiro | leitor | funcionário |
| --- | :--: | :--: | :--: | :--: |
| Ver lançamentos | ✅ | ✅ | ✅ | ❌ |
| Adicionar lançamento | ✅ | ✅ | ❌ | ❌ |
| Excluir lançamento | ✅ | ❌ | ❌ | ❌ |
| Ver **meu** saldo (horas) | ✅ | ✅ | ✅ | ✅ |
| Ver saldo de **todos** | ✅ | ❌ | ❌ | ❌ |
| Ver saldo de **outro** | ✅ | ❌ | ❌ | ❌ |
| Gerenciar papéis | ✅ | ❌ | ❌ | ❌ |

---

## Como rodar (passo a passo)

> Pode ser feito numa **conta pessoal** (o motor é o mesmo). A identidade real será a
> sua; use **“Ver como”** para exercer cada papel. A validação multiusuário de verdade
> (vários e-mails do domínio) é coberta pela governança do tenant (B-004, spike Hello World).

1. **https://script.google.com** → **Novo projeto**.
2. `Código.gs`: apague tudo e cole [Code.gs](Code.gs).
3. **`+`** → **HTML**, nome exatamente **`Index`**, cole [Index.html](Index.html).
4. Configurações ⚙️ → mostrar `appsscript.json` → cole [appsscript.json](appsscript.json) (timezone + escopos de Sheets/Drive/e-mail).
5. **Salvar**.
6. **Implantar** → **Nova implantação** → ⚙️ → **App da Web**:
   - **Executar como:** `Eu`
   - **Quem pode acessar:** `Qualquer pessoa em Ensina Blumenau` (tenant) ou `Qualquer pessoa com Conta do Google` (pessoal).
7. **Implantar** → **autorizar** (pede Planilhas/Drive — o spike cria a planilha de exemplo).
8. Abra a **URL do App da Web**.

---

## Roteiro de validação (o que conferir)

1. **Sessão**: aparece seu e-mail real com o papel `admin`. Você é promovido a admin
   automaticamente (bootstrap): na 1ª execução em conta pessoal o `getActiveUser()` pode vir
   vazio durante a autorização e a base nasce sem admin — ao recarregar já logado, o servidor
   detecta “nenhum admin” e promove o usuário real. **Se aparecer `desconhecido`, recarregue a página.**
2. **Como admin**: vê lançamentos, adiciona, exclui; “Ver saldo de todos” lista todos; o
   cartão **Gerenciar papéis** aparece.
3. **Ver como → Lúcia Leitora (leitor)** → “Entrar nesse papel”:
   - Continua **vendo** lançamentos, mas **Adicionar** retorna *“🛡️ Bloqueado pelo servidor”*.
   - No painel **Teste de barreira**, “Adicionar”, “Excluir”, “Ver saldo de todos”, “Ver saldo do Bruno”
     e “Tornar a Ana admin” todos devem dar **🛡️ Bloqueado pelo servidor**.
4. **Ver como → Ana (funcionário)**:
   - **Ver meu saldo** mostra **só a Ana** (3 h).
   - **Ver saldo de todos** e **Ver saldo do Bruno** → **bloqueado**. (Prova do isolamento.)
5. **Ver como → Tina (tesoureiro)**: **adiciona** lançamento, mas **excluir** e **ver todos os saldos** → bloqueado.
6. **Sair da simulação** → volta a admin (mesmo tendo “virado” leitor antes).
7. **Gerenciar papéis**: tente rebaixar você mesmo (único admin) → **bloqueado** (trava de lockout).

> O ponto central: os botões de “ataque” chamam as funções **direto**, sem passar pela UI.
> Se mesmo assim o servidor recusa, está provado que a autorização é **server-side**.

**Reset:** rode a função `resetData` no editor para recriar os dados de exemplo.

---

## Notas de design

- **`executeAs: USER_DEPLOYING`** é proposital: o servidor precisa de acesso à base para poder
  **filtrar** e devolver só o permitido. Se fosse `USER_ACCESSING`, cada usuário precisaria de
  permissão direta na planilha — o que quebra o isolamento.
- **Sanitização na fronteira** (`sanitizeLancamento_`): tipo restrito a entrada/saída, valor
  numérico ≥ 0, strings cortadas e sem caracteres de controle (mitiga XSS/injeção vinda do cliente).
- **Auditoria mínima**: cada lançamento grava `CriadoPor` (e-mail efetivo) + `CriadoEm`.
