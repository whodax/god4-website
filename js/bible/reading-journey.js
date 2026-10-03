/* Structured New Testament chapter ranges for the 30-day reading journey. */
(function(root){
  var books = [
    ['matthew','Matthew',28], ['mark','Mark',16], ['luke','Luke',24], ['john','John',21],
    ['acts','Acts',28], ['romans','Romans',16], ['1-corinthians','1 Corinthians',16],
    ['2-corinthians','2 Corinthians',13], ['galatians','Galatians',6], ['ephesians','Ephesians',6],
    ['philippians','Philippians',4], ['colossians','Colossians',4], ['1-thessalonians','1 Thessalonians',5],
    ['2-thessalonians','2 Thessalonians',3], ['1-timothy','1 Timothy',6], ['2-timothy','2 Timothy',4],
    ['titus','Titus',3], ['philemon','Philemon',1], ['hebrews','Hebrews',13], ['james','James',5],
    ['1-peter','1 Peter',5], ['2-peter','2 Peter',3], ['1-john','1 John',5], ['2-john','2 John',1],
    ['3-john','3 John',1], ['jude','Jude',1], ['revelation','Revelation',22]
  ];
  var definitions = [
    {title:'Part 1 of 5', start:['matthew',1], end:['luke',16], twoChapterDays:true},
    {title:'Part 2 of 5', start:['luke',17], end:['acts',21]},
    {title:'Part 3 of 5', start:['acts',22], end:['2-corinthians',11]},
    {title:'Part 4 of 5', start:['2-corinthians',12], end:['hebrews',6]},
    {title:'Part 5 of 5', start:['hebrews',7], end:['revelation',22]}
  ];
  function expandRange(start, end){
    var result = [], active = false, finished = false;
    for(var bookIndex=0;bookIndex<books.length && !finished;bookIndex++){
      var book=books[bookIndex];
      for(var chapter = 1; chapter <= book[2]; chapter++){
        if(book[0] === start[0] && chapter === start[1]) active = true;
        if(active) result.push({bookId:book[0], bookName:book[1], chapter:chapter});
        if(book[0] === end[0] && chapter === end[1]) { finished=true; break; }
      }
    }
    return result;
  }
  function makeDays(chapters, pairsOnly){
    var days = [];
    if(pairsOnly){
      for(var i=0;i<chapters.length;i+=2) days.push(chapters.slice(i,i+2));
      return days;
    }
    // Each five-chapter block makes three days: two pairs and one single.
    // Put the single at a book ending when possible; otherwise use the block end.
    for(var offset=0;offset<chapters.length;offset+=5){
      var block = chapters.slice(offset,offset+5), singleAt = block.length-1;
      for(var b=0;b<block.length;b++){
        var next = chapters[offset+b+1];
        if((b === 0 || b === block.length-1) && (!next || next.bookId !== block[b].bookId)){ singleAt = b; break; }
      }
      if(singleAt === 0){ days.push([block[0]],[block[1],block[2]],[block[3],block[4]]); }
      else if(singleAt === block.length-1){ days.push([block[0],block[1]],[block[2],block[3]],[block[4]]); }
      else days.push([block[0],block[1]],[block[2],block[3]],[block[4]]);
    }
    return days;
  }
  var plans = definitions.map(function(definition,index){
    var chapters = expandRange(definition.start, definition.end);
    return {index:index+1, title:definition.title, days:makeDays(chapters,definition.twoChapterDays)};
  });
  root.ReadingJourneyPlans = Object.freeze(plans.map(function(plan){
    return Object.freeze({index:plan.index,title:plan.title,days:Object.freeze(plan.days.map(function(day){
      var first=day[0], last=day[day.length-1];
      var reference=first.bookId===last.bookId
        ? first.bookName+' '+first.chapter+(last.chapter !== first.chapter ? '-'+last.chapter : '')
        : first.bookName+' '+first.chapter+' – '+last.bookName+' '+last.chapter;
      return Object.freeze({chapters:Object.freeze(day),reference:reference});
    }))});
  }));
})(typeof window === 'undefined' ? globalThis : window);
