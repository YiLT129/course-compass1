// Shared modal navigation for the preview and original timetable.
export function setupDialogNavigation({onRootBack=()=>false}={}) {
 const stack=[],registered=new WeakSet();
 function top(){return [...stack].reverse().find(dialog=>dialog.open);}
 function closeAll(){for(const dialog of [...stack].reverse())if(dialog.open)dialog.close();stack.length=0;}
 function back(){const dialog=top();if(dialog){dialog.close();return true;}return Boolean(onRootBack());}
 function open(dialog,{nested=false}={}){
  if(typeof dialog==='string')dialog=document.querySelector(dialog);
  if(!dialog)throw Error('找不到要打开的界面');
  register(dialog);
  if(dialog.open)return;
  if(!nested)closeAll();
  stack.push(dialog);dialog.showModal();
 }
 function register(dialog){if(registered.has(dialog))return;registered.add(dialog);
  const handle=dialog.querySelector('.sheet-handle');let pull=null;
  if(handle){handle.addEventListener('pointerdown',e=>{if(dialog!==top())return;dialog.style.animation='none';pull={id:e.pointerId,start:e.clientY,y:0};handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointermove',e=>{if(!pull||pull.id!==e.pointerId)return;pull.y=Math.max(0,e.clientY-pull.start);dialog.style.transform=`translateY(${pull.y}px)`;});for(const name of ['pointerup','pointercancel'])handle.addEventListener(name,e=>{if(!pull||pull.id!==e.pointerId)return;const dy=pull.y;pull=null;dialog.style.transform='';if(name==='pointerup'&&dy>90)back();});}
  let startedOutside=false;
  const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',event=>{startedOutside=event.target===dialog&&outside(event);});
  dialog.addEventListener('click',event=>{if(dialog===top()&&event.target===dialog&&startedOutside&&outside(event))dialog.close();startedOutside=false;});
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(dialog===top())back();});
  dialog.addEventListener('close',()=>{if(dialog.open)return;dialog.style.animation='';dialog.style.transform='';const i=stack.indexOf(dialog);if(i>=0)stack.splice(i,1);startedOutside=false;});
 }
 for(const dialog of document.querySelectorAll('dialog'))register(dialog);
 const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){if(node.matches('dialog'))register(node);for(const dialog of node.querySelectorAll('dialog'))register(dialog);}});observer.observe(document.body,{childList:true,subtree:true});
 // Android calls this before navigating WebView history or returning to the launcher.
 window.handleAppBack=back;
 let edge=null;document.addEventListener('pointerdown',e=>{if(e.clientX<24&&(top()||document.body.dataset.view&&document.body.dataset.view!=='week')&&!e.target.closest('input,textarea,select'))edge={id:e.pointerId,x:e.clientX,y:e.clientY};});document.addEventListener('pointerup',e=>{if(!edge||edge.id!==e.pointerId)return;const start=edge;edge=null;if(e.clientX-start.x>90&&Math.abs(e.clientY-start.y)<65)back();});document.addEventListener('pointercancel',()=>edge=null);
 return {open,back,closeAll,top,register};
}
