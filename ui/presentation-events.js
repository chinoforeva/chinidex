/* Explicit presentation events: adapters subscribe without replacing core functions. */
(() => {
 const listeners=new Map();
 window.ChiniEvents=Object.freeze({
  on(name,listener){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(listener);return ()=>listeners.get(name)?.delete(listener);},
  emit(name,args){for(const listener of listeners.get(name)||[])listener(...args);}
 });
})();
