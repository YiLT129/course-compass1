// The same geometry drives the preview and exported pixels, including edge clamping.
export function cropRect(iw,ih,ratio,zoom=1,x=.5,y=.5){
 if(!(iw>0&&ih>0&&ratio>0))throw Error('图片尺寸无效');
 zoom=Math.max(1,Math.min(4,zoom));const w=Math.min(iw,ih*ratio)/zoom,h=w/ratio;
 return {x:Math.max(0,Math.min(1,x))*(iw-w),y:Math.max(0,Math.min(1,y))*(ih-h),w,h};
}
