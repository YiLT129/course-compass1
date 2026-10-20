import {occurrenceKey,overrideFor,readOverrides,resetOverride,saveOverrides,upsertOverride} from '../core/overrides.js';

export function setupOverrides({getContext,notify,onChange=()=>{},storage=globalThis.localStorage}){
 function show(context={}){
  document.getElementById('occurrence-editor')?.remove();
  const host=document.getElementById('detail-content');if(!host)return;
  const section=document.createElement('section');section.id='occurrence-editor';section.className='occurrence-editor';
  let state,key,existing;const {course,week,period}=context,{settings,schoolId}=getContext();
  try{
   if(!course||!Number.isInteger(week)||!Number.isInteger(period))throw Error('请先回到课表，点开某一天的一节课，再做单次调整。');
   key=occurrenceKey(course,settings,{schoolId,week,period});if(context.date&&context.date!==key.date)throw Error('所选日期与课块不一致，请回到课表重新选择。');state=readOverrides(storage);existing=overrideFor(state,course,settings,{schoolId,week,period});
  }catch(error){section.classList.add('occurrence-hint');section.textContent=error.message;host.append(section);return;}
  const title=document.createElement('h3');title.textContent='仅修改这一次';section.append(title);
  const hint=document.createElement('p');hint.className='sheet-tip';hint.textContent=`${key.date} · 第 ${period} 节。只保存在本机，刷新教务课表后仍保留。`;section.append(hint);
  const form=document.createElement('form');form.className='occurrence-form';
  const cancelledLabel=document.createElement('label');cancelledLabel.className='occurrence-toggle';
  const cancelled=document.createElement('input');cancelled.type='checkbox';cancelled.name='cancelled';cancelled.checked=existing?.cancelled===true;
  const cancelledText=document.createElement('span');cancelledText.textContent='这节停课';cancelledLabel.append(cancelled,cancelledText);form.append(cancelledLabel);
  const roomLabel=document.createElement('label');roomLabel.textContent='这一次的教室';
  const room=document.createElement('input');room.type='text';room.name='location';room.maxLength=160;room.placeholder=course.location||'填写这一次的上课地点';room.value=existing?.location??course.location??'';roomLabel.append(room);form.append(roomLabel);
  const error=document.createElement('p');error.className='occurrence-error';error.setAttribute('role','status');form.append(error);
  const buttons=document.createElement('div');buttons.className='occurrence-actions';
  const save=document.createElement('button');save.type='submit';save.className='primary-button';save.textContent=existing?'保存这次修改':'保存单次调整';buttons.append(save);
  const reset=document.createElement('button');reset.type='button';reset.className='secondary-button';reset.textContent='恢复教务安排';reset.hidden=!existing;buttons.append(reset);form.append(buttons);section.append(form);host.append(section);
  function enableRoom(){room.disabled=cancelled.checked;}enableRoom();cancelled.onchange=enableRoom;
  function persist(next,message){try{saveOverrides(next,storage);notify(message);onChange(context);if(section.isConnected)show(context);}catch(cause){error.textContent=cause.message||'本机保存失败，请重试';}}
  form.onsubmit=event=>{
   event.preventDefault();error.textContent='';
   try{const latest=readOverrides(storage),location=room.value.trim()===(course.location||'').trim()?null:room.value.trim();
    const next=!cancelled.checked&&location===null?resetOverride(latest,key):upsertOverride(latest,{...key,cancelled:cancelled.checked,location,updatedAt:Date.now()});
    persist(next,cancelled.checked?'已将这一次标记为停课':location===null?'已恢复这一次的教务安排':'已保存这一次的教室');
   }catch(cause){error.textContent=cause.message;}
  };
  reset.onclick=()=>{try{persist(resetOverride(readOverrides(storage),key),'已恢复这一次的教务安排');}catch(cause){error.textContent=cause.message;}};
 }
 return {show,records:()=>readOverrides(storage).entries};
}
