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

  // Use 'any' type to avoid TypeScript errors
  private engine: any = null;
  private worker: Worker | null = null;
  
  // Model ID - using a smaller model for testing
  private modelId: string = 'gemma-2b-it-q4f16_1-MLC';
  
  constructor() {
    console.log('LLM service initialized');
  }

  /**
   * Initialize the model using Web Worker (not Service Worker)
   */
  public async initializeModel(): Promise<void> {
    try {
      console.log('Attempting to initialize model...');
      console.log('Using model ID:', this.modelId);
      
      this.loadingProgress.next('Starting model initialization...');
      this.loadingState.next('loading');
      
      // Set up progress callback
      const initProgressCallback = (report: { text: string; progress: number }) => {
        this.loadingProgress.next(report.text);
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
      this.engine = await webllm.CreateWebWorkerMLCEngine(
        this.worker,
        this.modelId,
        {
          initProgressCallback: initProgressCallback,
          logLevel: "INFO"
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
