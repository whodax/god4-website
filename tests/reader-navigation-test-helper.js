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
    const next=id==='bookSelect'?'Chapter':id==='chapterSelect'?'Verse':null;
    if(next){
      await page.getByRole('dialog',{name:next,exact:true}).waitFor({state:'visible'});
      await page.keyboard.press('Escape');
    }
    return locator.evaluate(element=>Array.from(element.selectedOptions).map(option=>option.value));
  }
  return locator.selectOption(value,options);
}
async function selectCompareOption(locator,value){
  const {expect}=require('@playwright/test');
  const page=locator.page();
  const key=await locator.evaluate(node=>node.id || 'compare-edition-'+node.dataset.compareIndex);
  const trigger=page.locator(`[data-themed-select="${key}"]`);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-haspopup','dialog');
  await trigger.click();
  const dialog=page.locator('#themedSelectPicker');
  await expect(dialog).toBeVisible();
  await dialog.locator(`[data-option-value="${value}"]`).click();
  await expect(dialog).toBeHidden();
  await expect(locator).toHaveValue(value);
  const replacement=page.locator(`[data-themed-select="${key}"]`);
  await expect(replacement).toBeFocused();
}
module.exports={selectReaderOption,selectCompareOption};
