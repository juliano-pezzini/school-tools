function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Banco de Horas')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
