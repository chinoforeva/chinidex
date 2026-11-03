(() => {
 const media=matchMedia('(max-width:700px)');let previous=media.matches;
 function single(){return media.matches;}
 function sync(){document.body.dataset.albumSingle=String(media.matches);document.body.classList.toggle('album-grid-view',!!window.ChiniWorkspace?.cache.documents.ui?.data.albumGrid);}
 window.ChiniAlbumView={single,sync};sync();
 media.addEventListener('change',()=>{
  const old=previous;previous=media.matches;sync();
  if(albumSetSlug&&collectionMode==='album'){const absolute=albumSpreadIndex*(old?1:2);albumSpreadIndex=Math.floor(absolute/(media.matches?1:2));renderAlbumBook();}
  if(collectionMode==='personal')window.renderPersonalAlbums?.();
  if(activeViewName()==='catch-em-all'){const first=old?pokedexSpreadIndex:Math.max(0,pokedexSpreadIndex*2-1);pokedexSpreadIndex=media.matches?first:Math.floor((first+1)/2);renderPokedexBook();}
 });
})();
