/** Crop locally and discard photo metadata before saving a small account image. */
export async function profileImage(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)||file.size>10*1024*1024)throw new Error('10MB 이하의 사진을 선택해 주세요.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('사진을 처리하지 못했어요.');
  const side=Math.min(image.naturalWidth,image.naturalHeight);
  ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,192,192);
  let value=canvas.toDataURL('image/webp',.8);
  // Some native WebViews display WebP but only encode JPEG/PNG from a canvas.
  if(!value.startsWith('data:image/webp;')||value.length>48000){
   ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fff4d9';ctx.fillRect(0,0,192,192);
   value=canvas.toDataURL('image/jpeg',.78);
  }
  if(!/^data:image\/(webp|jpeg);base64,/.test(value)||value.length>48000)throw new Error('다른 사진을 선택해 주세요.');
  return value;
 }finally{URL.revokeObjectURL(url);}
}
