/* Keep browser security enabled. Blob workers contain only bundled local code. */
const WorkerRuntime={
 create(){
  if(location.protocol!=='file:'||window.nexoraDesktop)return {worker:new Worker('analysis-worker.js'),dispose(){}};
  if(typeof NexoraWorkerSource!=='string')throw new Error('Recursos locais incompletos. Extraia todo o ZIP atualizado ou execute npm ci antes de abrir o aplicativo.');
  const url=URL.createObjectURL(new Blob([NexoraWorkerSource],{type:'text/javascript'}));
  try{return {worker:new Worker(url),dispose(){URL.revokeObjectURL(url)}}}
  catch(error){URL.revokeObjectURL(url);throw error}
 }
};
