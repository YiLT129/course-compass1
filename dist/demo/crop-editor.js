import {cropRect} from '../core/crop.js';
export function createCropEditor({save,load,notify,openSheet}){
 const dialog=document.querySelector('#crop-sheet'),canvas=document.querySelector('#crop-preview'),ctx=canvas.getContext('2d');
 let image,blob,url,ratio=9/16,zoom=1,x=.5,y=.5,points=new Map(),gesture;
 function draw(){if(!image)return;const r=cropRect(image.width,image.height,ratio,zoom,x,y);canvas.width=600;canvas.height=Math.round(600/ratio);ctx.drawImage(image,r.x,r.y,r.w,r.h,0,0,canvas.width,canvas.height);document.querySelector('#crop-zoom').value=zoom;document.querySelector('#crop-zoom-value').textContent=zoom.toFixed(2)+'×';document.querySelector('#crop-size').textContent=`${Math.round(r.w)} × ${Math.round(r.h)} 像素`;}
 function rebase(){const p=[...points.values()];gesture={x,y,zoom,points:p.map(v=>({...v})),distance:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0};}
 canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});rebase();};
 canvas.onpointermove=e=>{if(!points.has(e.pointerId)||!image)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...points.values()],box=canvas.getBoundingClientRect();if(p.length>1&&gesture.points.length>1){zoom=Math.max(1,Math.min(4,gesture.zoom*Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/Math.max(1,gesture.distance)));}else{const r=cropRect(image.width,image.height,ratio,zoom,x,y);x=Math.max(0,Math.min(1,gesture.x-(p[0].x-gesture.points[0].x)/box.width*r.w/Math.max(1,image.width-r.w)));y=Math.max(0,Math.min(1,gesture.y-(p[0].y-gesture.points[0].y)/box.height*r.h/Math.max(1,image.height-r.h)));}draw();};
 for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,e=>{points.delete(e.pointerId);rebase();});
 document.querySelector('#crop-ratio').onchange=e=>{ratio=e.target.value==='original'?image.width/image.height:e.target.value==='screen'?Math.max(.4,Math.min(1,innerWidth/innerHeight)):Number(e.target.value);draw();};
 document.querySelector('#crop-zoom').oninput=e=>{zoom=Number(e.target.value);draw();};
 document.querySelector('#crop-reset').onclick=()=>{zoom=1;x=y=.5;draw();};
 document.querySelector('#crop-cancel').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{points.clear();if(url)URL.revokeObjectURL(url);url=null;});
 document.querySelector('#crop-apply').onclick=async()=>{const button=document.querySelector('#crop-apply');button.disabled=true;try{const r=cropRect(image.width,image.height,ratio,zoom,x,y),out=document.createElement('canvas'),scale=Math.min(1,2560/Math.max(r.w,r.h));out.width=Math.max(1,Math.round(r.w*scale));out.height=Math.max(1,Math.round(r.h*scale));out.getContext('2d').drawImage(image,r.x,r.y,r.w,r.h,0,0,out.width,out.height);const cropped=await new Promise(resolve=>out.toBlob(resolve,'image/jpeg',.92));if(!cropped)throw Error('图片处理失败');await save(cropped,blob);dialog.close();notify('壁纸已裁剪并保存在此设备');}catch(e){notify(e.message);}finally{button.disabled=false;}};
 async function open(file){try{blob=file||await load();if(!blob)throw Error('请先选择一张图片');if(blob.size>15*1024*1024)throw Error('图片超过 15 MB，请使用较小的图片');if(!blob.type.startsWith('image/'))throw Error('请选择 JPG、PNG 或 WebP 图片');url=URL.createObjectURL(blob);image=new Image();image.src=url;await image.decode();if(image.width*image.height>60000000)throw Error('图片尺寸太大，请先缩小图片');zoom=1;x=y=.5;ratio=9/16;document.querySelector('#crop-ratio').value=String(ratio);openSheet('#crop-sheet');draw();}catch(e){if(url)URL.revokeObjectURL(url);notify(e.message);}}
 return {open};
}
