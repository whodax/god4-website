const plan = [
  {d:1, ref:'Matthew 1-2', done:true},
  {d:2, ref:'Matthew 3-4', done:true},
  {d:3, ref:'Matthew 5-6', done:true},
  {d:4, ref:'Matthew 7-8', done:true},
  {d:5, ref:'Matthew 9-10', done:true},
  {d:6, ref:'Matthew 11-12', done:true},
  {d:7, ref:'Matthew 13-14', done:true},
  {d:8, ref:'Matthew 15-16', done:true},
  {d:9, ref:'Matthew 17-18', done:true},
  {d:10, ref:'Matthew 19-20', done:true},
  {d:11, ref:'Matthew 21-22', done:true},
  {d:12, ref:'Matthew 23-24', done:true},
  {d:13, ref:'Matthew 25-26', done:true},
  {d:14, ref:'Matthew 27-28', done:true},
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
function renderPlan(){
  var today = new Date().getDate();
  var container = document.getElementById('planDays');
  var doneCount = 0;
  container.innerHTML = plan.map(function(day){
    if(day.done) doneCount++;
    var cls = day.done ? 'past completed' : (day.d === 8 ? 'today' : 'future');
    return '<button type="button" class="plan-day ' + cls + '" aria-label="Day ' + day.d + ': ' + day.ref + '" aria-pressed="' + (day.done ? 'true' : 'false') + '" onclick="toggleDay(' + day.d + ')">' +
      '<div class="day-num">' + day.d + '</div>' +
      '<div class="day-ref">' + day.ref + '</div>' +
      '</button>';
  }).join('');
  var pct = Math.round((doneCount / 30) * 100);
  document.getElementById('planFill').style.width = pct + '%';
  document.getElementById('planDone').textContent = doneCount + ' of 30 days';
  document.getElementById('planPct').textContent = pct + '%';
}

function toggleDay(d){
  var day = plan.find(function(x){ return x.d === d; });
  if(day){ day.done = !day.done; renderPlan(); }
}
