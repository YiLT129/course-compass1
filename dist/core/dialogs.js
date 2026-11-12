// Shared modal navigation for the preview and original timetable.
export function setupDialogNavigation({onRootBack=()=>false,motion=false}={}) {
 const stack=[],registered=new WeakSet(),motions=new WeakMap();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const canAnimate=dialog=>motion&&!reduced.matches&&typeof dialog.animate==='function';
 const pose=y=>`translate3d(0,${y}px,0)`;
 function top(){for(let i=stack.length-1;i>=0;i--)if(stack[i].open)return stack[i];}
 function forget(dialog){const i=stack.indexOf(dialog);if(i>=0)stack.splice(i,1);}
 function cancelMotion(dialog){
  const active=motions.get(dialog);if(!active)return;
  motions.delete(dialog);delete dialog.dataset.exiting;active.animation.cancel();
 }
 function animate(dialog,frames,duration,finish){
  cancelMotion(dialog);
  const animation=dialog.animate(frames,{duration,easing:finish?'cubic-bezier(.4,0,.72,1)':'cubic-bezier(.16,1,.3,1)',fill:'both'});
  const entry={animation,exiting:!!finish};motions.set(dialog,entry);
  if(finish)dialog.dataset.exiting='';
  animation.onfinish=()=>{
   if(motions.get(dialog)!==entry)return;
   if(finish&&dialog.open)dialog.close();
   cancelMotion(dialog);
  };
 }
 function position(dialog){
  try{return Math.max(0,new DOMMatrixReadOnly(getComputedStyle(dialog).transform).m42);}catch{return 0;}
 }
 function closeAll(){
  for(let i=stack.length-1;i>=0;i--){const dialog=stack[i];cancelMotion(dialog);if(dialog.open)dialog.close();}
  stack.length=0;
 }
 function dismiss(dialog=top(),offset){
  if(!dialog?.open||dialog!==top())return false;
  if(motions.get(dialog)?.exiting)return true;
  if(!canAnimate(dialog)){cancelMotion(dialog);dialog.close();return true;}
  const from=offset??position(dialog);
  animate(dialog,[{transform:pose(from),opacity:1},{transform:pose(Math.max(56,from+38)),opacity:0}],145,true);
  return true;
 }
 function back(){return dismiss()||Boolean(onRootBack());}
 function open(dialog,{nested=false}={}){
  if(typeof dialog==='string')dialog=document.querySelector(dialog);
  if(!dialog)throw Error('找不到要打开的界面');
  register(dialog);
  if(dialog.open){if(motions.get(dialog)?.exiting)cancelMotion(dialog);return;}
  if(!nested)closeAll();
  forget(dialog);dialog.showModal();stack.push(dialog);
  if(canAnimate(dialog))animate(dialog,[{transform:pose(30),opacity:.72},{transform:pose(0),opacity:1}],205,false);
 }
 function register(dialog){
  if(registered.has(dialog))return;registered.add(dialog);
  const handle=dialog.querySelector('.sheet-handle');let pull=null,frame=0;
  function clearPull(){
   if(frame)cancelAnimationFrame(frame);frame=0;pull=null;
   dialog.style.transform='';
  }
  if(handle){
   handle.addEventListener('pointerdown',e=>{
    if(dialog!==top()||motions.get(dialog)?.exiting||!e.isPrimary||e.button!==0)return;
    const offset=motion?position(dialog):0;
    cancelMotion(dialog);dialog.style.animation='none';dialog.style.transform=pose(offset);
    pull={id:e.pointerId,start:e.clientY,time:e.timeStamp,dy:0,offset};handle.setPointerCapture(e.pointerId);
   });
   handle.addEventListener('pointermove',e=>{
    if(!pull||pull.id!==e.pointerId)return;
    pull.dy=Math.max(0,e.clientY-pull.start);
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(pull&&dialog.open)dialog.style.transform=pose(pull.dy+pull.offset);});
   });
   for(const name of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,e=>{
    if(!pull||pull.id!==e.pointerId)return;
    const dy=pull.dy,offset=dy+pull.offset,speed=dy/Math.max(1,e.timeStamp-pull.time);
    const shouldDismiss=name==='pointerup'&&(dy>90||(motion&&dy>=38&&speed>.65));
    clearPull();if(motion)dialog.style.animation='';
    if(shouldDismiss)dismiss(dialog,offset);
    else if(offset>0&&canAnimate(dialog))animate(dialog,[{transform:pose(offset)},{transform:pose(0)}],170,false);
   });
  }
  let startedOutside=false;
  // While the modal is still in the top layer, prevent a queued key or submit
  // from confirming the form after the user has chosen to close it.
  for(const name of ['click','keydown','submit'])dialog.addEventListener(name,event=>{
   if(motions.get(dialog)?.exiting){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',event=>{startedOutside=event.target===dialog&&outside(event);});
  dialog.addEventListener('click',event=>{if(dialog===top()&&event.target===dialog&&startedOutside&&outside(event))dismiss(dialog);startedOutside=false;});
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(dialog===top())back();});
  dialog.addEventListener('close',()=>{if(dialog.open)return;cancelMotion(dialog);clearPull();dialog.style.animation='';forget(dialog);startedOutside=false;});
 }
 for(const dialog of document.querySelectorAll('dialog'))register(dialog);
 const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){if(node.matches('dialog'))register(node);for(const dialog of node.querySelectorAll('dialog'))register(dialog);}});observer.observe(document.body,{childList:true,subtree:true});
 // Android calls this before navigating WebView history or returning to the launcher.
 window.handleAppBack=back;
 let edge=null;
 document.addEventListener('pointerdown',e=>{if(e.clientX<24&&(top()||document.body.dataset.view&&document.body.dataset.view!=='week')&&!e.target.closest('input,textarea,select,.sheet-handle'))edge={id:e.pointerId,x:e.clientX,y:e.clientY};});
 document.addEventListener('pointerup',e=>{if(!edge||edge.id!==e.pointerId)return;const start=edge;edge=null;if(e.clientX-start.x>90&&Math.abs(e.clientY-start.y)<65)back();});
 document.addEventListener('pointercancel',()=>edge=null);
 return {open,dismiss,back,closeAll,top,register};
}
