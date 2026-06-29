function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Registro de Livros')
    .setFaviconUrl('https://cdn.jsdelivr.net/gh/juliano-pezzini/school-tools@main/book-registration/favicon.svg')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
