import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LlmService } from './services/llm.service';
import { ChatMessage } from './services/llm.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Qubi';
  darkMode = false;
  menuOpen = false;
  userInput = '';
  messages: ChatMessage[] = [];
  isLoading = false;
  modelLoadProgress = '';
  modelInitialized = false;
  autoLoadModel = true;
  cacheStatus: 'unknown' | 'checking' | 'not-found' | 'found' = 'unknown';
  private loadPromptShown = false;

  constructor(private llmService: LlmService) {}

  async ngOnInit() {
    // Apply saved theme
    const savedTheme = localStorage.getItem('theme');
    this.darkMode = savedTheme === 'dark';
    this.applyTheme();
    
    // Initial chat message
    this.messages = [
      { role: 'ai', content: 'Hello! I\'m Qubi, your AI assistant. How can I help you today?' }
    ];

    // Subscribe to model loading progress
    this.llmService.loadingProgress.subscribe((progress: string) => {
      this.modelLoadProgress = progress;
    });

    this.llmService.isModelLoaded$.subscribe((isLoaded: boolean) => {
      this.modelInitialized = isLoaded;
      if (isLoaded) {
        this.messages.push({
          role: 'ai',
          content: 'Model loaded successfully! I\'m ready to assist you.'
        });
      }
    });
    
    // Subscribe to cache status
    this.llmService.cacheStatus.subscribe((status) => {
      this.cacheStatus = status;
      
      // If no model in cache, show a message guiding the user to load the model
      if (status === 'not-found' && this.autoLoadModel) {
        this.showLoadModelPrompt();
      }
    });
    
    // Check auto-load setting
    this.autoLoadModel = localStorage.getItem('autoLoadModel') !== 'false';

    if (this.autoLoadModel) {
      this.llmService.toggleAutoLoad(this.autoLoadModel);
    }
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
    this.applyTheme();
  }

  applyTheme() {
    // Set data-theme attribute for CSS variables
    document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
    
    // Toggle dark class for Tailwind's dark mode
    if (this.darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  async sendMessage() {
    if (!this.userInput.trim() || this.isLoading) return;

    const userMessage = this.userInput.trim();
    this.messages.push({ role: 'user', content: userMessage });
    this.userInput = '';
    this.isLoading = true;

    try {
      if (!this.modelInitialized) {
        // Model not initialized yet, show a message about loading the model
        setTimeout(() => {
          this.messages.push({ 
            role: 'ai', 
            content: 'Please load the model first by clicking "Load Model" in the menu before I can respond to your message.' 
          });
          this.isLoading = false;
        }, 500);
        return;
      }

      const response = await this.llmService.chat(userMessage);
      this.messages.push({ role: 'ai', content: response });
    } catch (error) {
      console.error('Error sending message:', error);
      this.messages.push({ role: 'ai', content: 'Sorry, I encountered an error processing your message. Please try to load the model from the menu.' });
    } finally {
      this.isLoading = false;
    }
  }

  async loadModel() {
    try {
      await this.llmService.initializeModel();
    } catch (error) {
      console.error('Error loading model:', error);
    }
  }
  
  toggleAutoLoad() {
    this.autoLoadModel = !this.autoLoadModel;
    this.llmService.toggleAutoLoad(this.autoLoadModel);
    
    // Show a message to the user about the change
    if (this.autoLoadModel && !this.modelInitialized) {
      this.messages.push({
        role: 'ai',
        content: 'Auto-load enabled. Checking for cached model...'
      });
    } else if (!this.autoLoadModel) {
      this.messages.push({
        role: 'ai',
        content: 'Auto-load disabled. The model will need to be loaded manually when you reload the page.'
      });
    }
  }

  private showLoadModelPrompt() {
    // Wait a bit to ensure first greeting is displayed first
    setTimeout(() => {
      if (!this.modelInitialized && this.cacheStatus === 'not-found' && !this.loadPromptShown) {
        this.messages.push({
          role: 'ai',
          content: 'I notice the AI model isn\'t loaded yet. Please click the "Load Model" button in the menu to enable full functionality.'
        });
        this.loadPromptShown = true;
      }
    }, 1500);
  }
}
