function switchTab(t){TAB=t;SEL=null;
  document.getElementById('tab-gh').className='tab'+(t==='gh'?' active':'');
  document.getElementById('tab-local').className='tab'+(t==='local'?' active':'');
  renderSidebar();renderMain()}

function renderSidebar(){
  var list=TAB==='gh'?GH_TAGS:LOCAL_TAGS;
  document.getElementById('sidebar').innerHTML=list.map(function(t,i){
    var pills='';
    if(t._src==='gh')pills+='<span class="pill gh">GH#'+t._issue+'</span>';
    else pills+='<span class="pill loc">FILE</span>';
    if(t._isSys)pills+='<span class="pill sys">SYS</span>';
    if(t._hasScript)pills+='<span class="pill scr">JS</span>';
    return '<div class="tag-row'+(SEL===i?' sel':'')+'" onclick="selectTag('+i+')">'
      +'<span style="color:var(--ig);min-width:12ch;font-weight:600">'+esc(t._id)+'</span>'
      +'<span style="flex:1"></span>'+pills+'</div>'}).join('');
}

function renderMain(){
  var gh=GH_TAGS.length,loc=LOCAL_TAGS.length;
  var scripts=GH_TAGS.filter(function(t){return t._hasScript}).length;
  var jsBytes=GH_TAGS.reduce(function(s,t){return s+t._scriptLen},0);
  document.getElementById('main').innerHTML='<div class="stats-row">'
    +stat(gh,'GH ISSUES','var(--ig)')+stat(loc,'LOCAL FILES','var(--gd)')
    +stat(gh+loc,'TOTAL','var(--ok)')+stat(scripts,'SCRIPTS','var(--wr)')
    +stat(jsBytes,'JS BYTES','#a080ff')+'</div>'
    +'<div class="detail"><h3>tag.db overview</h3>'
    +'<pre>'+esc('── GitHub Issues ('+LABEL+') ──\n'
      +GH_TAGS.map(function(t){return(t._isSys?'⚙':'◻')+' '+t._id.padEnd(20)+' #'+String(t._issue).padStart(2)
        +(t._hasScript?' JS:'+String(t._scriptLen).padStart(4):'')}).join('\n')
      +'\n\n── Local tags/ ──\n'
      +LOCAL_TAGS.map(function(t){return '📄 '+t._id.padEnd(20)+' '+t._file}).join('\n'))
    +'</pre></div>';
}
