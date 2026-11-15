import {PLANNER_KEY,readPlanner,readNativePlanner,validatePlanner,parsePlannerTime,upsertPlannerEntry,plannerEntryKey,duePlannerEntries} from '../core/planner.js';
import {dateKey,addDays} from '../core/model.js';

const $=selector=>document.querySelector(selector);
const WEB_RECEIPTS='course-compass.planner-web-receipts.v1';
const WEEKDAYS=['周一','周二','周三','周四','周五','周六','周日'];
const pad=value=>String(value).padStart(2,'0');
const clock=at=>{const d=new Date(at);return pad(d.getHours())+':'+pad(d.getMinutes());};
const monthDay=d=>d.getMonth()+1+'月'+d.getDate()+'日';
const fromKey=key=>new Date(key+'T12:00:00');
const MIN_DATE='1969-12-31',MAX_DATE='2100-01-02';
const validDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>=MIN_DATE&&value<=MAX_DATE&&Number.isFinite(fromKey(value).getTime());
const weekDay=d=>(d.getDay()+6)%7;
const monday=d=>addDays(d,-weekDay(d));
const describe=at=>{const d=new Date(at);return monthDay(d)+' '+WEEKDAYS[weekDay(d)]+' · '+clock(d);};

export function mountPlannerDialogs(){
 $('#today-list').insertAdjacentHTML('beforebegin',`<button type="button" id="planner-entry" class="planner-entry" data-action="planner"><i data-icon="planner"></i><span><strong>日程规划</strong><small id="planner-next">自定时间 · 本机提醒</small></span><i data-icon="chevron-right"></i></button>`);
 $('#menu-sheet .menu-profile').insertAdjacentHTML('afterend',`<button type="button" class="action-row" data-action="planner"><i data-icon="planner"></i><span>日程规划<small>一周日历 · 到点提醒</small></span><i data-icon="chevron-right"></i></button>`);
 $('#today-view').insertAdjacentHTML('afterend',`
  <section id="planner-view" class="planner-view" aria-label="日程规划" hidden>
   <div class="planner-calendar">
    <div class="planner-week-bar">
     <button type="button" id="planner-week-prev" class="planner-arrow" aria-label="日程上一周" data-icon="chevron-left"></button>
     <h2><button type="button" id="planner-date-button" aria-label="跳到指定日期"><span id="planner-week-range"></span><i data-icon="chevron-down"></i></button></h2>
     <button type="button" id="planner-week-next" class="planner-arrow" aria-label="日程下一周" data-icon="chevron-right"></button>
     <button type="button" id="planner-week-today" class="planner-today">今天</button>
    </div>
    <div id="planner-days" class="planner-days" role="group" aria-label="选择日程日期"></div>
   </div>
   <button type="button" id="planner-jump-next" class="planner-next-card" hidden><i data-icon="clock"></i><span><small>下一条日程</small><strong id="planner-next-title"></strong><span id="planner-next-at"></span></span><i data-icon="chevron-right"></i></button>
   <button type="button" id="planner-reminder-toggle" class="planner-status-card" aria-expanded="false" aria-controls="planner-reminder-controls">
    <i data-icon="info"></i><span><strong id="planner-status-title">提醒设置</strong><small id="planner-status-summary"></small></span><i data-icon="chevron-right"></i>
   </button>
   <section id="planner-reminder-controls" class="planner-permissions" aria-label="提醒设置" hidden>
    <p id="planner-platform"></p>
    <div class="planner-settings">
     <button type="button" id="planner-notifications" hidden>开启系统通知</button>
     <button type="button" id="planner-exact" hidden>允许准点提醒</button>
     <button type="button" id="planner-retry" hidden>重试登记</button>
     <button type="button" id="planner-test" hidden>1 分钟测试通知</button>
     <button type="button" id="planner-app-settings" hidden>应用与电池设置</button>
    </div>
    <p id="planner-test-status" role="status" hidden></p>
    <p id="planner-delivery-status" class="planner-delivery" hidden></p>
   </section>
   <div class="planner-day-bar"><div><h2 id="planner-day-title"></h2><p id="planner-day-count"></p></div><button type="button" id="planner-new" class="primary-button"><i data-icon="plus"></i>添加日程</button></div>
   <div id="planner-timeline" class="planner-timeline" aria-labelledby="planner-day-title"></div>
   <p id="planner-empty" class="planner-empty">这天还没有日程</p>
  </section>`);
 document.body.insertAdjacentHTML('beforeend',`
  <dialog id="planner-date-sheet" class="sheet planner-sheet" aria-labelledby="planner-date-title">
   <div class="sheet-handle"></div><div class="sheet-title"><h2 id="planner-date-title">跳到日期</h2><button type="button" data-close="planner-date-sheet" class="plain-icon" aria-label="关闭日期选择" data-icon="close"></button></div>
   <form id="planner-jump-form" class="planner-form"><label>日期<input id="planner-jump-date" type="date" required min="1969-12-31" max="2100-01-02"></label><button class="primary-button full" type="submit">查看当天</button></form>
  </dialog>
  <dialog id="planner-edit-sheet" class="sheet planner-sheet" aria-labelledby="planner-edit-title">
   <div class="sheet-handle"></div><div class="sheet-title"><h2 id="planner-edit-title">添加日程</h2><button type="button" data-close="planner-edit-sheet" class="plain-icon" aria-label="返回日程" data-icon="close"></button></div>
   <form id="planner-form" class="planner-form">
    <label>标题<input name="title" type="text" required maxlength="80" placeholder="例如：去实验室拿材料" autofocus></label>
    <div class="planner-form-time"><label>日期<input name="date" type="date" required max="2099-12-31"></label><label>提醒时间<input name="time" type="time" required step="60"></label></div>
    <label><span>备注 <span class="planner-optional">选填</span></span><textarea name="note" maxlength="400" rows="3" placeholder="地点、要带的东西…"></textarea></label>
    <p class="sheet-tip">按此设备的日期和时间提醒一次。</p><p id="planner-edit-error" class="form-error" role="alert"></p>
    <button type="submit" id="planner-save" class="primary-button full">保存日程</button>
    <button type="button" id="planner-delete" class="planner-remove" hidden>删除日程</button>
    <div id="planner-delete-check" class="planner-delete-check" hidden><p>删除这条日程并取消它的提醒？</p><button type="button" id="planner-delete-cancel">保留</button><button type="button" id="planner-delete-confirm">确认删除</button></div>
   </form>
  </dialog>
  <dialog id="planner-alert-sheet" class="sheet planner-sheet planner-alert" role="alertdialog" aria-labelledby="planner-alert-title">
   <div class="sheet-handle"></div><div class="sheet-title"><h2 id="planner-alert-title"><i data-icon="clock"></i>日程提醒</h2><button type="button" data-close="planner-alert-sheet" class="plain-icon" aria-label="关闭日程提醒" data-icon="close"></button></div>
   <div id="planner-due-list" class="planner-list"></div>
   <button type="button" id="planner-ack" class="primary-button full" autofocus>知道了</button>
  </dialog>`);
}

function textNode(tag,value,className){
 const el=document.createElement(tag);
 el.textContent=value;if(className)el.className=className;
 return el;
}

function alertCard(entry){
 const row=document.createElement('article');row.className='planner-card';
 const time=textNode('time',describe(entry.at));time.dateTime=new Date(entry.at).toISOString();
 row.append(time,textNode('strong',entry.title));
 if(entry.note)row.append(textNode('p',entry.note));
 return row;
}

function timelineCard(entry,now,upNext){
 const row=document.createElement('div');
 row.className='planner-timeline-row'+(upNext?' is-next':'');
 const time=textNode('time',clock(entry.at),'planner-time');
 time.dateTime=new Date(entry.at).toISOString();
 const card=document.createElement('button');
 card.type='button';card.className='planner-event';card.dataset.planEdit=entry.id;
 card.setAttribute('aria-label','编辑'+entry.title);
 const head=document.createElement('span');head.className='planner-event-head';
 head.append(textNode('span','个人日程','planner-event-label'),textNode('span',upNext?'下一条':entry.historical||entry.at<=now?'已到期':'待提醒','planner-event-state'));
 card.append(head,textNode('strong',entry.title));
 if(entry.note)card.append(textNode('small',entry.note,'planner-event-note'));
 row.append(time,card);
 return row;
}

function readReceipts(){
 try{
  const raw=localStorage.getItem(WEB_RECEIPTS);
  if(!raw||raw.length>20000)return [];
  const list=JSON.parse(raw);
  return Array.isArray(list)?list.filter(x=>typeof x==='string').slice(-100):[];
 }catch{return [];}
}

export function setupPlanner({dialogs,notify,setView,restorePending=false,recoverPlannerRestore=async()=>true}){
 const native=typeof window.CourseCompass?.updatePlanner==='function'&&typeof window.CourseCompass?.peekPlannerReminders==='function'?window.CourseCompass:null;
 const editor=$('#planner-edit-sheet'),alert=$('#planner-alert-sheet'),form=$('#planner-form'),timeline=$('#planner-timeline');
 let state=null,readError='',synced=false,timer=0,openedAt=Date.now(),editing=null,listKey='',weekKey='';
 let selected=dateKey(),status=null,testing=false;
 let alertKeys=new Set(),ackFrame=0,pendingAck=new Set();
 const memoryReceipts=new Set();

 function permissionCopy(){
  const text=$('#planner-platform'),summary=$('#planner-status-summary'),heading=$('#planner-status-title'),card=$('#planner-reminder-toggle');
  const notifications=$('#planner-notifications'),exact=$('#planner-exact'),retry=$('#planner-retry'),test=$('#planner-test'),settings=$('#planner-app-settings'),testStatus=$('#planner-test-status'),delivery=$('#planner-delivery-status');
  notifications.hidden=exact.hidden=retry.hidden=test.hidden=settings.hidden=testStatus.hidden=delivery.hidden=true;
  heading.textContent='提醒设置';card.dataset.state='';
  if(restorePending){
   heading.textContent='安卓日程待恢复';summary.textContent='点开后重试恢复';card.dataset.state='warning';
   text.textContent='完整备份中的日程尚未写入安卓提醒，请重试后再编辑。';
   retry.textContent='重试恢复';retry.hidden=false;return;
  }
  retry.textContent='重试登记';
  if(readError){summary.textContent='无法读取日程';text.textContent=readError;card.dataset.state='warning';return;}
  if(!native){
   summary.textContent='仅在网页打开时提醒';text.textContent='关闭网页后不会提醒。安卓安装版支持系统通知。';return;
  }
  settings.hidden=false;
  try{status=JSON.parse(native.getPlannerStatus());}catch{status=null;}
  if(!synced||!status||status.alarmMode==='error'){
   heading.textContent='提醒需要检查';summary.textContent='系统闹钟尚未确认登记';card.dataset.state='warning';
   text.textContent='日程已存在本机，系统提醒暂未登记成功。请重试。';retry.hidden=false;return;
  }
  if(!status.notifications){
   heading.textContent='系统通知未开启';summary.textContent='退出课间后不会弹通知';card.dataset.state='warning';
   text.textContent='允许「日程提醒」通知后，退出应用也能接收系统提醒。';
   notifications.textContent='开启系统通知';notifications.hidden=false;
  }else{
   const scheduled=status.alarmAt>0;
   heading.textContent=scheduled?'已向系统登记提醒':'系统通知已开启';
   summary.textContent=scheduled?describe(status.alarmAt)+(status.alarmMode==='ordinary'?' · 可能延后':''):'暂时没有待提醒的日程';
   text.textContent='打开课间时弹窗，退出后使用系统通知。'+(!status.exact?'未允许准点提醒，后台通知可能延后。':'')+(!status.headsUp?' 系统横幅未开启，可在通知栏查看。':'');
   if(!status.headsUp){notifications.textContent='调整通知横幅';notifications.hidden=false;}
   exact.hidden=Boolean(status.exact);
   test.hidden=typeof native.testPlannerNotification!=='function';
   test.disabled=testing||Boolean(status.testAt>Date.now()&&!status.testSent);
  }
  if(status.backgroundRestricted)text.textContent+=' 系统限制了课间的后台活动，可在应用与电池设置检查。';
  if(status.testAt){
   testStatus.hidden=false;
   if(status.testSent)testStatus.textContent=status.testSource==='alarm-background'?'后台闹钟已触发，测试通知已交给系统。若没看到横幅，请查看通知栏。':status.testSource==='alarm-visible'?'闹钟在应用打开时触发，测试通知已交给系统。要验证清后台，请重新测试。':'测试通知在应用恢复时补发，未验证后台闹钟。';
   else if(status.testAt+10000<Date.now())testStatus.textContent=status.exact?'测试还没有送达记录。若划掉后台后一直收不到，可检查课间的电池和后台限制。':'普通提醒可能被系统延后。要验证准点送达，请先开启准点提醒再试。';
   else testStatus.textContent='测试提醒：'+clock(status.testAt)+'。现在可以划掉课间，等系统通知。';
  }
  const traces=[['最近闹钟唤醒',status.lastWakeAt],['最近系统投递',status.lastSystemAt],['最近应用弹窗',status.lastPopupAt]].filter(([,at])=>at>0);
  if(traces.length){delivery.hidden=false;delivery.textContent=traces.map(([label,at])=>label+' '+describe(at)).join(' / ');}
 }

 function draw(){
  const entries=state?.entries||[],now=Date.now(),today=dateKey(new Date(now)),date=fromKey(selected),start=monday(date),end=addDays(start,6);
  const upcoming=entries.find(row=>!row.historical&&row.at>now);
  const first=upcoming?describe(upcoming.at)+' · '+upcoming.title:'自定时间 · 本机提醒';
  $('#planner-next').textContent=readError?'日程暂不可用':first;
  $('#planner-jump-next').hidden=!upcoming;
  if(upcoming){$('#planner-next-title').textContent=upcoming.title;$('#planner-next-at').textContent=describe(upcoming.at);}
  $('#planner-week-range').textContent=monthDay(start)+' — '+monthDay(end);
  $('#planner-week-today').disabled=selected===today;
  $('#planner-new').disabled=restorePending||!state||selected<today||selected>'2099-12-31';
  $('#planner-week-prev').disabled=dateKey(addDays(date,-7))<MIN_DATE;
  $('#planner-week-next').disabled=dateKey(addDays(date,7))>MAX_DATE;
  const rows=entries.filter(row=>dateKey(new Date(row.at))===selected);
  const days=Array.from({length:7},(_,i)=>addDays(start,i));
  const dates=new Map();
  for(const row of entries){const k=dateKey(new Date(row.at));dates.set(k,(dates.get(k)||0)+1);}
  const key=JSON.stringify([selected,today,days.map(d=>dates.get(dateKey(d))||0)]);
  if(weekKey!==key){
   weekKey=key;
   $('#planner-days').replaceChildren(...days.map((day,i)=>{
    const d=dateKey(day),count=dates.get(d)||0,b=document.createElement('button');
    b.type='button';b.dataset.planDay=d;b.disabled=!validDay(d);b.setAttribute('aria-pressed',String(d===selected));
    if(d===today)b.setAttribute('aria-current','date');
    b.setAttribute('aria-label',monthDay(day)+' '+WEEKDAYS[i]+(count?'，'+count+'条日程':''));
    b.append(textNode('span',WEEKDAYS[i],'planner-weekday'),textNode('strong',day.getDate(),'planner-date'),textNode('span',count||'','planner-day-marker'));
    return b;
   }));
  }
  $('#planner-day-title').textContent=(selected===today?'今天 · ':'')+monthDay(date)+' '+WEEKDAYS[weekDay(date)];
  $('#planner-day-count').textContent=rows.length?rows.length+' 条日程':'当天暂无安排';
  const signature=JSON.stringify([selected,rows,upcoming?.id,rows.map(r=>r.historical||r.at<=now),readError]);
  if(signature!==listKey){
   listKey=signature;
   timeline.replaceChildren(...rows.map(row=>timelineCard(row,now,upcoming?.id===row.id)));
   $('#planner-empty').hidden=rows.length>0;
   $('#planner-empty').textContent=readError?'无法读取本机记录。':'这天还没有日程';
  }
 }

 function selectDay(value){
  if(!validDay(value))return;
  const focus=document.activeElement?.closest?.('[data-plan-day]');
  selected=value;draw();
  if(focus)$('#planner-days [aria-pressed=true]')?.focus({preventScroll:true});
 }

 function writeNative(snapshot,saved){
  return native.updatePlanner(JSON.stringify(snapshot),saved?.id||'',saved?.at||0)===true;
 }

 function drawAlerts(){
  const rows=(state?.entries||[]).filter(row=>!row.historical&&alertKeys.has(plannerEntryKey(row)));
  alertKeys=new Set(rows.map(plannerEntryKey));
  $('#planner-due-list').replaceChildren(...rows.map(alertCard));
  if(!rows.length&&alert.open)alert.close();
  return rows.length>0;
 }

 function showDue(rows){
  if(!alert.open)alertKeys.clear();
  for(const row of rows)alertKeys.add(plannerEntryKey(row));
  if(!drawAlerts())return [];
  dialogs.open(alert,{nested:true});
  return alert.open?rows.map(plannerEntryKey).filter(key=>alertKeys.has(key)):[];
 }

 function confirmPainted(keys){
  if(!keys.length)return;
  for(const key of keys)pendingAck.add(key);
  if(ackFrame)return;
  // Give WebView a rendering opportunity before the native queue can cancel the backup.
  ackFrame=requestAnimationFrame(()=>{ackFrame=requestAnimationFrame(()=>{
   ackFrame=0;
   const shown=[...pendingAck].filter(key=>alertKeys.has(key));
   pendingAck.clear();
   if(document.hidden||!alert.open||!shown.length)return;
   try{native.acknowledgePlannerReminders(JSON.stringify(shown));}catch{}
  });});
 }

 function tick(){
  clearTimeout(timer);
  if(document.hidden||!state)return;
  const now=Date.now();
  if(native){
   if(synced)try{
    const rows=JSON.parse(native.peekPlannerReminders());
    if(Array.isArray(rows)&&rows.length)confirmPainted(showDue(rows));
   }catch{ /* If the dialog cannot open, the native alarm retains the pending reminder. */ }
  }else{
   const seen=new Set([...readReceipts(),...memoryReceipts]);
   const due=duePlannerEntries(state.entries,openedAt,now,seen);
   const shown=due.length?showDue(due):[];
   if(shown.length){
    for(const key of shown){seen.add(key);memoryReceipts.add(key);}
    try{localStorage.setItem(WEB_RECEIPTS,JSON.stringify([...seen].slice(-100)));}catch{}
   }
  }
  draw();permissionCopy();
  const next=state.entries.find(row=>!row.historical&&row.at>now);
  const delay=next?Math.min(60000,Math.max(1,next.at-Date.now())):60000;
  const testSoon=status?.testAt&&!status.testSent&&Date.now()<status.testAt+30000;
  timer=setTimeout(tick,testSoon?Math.min(5000,delay):delay);
 }

 function reload({restored=false}={}){
  if(restored)openedAt=Date.now();
  try{
   const model=native?readNativePlanner(native):null;
   state=model||readPlanner();readError='';
   synced=!!native&&(!!model||writeNative(state));
   if(synced)native.plannerPageReady?.();
  }
  catch{state=null;readError='本机日程无法读取，原始记录已保留。';}
  if(alert.open)drawAlerts();
  draw();permissionCopy();tick();
 }

 function openPlanner(at){
  if(at>0)selectDay(dateKey(new Date(at)));
  dialogs.closeAll();draw();permissionCopy();setView('planner');
  if(at>0)$('.app-canvas').scrollTop=0;
 }

 function openEditor(row=null){
  editing=row?.id??null;form.reset();
  const now=Date.now(),future=row&&!row.historical&&row.at>now;
  const chosen=new Date(future?row.at:Math.ceil((now+300000)/60000)*60000);
  const date=future||row?dateKey(chosen):selected>dateKey(chosen)?selected:dateKey(chosen);
  form.elements.title.value=row?.title||'';
  form.elements.date.min=dateKey(new Date(now));
  form.elements.date.value=date;form.elements.time.value=clock(chosen);
  form.elements.note.value=row?.note||'';
  $('#planner-edit-title').textContent=row?'编辑日程':'添加日程';
  $('#planner-delete').hidden=!row;
  $('#planner-delete-check').hidden=true;$('#planner-edit-error').textContent='';
  dialogs.open(editor,{nested:true});
 }

 function persist(updated,message,saved,at){
  if(restorePending)throw Error('请先完成日程恢复');
  if(native){
   if(!writeNative(updated,saved))throw Error('日程没有写入手机，请重试；原日程仍保留。');
   synced=true;
   // Cache for compatibility with older app versions; not authoritative on Android.
   try{localStorage.setItem(PLANNER_KEY,JSON.stringify(updated));}catch{}
  }else localStorage.setItem(PLANNER_KEY,JSON.stringify(updated));
  state=updated;
  if(at)selected=dateKey(new Date(at));
  editor.close();if(alert.open)drawAlerts();tick();
  notify(native&&(!synced||status?.alarmMode==='error')?'日程已保存，系统提醒未确认登记':message);
 }

 $('#planner-new').onclick=()=>openEditor();
 $('#planner-week-prev').onclick=()=>selectDay(dateKey(addDays(fromKey(selected),-7)));
 $('#planner-week-next').onclick=()=>selectDay(dateKey(addDays(fromKey(selected),7)));
 $('#planner-week-today').onclick=()=>selectDay(dateKey());
 $('#planner-date-button').onclick=()=>{$('#planner-jump-date').value=selected;dialogs.open('#planner-date-sheet',{nested:true});};
 $('#planner-jump-form').onsubmit=event=>{
  event.preventDefault();
  const value=$('#planner-jump-date').value;
  if(validDay(value)){selectDay(value);dialogs.dismiss($('#planner-date-sheet'));}
 };
 $('#planner-jump-next').onclick=()=>{
  const row=state?.entries.find(x=>!x.historical&&x.at>Date.now());
  if(row){selectDay(dateKey(new Date(row.at)));$('.app-canvas').scrollTop=0;}
 };
 $('#planner-days').addEventListener('click',event=>{const button=event.target.closest('[data-plan-day]');if(button)selectDay(button.dataset.planDay);});
 $('#planner-days').addEventListener('keydown',event=>{
  const dir={ArrowLeft:-1,ArrowRight:1}[event.key];
  if(dir){event.preventDefault();selectDay(dateKey(addDays(fromKey(selected),dir)));}
 });
 form.onsubmit=event=>{
  event.preventDefault();
  try{
   const current=native?(readNativePlanner(native)||state):readPlanner(),fields=form.elements,old=current.entries.find(row=>row.id===editing),now=Date.now();
   if(editing&&!old)throw Error('这条日程已被移除，请重新添加');
   const id=editing||crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
   const row={id,title:fields.title.value,at:parsePlannerTime(fields.date.value,fields.time.value,old?.at),note:fields.note.value};
   persist(upsertPlannerEntry(current,row,now),editing?'日程已更新':'日程已添加',{id,at:now},row.at);
  }catch(error){$('#planner-edit-error').textContent=error.message;}
 };
 $('#planner-delete').onclick=()=>{$('#planner-delete-check').hidden=false;$('#planner-delete-confirm').focus();};
 $('#planner-delete-cancel').onclick=()=>{$('#planner-delete-check').hidden=true;$('#planner-delete').focus();};
 $('#planner-delete-confirm').onclick=()=>{
  try{if(editing)persist(validatePlanner({version:1,entries:(native?(readNativePlanner(native)||state):readPlanner()).entries.filter(x=>x.id!==editing)}),'日程已删除');}
  catch(error){$('#planner-edit-error').textContent=error.message;}
 };
 $('#planner-reminder-toggle').onclick=()=>{
  const panel=$('#planner-reminder-controls');panel.hidden=!panel.hidden;
  $('#planner-reminder-toggle').setAttribute('aria-expanded',String(!panel.hidden));permissionCopy();
 };
 $('#planner-notifications').onclick=()=>native?.requestPlannerNotifications();
 $('#planner-exact').onclick=()=>native?.requestPlannerExact();
 $('#planner-retry').onclick=async()=>{
  if(restorePending){
   restorePending=!await recoverPlannerRestore();
   if(!restorePending){reload({restored:true});notify('日程已恢复');}
   else{permissionCopy();notify('日程仍未恢复，请稍后重试');}
   return;
  }
  if(native&&state){
   try{synced=writeNative(state);if(synced)native.plannerPageReady?.();}
   catch{synced=false;}
  }
  tick();
 };
 $('#planner-app-settings').onclick=()=>native?.openPlannerAppSettings?.();
 $('#planner-test').onclick=()=>{
  if(!native||testing)return;
  testing=true;
  try{
   if(!native.testPlannerNotification())notify('测试通知未能登记，请检查系统通知与闹钟权限');
  }catch{notify('无法登记测试通知');}
  finally{testing=false;tick();}
 };
 $('#planner-ack').onclick=()=>dialogs.dismiss(alert);
 alert.addEventListener('close',()=>{if(!alert.open){alertKeys.clear();pendingAck.clear();if(ackFrame)cancelAnimationFrame(ackFrame);ackFrame=0;}});
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-action=planner]'))openPlanner();
  const edit=event.target.closest('[data-plan-edit]');
  if(edit){if(restorePending){notify('请先完成日程恢复');return;}const row=state?.entries.find(x=>x.id===edit.dataset.planEdit);if(row)openEditor(row);}
 });
 if(native)window.onNativePlannerChanged=tick;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&native&&!synced&&!readError)reload();else tick();});
 window.addEventListener('pageshow',tick);
 window.addEventListener('storage',event=>{if(!native&&(event.key===PLANNER_KEY||event.key===null))reload();});
 function followLink(){
  const hash=location.hash.match(/^#planner(?:=([0-9]{1,13}))?$/);
  if(!hash)return;
  history.replaceState(history.state,'',location.pathname+location.search);
  const at=Number(hash[1])||0;openPlanner(at>0&&at<4102531200000?at:0);
 }
 window.addEventListener('hashchange',followLink);
 reload();followLink();
 return {reload:()=>{restorePending=false;reload({restored:true});},blockRestore:()=>{restorePending=true;permissionCopy();draw();}};
}
