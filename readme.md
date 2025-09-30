# TekFlow Assistant

A comprehensive Chrome extension designed to streamline automotive service workflows with AI-powered diagnostic assistance and promise time monitoring.

## Features

### 🤖 AI-Powered Customer Concern Analysis
- Intelligent automotive diagnostic assistant with industry-specific prompts
- Generates targeted follow-up questions based on customer concerns
- Creates technician-ready notes with safety prioritization
- JSON-structured output for consistent documentation

### ⏰ Promise Time Monitoring
- Real-time tracking of customer timeout promises
- Visual highlighting of empty promise time fields
- Configurable alert intervals with popup notifications
- Snooze functionality for managing alerts
- Integrated monitoring widget in the sidepanel

### 🎨 Modern UI/UX
- Dark and light theme support with persistent preferences
- Side panel interface for seamless workflow integration
- Responsive design optimized for service advisor workflows
- Intuitive conversation management and export features

### 🔧 Tekmetric Integration
- Seamless integration with Tekmetric shop management system
- Automatic token capture and API authentication
- Direct links to repair orders and customer information
- Support for multiple shop environments

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The TekFlow Assistant icon will appear in your toolbar

## Configuration

### AI Prompts
1. Right-click the extension icon and select "Options"
2. Navigate to "API Logic Configuration"
3. The extension comes with a comprehensive automotive diagnostic prompt
4. Customize the prompt as needed for your shop's requirements

### Promise Time Alerts
1. In the Options page, scroll to "Promise Time Alerts"
2. Configure warning intervals (default: 60 minutes and 1 minute before timeout)
3. Add custom intervals as needed
4. Save your configuration

### Theme Settings
- Choose between Light and Dark themes in the Options page
- Theme preference is automatically applied across all extension interfaces

## Usage

### Customer Concern Analysis
1. Open the sidepanel by clicking the extension icon
2. Enter the customer's concern in the text area
3. Press Enter or click Submit to generate follow-up questions
4. Answer the questions as you gather information from the customer
5. Use "Submit for Review" to generate additional questions
6. Click "Done" to finalize the conversation
7. Copy or send the formatted conversation to Tekmetric

### Promise Time Monitoring
1. Navigate to a repair order in Tekmetric
2. Empty "Promised Time Out" fields will be highlighted in red
3. Set a promise time to begin monitoring
4. The sidepanel will show active promise time countdowns
5. Configure alert intervals in Options to receive notifications

## Files Structure

```
├── manifest.json              # Extension configuration
├── background.js             # Service worker for API monitoring
├── popup.js                  # Main sidepanel functionality
├── sidepanel.html           # Sidepanel interface
├── options.html             # Configuration page
├── options.js               # Options page functionality
├── ui.js                    # UI interaction handlers
├── aiInteraction.js         # AI/API communication
├── promptManager.js         # Prompt generation logic
├── content.js               # Main content script
├── addAIconcern.js          # Tekmetric integration
├── addAInewAppointment.js   # Appointment integration
├── promiseTimeContent.js    # Promise time field monitoring
├── promiseTimePopup.html    # Alert popup interface
├── promiseTimePopup.js      # Alert popup functionality
├── styles.css               # Global styling
└── images/                  # Extension icons and assets
```

## AI Prompt System

The extension uses three main AI prompts managed in `promptManager.js`:

### 1. Customer Concern Follow-Up Prompt
- **Purpose**: Generates follow-up questions based on customer concerns
- **Function**: `generateFollowUpPrompt(customerConcern)`
- **Features**: Industry-specific automotive diagnostic questions with safety prioritization

### 2. Review Conversation Prompt
- **Purpose**: Reviews conversation history and suggests additional questions
- **Function**: `generateReviewPrompt(customerConcern, answeredQuestions, activeResponses)`
- **Features**: Contextual question generation based on previous responses

### 3. Conversation Cleanup Prompt
- **Purpose**: Cleans and formats conversation text for technician use
- **Function**: `generateCleanConversationPrompt(conversationText)`
- **Features**: Natural language formatting without labels

## Version History

### v0.1.3 (Current)
- Integrated Promise Time monitoring functionality
- Added configurable alert system
- Enhanced sidepanel with promise time widget
- Improved options page with interval configuration

### v0.1.2
- Added Enter key submission for customer concerns
- Enhanced user experience improvements

### v0.1.1
- Added comprehensive automotive diagnostic prompt
- Improved default configuration

### v0.1.0
- Fixed Content Security Policy violations
- Implemented theme system
- Added proxy URL configuration

## Development

### Prerequisites
- Chrome browser with Developer mode enabled
- Basic knowledge of Chrome Extension APIs
- Tekmetric account for testing integration features

### Local Development
1. Clone the repository
2. Make your changes
3. Reload the extension in Chrome Extensions page
4. Test functionality on Tekmetric pages

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## API Configuration

The extension supports both direct OpenAI API calls and proxy server configurations:

- **Direct API**: Configure your OpenAI API key in the extension
- **Proxy Server**: Set up a server-side proxy and configure the URL in Options

## Support

For issues, feature requests, or questions:
1. Check the Issues section of this repository
2. Create a new issue with detailed information
3. Include browser version, extension version, and steps to reproduce

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This extension is designed to work with Tekmetric shop management system. Ensure compliance with your shop's data handling policies and customer privacy requirements.
