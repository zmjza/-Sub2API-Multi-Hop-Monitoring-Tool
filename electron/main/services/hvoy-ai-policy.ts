const allowedOrigins = new Set(['https://hvoyai.com', 'https://www.hvoyai.com']);

export function buildHvoyAiFillScript(apiBaseUrl: string, apiKey: string): string {
  const url = JSON.stringify(apiBaseUrl);
  const key = JSON.stringify(apiKey);
  return `(async()=>{
    const wait=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
    const fieldText=(element)=>{
      const label=element.id?document.querySelector('label[for="'+CSS.escape(element.id)+'"]')?.textContent:'';
      return [element.name,element.id,element.placeholder,element.getAttribute('aria-label'),label,element.parentElement?.innerText].filter(Boolean).join(' ').toLowerCase();
    };
    const fields=()=>[...document.querySelectorAll('input,textarea')].filter((element)=>!element.disabled);
    const setValue=(element,value)=>{
      const prototype=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;
      if(!setter)return false;
      element.focus();
      setter.call(element,value);
      try{element.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:null}));}
      catch{element.dispatchEvent(new Event('input',{bubbles:true}));}
      element.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    };
    for(let attempt=0;attempt<80;attempt+=1){
      const regionButton=[...document.querySelectorAll('button')].find((button)=>button.textContent?.trim()==='我知道了');
      regionButton?.click();
      let candidates=fields();
      const urlInput=candidates.find((element)=>element.name==='api-endpoint-url')||candidates.find((element)=>/api.*(url|address|地址|接口)|接口地址/.test(fieldText(element)))||candidates.find((element)=>/^https?:/i.test(element.placeholder||''));
      let keyInput=candidates.find((element)=>element.name==='access-token-input')||candidates.find((element)=>/(api.*key|key.*api|密钥)/.test(fieldText(element)))||candidates.find((element)=>/sk-/.test(element.placeholder||''));
      if(!keyInput){
        const keyLabel=[...document.querySelectorAll('label')].find((label)=>/api *key|api密钥|密钥/i.test(label.textContent||''));
        const keyPlaceholder=keyLabel?.parentElement?.querySelector('div.cursor-text');
        if(keyPlaceholder instanceof HTMLElement){
          const rect=keyPlaceholder.getBoundingClientRect();
          if(rect.width>0&&rect.height>0)return {
            filled:false,
            urlFound:Boolean(urlInput),
            keyFound:false,
            keyActivation:{x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+rect.height/2)}
          };
        }
        await wait(250);
        candidates=fields();
        keyInput=candidates.find((element)=>element.name==='access-token-input')||candidates.find((element)=>/(api.*key|key.*api|密钥)/.test(fieldText(element)));
      }
      if(urlInput&&keyInput){
        setValue(urlInput,${url});
        setValue(keyInput,${key});
        await wait(120);
        if(urlInput.value===${url}&&keyInput.value===${key}){
          const heading=[...document.querySelectorAll('h1,h2,h3')].find((element)=>element.textContent?.trim()==='接口配置');
          heading?.scrollIntoView({block:'start'});
          window.scrollBy(0,-16);
          return {filled:true,urlFound:true,keyFound:true};
        }
      }
      await wait(250);
    }
    const candidates=fields();
    return {
      filled:false,
      urlFound:candidates.some((element)=>element.name==='api-endpoint-url'||/api.*(url|address|地址|接口)|接口地址/.test(fieldText(element))),
      keyFound:candidates.some((element)=>element.name==='access-token-input'||/(api.*key|key.*api|密钥)/.test(fieldText(element)))
    };
  })()`;
}

export function isAllowedHvoyAiNavigation(value: string): boolean {
  try {
    const url = new URL(value);
    return url.username === '' && url.password === '' && allowedOrigins.has(url.origin);
  } catch {
    return false;
  }
}
