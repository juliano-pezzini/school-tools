function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Registro de Livros')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
