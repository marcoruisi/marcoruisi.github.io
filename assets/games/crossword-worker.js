importScripts('/assets/games/crossword-engine.js');
self.onmessage=({data})=>{try{const grid=MRCCrosswordEngine.build(data.pairs,data.lang!=='en');self.postMessage({grid,project:MRCCrosswordEngine.project(grid,data.lang!=='en')})}catch(e){self.postMessage({error:e.message})}};
