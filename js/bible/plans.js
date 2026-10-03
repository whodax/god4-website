var journeyState = UserData.journey.load();
var activePlanReadingSession = null;
var planSpeechReturnPending = false;
var planNavigationRequest = 0;
var planHistorySessionId = null;
var planHistorySequence = 0;
var pendingPlanReturnAnnouncement = null;
var planHistoryListenerInstalled = false;
var planHistoryStateKey = 'god4PlanReaderSession';

function currentHistoryState(){
  return history.state && typeof history.state==='object' ? Object.assign({},history.state) : {};
}

function pushPlanReaderHistory(){
  var id='plan-'+Date.now()+'-'+(++planHistorySequence), state=currentHistoryState();
  state[planHistoryStateKey]=id;
  try{
    history.pushState(state,'',location.href);
    planHistorySessionId=id;
    return true;
  }catch(error){
    planHistorySessionId=null;
    return false;
  }
}

function removePlanReaderHistoryMarker(){
  if(!planHistorySessionId) return;
  var state=currentHistoryState();
  if(state[planHistoryStateKey]===planHistorySessionId){
    delete state[planHistoryStateKey];
    history.replaceState(Object.keys(state).length ? state : null,'',location.href);
  }
  planHistorySessionId=null;
}

function clearOrphanedPlanReaderHistoryMarker(){
  var state=currentHistoryState();
  if(!state[planHistoryStateKey]) return;
  delete state[planHistoryStateKey];
  history.replaceState(Object.keys(state).length ? state : null,'',location.href);
}

function handlePlanReaderPopState(event){
  if(activePlanReadingSession && planHistorySessionId){
    planHistorySessionId=null;
    var announce=pendingPlanReturnAnnouncement===true;
    pendingPlanReturnAnnouncement=null;
    returnToPlanFromSession(announce,true);
    return;
  }
  if(event.state && event.state[planHistoryStateKey]) clearOrphanedPlanReaderHistoryMarker();
}

function planSessionContainsChapter(bookId,chapter){
  return Boolean(activePlanReadingSession && activePlanReadingSession.readings.some(function(reading){
    return reading.bookId===bookId && chapter>=reading.startChapter && chapter<=reading.endChapter;
  }));
}

function updatePlanSessionControl(){
  var button=document.getElementById('readerBackToPlan'), reader=document.getElementById('view-reader');
  if(button) button.hidden=!(activePlanReadingSession && reader && reader.classList.contains('active'));
  if(reader) reader.classList.toggle('has-plan-session',Boolean(activePlanReadingSession));
}

function clearPlanReadingSession(){
  removePlanReaderHistoryMarker();
  activePlanReadingSession=null;
  planSpeechReturnPending=false;
  planNavigationRequest++;
  updatePlanSessionControl();
  if(typeof updateReaderControls==='function') updateReaderControls();
}

function buildPlanReadingSession(planIndex,dayNumber,day){
  var readings=[];
  day.chapters.forEach(function(chapter){
    var previous=readings[readings.length-1];
    if(previous && previous.bookId===chapter.bookId && previous.endChapter+1===chapter.chapter) previous.endChapter=chapter.chapter;
    else readings.push({bookId:chapter.bookId,startChapter:chapter.chapter,endChapter:chapter.chapter});
  });
  var start=day.chapters[0], end=day.chapters[day.chapters.length-1];
  var finalChapter=BibleData.getChapter(currentTranslation,end.bookId,end.chapter);
  var endVerse=finalChapter ? finalChapter.verses.reduce(function(last,verse,index){ return typeof verse==='string' && verse.trim() ? index+1 : last; },0) : 0;
  return {
    planPart:planIndex+1,day:dayNumber,readings:readings,
    start:{bookId:start.bookId,chapter:start.chapter,verse:1},
    end:{bookId:end.bookId,chapter:end.chapter,verse:endVerse},translationId:currentTranslation
  };
}

function refreshPlanReadingSessionTranslation(){
  if(!activePlanReadingSession) return;
  activePlanReadingSession.translationId=currentTranslation;
  var chapter=BibleData.getChapter(currentTranslation,activePlanReadingSession.end.bookId,activePlanReadingSession.end.chapter);
  activePlanReadingSession.end.verse=chapter ? chapter.verses.reduce(function(last,verse,index){
    return typeof verse==='string' && verse.trim() ? index+1 : last;
  },0) : 0;
}

function returnToPlanFromSession(announceCompletion,fromPopState){
  if(!activePlanReadingSession) return false;
  if(!fromPopState && planHistorySessionId && history.state && history.state[planHistoryStateKey]===planHistorySessionId){
    pendingPlanReturnAnnouncement=Boolean(announceCompletion);
    history.back();
    return true;
  }
  if(activePlanReadingSession.completionPending && announceCompletion){
    completeJourneyDay(activePlanReadingSession.planPart-1,activePlanReadingSession.day,localCalendarDate(new Date()));
  }
  var journeyWasComplete=journeyCycleIsComplete();
  clearPlanReadingSession();
  if(typeof BibleSpeech!=='undefined' && BibleSpeech.getState()!=='idle') BibleSpeech.stop();
  var reader=document.getElementById('view-reader');
  if(reader && reader.classList.contains('reader-fullscreen')) toggleFullscreen();
  var planButton=document.querySelector('.bs-btn[aria-controls="view-plan"]');
  if(planButton) switchView('plan',planButton);
  var status=document.getElementById('journeyStatus');
  if(status){
    var message=journeyWasComplete ? isNewTestamentJourneyCongratulations() :
      (announceCompletion ? 'Daily reading complete. Returning to Plan.' : '');
    if(status.textContent!==message) status.textContent=message;
  }
  var heading=document.getElementById('planHeading');
  if(heading) heading.focus();
  return true;
}

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

function journeyCycleIsComplete(){
  return journeyState.plans.every(function(days,index){ return days.length===ReadingJourneyPlans[index].days.length; });
}

function rolloverJourneyIfComplete(){
  if(!journeyCycleIsComplete()) return false;
  journeyState.plans=ReadingJourneyPlans.map(function(){ return []; });
  UserData.journey.save(journeyState);
  return true;
}

function prepareJourneyPlanView(){
  if(!rolloverJourneyIfComplete()) return false;
  renderPlan();
  var status=document.getElementById('journeyStatus');
  if(status) status.textContent=isNewTestamentJourneyCongratulations();
  return true;
}

function isNewTestamentJourneyCongratulations(){
  return 'Congratulations! You completed the entire New Testament Journey. You’ve gone far beyond a casual reading of Scripture—but there is always more to learn. Let’s do that again.';
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
  document.getElementById('journeyStreak').textContent=journeyStreak(localCalendarDate(new Date()))+'-day streak';
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
  clearPlanReadingSession();
  var requestId=++planNavigationRequest;
  var status=document.getElementById('journeyStatus');
  if(status) status.textContent='';
  var passage=day.chapters[0];
  return navigateReaderToPassage(passage.bookId,passage.chapter,1).then(function(navigated){
    if(!navigated || requestId!==planNavigationRequest) return false;
    activePlanReadingSession=buildPlanReadingSession(planIndex,dayNumber,day);
    activePlanReadingSession.completionPending=planIndex===ReadingJourneyPlans.length-1 &&
      dayNumber===ReadingJourneyPlans[planIndex].days.length;
    pushPlanReaderHistory();
    updatePlanSessionControl();
    updateReaderControls();
    if(!activePlanReadingSession.completionPending) completeJourneyDay(planIndex,dayNumber,localCalendarDate(new Date()));
    if(!journeyCycleIsComplete()) renderPlan();
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
  var backButton=document.getElementById('readerBackToPlan');
  if(backButton) backButton.addEventListener('click',function(){ returnToPlanFromSession(false); });
  if(!planHistoryListenerInstalled){
    window.addEventListener('popstate',handlePlanReaderPopState);
    planHistoryListenerInstalled=true;
  }
  clearOrphanedPlanReaderHistoryMarker();
  updatePlanSessionControl();
  var rolledOver=rolloverJourneyIfComplete();
  renderPlan();
  if(rolledOver){
    var status=document.getElementById('journeyStatus');
    if(status) status.textContent=isNewTestamentJourneyCongratulations();
  }
}

if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',initializePlanControls,{once:true});
else initializePlanControls();
