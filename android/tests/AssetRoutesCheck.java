package cn.coursecompass.app;
public final class AssetRoutesCheck {
 public static void main(String[] args){
  check("/","demo/index.html");check("/demo","demo/index.html");check("/demo/","demo/index.html");check("/demo/index.html","demo/index.html");check("/demo/demo.js","demo/demo.js");check("/core/model.js","core/model.js");check("/vendor/pdfjs/cmaps/UniGB-UCS2-H.bcmap","vendor/pdfjs/cmaps/UniGB-UCS2-H.bcmap");check("/../school.json",null);check("/demo/../../school.json",null);check("/demo\\index.html",null);
  if(!"text/javascript".equals(AssetRoutes.mime("pdf.worker.js")))throw new AssertionError("Worker MIME");if(!"text/html".equals(AssetRoutes.mime("index.html")))throw new AssertionError("HTML MIME");System.out.println("PASS: native asset routes, directory launch URLs, traversal rejection, module MIME");
 }
 static void check(String path,String expected){String result=AssetRoutes.assetPath(path);if(expected==null?result!=null:!expected.equals(result))throw new AssertionError(path+" -> "+result);}
}
