import { Unzip, UnzipInflate, strFromU8 } from 'fflate';
import { classifyFile, parseEntries } from './analysis';
const MAX_INPUT = 250 * 1024 * 1024;
const MAX_JSON = 40 * 1024 * 1024;
const MAX_TOTAL = 100 * 1024 * 1024;
self.onmessage = async (event: MessageEvent<{ files: File[] }>) => {
  try {
    const files = event.data.files;
    if (!files.length || files.length > 200) throw new Error('Choose a ZIP or up to 200 JSON files.');
    if (files.reduce((n,f)=>n+f.size,0)>MAX_INPUT) throw new Error('This import exceeds 250 MB. Request only Followers and following, or extract the ZIP and select the connection JSON files.');
    if (files.some(f=>f.name.endsWith('.zip')) && files.length!==1) throw new Error('Import one ZIP at a time, or select the JSON files from a single export.');
    const entries: {name:string; text:string}[] = []; let total = 0;
    for (const file of files) {
      if (/\.zip$/i.test(file.name)) {
        let failure: Error | null = null; let count = 0;
        const unzip = new Unzip(entry => {
          if (++count > 100000) { failure = new Error('Archive has too many files. Export only Followers and following.'); return; }
          if (!classifyFile(entry.name)) return;
          if (entries.length >= 200) { failure = new Error('Too many connection files.'); return; }
          const chunks: Uint8Array[] = []; let length = 0;
          entry.ondata = (err, data, final) => {
            if (err) { failure = new Error('Could not decompress this ZIP. Extract it and import the JSON files.'); return; }
            length += data.length; total += data.length;
            if (length > MAX_JSON || total > MAX_TOTAL) { failure = new Error('Expanded connection data is too large. Import a smaller export.'); entry.terminate(); return; }
            chunks.push(data);
            if (final) { const joined = new Uint8Array(length); let offset = 0; for(const c of chunks){joined.set(c,offset);offset+=c.length;} entries.push({name:entry.name,text:strFromU8(joined)}); }
          };
          entry.start();
        });
        unzip.register(UnzipInflate);
        const reader = file.stream().getReader();
        try { while(true){ const {value,done}=await reader.read(); if(done){unzip.push(new Uint8Array(),true);break;} unzip.push(value,false); if(failure) throw failure; } if(failure) throw failure; } finally { await reader.cancel(); }
      } else {
        if (!classifyFile(file.name)) throw new Error(`Unsupported file: ${file.name}. Choose Instagram connection JSON files or the original ZIP.`);
        total += file.size;
        if (file.size > MAX_JSON || total > MAX_TOTAL) throw new Error('Connection files exceed the safe import size.');
        entries.push({name:file.name,text:await file.text()});
      }
    }
    self.postMessage({snapshot:parseEntries(entries, files.length === 1 ? files[0].name : `${files.length} Instagram files`)});
  } catch(error) { self.postMessage({error: error instanceof Error ? error.message : 'Could not read this archive.'}); }
};
