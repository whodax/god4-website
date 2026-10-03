var journeyState = UserData.journey.load();

function currentJourneyPlanIndex(){
  return ReadingJourneyPlans.findIndex(function(plan,index){ return journeyState.plans[index].length < plan.days.length; });
}

function localCalendarDate(date){
  var year=date.getFullYear(), month=String(date.getMonth()+1).padStart(2,'0'), day=String(date.getDate()).padStart(2,'0');
  return year+'-'+month+'-'+day;
}

function journeyStreak(today){
  var dates=journeyState.completedDates.slice().sort().reverse();
  if(!dates.length) return 0;
  var todayDate=new Date(today+'T00:00:00'), latest=new Date(dates[0]+'T00:00:00');
  var distance=Math.round((todayDate-latest)/86400000);
  if(distance > 1 || distance < 0) return 0;
  var streak=1;
  for(var i=1;i<dates.length;i++){
    var prior=new Date(dates[i]+'T00:00:00'), newer=new Date(dates[i-1]+'T00:00:00');
    if(Math.round((newer-prior)/86400000) !== 1) break;
    streak++;
  }
  return streak;
}

function renderPlan(){
  var container=document.getElementById('planDays');
  if(!container) return;
  var index=currentJourneyPlanIndex(), completedTotal=journeyState.plans.reduce(function(total,days){ return total+days.length; },0);
  var plan=index < 0 ? null : ReadingJourneyPlans[index];
  var completed=plan ? journeyState.plans[index] : [];
  var nextDayNumber=plan ? plan.days.findIndex(function(_,dayIndex){ return completed.indexOf(dayIndex+1)===-1; })+1 : 0;
  container.innerHTML=plan ? plan.days.map(function(day,dayIndex){
    var dayNumber=dayIndex+1, done=completed.indexOf(dayNumber)!==-1;
    var nextDay=dayNumber===nextDayNumber;
    var cls=done ? 'past completed' : (nextDay ? 'today' : 'future');
    return '<button type="button" class="plan-day '+cls+'" aria-label="'+plan.title+', day '+dayNumber+': '+day.reference+'" aria-pressed="'+(done?'true':'false')+'" data-plan-day="'+dayNumber+'">'+
      '<div class="day-num">'+dayNumber+'</div><div class="day-ref">'+day.reference+'</div></button>';
  }).join('') : '<p class="plan-complete-message">You completed the full New Testament reading journey.</p>';
  var count=completed.length, pct=plan ? Math.round(count/plan.days.length*100) : 100;
  document.getElementById('planTitle').textContent=plan ? plan.title : 'Journey complete';
  document.getElementById('planDone').textContent=count+' of 30 days completed';
  document.getElementById('planPct').textContent=pct+'%';
  document.getElementById('planFill').className='plan-progress-fill plan-progress-days-'+count;
  document.querySelector('.plan-progress-bar').setAttribute('aria-valuenow',String(count));
  document.getElementById('journeyTotal').textContent=completedTotal+' of 150 days completed';
  document.getElementById('journeyStreak').textContent=journeyStreak(localCalendarDate(new Date()))+' day streak';
  document.getElementById('journeyStatus').textContent=plan ? plan.title+', part '+(index+1)+' of 5' : 'New Testament journey complete';
}

function completeJourneyDay(planIndex,dayNumber,date){
  var completed=journeyState.plans[planIndex];
  if(completed.indexOf(dayNumber)!==-1) return false;
  completed.push(dayNumber);
  completed.sort(function(a,b){ return a-b; });
  if(journeyState.completedDates.indexOf(date)===-1){
    journeyState.completedDates.push(date);
    journeyState.completedDates.sort();
  }
  UserData.journey.save(journeyState);
  return true;
}

function openJourneyDay(dayNumber){
  var planIndex=currentJourneyPlanIndex();
  if(planIndex<0) return Promise.resolve(false);
  var day=ReadingJourneyPlans[planIndex].days[dayNumber-1];
  if(!day) return Promise.resolve(false);
  var passage=day.chapters[0];
  return navigateReaderToPassage(passage.bookId,passage.chapter,1).then(function(navigated){
    if(!navigated) return false;
    completeJourneyDay(planIndex,dayNumber,localCalendarDate(new Date()));
    renderPlan();
    return true;
  });
}

function initializePlanControls(){
  var container=document.getElementById('planDays');
  if(!container) return;
  container.addEventListener('click',function(event){
    var button=event.target.closest('[data-plan-day]');
    if(button && container.contains(button)) openJourneyDay(Number(button.getAttribute('data-plan-day')));
  });
  renderPlan();
}

if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',initializePlanControls,{once:true});
else initializePlanControls();
