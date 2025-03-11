import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LlmService } from './services/llm.service';
import { ChatMessage } from './services/llm.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
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
}
