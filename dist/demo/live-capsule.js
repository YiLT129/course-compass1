import {dateKey} from '../core/model.js';

export function setupLiveCapsule({getPrefs,updatePrefs,onOpenSession}){
 const host=document.querySelector('#live-status');
 host.innerHTML='<button type="button" id="live-toggle" class="live-toggle" aria-controls="live-expanded"><span class="live-dot" aria-hidden="true"></span><strong id="live-title"></strong><span id="live-course" class="live-course"></span><span class="live-chevron" aria-hidden="true">⌄</span></button><div id="live-expanded" class="live-expanded" hidden><p id="live-detail"></p><div id="live-actions"></div><p id="live-next"></p><small>按设备时间与已保存的学校作息更新</small></div>';
 const $=s=>host.querySelector(s);let lastClock=null;
 function expansion(){const expanded=getPrefs().capsuleExpanded===true;$('#live-toggle').setAttribute('aria-expanded',String(expanded));$('#live-expanded').hidden=!expanded;host.classList.toggle('expanded',expanded);}
 $('#live-toggle').onclick=()=>{updatePrefs({capsuleExpanded:!getPrefs().capsuleExpanded});expansion();};
 function render(clock,now){
  lastClock=clock;const time=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}),current=clock.current,next=clock.next[0],active=current.length>0;
  const title=time+' · '+(active?'第'+current[0].period+'节正在上课':clock.onBreak?'课间休息':clock.withinTerm&&clock.period?'第'+clock.period+'节空课':'当前没有课程');
  const names=(active?current:clock.next).map(c=>c.name).join(' / '),summary=active?names:next?(next.date===dateKey(now)?'下节：':'下次：')+names:'未来7天暂无安排';
  const detail=active?current.map(c=>c.name+' · 第'+c.period+'节 '+c.time+' · '+(c.location||'地点待定')).join('\n')+(current.length>1?'\n时间重叠，请核对':''):next?(next.date===dateKey(now)?'下一节：':next.date+'：')+'第'+next.period+'节 '+clock.next.map(c=>c.name).join(' / ')+' · '+next.time+' · '+(next.location||'地点待定'):'未来7天暂无课程';
  for(const [id,value]of [['#live-title',title],['#live-course',summary],['#live-detail',detail]])if($(id).textContent!==value)$(id).textContent=value;
  host.dataset.state=active?'current':clock.onBreak?'break':'free';$('#live-toggle').setAttribute('aria-label',title+'，'+summary+'，点击'+(getPrefs().capsuleExpanded?'收起':'展开'));
  const following=active&&next?'下一节：'+(next.date===dateKey(now)?'':next.date+' ')+'第'+next.period+'节 '+clock.next.map(c=>c.name).join(' / ')+' · '+next.time:'';
  $('#live-next').textContent=following;$('#live-next').hidden=!following;
  const entries=active?current:clock.next,signature=JSON.stringify(entries.map(c=>[c.id,c.period,c.date,c.cancelled]));
  if($('#live-actions').dataset.signature!==signature){$('#live-actions').replaceChildren();entries.forEach((c,i)=>{const button=document.createElement('button');button.type='button';button.className='live-open';button.textContent=(active?'查看当前课程':'查看下一节')+(entries.length>1?' '+(i+1):'');button.onclick=()=>onOpenSession(c);$('#live-actions').append(button);});$('#live-actions').dataset.signature=signature;}
  expansion();
 }
 return {render,refresh(){expansion();if(lastClock)host.dataset.state=lastClock.current.length?'current':lastClock.onBreak?'break':'free';}};
}
