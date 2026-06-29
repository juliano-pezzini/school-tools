function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Banco de Horas')
    .setFaviconUrl('https://cdn.jsdelivr.net/gh/juliano-pezzini/school-tools@main/comp-time/favicon.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
