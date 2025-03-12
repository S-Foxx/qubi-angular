// sw.js
// This file will be bundled and served properly in the web root
import { ServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

let handler;

self.addEventListener("install", function(event) {
  console.log("Service Worker installing");
  
});

self.addEventListener("activate", function(event) {
  console.log("Service Worker activating");
  handler = new ServiceWorkerMLCEngineHandler();
  console.log("WebLLM Service Worker is ready");
  
  // Claim clients so the service worker starts controlling any open pages
  
});