# Spike — Ler o código da FOTO (revalida AD-008)

**Pergunta que este spike responde:** dá para o tesoureiro **tirar uma foto** da
nota e o app decodificar o **código de barras (NFe)** ou o **QR (NFC-e)** a partir
dessa foto estática — em vez de scan de vídeo ao vivo?

O spike `m0-hello-world` (2026-06-20) já testou isso **só com ZXing** e concluiu
que era não confiável → virou a decisão **AD-008** (scanner de vídeo ao vivo em
página à parte). Este spike **revalida** usando o motor que a produção usa hoje
como principal — o **`BarcodeDetector` nativo** — que nunca foi medido em foto.

## Como testar

1. Publique/abra a página **por HTTPS** (GitHub Pages: `docs/foto-spike/`).
   A câmera nativa (`<input capture>`) precisa de HTTPS no celular.
2. Abra no aparelho-alvo (**S24+, Chrome**).
3. Tire ~10 fotos de cada tipo, variando o enquadramento:
   - **NFe (DANFE)** — o código de barras longo (Code-128). Teste de perto (só o
     código, preenchendo a largura) **e** a nota inteira.
   - **NFC-e (cupom)** — o QR code. Idem: de perto e o cupom inteiro.
4. Também dá para usar **🖼️ Escolher da galeria** com fotos já salvas.

## O que reportar

O **placar da sessão** no rodapé da página:

- **Fotos testadas** / **algum motor acertou** → a taxa de acerto (%).
- Quantas o **BarcodeDetector** leu vs. quantas o **ZXing** leu.
- Quantas resultaram em **chave NFe válida (cDV)**.
- O bloco **Diagnóstico** (BarcodeDetector disponível? formatos suportados?).

Anote separadamente **NFe (barra)** e **NFC-e (QR)** — a expectativa é que o QR
decodifique bem por foto e o código de barras longo seja o caso difícil.

## Como ler o resultado

- **≥80% de acerto** (principalmente no QR) → vale construir o fluxo "foto → decodifica
  in-app", pelo menos para NFC-e; AD-008 fica parcialmente superada para foto.
- **40–80%** → viável só com boa orientação de enquadramento; decidir por tipo.
- **<40%** → AD-008 se mantém; seguir com o scanner de vídeo ao vivo.

> Lembrete de arquitetura: mesmo se a decodificação por foto funcionar, a
> extração da **NFC-e (modelo 65)** não roda no servidor (Cloudflare bloqueia
> `UrlFetchApp` — por isso hoje é client-side na página do scanner). In-app, a
> NFe **modelo 55** teria dados completos (via proxy) e a NFC-e cairia em dados
> parciais (fornecedor+data via BrasilAPI + link SEFAZ).
