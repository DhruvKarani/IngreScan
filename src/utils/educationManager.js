import AsyncStorage from '@react-native-async-storage/async-storage';

class EducationManager {
  constructor() {
    this.storageKey = 'education_daily_facts';
    this.lastUpdateKey = 'education_last_update';
    this.allFacts = [];
    this.dailyFacts = [];
  }

  // Initialize with education data
  async initialize(educationData) {
    if (educationData && educationData.flashcards) {
      this.allFacts = [...educationData.flashcards];
      await this.updateDailyFacts();
    }
  }

  // Get today's date as string (YYYY-MM-DD)
  getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  // Check if we need to update daily facts
  async shouldUpdateDaily() {
    try {
      const lastUpdate = await AsyncStorage.getItem(this.lastUpdateKey);
      return lastUpdate !== this.getTodayString();
    } catch (error) {
      console.log('Error checking last update:', error);
      return true;
    }
  }

  // Shuffle array using Fisher-Yates algorithm
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Get daily selection based on date seed
  getDailySelection(facts, count = 3) {
    const today = this.getTodayString();
    const seed = today.split('-').reduce((acc, val) => acc + parseInt(val), 0);
    
    // Use date as seed for consistent daily selection
    const shuffled = [...facts];
    for (let i = 0; i < seed % 10; i++) {
      shuffled.push(shuffled.shift());
    }
    
    return shuffled.slice(0, count);
  }

  // Update daily facts (called once per day)
  async updateDailyFacts() {
    try {
      const shouldUpdate = await this.shouldUpdateDaily();
      
      if (shouldUpdate && this.allFacts.length > 0) {
        // Get 3 random facts for today
        const dailySelection = this.getDailySelection(this.allFacts, 3);
        
        // Store in AsyncStorage
        await AsyncStorage.setItem(this.storageKey, JSON.stringify(dailySelection));
        await AsyncStorage.setItem(this.lastUpdateKey, this.getTodayString());
        
        this.dailyFacts = dailySelection;
        console.log('Updated daily facts for:', this.getTodayString());
      } else {
        // Load existing daily facts
        const stored = await AsyncStorage.getItem(this.storageKey);
        if (stored) {
          this.dailyFacts = JSON.parse(stored);
        } else {
          // Fallback if no stored data
          this.dailyFacts = this.allFacts.slice(0, 3);
        }
      }
    } catch (error) {
      console.log('Error updating daily facts:', error);
      // Fallback to first 3 facts
      this.dailyFacts = this.allFacts.slice(0, 3);
    }
  }

  // Get fresh random facts (for manual refresh)
  getFreshFacts(count = 3) {
    const shuffled = this.shuffleArray(this.allFacts);
    return shuffled.slice(0, count);
  }

  // Get current daily facts
  getDailyFacts() {
    return this.dailyFacts;
  }

  // Get all facts for browsing
  getAllFacts() {
    return this.allFacts;
  }

  // Get facts by category
  getFactsByCategory(category) {
    return this.allFacts.filter(fact => fact.category === category);
  }

  // Get random fact
  getRandomFact() {
    if (this.allFacts.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.allFacts.length);
    return this.allFacts[randomIndex];
  }

  // Future: Fetch new facts from API
  async fetchRemoteFacts() {
    try {
      // This could fetch from your backend in the future
      // const response = await fetch('https://your-api.com/education-facts');
      // const newFacts = await response.json();
      // this.allFacts = [...this.allFacts, ...newFacts];
      // await this.updateDailyFacts();
      console.log('Remote facts feature coming soon!');
    } catch (error) {
      console.log('Error fetching remote facts:', error);
    }
  }

  // Get stats
  getStats() {
    return {
      totalFacts: this.allFacts.length,
      dailyFactsCount: this.dailyFacts.length,
      categories: [...new Set(this.allFacts.map(fact => fact.category))],
      lastUpdate: this.getTodayString()
    };
  }
}

// Create singleton instance
export const educationManager = new EducationManager();
export default educationManager;