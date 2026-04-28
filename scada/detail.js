function selectTag(i){
  SEL=i;renderSidebar();
  var t=(TAB==='gh'?GH_TAGS:LOCAL_TAGS)[i];
  var clean=cleanTag(t);
  var main=document.getElementById('main');
  var p=prop('id',t._id);
  if(t._src==='gh'){p+=prop('issue','#'+t._issue)+prop('title',t._title)+prop('updated',t._updated?.slice(0,19).replace('T',' '))}
  else{p+=prop('file','tags/'+t._file)}
  if(t._udt)p+=prop('_udt',t._udt);
  if(t._hasScript)p+=prop('script',t._scriptLen+' bytes');
  main.innerHTML='<div class="detail"><h3>'+(t._src==='gh'?'#'+t._issue+' · ':'')+t._id+'</h3>'
    +'<div class="props">'+p+'</div>'
    +'<h3 style="margin-top:8px">JSON</h3><pre>'+esc(JSON.stringify(clean,null,2))+'</pre>'
    +(t._hasScript?'<h3 style="margin-top:8px">script</h3><pre>'+esc(t.script)+'</pre>':'')
    +'<div style="margin-top:6px;display:flex;gap:4px">'
    +'<button class="btn" onclick="copyTag('+i+')">⎘ copy</button>'
    +(t._src==='gh'?'<button class="btn" onclick="window.open(\'https://github.com/'+REPO+'/issues/'+t._issue+'\')">↗ github</button>':'')
    +'</div></div>';
}

function copyTag(i){navigator.clipboard.writeText(JSON.stringify(cleanTag((TAB==='gh'?GH_TAGS:LOCAL_TAGS)[i]),null,2))}
function copyAll(){navigator.clipboard.writeText(JSON.stringify(GH_TAGS.concat(LOCAL_TAGS).map(cleanTag),null,2))}

async function refresh(){
  document.getElementById('status').textContent='fetching...';
  try{await Promise.all([fetchGH(),fetchLocal()]);renderSidebar();renderMain();
    document.getElementById('status').textContent='✔ '+GH_TAGS.length+' issues · '+LOCAL_TAGS.length+' local'}
  catch(e){document.getElementById('status').innerHTML='<span style="color:var(--er)">✘ '+e.message+'</span>'}
}

setInterval(function(){var c=document.getElementById('clock');if(c)c.textContent=new Date().toLocaleTimeString()},1000);
refresh();
