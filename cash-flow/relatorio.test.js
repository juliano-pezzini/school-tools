// cash-flow/relatorio.test.js — Testes dos helpers e funções de relatório (logic.js)
import { describe, it, expect } from 'vitest';
import {
  escapeHtml_,
  toSortedPairs_,
  pct_,
  reportPdfFileName_,
  computeMonthReport_,
  computeAnnualReport_,
  buildInsights_,
  buildSvgBars_,
  buildMonthlyPdfHtml_,
  buildAnnualPdfHtml_,
  MONTH_NAMES_REL
} from './logic.js';

// ===========================================================================
// T1 — Helpers puros de relatório
// ===========================================================================

describe('escapeHtml_', () => {
  it('escapa & < > " \'', () => {
    expect(escapeHtml_('a & b < c > d "e" f\'g'))
      .toBe('a &amp; b &lt; c &gt; d &quot;e&quot; f&#39;g');
  });

  it('retorna string inalterada quando não há caracteres especiais', () => {
    expect(escapeHtml_('texto simples 123')).toBe('texto simples 123');
  });

  it('converte não-strings para string', () => {
    expect(escapeHtml_(42)).toBe('42');
    expect(escapeHtml_(null)).toBe('null');
    expect(escapeHtml_(undefined)).toBe('undefined');
  });
});

describe('toSortedPairs_', () => {
  it('retorna pares ordenados por value decrescente', () => {
    expect(toSortedPairs_({ a: 10, b: 30, c: 20 })).toEqual([
      { key: 'b', value: 30 },
      { key: 'c', value: 20 },
      { key: 'a', value: 10 }
    ]);
  });

  it('retorna array vazio para objeto vazio', () => {
    expect(toSortedPairs_({})).toEqual([]);
  });

  it('lida com valores iguais (ordem estável entre chaves)', () => {
    var result = toSortedPairs_({ x: 5, y: 5 });
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(5);
    expect(result[1].value).toBe(5);
  });
});

describe('pct_', () => {
  it('calcula percentual inteiro', () => {
    expect(pct_(50, 200)).toBe('25%');
  });

  it('retorna 0% quando whole é zero', () => {
    expect(pct_(0, 0)).toBe('0%');
  });

  it('retorna 0% quando whole é falsy (null/undefined)', () => {
    expect(pct_(10, null)).toBe('0%');
    expect(pct_(10, undefined)).toBe('0%');
  });

  it('arredonda para o inteiro mais próximo', () => {
    expect(pct_(1, 3)).toBe('33%');
    expect(pct_(2, 3)).toBe('67%');
  });

  it('retorna 100% quando part === whole', () => {
    expect(pct_(500, 500)).toBe('100%');
  });
});

describe('reportPdfFileName_', () => {
  it('gera nome para relatório mensal', () => {
    expect(reportPdfFileName_('mensal', '2025-07'))
      .toBe('Relatorio_APP_mensal_2025-07.pdf');
  });

  it('gera nome para relatório anual', () => {
    expect(reportPdfFileName_('anual', '2025'))
      .toBe('Relatorio_APP_anual_2025.pdf');
  });
});

// ===========================================================================
// T2 — Agregação + builders
// ===========================================================================

// Helper: cria um row de lançamento para testes
function makeRow(id, date, tipo, categoria, valor, opts) {
  opts = opts || {};
  return {
    Id: id,
    Data: date,
    Tipo: tipo,
    Categoria: categoria,
    Valor: valor,
    Descricao: opts.descricao || '',
    ComprovanteId: opts.comprovanteId || '',
    ComprovanteUrl: opts.comprovanteUrl || '',
    Excluido: opts.excluido || false,
    CriadoEm: opts.criadoEm || date.toISOString()
  };
}

describe('computeMonthReport_', () => {
  var config = { saldoAbertura: 1000 };
  var rows = [
    makeRow('L1', new Date(2025, 0, 10), 'entrada', 'Contribuição', 500),
    makeRow('L2', new Date(2025, 0, 15), 'saida', 'Material', 200),
    makeRow('L3', new Date(2025, 1, 5), 'entrada', 'Cantina', 300),
    makeRow('L4', new Date(2025, 1, 10), 'saida', 'Limpeza', 100),
    makeRow('L5', new Date(2025, 1, 12), 'saida', 'Material', 150, { excluido: true }),
    makeRow('L6', new Date(2025, 0, 20), 'entrada', 'Doação', 100, { comprovanteId: 'F1', comprovanteUrl: 'https://drive/F1' })
  ];

  it('retorna totais corretos do mês (REL-01)', () => {
    var r = computeMonthReport_(config, rows, '2025-02', []);
    expect(r.entradasMes).toBe(300);
    expect(r.saidasMes).toBe(100);
    expect(r.saldoMes).toBe(200);
    // acumulado: 1000 + (500+100+300) - (200+100) = 1600
    expect(r.saldoAcumulado).toBe(1600);
  });

  it('lista lançamentos não-excluídos do mês com ComprovanteUrl (REL-02)', () => {
    var r = computeMonthReport_(config, rows, '2025-02', []);
    // L5 (excluído) deve ser omitido; L3 e L4 são do mês 02
    expect(r.lancamentos).toHaveLength(2);
    var ids = r.lancamentos.map(function (l) { return l.Id; });
    expect(ids).toContain('L3');
    expect(ids).toContain('L4');
  });

  it('inclui TemComprovante e ComprovanteUrl para lançamentos com comprovante (REL-02)', () => {
    var r = computeMonthReport_(config, rows, '2025-01', []);
    var l6 = r.lancamentos.find(function (l) { return l.Id === 'L6'; });
    expect(l6.TemComprovante).toBe(true);
    expect(l6.ComprovanteUrl).toBe('https://drive/F1');
    var l1 = r.lancamentos.find(function (l) { return l.Id === 'L1'; });
    expect(l1.TemComprovante).toBe(false);
  });

  it('marca provisório quando mês NÃO está fechado (REL-03)', () => {
    var r = computeMonthReport_(config, rows, '2025-01', []);
    expect(r.provisorio).toBe(true);
  });

  it('marca oficial quando mês ESTÁ fechado (REL-03)', () => {
    var r = computeMonthReport_(config, rows, '2025-01', ['2025-01']);
    expect(r.provisorio).toBe(false);
  });

  it('renderiza relatório vazio para mês sem lançamentos (REL-04)', () => {
    var r = computeMonthReport_(config, rows, '2025-06', []);
    expect(r.entradasMes).toBe(0);
    expect(r.saidasMes).toBe(0);
    expect(r.saldoMes).toBe(0);
    expect(r.lancamentos).toHaveLength(0);
  });

  it('trata abertura indefinida como 0', () => {
    var r = computeMonthReport_(null, rows, '2025-01', []);
    // sem abertura: 0 + 500 + 100 - 200 = 400
    expect(r.saldoAcumulado).toBe(400);
  });

  it('ignora lançamentos excluídos em todos os cálculos', () => {
    var r = computeMonthReport_(config, rows, '2025-02', []);
    // L5 (excluído, saída 150) é ignorado → saídas = 100
    expect(r.saidasMes).toBe(100);
  });

  it('formata mesFmt como MM/YYYY', () => {
    var r = computeMonthReport_(config, rows, '2025-02', []);
    expect(r.mesFmt).toBe('02/2025');
  });
});

describe('computeAnnualReport_', () => {
  var config = { saldoAbertura: 500 };
  var rows = [
    makeRow('L1', new Date(2025, 0, 10), 'entrada', 'Contribuição', 1000),
    makeRow('L2', new Date(2025, 0, 15), 'saida', 'Material', 400),
    makeRow('L3', new Date(2025, 5, 5), 'entrada', 'Evento', 2000),
    makeRow('L4', new Date(2025, 5, 10), 'saida', 'Evento', 800),
    makeRow('L5', new Date(2025, 11, 3), 'saida', 'Limpeza', 300),
    makeRow('L6', new Date(2025, 2, 1), 'entrada', 'Contribuição', 500, { excluido: true })
  ];

  it('retorna KPIs anuais corretos (REL-05)', () => {
    var r = computeAnnualReport_(config, rows, 2025, []);
    expect(r.totalEntradas).toBe(3000);
    expect(r.totalSaidas).toBe(1500);
    expect(r.resultado).toBe(1500);
  });

  it('retorna 12 meses com séries (REL-07)', () => {
    var r = computeAnnualReport_(config, rows, 2025, []);
    expect(r.meses).toHaveLength(12);
  });

  it('Σ mensal == totais anuais (REL-09)', () => {
    var r = computeAnnualReport_(config, rows, 2025, []);
    var sumE = r.meses.reduce(function (s, m) { return s + m.entradas; }, 0);
    var sumS = r.meses.reduce(function (s, m) { return s + m.saidas; }, 0);
    expect(Math.round(sumE * 100) / 100).toBe(r.totalEntradas);
    expect(Math.round(sumS * 100) / 100).toBe(r.totalSaidas);
  });

  it('saldoAcumulado ao fim do ano == meses[11].acumulado', () => {
    var r = computeAnnualReport_(config, rows, 2025, []);
    expect(r.saldoAcumulado).toBe(r.meses[11].acumulado);
  });

  it('retorna porCategoria normalizada e ordenada por total desc (REL-06)', () => {
    var r = computeAnnualReport_(config, rows, 2025, []);
    expect(r.porCategoriaSaida[0].total).toBeGreaterThanOrEqual(r.porCategoriaSaida[r.porCategoriaSaida.length - 1].total);
  });

  it('ignora lançamentos excluídos (L6 não conta)', () => {
    var r = computeAnnualReport_(config, rows, 2025, []);
    // L6 excluída (entrada 500) não deve contar → totalEntradas = 1000+2000 = 3000
    expect(r.totalEntradas).toBe(3000);
  });

  it('porCategoriaEntrada exclui lançamentos com Excluido=true', () => {
    var r = computeAnnualReport_(config, rows, 2025, []);
    // L6 (Contribuição, 500, excluída) não deve aparecer na soma de categorias
    var contrib = r.porCategoriaEntrada.find(function (c) { return c.categoria === 'Contribuição'; });
    expect(contrib.total).toBe(1000); // só L1; L6 excluída
  });

  it('gera insights (REL-08)', () => {
    var r = computeAnnualReport_(config, rows, 2025, []);
    expect(r.insights.length).toBeGreaterThan(0);
    expect(r.insights.some(function (s) { return s.indexOf('Melhor mês') >= 0; })).toBe(true);
    expect(r.insights.some(function (s) { return s.indexOf('Resultado de 2025') >= 0; })).toBe(true);
  });

  it('marca provisório/oficial por mês (REL-03)', () => {
    var r = computeAnnualReport_(config, rows, 2025, ['2025-01']);
    expect(r.meses[0].provisorio).toBe(false); // jan fechado
    expect(r.meses[1].provisorio).toBe(true);  // fev aberto
  });

  it('ano vazio retorna totais zerados (REL-04)', () => {
    var r = computeAnnualReport_(config, [], 2025, []);
    expect(r.totalEntradas).toBe(0);
    expect(r.totalSaidas).toBe(0);
    expect(r.resultado).toBe(0);
  });
});

describe('buildInsights_', () => {
  var meses = [];
  for (var i = 0; i < 12; i++) {
    meses.push({ saldo: (i === 5 ? 1200 : (i === 8 ? -300 : 100)) });
  }
  var catE = [{ categoria: 'Contribuição', total: 5000 }];
  var catS = [{ categoria: 'Material', total: 3000 }];

  it('inclui melhor mês, mês apertado, meses no vermelho, maior despesa, receita, média, resultado', () => {
    var ins = buildInsights_(2025, meses, catE, catS, 10000, 6000);
    expect(ins.some(function (s) { return s.indexOf('Melhor mês: jun') >= 0; })).toBe(true);
    expect(ins.some(function (s) { return s.indexOf('vermelho') >= 0; })).toBe(true);
    expect(ins.some(function (s) { return s.indexOf('Material') >= 0; })).toBe(true);
    expect(ins.some(function (s) { return s.indexOf('Contribuição') >= 0; })).toBe(true);
    expect(ins.some(function (s) { return s.indexOf('Média') >= 0; })).toBe(true);
    expect(ins.some(function (s) { return s.indexOf('superávit') >= 0; })).toBe(true);
  });

  it('retorna déficit quando saídas > entradas', () => {
    var ins = buildInsights_(2025, meses, catE, catS, 5000, 6000);
    expect(ins.some(function (s) { return s.indexOf('déficit') >= 0; })).toBe(true);
  });

  it('retorna array vazio para meses vazio', () => {
    expect(buildInsights_(2025, [], [], [], 0, 0)).toEqual([]);
  });
});

describe('buildSvgBars_', () => {
  it('retorna SVG com tag de abertura', () => {
    var meses = [];
    for (var i = 0; i < 12; i++) meses.push({ saldo: 100 * (i + 1) });
    var svg = buildSvgBars_(meses);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('</svg>');
  });

  it('inclui barras vermelhas para saldo negativo', () => {
    var meses = [];
    for (var i = 0; i < 12; i++) meses.push({ saldo: i === 3 ? -500 : 200 });
    var svg = buildSvgBars_(meses);
    expect(svg).toContain('#c5221f');
  });
});

describe('buildMonthlyPdfHtml_', () => {
  var report = {
    mes: '2025-07', ano: 2025, mesFmt: '07/2025',
    entradasMes: 1000, saidasMes: 400, saldoMes: 600, saldoAcumulado: 2600,
    provisorio: false,
    lancamentos: [
      { Id: 'L1', Data: '15/07/2025', Tipo: 'saida', Categoria: 'Material',
        Valor: 400, Descricao: 'Compra', ComprovanteUrl: 'https://drive/F1', TemComprovante: true },
      { Id: 'L2', Data: '10/07/2025', Tipo: 'entrada', Categoria: 'Doação',
        Valor: 1000, Descricao: 'Doação anônima', ComprovanteUrl: '', TemComprovante: false }
    ]
  };

  it('contém link de comprovante para lançamento com comprovante (REL-13)', () => {
    var html = buildMonthlyPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('href="https://drive/F1"');
    expect(html).toContain('>ver</a>');
  });

  it('mostra "—" para lançamento sem comprovante', () => {
    var html = buildMonthlyPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('—');
  });

  it('contém aviso de privacidade (REL-13)', () => {
    var html = buildMonthlyPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('links de comprovante são públicos');
  });

  it('mostra badge oficial para mês fechado (REL-03)', () => {
    var html = buildMonthlyPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('Oficial');
  });

  it('mostra badge provisório para mês aberto', () => {
    var r = Object.assign({}, report, { provisorio: true });
    var html = buildMonthlyPdfHtml_(r, '17/07/2026 às 10:00');
    expect(html).toContain('Provisório');
  });

  it('contém KPIs em R$ pt-BR', () => {
    var html = buildMonthlyPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('R$ 1.000,00');
    expect(html).toContain('R$ 400,00');
  });

  it('sanitiza HTML em campos de texto (XSS)', () => {
    var r = Object.assign({}, report, {
      lancamentos: [
        { Id: 'L1', Data: '01/01/2025', Tipo: 'saida', Categoria: '<script>',
          Valor: 10, Descricao: 'a<b>c', ComprovanteUrl: '', TemComprovante: false }
      ]
    });
    var html = buildMonthlyPdfHtml_(r, '01/01/2025');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a&lt;b&gt;c');
  });
});

describe('buildAnnualPdfHtml_', () => {
  var report = {
    ano: 2025,
    totalEntradas: 10000, totalSaidas: 6000, resultado: 4000,
    saldoAcumulado: 4500,
    meses: [],
    porCategoriaEntrada: [{ categoria: 'Contribuição', total: 8000 }],
    porCategoriaSaida: [{ categoria: 'Material', total: 3000 }, { categoria: 'Limpeza', total: 2000 }],
    insights: ['Melhor mês: jun.', 'Resultado de 2025: superávit.']
  };
  for (var i = 0; i < 12; i++) {
    report.meses.push({
      mesKey: '2025-' + String(i + 1).padStart(2, '0'),
      mesFmt: String(i + 1).padStart(2, '0') + '/2025',
      entradas: 833, saidas: 500, saldo: 333, acumulado: 333 * (i + 1),
      provisorio: true
    });
  }

  it('contém KPIs anuais', () => {
    var html = buildAnnualPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('R$ 10.000,00');
    expect(html).toContain('R$ 6.000,00');
    expect(html).toContain('R$ 4.000,00');
  });

  it('contém SVG de barras', () => {
    var html = buildAnnualPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('<svg');
    expect(html).toContain('</svg>');
  });

  it('contém tabela de categorias', () => {
    var html = buildAnnualPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('Contribuição');
    expect(html).toContain('Material');
  });

  it('contém insights', () => {
    var html = buildAnnualPdfHtml_(report, '17/07/2026 às 10:00');
    expect(html).toContain('Melhor mês: jun.');
    expect(html).toContain('superávit');
  });

  it('contém tabela de movimento mensal com 12 linhas', () => {
    var html = buildAnnualPdfHtml_(report, '17/07/2026 às 10:00');
    // Each month name should appear
    expect(html).toContain('>jan<');
    expect(html).toContain('>dez<');
  });
});
