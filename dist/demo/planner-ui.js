import {PLANNER_KEY,readPlanner,validatePlanner,parsePlannerTime,upsertPlannerEntry,plannerEntryKey,duePlannerEntries} from '../core/planner.js';

const $=selector=>document.querySelector(selector);
const WEB_RECEIPTS='course-compass.planner-web-receipts.v1';
const pad=value=>String(value).padStart(2,'0');
const localDate=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const localTime=d=>pad(d.getHours())+':'+pad(d.getMinutes());
function describe(at){
 return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at);
}

export function mountPlannerDialogs(){
 $('#today-list').insertAdjacentHTML('beforebegin',`<button type="button" id="planner-entry" class="planner-entry" data-action="planner"><i data-icon="calendar"></i><span><strong>日程规划</strong><small id="planner-next">设定日期和时间，到点提醒</small></span><i data-icon="chevron-right"></i></button>`);
 $('#menu-sheet .menu-profile').insertAdjacentHTML('afterend',`<button type="button" class="action-row" data-action="planner"><i data-icon="calendar"></i><span>日程规划<small>自定时间 · 本机提醒</small></span><i data-icon="chevron-right"></i></button>`);
 document.body.insertAdjacentHTML('beforeend',`
  <dialog id="planner-sheet" class="sheet planner-sheet" aria-labelledby="planner-title">
   <div class="sheet-handle"></div><div class="sheet-title"><h2 id="planner-title">日程规划</h2><button type="button" data-close="planner-sheet" class="plain-icon" aria-label="关闭日程规划" data-icon="close"></button></div>
   <div class="planner-permissions">
    <p class="sheet-tip" id="planner-platform" role="status"></p>
    <div class="planner-settings">
     <button type="button" id="planner-notifications" hidden>开启系统通知</button>
     <button type="button" id="planner-exact" hidden>允许准点提醒</button>
     <button type="button" id="planner-retry" hidden>重试同步</button>
    </div>
   </div>
   <button type="button" id="planner-new" class="primary-button full">＋ 添加日程</button>
   <h3 class="planner-section-title">即将到来</h3><div id="planner-upcoming" class="planner-list"></div>
   <details id="planner-history"><summary>已到期 <span id="planner-history-count"></span></summary><div id="planner-past" class="planner-list"></div></details>
  </dialog>
  <dialog id="planner-edit-sheet" class="sheet planner-sheet" aria-labelledby="planner-edit-title">
   <div class="sheet-handle"></div><div class="sheet-title"><h2 id="planner-edit-title">添加日程</h2><button type="button" data-close="planner-edit-sheet" class="plain-icon" aria-label="返回日程列表" data-icon="close"></button></div>
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

function planCard(entry,editable){
 const row=document.createElement('article');
 row.className='planner-card';
 const time=document.createElement('time');
 time.dateTime=new Date(entry.at).toISOString();time.textContent=describe(entry.at);
 const title=document.createElement('strong');title.textContent=entry.title;
 row.append(time,title);
 if(entry.note){const note=document.createElement('p');note.textContent=entry.note;row.append(note);}
 if(editable){
  const button=document.createElement('button');button.type='button';button.dataset.planEdit=entry.id;button.textContent='编辑';
  button.setAttribute('aria-label','编辑'+entry.title);row.append(button);
 }
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

export function setupPlanner({dialogs,notify,setView}){
 const native=typeof window.CourseCompass?.updatePlanner==='function'&&typeof window.CourseCompass?.takePlannerReminders==='function'?window.CourseCompass:null;
 const sheet=$('#planner-sheet'),editor=$('#planner-edit-sheet'),alert=$('#planner-alert-sheet'),form=$('#planner-form');
 let state=null,readError='',synced=false,timer=0,openedAt=Date.now(),editing=null,listKey='';
 let alertKeys=new Set();
 const memoryReceipts=new Set();

 function permissionCopy(){
  const text=$('#planner-platform'),notifications=$('#planner-notifications'),exact=$('#planner-exact'),retry=$('#planner-retry');
  notifications.hidden=exact.hidden=retry.hidden=true;
  if(readError){text.textContent=readError;return;}
  if(!native){text.textContent='网页打开时到点弹窗。关闭网页后不会提醒；需要后台提醒时请用安卓安装版。';return;}
  if(!synced){
   text.textContent='日程已保存在本机，安卓提醒同步未完成。';
   retry.hidden=false;return;
  }
  let status;
  try{status=JSON.parse(native.getPlannerStatus());}catch{status=null;}
  if(!status){text.textContent='暂时无法读取安卓通知设置。';return;}
  if(!status.notifications){
   text.textContent='现在仅在应用内弹窗。允许系统通知后，退到后台也能收到提醒。';
   notifications.textContent='开启系统通知';notifications.hidden=false;
  }else{
   text.textContent='应用内弹窗 · 后台系统通知。'+(!status.exact?'未允许准点提醒，后台通知可能延后。':'')+(!status.headsUp?'当前通知类别未设为横幅。':'');
   if(!status.headsUp){notifications.textContent='调整通知横幅';notifications.hidden=false;}
   exact.hidden=Boolean(status.exact);
  }
 }

 function draw(){
  const entries=state?.entries||[],now=Date.now(),upcoming=entries.filter(row=>!row.historical&&row.at>now),past=entries.filter(row=>row.historical||row.at<=now).reverse();
  const first=upcoming[0];
  $('#planner-next').textContent=readError?'日程暂不可用':first?describe(first.at)+' · '+first.title:'设定日期和时间，到点提醒';
  $('#planner-new').disabled=!state;
  const key=JSON.stringify([upcoming,past,readError]);
  if(key!==listKey){
   listKey=key;
   const list=$('#planner-upcoming');
   list.replaceChildren(...upcoming.map(x=>planCard(x,true)));
   if(!upcoming.length){
    const empty=document.createElement('p');empty.className='sheet-tip';empty.textContent=readError?'无法读取当前记录。':'还没有待提醒的日程。';list.append(empty);
   }
   $('#planner-history').hidden=!past.length;
   $('#planner-history-count').textContent=past.length+' 条';
   $('#planner-past').replaceChildren(...past.map(x=>planCard(x,true)));
  }
 }

 function syncNative(saved){
  if(!native||!state)return;
  const snapshot={version:state.version,entries:state.entries.filter(row=>!row.historical)};
  try{synced=native.updatePlanner(JSON.stringify(snapshot),saved?.id||'',saved?.at||0)===true;}catch{synced=false;}
 }

 function drawAlerts(){
  const rows=(state?.entries||[]).filter(row=>!row.historical&&alertKeys.has(plannerEntryKey(row)));
  alertKeys=new Set(rows.map(plannerEntryKey));
  $('#planner-due-list').replaceChildren(...rows.map(x=>planCard(x,false)));
  if(!rows.length&&alert.open)alert.close();
  return rows.length>0;
 }

 function showDue(rows){
  if(!alert.open)alertKeys.clear();
  for(const row of rows)alertKeys.add(plannerEntryKey(row));
  if(drawAlerts())dialogs.open(alert,{nested:true});
 }

 function tick(){
  clearTimeout(timer);
  if(document.hidden||!state)return;
  const now=Date.now();
  if(native){
   if(synced){
    try{
     const rows=JSON.parse(native.takePlannerReminders());
     if(Array.isArray(rows)&&rows.length)showDue(rows);
    }catch{ /* The native queue remains available on the next focus or alarm. */ }
   }
  }else{
   const seen=new Set([...readReceipts(),...memoryReceipts]);
   const due=duePlannerEntries(state.entries,openedAt,now,seen);
   if(due.length){
    for(const row of due){const key=plannerEntryKey(row);seen.add(key);memoryReceipts.add(key);}
    try{localStorage.setItem(WEB_RECEIPTS,JSON.stringify([...seen].slice(-100)));}catch{}
    showDue(due);
   }
  }
  draw();
  const next=state.entries.find(row=>!row.historical&&row.at>now);
  if(next)timer=setTimeout(tick,Math.min(60000,Math.max(1,next.at-Date.now())));
 }

 function reload({restored=false}={}){
  if(restored)openedAt=Date.now();
  try{state=readPlanner();readError='';syncNative();}
  catch{state=null;readError='本机日程无法读取，原始记录已保留。';}
  if(alert.open)drawAlerts();
  permissionCopy();draw();tick();
 }

 function openPlanner(){draw();permissionCopy();dialogs.open(sheet,{nested:true});}
 function openEditor(row=null){
  editing=row?.id??null;
  form.reset();
  const now=Date.now(),chosen=new Date(row&&!row.historical&&row.at>now?row.at:Math.ceil((now+300000)/60000)*60000);
  form.elements.title.value=row?.title||'';
  form.elements.date.min=localDate(new Date(now));
  form.elements.date.value=localDate(chosen);form.elements.time.value=localTime(chosen);
  form.elements.note.value=row?.note||'';
  $('#planner-edit-title').textContent=row?'编辑日程':'添加日程';
  $('#planner-delete').hidden=!row;
  $('#planner-delete-check').hidden=true;$('#planner-edit-error').textContent='';
  dialogs.open(editor,{nested:true});
 }

 function persist(updated,message,saved){
  localStorage.setItem(PLANNER_KEY,JSON.stringify(updated));
  state=updated;syncNative(saved);
  editor.close();if(alert.open)drawAlerts();permissionCopy();tick();
  notify(native&&!synced?'日程已保存，安卓提醒待同步':message);
 }

 $('#planner-new').onclick=()=>openEditor();
 $('#planner-form').onsubmit=event=>{
  event.preventDefault();
  try{
   const current=readPlanner(),fields=form.elements,old=current.entries.find(row=>row.id===editing),now=Date.now();
   if(editing&&!old)throw Error('这条日程已被移除，请重新添加');
   const id=editing||crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
   const row={id,title:fields.title.value,at:parsePlannerTime(fields.date.value,fields.time.value,old?.at),note:fields.note.value};
   persist(upsertPlannerEntry(current,row,now),editing?'日程已更新':'日程已添加',{id,at:now});
  }catch(error){$('#planner-edit-error').textContent=error.message;}
 };
 $('#planner-delete').onclick=()=>{$('#planner-delete-check').hidden=false;$('#planner-delete-confirm').focus();};
 $('#planner-delete-cancel').onclick=()=>{$('#planner-delete-check').hidden=true;$('#planner-delete').focus();};
 $('#planner-delete-confirm').onclick=()=>{
  try{if(editing)persist(validatePlanner({version:1,entries:readPlanner().entries.filter(x=>x.id!==editing)}),'日程已删除');}
  catch(error){$('#planner-edit-error').textContent=error.message;}
 };
 $('#planner-notifications').onclick=()=>native?.requestPlannerNotifications();
 $('#planner-exact').onclick=()=>native?.requestPlannerExact();
 $('#planner-retry').onclick=()=>{syncNative();permissionCopy();tick();};
 $('#planner-ack').onclick=()=>alert.close();
 alert.addEventListener('close',()=>{if(!alert.open)alertKeys.clear();});
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-action=planner]'))openPlanner();
  const edit=event.target.closest('[data-plan-edit]');
  if(edit){const row=state?.entries.find(x=>x.id===edit.dataset.planEdit);if(row)openEditor(row);}
 });
 if(native)window.onNativePlannerChanged=()=>{permissionCopy();tick();};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&native&&!synced)syncNative();permissionCopy();tick();});
 window.addEventListener('pageshow',()=>{permissionCopy();tick();});
 window.addEventListener('storage',event=>{if(event.key===PLANNER_KEY||event.key===null)reload();});
 function followLink(){
  if(location.hash!=='#planner')return;
  history.replaceState(history.state,'',location.pathname+location.search);
  setView('today');openPlanner();
 }
 window.addEventListener('hashchange',followLink);
 reload();followLink();
 return {reload:()=>reload({restored:true})};
}
