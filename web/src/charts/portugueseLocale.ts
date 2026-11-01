// European Portuguese, matching the UI's pt-PT number and date formatting.
export default {
  time: {
    month: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    monthAbbr: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    dayOfWeek: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
    dayOfWeekAbbr: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  },
  legend: { selector: { all: 'Todos', inverse: 'Inverter' } },
  toolbox: {
    brush: { title: { rect: 'Seleção retangular', polygon: 'Seleção poligonal', lineX: 'Selecionar horizontalmente', lineY: 'Selecionar verticalmente', keep: 'Manter seleções', clear: 'Limpar seleções' } },
    dataView: { title: 'Vista de dados', lang: ['Vista de dados', 'Fechar', 'Atualizar'] },
    dataZoom: { title: { zoom: 'Ampliar área', back: 'Zoom anterior' } },
    magicType: { title: { line: 'Gráfico de linhas', bar: 'Gráfico de barras', stack: 'Empilhar', tiled: 'Separar' } },
    restore: { title: 'Repor' },
    saveAsImage: { title: 'Guardar imagem', lang: ['Clique com o botão direito para guardar a imagem'] },
  },
  series: {
    typeNames: {
      pie: 'Gráfico circular', bar: 'Gráfico de barras', line: 'Gráfico de linhas', scatter: 'Gráfico de dispersão',
      effectScatter: 'Gráfico de dispersão com efeito', radar: 'Gráfico de radar', tree: 'Árvore', treemap: 'Mapa de árvore',
      boxplot: 'Diagrama de extremos e quartis', candlestick: 'Gráfico de velas', k: 'Gráfico de velas', heatmap: 'Mapa de calor',
      map: 'Mapa', parallel: 'Coordenadas paralelas', lines: 'Gráfico de linhas', graph: 'Grafo', sankey: 'Diagrama de Sankey',
      funnel: 'Gráfico de funil', gauge: 'Indicador', pictorialBar: 'Barras pictóricas', themeRiver: 'Gráfico de fluxo temático',
      sunburst: 'Gráfico radial hierárquico', custom: 'Gráfico personalizado', chart: 'Gráfico',
    },
  },
  aria: {
    general: { withTitle: 'Este é um gráfico intitulado «{title}».', withoutTitle: 'Este é um gráfico.' },
    series: {
      single: { prefix: '', withName: ' Tipo: {seriesType}; série: {seriesName}.', withoutName: ' Tipo: {seriesType}.' },
      multiple: {
        prefix: ' Contém {seriesCount} séries.', withName: ' Série {seriesId}: {seriesName}, tipo {seriesType}.',
        withoutName: ' Série {seriesId}: tipo {seriesType}.', separator: { middle: '', end: '' },
      },
    },
    data: {
      allData: ' Os dados são: ', partialData: ' Os primeiros {displayCnt} valores são: ',
      withName: '{name}: {value}', withoutName: '{value}', separator: { middle: ', ', end: '.' },
    },
  },
};
