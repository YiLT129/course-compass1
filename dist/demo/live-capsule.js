import {addDays,dateKey,parseDate} from '../core/model.js';

const formatTime=date=>date.toTimeString().slice(0,5);

function nextLabel(next,now){
 if(next.date===dateKey(now))return '下节';
 if(next.date===dateKey(addDays(now,1)))return '明天';
 const date=parseDate(next.date);
 return `${date.getMonth()+1}月${date.getDate()}日`;
}

export function setupLiveCapsule({getPrefs,updatePrefs,onOpenSession,onOpenRoom,roomIcon}){
 const host=document.querySelector('#live-status');
 host.innerHTML=`
  <div class="live-row">
   <button type="button" id="live-toggle" class="live-toggle" aria-controls="live-expanded">
    <span class="live-dot" aria-hidden="true"></span><strong id="live-title"></strong>
    <span id="live-course" class="live-course"></span><span class="live-chevron" aria-hidden="true">⌄</span>
   </button>
   <button type="button" id="room-shortcut" class="live-room-button" aria-haspopup="dialog" aria-controls="room-sheet">
    ${roomIcon}<span id="live-room">教室</span>
   </button>
  </div>
  <div id="live-expanded" class="live-expanded" hidden>
   <p id="live-detail"></p><div id="live-actions"></div><p id="live-next"></p>
  </div>`;
 const $=selector=>host.querySelector(selector);
 let roomSession;

 function expansion(){
  const expanded=getPrefs().capsuleExpanded===true;
  $('#live-toggle').setAttribute('aria-expanded',String(expanded));
  $('#live-expanded').hidden=!expanded;
  host.classList.toggle('expanded',expanded);
 }
 $('#live-toggle').onclick=()=>{updatePrefs({capsuleExpanded:!getPrefs().capsuleExpanded});expansion();};
 $('#room-shortcut').onclick=()=>onOpenRoom(roomSession);

 function render(clock,now){
  const {current,next}=clock, upcoming=next[0],active=current.length>0;
  const entries=active?current:next;
  roomSession=entries[0];
  const time=formatTime(now);
  const title=active?`上课中 ${time}`:upcoming?`${nextLabel(upcoming,now)} ${formatTime(new Date(upcoming.startsAt))}`:time;
  const names=entries.map(c=>c.name).join(' / ');
  const summary=names||'未来7天暂无课程';
  const liveState=active?`第${current[0].period}节正在上课`:clock.onBreak?'课间休息':'当前没有课程';
  const detail=active?current.map(c=>`${c.name} · 第${c.period}节 ${c.time} · ${c.location||'地点待定'}`).join('\n')+(current.length>1?'\n时间重叠，请核对':''):
   upcoming?`${upcoming.date} · 第${upcoming.period}节 ${names} · ${upcoming.time} · ${upcoming.location||'地点待定'}`:summary;
  const room=roomSession?(roomSession.location||'地点待定'):'教室';
  for(const [id,value] of [['#live-title',title],['#live-course',summary],['#live-detail',detail],['#live-room',room]]){
   if($(id).textContent!==value)$(id).textContent=value;
  }
  const roomButton=$('#room-shortcut');
  roomButton.title=roomSession?`${roomSession.name} · ${room}`:'查看教室';
  roomButton.setAttribute('aria-label',roomSession?`查看教室，${roomButton.title}`:'查看教室');
  host.dataset.state=active?'current':clock.onBreak?'break':'free';
  $('#live-toggle').setAttribute('aria-label',`${time}，${liveState}，${active?summary:title+'，'+summary}`);
  const following=active&&upcoming?`${nextLabel(upcoming,now)}：第${upcoming.period}节 ${next.map(c=>c.name).join(' / ')} · ${upcoming.time}`:'';
  $('#live-next').textContent=following;
  $('#live-next').hidden=!following;

  const actions=$('#live-actions');
  const signature=JSON.stringify([active,entries.map(c=>[c.id,c.period,c.date])]);
  if(actions.dataset.signature!==signature){
   actions.replaceChildren(...entries.map((c,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='live-open';
    button.textContent=(active?'查看当前课程':'查看下一节')+(entries.length>1?' '+(index+1):'');
    button.onclick=()=>onOpenSession(c);
    return button;
   }));
   actions.dataset.signature=signature;
  }
  expansion();
 }

 return {render,refresh:expansion};
}
