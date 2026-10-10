// Shared modal navigation for the preview and original timetable.
export function setupDialogNavigation({onRootBack=()=>false}={}) {
 const stack=[];
 function top(){return [...stack].reverse().find(dialog=>dialog.open);}
 function closeAll(){for(const dialog of [...stack].reverse())if(dialog.open)dialog.close();stack.length=0;}
 function back(){const dialog=top();if(dialog){dialog.close();return true;}return Boolean(onRootBack());}
 function open(dialog,{nested=false}={}){
  if(typeof dialog==='string')dialog=document.querySelector(dialog);
  if(!dialog)throw Error('找不到要打开的界面');
  if(dialog.open)return;
  if(!nested)closeAll();
  stack.push(dialog);dialog.showModal();
 }
 for(const dialog of document.querySelectorAll('dialog')){
  let startedOutside=false;
  const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',event=>{startedOutside=event.target===dialog&&outside(event);});
  dialog.addEventListener('click',event=>{if(dialog===top()&&event.target===dialog&&startedOutside&&outside(event))dialog.close();startedOutside=false;});
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(dialog===top())back();});
  dialog.addEventListener('close',()=>{if(dialog.open)return;const i=stack.indexOf(dialog);if(i>=0)stack.splice(i,1);startedOutside=false;});
 }
 // Android calls this before navigating WebView history or returning to the launcher.
 window.handleAppBack=back;
 return {open,back,closeAll,top};
}
