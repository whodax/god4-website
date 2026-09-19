const plan = [
  {d:1, ref:'Matthew 1-2', done:false},
  {d:2, ref:'Matthew 3-4', done:false},
  {d:3, ref:'Matthew 5-6', done:false},
  {d:4, ref:'Matthew 7-8', done:false},
  {d:5, ref:'Matthew 9-10', done:false},
  {d:6, ref:'Matthew 11-12', done:false},
  {d:7, ref:'Matthew 13-14', done:false},
  {d:8, ref:'Matthew 15-16', done:false},
  {d:9, ref:'Matthew 17-18', done:false},
  {d:10, ref:'Matthew 19-20', done:false},
  {d:11, ref:'Matthew 21-22', done:false},
  {d:12, ref:'Matthew 23-24', done:false},
  {d:13, ref:'Matthew 25-26', done:false},
  {d:14, ref:'Matthew 27-28', done:false},
  {d:15, ref:'Mark 1-2', done:false},
  {d:16, ref:'Mark 3-4', done:false},
  {d:17, ref:'Mark 5-6', done:false},
  {d:18, ref:'Mark 7-8', done:false},
  {d:19, ref:'Mark 9-10', done:false},
  {d:20, ref:'Mark 11-12', done:false},
  {d:21, ref:'Mark 13-14', done:false},
  {d:22, ref:'Mark 15-16', done:false},
  {d:23, ref:'Luke 1-2', done:false},
  {d:24, ref:'Luke 3-4', done:false},
  {d:25, ref:'Luke 5-6', done:false},
  {d:26, ref:'Luke 7-8', done:false},
  {d:27, ref:'Luke 9-10', done:false},
  {d:28, ref:'Luke 11-12', done:false},
  {d:29, ref:'Luke 13-14', done:false},
  {d:30, ref:'Luke 15-16', done:false}
];
const PLAN_STORAGE_KEY = 'god4.plan.completedDays';
try {
  var completedDays = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) || '[]');
  if(Array.isArray(completedDays)){
    plan.forEach(function(day){ day.done = completedDays.includes(day.d); });
  }
} catch(error) {
  // Missing or unreadable saved progress starts with no completed days.
}

function renderPlan(){
  var nextDay = plan.find(function(day){ return !day.done; });
  var container = document.getElementById('planDays');
  var doneCount = 0;
  container.innerHTML = plan.map(function(day){
    if(day.done) doneCount++;
    var cls = day.done ? 'past completed' : (day === nextDay ? 'today' : 'future');
    return '<button type="button" class="plan-day ' + cls + '" aria-label="Day ' + day.d + ': ' + day.ref + '" aria-pressed="' + (day.done ? 'true' : 'false') + '" onclick="toggleDay(' + day.d + ')">' +
      '<div class="day-num">' + day.d + '</div>' +
      '<div class="day-ref">' + day.ref + '</div>' +
      '</button>';
  }).join('');
  var pct = Math.round((doneCount / plan.length) * 100);
  document.getElementById('planFill').style.width = pct + '%';
  document.getElementById('planDone').textContent = doneCount + ' of ' + plan.length + ' days';
  document.getElementById('planPct').textContent = pct + '%';
}

function toggleDay(d){
  var day = plan.find(function(x){ return x.d === d; });
  if(day){
    day.done = !day.done;
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan.filter(function(item){ return item.done; }).map(function(item){ return item.d; })));
    } catch(error) {
      // Keep the plan usable for this visit if browser storage is unavailable.
    }
    renderPlan();
  }
}
