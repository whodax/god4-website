export function update(panel,event){
  const scroll=panel.querySelector('#commandmentScroll');
  const passages=Array.from(scroll.querySelectorAll('li'));
  let index=passages.findLastIndex(passage=>passage.offsetTop<=scroll.scrollTop+1);
  index=Math.max(0,index);
  const bar=panel.querySelector('.commandment-scrollbar');
  const step=event.target.closest?.('[data-step]');
  if(event.type==='input' && event.target===bar){
    index=bar.valueAsNumber-1;
    scroll.scrollTo({top:passages[index].offsetTop,behavior:'instant'});
  } else if(step && step.getAttribute('aria-disabled')!=='true'){
    index=Math.min(passages.length-1,Math.max(0,index+Number(step.dataset.step)));
    scroll.scrollTo({top:passages[index].offsetTop,behavior:'instant'});
  }
  const output=panel.querySelector('output');
  const position=(index+1)+' of '+passages.length;
  if(output.value!==position) output.value=position;
  bar.value=String(index+1);
  if(bar.getAttribute('aria-valuetext')!==position) bar.setAttribute('aria-valuetext',position);
  panel.querySelector('[data-step="-1"]').setAttribute('aria-disabled',String(index===0));
  panel.querySelector('[data-step="1"]').setAttribute('aria-disabled',String(index===passages.length-1));
}
