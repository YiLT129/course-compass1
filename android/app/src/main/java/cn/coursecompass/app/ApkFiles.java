package cn.coursecompass.app;
import java.io.*;
import java.util.zip.*;

/** Reads only bundled web files from this application's own base APK. */
final class ApkFiles {
 static byte[] read(String apk,String path)throws IOException{
  if(path==null||path.startsWith("/")||path.indexOf('\\')>=0)throw new IOException("Invalid asset path: "+path);
  for(String part:path.split("/"))if(part.equals("..")||part.equals("."))throw new IOException("Invalid asset path: "+path);
  try(ZipFile zip=new ZipFile(apk)){
   ZipEntry entry=zip.getEntry("assets/"+path);if(entry==null||entry.isDirectory())throw new FileNotFoundException("assets/"+path);
   if(entry.getSize()>16*1024*1024)throw new IOException("Bundled asset too large");
   try(InputStream in=zip.getInputStream(entry);ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] buffer=new byte[8192];int n,total=0;while((n=in.read(buffer))!=-1){total+=n;if(total>16*1024*1024)throw new IOException("Bundled asset too large");out.write(buffer,0,n);}return out.toByteArray();
   }
  }
 }
}
