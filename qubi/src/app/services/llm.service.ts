import { Injectable } from '@angular/core';
import * as webllm from '@mlc-ai/web-llm';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class LlmService {

  private _isModelLoaded = new BehaviorSubject<boolean>(false);
  public isModelLoaded$ = this._isModelLoaded.asObservable();
  
  public loadingState = new BehaviorSubject<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  public loadingProgress = new BehaviorSubject<string>('');
  public cacheStatus = new BehaviorSubject<'unknown' | 'checking' | 'not-found' | 'found'>('unknown');

  // Use 'any' type to avoid TypeScript errors
  private engine: any = null;
  private worker: Worker | null = null;
  
  // Model ID - using a smaller model for testing
  private modelId: string = 'gemma-2b-it-q4f16_1-MLC';
  
  // System prompt to guide the model's behavior
  private systemPrompt: string = `You are Qubi, it's an alias, you are a Gemma model from Google. You are a helpful and friendly AI assistant who chats in a human conversational way. You enjoy engaging the user in intriguing conversation.`;
  
  constructor() {
    console.log('LLM service initialized');
    
    // Check if auto-load is enabled (default to true)
    const autoLoadModel = localStorage.getItem('autoLoadModel') !== 'false';
    
    if (autoLoadModel) {
      // Use a small timeout to allow the UI to render first
      setTimeout(() => {
        this.checkAndLoadCachedModel();
      }, 100);
    }
  }

  /**
   * Check if the model is cached and load it automatically
   */
  private async checkAndLoadCachedModel(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        console.log('IndexedDB not supported, cannot check for cached model');
        this.cacheStatus.next('not-found');
        return;
      }
      
      // Set loading state
      this.loadingProgress.next('Checking for cached model...');
      this.cacheStatus.next('checking');
      
      // Proper way to check if model exists in IndexedDB
      const modelExists = await this.isModelInCache();
      
      if (!modelExists) {
        console.log('No cached model found, will require manual load');
        this.loadingProgress.next('');
        this.cacheStatus.next('not-found');
        return;
      }
      
      console.log('Found cached model in IndexedDB');
      this.loadingProgress.next('Found cached model. Loading from browser storage...');
      this.cacheStatus.next('found');
      
      // If we get here, attempt to load the model
      await this.initializeModel(true);
      
    } catch (error) {
      console.log('Error checking for cached model, will require manual load:', error);
      this.loadingProgress.next('');
      this.cacheStatus.next('not-found');
    }
  }

  /**
   * Check if the model exists in IndexedDB cache
   */
  private async isModelInCache(): Promise<boolean> {
    try {
      // Use WebLLM's built-in cache checking method
      const appConfig = webllm.prebuiltAppConfig;
      appConfig.useIndexedDBCache = true;
      
      // hasModelInCache is the official way to check if a model is cached
      const modelCached = await webllm.hasModelInCache(this.modelId, appConfig);
      console.log(`Model cache check for ${this.modelId}: ${modelCached}`);
      return modelCached;
    } catch (e) {
      console.error('Error checking model cache:', e);
      return false;
    }
  }

  /**
   * Initialize the model using Web Worker (not Service Worker)
   */
  public async initializeModel(fromCache: boolean = false): Promise<void> {
    try {
      console.log('Attempting to initialize model...');
      console.log('Using model ID:', this.modelId);
      
      this.loadingProgress.next(fromCache ? 'Loading model from cache...' : 'Starting model initialization...');
      this.loadingState.next('loading');
      
      // Set up progress callback
      const initProgressCallback = (report: { text: string; progress: number }) => {
        // If loading from cache, prepend the message
        const progressMsg = fromCache 
          ? `Loading from cache: ${report.text}` 
          : report.text;
          
        this.loadingProgress.next(progressMsg);
        console.log(`WebLLM init progress: ${report.progress}% - ${report.text}`);
      };

      // Create a new Worker
      if (this.worker) {
        // Terminate any existing worker
        this.worker.terminate();
        this.worker = null;
      }
      
      console.log('Creating new Web Worker...');
      this.worker = new Worker(new URL('/assets/worker.js', window.location.origin), { 
        type: 'module'
      });
      
      // Set up message handlers for the worker
      this.worker.onmessage = (event) => {
        console.log('Received message from worker:', event.data);
        
        // Check for errors
        if (event.data.type === 'error') {
          console.error('Worker error:', event.data.message);
          this.loadingState.next('error');
          this.loadingProgress.next(`Error: ${event.data.message}`);
        }
      };
      
      // Send a test message to the worker
      this.worker.postMessage({
        type: 'init',
        message: 'Initializing WebLLM'
      });
      
      // Create the engine using the WebWorkerMLCEngine approach
      console.log('Creating WebWorkerMLCEngine...');
      
      // Use WebLLM's prebuilt app config and enable IndexedDB caching
      const appConfig = webllm.prebuiltAppConfig;
      appConfig.useIndexedDBCache = true;
      
      this.engine = await webllm.CreateWebWorkerMLCEngine(
        this.worker,
        this.modelId,
        {
          initProgressCallback: initProgressCallback,
          logLevel: "INFO",
          appConfig: appConfig
        }
      );
      
      console.log("Engine created successfully:", this.engine);
      
      // Test the engine by getting some basic info
      try {
        const vendor = await this.engine.getGPUVendor();
        console.log("GPU Vendor:", vendor);
      } catch (error) {
        console.warn("Could not get GPU vendor:", error);
      }
            
      // Mark as successfully loaded
      this._isModelLoaded.next(true);
      this.loadingState.next('loaded');
      
      // Save auto-load preference
      localStorage.setItem('autoLoadModel', 'true');
      
    } catch (error: any) {
      console.error('Failed to initialize model:', error);
      
      this.loadingState.next('error');
      this.loadingProgress.next(`Error loading model: ${error}`);
      throw new Error('Unable to initialize model: ' + error);
    }
  }

  /**
   * Send a chat message to the model
   */
  public async chat(message: string): Promise<string> {
    if (!this.engine) {
      throw new Error('Model not initialized');
    }

    try {
      console.log('Sending message to WebLLM:', message);
      
      // Create a chat completion request
      const response = await this.engine.chatCompletion({
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: message }
        ],
        // Use these settings for faster responses during testing
        temperature: 0.7,
        max_tokens: 1000
      });
      
      console.log('Response from WebLLM:', response);
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error in chat completion:', error);
      throw error;
    }
  }

  /**
   * Get model loading status
   */
  public isModelLoaded(): boolean {
    return this._isModelLoaded.value;
  }

  /**
   * Toggle auto-loading of model on startup
   */
  public toggleAutoLoad(enable: boolean): void {
    localStorage.setItem('autoLoadModel', enable ? 'true' : 'false');
    console.log(`Auto-load model on startup: ${enable}`);
    
    // If auto-load is being enabled and model isn't already loaded, 
    // check for cached model immediately
    if (enable && !this._isModelLoaded.value) {
      this.checkAndLoadCachedModel();
    }
  }

  /**
   * Clear model cache
   */
  public async clearModelCache(): Promise<boolean> {
    try {
      const appConfig = webllm.prebuiltAppConfig;
      appConfig.useIndexedDBCache = true;
      
      // Use WebLLM's built-in method to delete all cached data for the model
      await webllm.deleteModelAllInfoInCache(this.modelId, appConfig);
      console.log(`Cache cleared for model: ${this.modelId}`);
      return true;
    } catch (e) {
      console.error('Error clearing model cache:', e);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  public async dispose(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch (error) {
        console.error('Error unloading engine:', error);
      }
    }
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this._isModelLoaded.next(false);
    this.loadingState.next('idle');
  }
}
