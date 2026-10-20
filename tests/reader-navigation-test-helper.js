// Legacy selector coverage follows the real More disclosure rather than forcing
// hidden controls. Primary navigation is exercised by the picker-focused tests.
async function selectReaderOption(locator,value,options){
  const page=locator.page(), id=await locator.getAttribute('id');
  const replacement=page.locator(`[data-reader-select="${id}"]`);
  if(!await locator.isVisible() && !await replacement.isVisible()){
    await page.locator('#readerMoreTrigger').click();
    await page.evaluate(()=>ReaderTranslationLoader.ensure().catch(()=>{}));
  }
  if(await replacement.isVisible()){
    await replacement.click();
    await page.locator(`#readerOptionsPicker [data-option-value="${value}"]`).click();
    return locator.evaluate(element=>Array.from(element.selectedOptions).map(option=>option.value));
  }
  return locator.selectOption(value,options);
}
module.exports={selectReaderOption};
