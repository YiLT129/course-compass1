import {dateKey,parseDate,weekAt} from '../core/model.js';
import {blocksFor} from '../core/sessions.js';

const weekdays=['周日','周一','周二','周三','周四','周五','周六'];
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function setupDayOverview({dialogs,read}){
 const heading=document.querySelector('#date-heading');
 const sheet=document.querySelector('#day-overview-sheet');
 const title=sheet.querySelector('h2'),list=sheet.querySelector('ol');
 const empty=sheet.querySelector('#day-overview-empty'),error=sheet.querySelector('#day-overview-error');
 let selected;

 function draw(){
  const date=parseDate(selected);
  const {courses,settings,plan}=read();
  const week=weekAt(settings.startDate,date),day=(date.getDay()+6)%7+1;
  const blocks=week>=1&&week<=settings.totalWeeks?blocksFor(courses,week,day,settings.times):[];
  const entries=blocks.map(block=>{
   const [start]=settings.times[block.start-1].split('-'),[,end]=settings.times[block.end-1].split('-');
   const periods=block.start===block.end?block.start:`${block.start}–${block.end}`;
   const status=[block.move&&'调课',block.cancelled?'停课':block.localOverride&&'仅本次'].filter(Boolean).join(' · ');
   return {start,end,title:block.name,details:`第 ${periods} 节 · ${block.location||'地点待定'}`,status,
    attributes:`data-course="${escape(block.id)}" data-date="${selected}" data-period="${block.start}"`,cancelled:block.cancelled};
  });
  for(const event of plan?.entries||[]){
   const date=new Date(event.at);
   if(dateKey(date)!==selected)continue;
   entries.push({start:date.toTimeString().slice(0,5),title:event.title,details:event.note,status:'个人日程',
    attributes:`data-plan-edit="${escape(event.id)}"`});
  }
  entries.sort((a,b)=>a.start.localeCompare(b.start));
  title.textContent=`${date.getMonth()+1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
  list.innerHTML=entries.map(({start,end,title,details,status,attributes,cancelled})=>`
   <li>
    <div class="day-overview-time"><time>${start}</time>${end?`<small>${end}</small>`:''}</div>
    <button type="button" class="day-overview-entry${cancelled?' day-overview-cancelled':''}" ${attributes}>
     <strong>${escape(title)}</strong>${details?`<small>${escape(details)}</small>`:''}
     ${status?`<span class="day-overview-status">${escape(status)}</span>`:''}
    </button>
   </li>`).join('');
  list.hidden=!entries.length;
  empty.hidden=!!entries.length;
  empty.textContent=plan?'这一天没有课程或个人日程':'这一天没有课程';
  error.hidden=Boolean(plan);
 }

 heading.addEventListener('click',event=>{
  const button=event.target.closest('button[data-overview-date]');
  if(!button)return;
  selected=button.dataset.overviewDate;
  draw();
  dialogs.open(sheet);
  list.scrollTop=0;
 });

 function refresh(){if(sheet.open)draw();}
 document.querySelector('#planner-edit-sheet').addEventListener('close',refresh);
 return {refresh};
}
