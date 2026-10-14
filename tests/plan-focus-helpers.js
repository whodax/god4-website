const {expect}=require('@playwright/test');

async function planFocusGeometry(target){
  return target.evaluate(element=>{
    const rect=element.getBoundingClientRect(), style=getComputedStyle(element);
    const outline=style.outlineStyle==='none' ? 0 : Math.max(0,
      (parseFloat(style.outlineWidth)||0)+(parseFloat(style.outlineOffset)||0));
    const stickyBottom=Array.from(document.querySelectorAll('nav,#bibleApp .bs-nav'))
      .filter(header=>{
        const css=getComputedStyle(header), box=header.getBoundingClientRect();
        return css.position==='sticky' && box.bottom>0 && box.top<=(parseFloat(css.top)||0)+1;
      }).reduce((bottom,header)=>Math.max(bottom,header.getBoundingClientRect().bottom),0);
    return {focused:document.activeElement===element,top:rect.top-outline,bottom:rect.bottom+outline,
      safeTop:stickyBottom,viewportBottom:innerHeight,outlineWidth:parseFloat(style.outlineWidth)||0,
      outlineStyle:style.outlineStyle,overflow:document.documentElement.scrollWidth>innerWidth,
      scrollX:window.scrollX,scrollY:window.scrollY};
  });
}

async function expectPlanFocusVisible(page,target){
  await expect(target).toBeFocused();
  try{await expect.poll(async()=>{
    const box=await planFocusGeometry(target);
    return box.focused && box.top>=box.safeTop && box.bottom<=box.viewportBottom;
  },{message:'the full focused Plan control and outline must fit below sticky headers'}).toBe(true);
  }catch(error){
    console.log('FAILED_PLAN_GEOMETRY',JSON.stringify(await planFocusGeometry(target)));
    throw error;
  }
  const box=await planFocusGeometry(target);
  expect(box.top).toBeGreaterThanOrEqual(box.safeTop);
  expect(box.bottom).toBeLessThanOrEqual(box.viewportBottom);
  expect(box.overflow).toBe(false);
  expect(box.scrollX).toBe(0);
  if(await target.evaluate(element=>element.tagName==='BUTTON')){
    expect(box.outlineStyle).not.toBe('none');
    expect(box.outlineWidth).toBeGreaterThan(0);
  }
  return box;
}

module.exports={planFocusGeometry,expectPlanFocusVisible};
