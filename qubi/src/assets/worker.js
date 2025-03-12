// WebLLM Web Worker implementation
import * as MLCWorker from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm";

console.log("Web Worker script loaded");
console.log("MLCWorker imported:", MLCWorker);

// Create a handler for processing messages
let handler;

try {
  if (typeof MLCWorker === 'undefined') {
    console.error("MLCWorker is undefined - import failed");
  } else if (!MLCWorker.WebWorkerMLCEngineHandler) {
    console.error("WebWorkerMLCEngineHandler is not defined");
    console.log("Available in MLCWorker:", Object.keys(MLCWorker));
  } else {
    // Use WebWorkerMLCEngineHandler instead of ServiceWorkerMLCEngineHandler
    handler = new MLCWorker.WebWorkerMLCEngineHandler();
    console.log("WebWorkerMLCEngineHandler created:", handler);
  }
} catch (error) {
  console.error("Error creating web worker handler:", error);
}

// Set up message handling
onmessage = function(event) {
  console.log('Web worker received message:', event.data);
  
  // Send acknowledgment back
  postMessage({
    type: 'worker_response',
    message: 'Message received by web worker'
  });
  
  // Forward to handler if it exists
  if (handler) {
    try {
      handler.onmessage(event);
    } catch (error) {
      console.error("Error in handler.onmessage:", error);
      
      // Send error back to main thread
      postMessage({
        type: 'error',
        message: 'Error processing message: ' + error.message
      });
    }
  } else {
    console.warn("Message received but handler not created yet");
    
    // Send error back to main thread
    postMessage({
      type: 'error',
      message: 'Handler not initialized yet'
    });
  }
};
