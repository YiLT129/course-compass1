from pathlib import Path
import zipfile,re,sys,json,hashlib
if len(sys.argv)!=2:raise SystemExit('Usage: python scripts/verify-apk-startup.py /path/to/app.apk')
apk=Path(sys.argv[1])
with zipfile.ZipFile(apk) as z:
    assert z.testzip() is None
    # ZipInfo.filename is silently normalized by Python on Windows. orig_filename is essential.
    invalid=[i.orig_filename for i in z.infolist() if '\\' in i.orig_filename]
    assert not invalid,f'Android-incompatible raw ZIP entry names: {invalid[:5]}'
    names=set(z.namelist())
    for name in ['assets/demo/index.html','assets/demo/demo.js','assets/demo/crop-editor.js','assets/demo/data-tools.js','assets/demo/glass.css','assets/core/model.js','assets/vendor/pdfjs/pdf.js','assets/vendor/pdfjs/pdf.worker.js']:
        assert name in names,name
    if 'assets/vendor/ocr/manifest.json' in names:
        ocr=json.loads(z.read('assets/vendor/ocr/manifest.json'))
        for name,meta in ocr['files'].items():
            path='assets/vendor/ocr/'+name
            assert path in names,f'Missing OCR asset (possible AAPT filename rewrite): {path}'
            data=z.read(path)
            assert len(data)==meta['bytes'] and hashlib.sha256(data).hexdigest()==meta['sha256'],f'Changed OCR asset: {path}'
    for name in sorted(n for n in names if n.startswith('assets/') and n.endswith(('.js','.html')) and '/vendor/' not in n):
        text=z.read(name).decode('utf-8')
        refs=re.findall(r'(?:from\s*|import\s*\(|(?:src|href)=)[\s]*[\'"]([^\'"<>\s]+)',text)
        for ref in refs:
            if not ref.startswith(('./','../')) or not re.search(r'\.(js|css|svg|html|json|webmanifest)$',ref):continue
            parts=[]
            for part in (str(Path(name).parent).replace('\\','/')+'/'+ref).split('/'):
                if part=='..':parts.pop()
                elif part not in ('','.'):parts.append(part)
            target='/'.join(parts)
            assert target in names,f'{name}: missing {target}'
    source=(Path(__file__).resolve().parents[1]/'android/app/src/main/java/cn/coursecompass/app/MainActivity.java').read_text(encoding='utf-8')
    assert 'new WebViewAssetLoader.Builder()' in source
    assert '/assets/demo/index.html' in source
    assert 'shouldInterceptRequest(WebView view,String url)' in source
    assert 'ApkFiles.read(getApplicationInfo().sourceDir' in source
print('PASS: RAW APK entry names, launch document, local dependencies, AndroidX loader and fallback')
