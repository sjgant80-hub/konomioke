// llm.js — in-browser LLM via WebLLM (WebGPU), generates chat responses
var LLM={engine:null,ready:false,loading:false,model:'SmolLM2-1.7B-Instruct-q4f16_1-MLC'};

async function initLLM(statusCb){
  if(LLM.loading||LLM.ready)return;
  LLM.loading=true;
  if(statusCb)statusCb('loading WebLLM...');
  try{
    var mod=await import('https://esm.run/@mlc-ai/web-llm');
    var create=mod.CreateMLCEngine||mod.CreateWebWorkerMLCEngine;
    LLM.engine=await create(LLM.model,{
      initProgressCallback:function(p){
        if(statusCb)statusCb(p.text||('loading '+Math.round((p.progress||0)*100)+'%'));
      }
    });
    LLM.ready=true;LLM.loading=false;
    trace('info','llm ready: '+LLM.model,'llm');
    if(statusCb)statusCb('LLM ready');
  }catch(e){
    LLM.loading=false;
    trace('warn','llm load fail: '+e.message,'llm');
    if(statusCb)statusCb('LLM failed: '+e.message);
  }
}

async function llmRespond(userMsg){
  if(!LLM.ready||!LLM.engine)return null;
  try{
    var reply=await LLM.engine.chat.completions.create({
      messages:[
        {role:'system',content:'You are a friendly arena companion in KONOMI chat. Keep responses under 2 sentences. Be fun and reactive to what people say. You can reference the kanji blast game (火雷気水風土).'},
        {role:'user',content:userMsg}
      ],
      max_tokens:80,temperature:0.8
    });
    return reply.choices[0]?.message?.content||null;
  }catch(e){trace('warn','llm error: '+e.message,'llm');return null}
}
