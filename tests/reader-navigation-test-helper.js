// Legacy selector coverage follows the real More disclosure rather than forcing
// hidden controls. Primary navigation is exercised by the picker-focused tests.
async function selectReaderOption(locator,value,options){
  if(!await locator.isVisible()) await locator.page().locator('#readerMoreTrigger').click();
  return locator.selectOption(value,options);
}
module.exports={selectReaderOption};
