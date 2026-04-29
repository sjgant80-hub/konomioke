// tag-db.js — shared tag.db loader for all pages
// Fetches konomi-config + engine-config issues, caches in TAGDB
var TAGDB={tags:{},loaded:false,repo:'teslasolar/konomioke'};

async function loadTagDB(){
  if(TAGDB.loaded)return TAGDB.tags;
  var labels=['konomi-config','engine-config'];
  for(var label of labels){
    try{
      var ctrl=new AbortController();setTimeout(function(){ctrl.abort()},4000);
      var r=await fetch('https://api.github.com/repos/'+TAGDB.repo+'/issues?labels='+label+'&state=open&per_page=50',
        {headers:{Accept:'application/vnd.github+json'},signal:ctrl.signal});
      var data=await r.json();
      if(!Array.isArray(data))continue;
      for(var iss of data){
        var m=iss.body?.match(/```json\s*([\s\S]*?)```/);
        if(!m)continue;
        try{var tag=JSON.parse(m[1]);var id=tag.tag_id||tag._udt||'issue-'+iss.number;
          tag._issue=iss.number;tag._label=label;TAGDB.tags[id]=tag}catch(e){}}
    }catch(e){}
  }
  TAGDB.loaded=true;
  return TAGDB.tags;
}

function getTag(id){return TAGDB.tags[id]||null}
function getAllTags(){return TAGDB.tags}
function getTagsByLabel(label){var out={};for(var k in TAGDB.tags)if(TAGDB.tags[k]._label===label)out[k]=TAGDB.tags[k];return out}
