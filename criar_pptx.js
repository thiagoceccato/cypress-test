const pptxgen = require('pptxgenjs');
const fs = require('fs');

// Criar apresentacao
const pptx = new pptxgen();

// Configuracoes gerais
pptx.author = 'Auditoria GA4';
pptx.title = 'Auditoria GA4 - Sicredi';
pptx.subject = 'Analise de Cobertura de Disparos Google Analytics 4';
pptx.company = 'Sicredi';

// Cores
const VERDE_SICREDI = '00A859';
const VERDE_ESCURO = '006B3F';
const CINZA_ESCURO = '1a1a2e';
const BRANCO = 'FFFFFF';
const VERMELHO = 'FF4757';
const AMARELO = 'F7D100';
const LARANJA = 'FFA502';

// ========== SLIDE 1: CAPA ==========
let slide1 = pptx.addSlide();
slide1.background = { color: CINZA_ESCURO };

slide1.addText('SICREDI', {
    x: 0, y: 1.5, w: '100%', h: 0.5,
    fontSize: 18, color: VERDE_SICREDI, align: 'center',
    fontFace: 'Arial', bold: true, charSpacing: 10
});

slide1.addText('Auditoria GA4', {
    x: 0, y: 2.3, w: '100%', h: 1,
    fontSize: 54, color: VERDE_SICREDI, align: 'center',
    fontFace: 'Arial', bold: true
});

slide1.addText('Analise de Cobertura de Disparos Google Analytics 4', {
    x: 0, y: 3.3, w: '100%', h: 0.5,
    fontSize: 20, color: 'AAAAAA', align: 'center',
    fontFace: 'Arial'
});

slide1.addText('Coleta realizada em 07/12/2025', {
    x: 0, y: 4.5, w: '100%', h: 0.4,
    fontSize: 12, color: '666666', align: 'center',
    fontFace: 'Arial'
});

// ========== SLIDE 2: RESUMO EXECUTIVO ==========
let slide2 = pptx.addSlide();
slide2.background = { color: CINZA_ESCURO };

slide2.addText('Resumo Executivo', {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32, color: BRANCO, fontFace: 'Arial', bold: true
});

// Linha verde decorativa
slide2.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 0.08, h: 0.5, fill: { color: VERDE_SICREDI }
});

// Cards de metricas
const metricas = [
    { valor: '2.439', label: 'Elementos Analisados', x: 0.5 },
    { valor: '119', label: 'Paginas Auditadas', x: 2.95 },
    { valor: '23', label: 'Categorias de Produto', x: 5.4 },
    { valor: '62%', label: 'Cobertura GA4', x: 7.85 }
];

metricas.forEach(m => {
    // Card background
    slide2.addShape(pptx.ShapeType.roundRect, {
        x: m.x, y: 1.8, w: 2.2, h: 1.8,
        fill: { color: '2d2d44' },
        line: { color: '3d3d54', pt: 1 }
    });
    // Linha verde no topo
    slide2.addShape(pptx.ShapeType.rect, {
        x: m.x, y: 1.8, w: 2.2, h: 0.05, fill: { color: VERDE_SICREDI }
    });
    // Valor
    slide2.addText(m.valor, {
        x: m.x, y: 2.1, w: 2.2, h: 0.8,
        fontSize: 36, color: VERDE_SICREDI, align: 'center',
        fontFace: 'Arial', bold: true
    });
    // Label
    slide2.addText(m.label, {
        x: m.x, y: 2.9, w: 2.2, h: 0.5,
        fontSize: 10, color: 'AAAAAA', align: 'center',
        fontFace: 'Arial'
    });
});

// Rodape
slide2.addText('Auditoria GA4 - Sicredi', {
    x: 0.5, y: 5.2, w: 4, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial'
});
slide2.addText('2 / 6', {
    x: 8.5, y: 5.2, w: 1, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial', align: 'right'
});

// ========== SLIDE 3: COBERTURA GA4 ==========
let slide3 = pptx.addSlide();
slide3.background = { color: CINZA_ESCURO };

slide3.addText('Cobertura de Disparos GA4', {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32, color: BRANCO, fontFace: 'Arial', bold: true
});

slide3.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 0.08, h: 0.5, fill: { color: VERDE_SICREDI }
});

// Grafico circular simplificado (representacao visual)
slide3.addShape(pptx.ShapeType.ellipse, {
    x: 1, y: 1.8, w: 3, h: 3,
    fill: { color: VERDE_SICREDI }
});
slide3.addShape(pptx.ShapeType.ellipse, {
    x: 1.4, y: 2.2, w: 2.2, h: 2.2,
    fill: { color: CINZA_ESCURO }
});

slide3.addText('62%', {
    x: 1, y: 2.7, w: 3, h: 0.8,
    fontSize: 48, color: VERDE_SICREDI, align: 'center',
    fontFace: 'Arial', bold: true
});
slide3.addText('COBERTURA', {
    x: 1, y: 3.4, w: 3, h: 0.4,
    fontSize: 10, color: '888888', align: 'center',
    fontFace: 'Arial', charSpacing: 3
});

// Detalhes lado direito
// Box verde - com GA4
slide3.addShape(pptx.ShapeType.roundRect, {
    x: 5, y: 2, w: 4.5, h: 1.2,
    fill: { color: '2d2d44' },
    line: { color: VERDE_SICREDI, pt: 2 }
});
slide3.addText('1.513', {
    x: 5.2, y: 2.1, w: 1.5, h: 0.8,
    fontSize: 32, color: VERDE_SICREDI, fontFace: 'Arial', bold: true
});
slide3.addText('Elementos COM disparo GA4\nCliques corretamente rastreados', {
    x: 6.7, y: 2.2, w: 2.6, h: 0.8,
    fontSize: 11, color: 'CCCCCC', fontFace: 'Arial'
});

// Box vermelho - sem GA4
slide3.addShape(pptx.ShapeType.roundRect, {
    x: 5, y: 3.4, w: 4.5, h: 1.2,
    fill: { color: '2d2d44' },
    line: { color: VERMELHO, pt: 2 }
});
slide3.addText('926', {
    x: 5.2, y: 3.5, w: 1.5, h: 0.8,
    fontSize: 32, color: VERMELHO, fontFace: 'Arial', bold: true
});
slide3.addText('Elementos SEM disparo GA4\nOportunidades de melhoria', {
    x: 6.7, y: 3.6, w: 2.6, h: 0.8,
    fontSize: 11, color: 'CCCCCC', fontFace: 'Arial'
});

// Rodape
slide3.addText('Auditoria GA4 - Sicredi', {
    x: 0.5, y: 5.2, w: 4, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial'
});
slide3.addText('3 / 6', {
    x: 8.5, y: 5.2, w: 1, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial', align: 'right'
});

// ========== SLIDE 4: POR CATEGORIA ==========
let slide4 = pptx.addSlide();
slide4.background = { color: CINZA_ESCURO };

slide4.addText('Elementos por Categoria', {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32, color: BRANCO, fontFace: 'Arial', bold: true
});

slide4.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 0.08, h: 0.5, fill: { color: VERDE_SICREDI }
});

const categorias = [
    { nome: 'Cartoes', valor: 344, pct: 100 },
    { nome: 'Credito', valor: 337, pct: 98 },
    { nome: 'Maquinha de Cartoes', valor: 278, pct: 81 },
    { nome: 'Consorcio', valor: 232, pct: 67 },
    { nome: 'Seguros', valor: 198, pct: 58 },
    { nome: 'Investimentos', valor: 153, pct: 44 },
    { nome: 'Solucoes PJ', valor: 127, pct: 37 },
    { nome: 'Campanhas', valor: 117, pct: 34 },
    { nome: 'Catalogo', valor: 111, pct: 32 },
    { nome: 'Conta Corrente', valor: 79, pct: 23 },
    { nome: 'Pagamentos', valor: 65, pct: 19 },
    { nome: 'PIX', valor: 62, pct: 18 }
];

// Coluna 1
categorias.slice(0, 6).forEach((cat, i) => {
    const y = 1.5 + (i * 0.6);
    // Nome
    slide4.addText(cat.nome, {
        x: 0.5, y: y, w: 1.8, h: 0.4,
        fontSize: 11, color: 'CCCCCC', fontFace: 'Arial'
    });
    // Barra fundo
    slide4.addShape(pptx.ShapeType.rect, {
        x: 2.4, y: y + 0.12, w: 2, h: 0.2,
        fill: { color: '3d3d54' }
    });
    // Barra preenchida
    slide4.addShape(pptx.ShapeType.rect, {
        x: 2.4, y: y + 0.12, w: 2 * (cat.pct / 100), h: 0.2,
        fill: { color: VERDE_SICREDI }
    });
    // Valor
    slide4.addText(cat.valor.toString(), {
        x: 4.5, y: y, w: 0.6, h: 0.4,
        fontSize: 11, color: VERDE_SICREDI, fontFace: 'Arial', align: 'right'
    });
});

// Coluna 2
categorias.slice(6, 12).forEach((cat, i) => {
    const y = 1.5 + (i * 0.6);
    // Nome
    slide4.addText(cat.nome, {
        x: 5.3, y: y, w: 1.8, h: 0.4,
        fontSize: 11, color: 'CCCCCC', fontFace: 'Arial'
    });
    // Barra fundo
    slide4.addShape(pptx.ShapeType.rect, {
        x: 7.2, y: y + 0.12, w: 2, h: 0.2,
        fill: { color: '3d3d54' }
    });
    // Barra preenchida
    slide4.addShape(pptx.ShapeType.rect, {
        x: 7.2, y: y + 0.12, w: 2 * (cat.pct / 100), h: 0.2,
        fill: { color: VERDE_SICREDI }
    });
    // Valor
    slide4.addText(cat.valor.toString(), {
        x: 9.3, y: y, w: 0.5, h: 0.4,
        fontSize: 11, color: VERDE_SICREDI, fontFace: 'Arial', align: 'right'
    });
});

// Rodape
slide4.addText('Auditoria GA4 - Sicredi', {
    x: 0.5, y: 5.2, w: 4, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial'
});
slide4.addText('4 / 6', {
    x: 8.5, y: 5.2, w: 1, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial', align: 'right'
});

// ========== SLIDE 5: RECOMENDACOES ==========
let slide5 = pptx.addSlide();
slide5.background = { color: CINZA_ESCURO };

slide5.addText('Recomendacoes', {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32, color: BRANCO, fontFace: 'Arial', bold: true
});

slide5.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 0.08, h: 0.5, fill: { color: VERDE_SICREDI }
});

const recomendacoes = [
    {
        prioridade: 'ALTA', cor: VERMELHO,
        titulo: 'Implementar rastreamento nos 926 elementos faltantes',
        desc: '38% dos elementos clicaveis nao possuem disparo GA4. Priorizar paginas de conversao.',
        x: 0.5, y: 1.5
    },
    {
        prioridade: 'ALTA', cor: VERMELHO,
        titulo: 'Padronizar nomenclatura de eventos',
        desc: 'Implementar convencao de nomes para facilitar analises no GA4.',
        x: 5.1, y: 1.5
    },
    {
        prioridade: 'MEDIA', cor: LARANJA,
        titulo: 'Revisar categoria de eventos',
        desc: 'Garantir categorias bem definidas para relatorios e dashboards.',
        x: 0.5, y: 3.3
    },
    {
        prioridade: 'BAIXA', cor: VERDE_SICREDI,
        titulo: 'Automatizar auditoria periodica',
        desc: 'Configurar execucao automatica mensal para monitorar evolucao.',
        x: 5.1, y: 3.3
    }
];

recomendacoes.forEach(rec => {
    // Card
    slide5.addShape(pptx.ShapeType.roundRect, {
        x: rec.x, y: rec.y, w: 4.4, h: 1.6,
        fill: { color: '2d2d44' },
        line: { color: '3d3d54', pt: 1 }
    });
    // Linha lateral colorida
    slide5.addShape(pptx.ShapeType.rect, {
        x: rec.x, y: rec.y, w: 0.06, h: 1.6,
        fill: { color: rec.cor }
    });
    // Badge prioridade
    slide5.addText(rec.prioridade, {
        x: rec.x + 0.2, y: rec.y + 0.15, w: 0.8, h: 0.25,
        fontSize: 8, color: rec.cor, fontFace: 'Arial', bold: true
    });
    // Titulo
    slide5.addText(rec.titulo, {
        x: rec.x + 0.2, y: rec.y + 0.45, w: 4, h: 0.5,
        fontSize: 12, color: BRANCO, fontFace: 'Arial', bold: true
    });
    // Descricao
    slide5.addText(rec.desc, {
        x: rec.x + 0.2, y: rec.y + 1, w: 4, h: 0.5,
        fontSize: 10, color: '999999', fontFace: 'Arial'
    });
});

// Rodape
slide5.addText('Auditoria GA4 - Sicredi', {
    x: 0.5, y: 5.2, w: 4, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial'
});
slide5.addText('5 / 6', {
    x: 8.5, y: 5.2, w: 1, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial', align: 'right'
});

// ========== SLIDE 6: CONCLUSAO ==========
let slide6 = pptx.addSlide();
slide6.background = { color: CINZA_ESCURO };

slide6.addText('Conclusao', {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32, color: BRANCO, fontFace: 'Arial', bold: true
});

slide6.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 0.08, h: 0.5, fill: { color: VERDE_SICREDI }
});

// Box principal
slide6.addShape(pptx.ShapeType.roundRect, {
    x: 1, y: 1.5, w: 8, h: 3.2,
    fill: { color: '1a3d2e' },
    line: { color: VERDE_SICREDI, pt: 1 }
});

slide6.addText('Proximos Passos', {
    x: 1, y: 1.7, w: 8, h: 0.5,
    fontSize: 24, color: VERDE_SICREDI, align: 'center',
    fontFace: 'Arial', bold: true
});

slide6.addText(
    'A auditoria identificou que 62% dos elementos clicaveis do site Sicredi\n' +
    'possuem rastreamento GA4 ativo. Para atingir a meta de 90% de cobertura,\n' +
    'recomenda-se um plano de acao focado nas categorias de maior impacto comercial.',
    {
        x: 1.5, y: 2.3, w: 7, h: 1,
        fontSize: 13, color: 'CCCCCC', align: 'center',
        fontFace: 'Arial'
    }
);

// Metricas finais
const statsFinais = [
    { valor: '119', label: 'Paginas', x: 1.5 },
    { valor: '2.439', label: 'Elementos', x: 3.3 },
    { valor: '62%', label: 'Cobertura Atual', x: 5.1 },
    { valor: '90%', label: 'Meta Sugerida', x: 6.9 }
];

statsFinais.forEach(s => {
    slide6.addText(s.valor, {
        x: s.x, y: 3.5, w: 1.6, h: 0.6,
        fontSize: 28, color: VERDE_SICREDI, align: 'center',
        fontFace: 'Arial', bold: true
    });
    slide6.addText(s.label, {
        x: s.x, y: 4.05, w: 1.6, h: 0.3,
        fontSize: 9, color: '888888', align: 'center',
        fontFace: 'Arial'
    });
});

// Rodape
slide6.addText('Auditoria GA4 - Sicredi', {
    x: 0.5, y: 5.2, w: 4, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial'
});
slide6.addText('6 / 6', {
    x: 8.5, y: 5.2, w: 1, h: 0.3,
    fontSize: 10, color: '555555', fontFace: 'Arial', align: 'right'
});

// Salvar arquivo
const outputPath = 'cypress/results_novo/AUDITORIA_GA4_SICREDI.pptx';
pptx.writeFile({ fileName: outputPath })
    .then(() => {
        console.log('Apresentacao criada com sucesso!');
        console.log('Arquivo: ' + outputPath);
    })
    .catch(err => {
        console.error('Erro ao criar apresentacao:', err);
    });


