import {coursesFor,weekAt,addDays,dateKey} from './model.js';

// A display session keeps its source ID; splitting never rewrites imported records.
export function sessionsFor(courses,week,day){
 return coursesFor(courses,week,day).flatMap(c=>Array.from({length:c.end-c.start+1},(_,i)=>({...c,sourceStart:c.sourceStart??c.start,sourceEnd:c.sourceEnd??c.end,period:c.start+i,start:c.start+i,end:c.start+i,sessionKey:c.id+'@'+(c.start+i)}))).sort((a,b)=>a.day-b.day||a.period-b.period||a.name.localeCompare(b.name));
}
function at(date,time){const [h,m]=time.split(':').map(Number);return new Date(date.getFullYear(),date.getMonth(),date.getDate(),h,m,0,0).getTime();}
export function scheduleClock(courses,settings,now=new Date()){
 const stamp=now.getTime(),week=weekAt(settings.startDate,now),day=(now.getDay()+6)%7+1;
 const period=settings.times.findIndex(t=>{const [a,b]=t.split('-');return stamp>=at(now,a)&&stamp<at(now,b);})+1;
 const today=[],future=[],current=[];
 for(let offset=0;offset<=7;offset++){
  const date=addDays(now,offset),w=weekAt(settings.startDate,date);if(w<1||w>settings.totalWeeks)continue;
  for(const session of sessionsFor(courses,w,(date.getDay()+6)%7+1)){
   const [start,end]=settings.times[session.period-1].split('-'),entry={...session,date:dateKey(date),time:start+'–'+end,startsAt:at(date,start),endsAt:at(date,end)};
   if(offset===0)today.push(entry);
   if(session.cancelled)continue;
   if(stamp>=entry.startsAt&&stamp<entry.endsAt)current.push(entry);
   else if(stamp<entry.startsAt)future.push(entry);
  }
 }
 future.sort((a,b)=>a.startsAt-b.startsAt||a.name.localeCompare(b.name));
 const next=future.length?future.filter(e=>e.startsAt===future[0].startsAt):[];
 const onBreak=!period&&today.some(e=>!e.cancelled&&e.endsAt<=stamp)&&next.some(e=>e.date===dateKey(now));
 return {week,day,period,current,next,today,onBreak,withinTerm:week>=1&&week<=settings.totalWeeks};
}
