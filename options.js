// options.js

// Load saved conversations from storage
function loadConversations() {
    chrome.storage.local.get(['conversations'], function(result) {
        const conversations = result.conversations || [];
        const conversationList = document.getElementById('conversation-list');
        conversationList.innerHTML = ''; // Clear existing list

        conversations.forEach((conv, index) => {
            const convDiv = document.createElement('div');
            convDiv.classList.add('conversation-item');

            // Collapsible view
            const title = document.createElement('div');
            title.classList.add('conversation-title');
            title.textContent = `Conversation ${index + 1}`;

            const content = document.createElement('div');
            content.classList.add('conversation-content');
            content.style.display = 'none';
            content.textContent = JSON.stringify(conv, null, 2);

            title.addEventListener('click', () => {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });

            // Add delete button for each conversation
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('delete-button');
            deleteButton.onclick = () => deleteConversation(index);

            convDiv.appendChild(title);
            convDiv.appendChild(content);
            convDiv.appendChild(deleteButton);
            conversationList.appendChild(convDiv);
        });
    });
}

// Delete a single conversation
function deleteConversation(index) {
    chrome.storage.local.get(['conversations'], function(result) {
        let conversations = result.conversations || [];
        conversations.splice(index, 1); // Remove the selected conversation
        chrome.storage.local.set({ 'conversations': conversations }, function() {
            loadConversations(); // Reload the list
        });
    });
}

// Delete all conversations
document.getElementById('deleteAllBtn').addEventListener('click', function() {
    if (confirm("Are you sure you want to delete all conversations?")) {
        chrome.storage.local.set({ 'conversations': [] }, function() {
            loadConversations();
        });
    }
});

// Save layout option
document.getElementById('saveLayout').addEventListener('click', function() {
    const layout = document.querySelector('input[name="layout"]:checked').value;
    chrome.storage.local.set({ 'layout': layout }, function() {
        alert('Layout saved!');
    });
});

// Save OpenAI prompt
document.getElementById('savePromptButton').addEventListener('click', function() {
    const openaiPrompt = document.getElementById('openaiPrompt').value;
    chrome.storage.local.set({ openaiPrompt }, function() {
        const saveBtn = document.getElementById('savePromptButton');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Prompt Saved!';
        saveBtn.style.backgroundColor = 'var(--accent-green)';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 1500);
    });
});

// Save OpenAI API Key
document.getElementById('saveApiKeyButton').addEventListener('click', function() {
    const openaiApiKey = document.getElementById('openaiApiKey').value.trim();
    if (openaiApiKey) {
        chrome.storage.local.set({ openaiApiKey }, function() {
            const saveBtn = document.getElementById('saveApiKeyButton');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'API Key Saved!';
            saveBtn.style.backgroundColor = 'var(--accent-green)';
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.backgroundColor = '';
            }, 1500);
        });
    } else {
        alert('Please enter a valid API key.');
    }
});

// Initialize the options page
document.addEventListener('DOMContentLoaded', function() {
    loadConversations();

    // Load the saved layout option
    chrome.storage.local.get(['layout'], function(result) {
        if (result.layout) {
            document.querySelector(`input[value="${result.layout}"]`).checked = true;
        }
    });

    // Load the saved OpenAI prompt or set default
    chrome.storage.local.get(['openaiPrompt'], function(result) {
        const defaultPrompt = `You are an AI assistant for automotive service advisors. Your job is to (1) clarify the customer's concern, (2) generate targeted diagnostic questions for the advisor to ask, and (3) produce a clean, technician-ready note.

## Objectives
1) Understand the customer's main symptom and operating conditions.
2) Generate concise clarifying questions tailored to the symptom/system.
3) ALWAYS include a universal duplication question: 
   - "How will my technician duplicate this symptom you're experiencing?"
   - Acceptable variations:
     - "What would my technician need to do to make this happen again?"
     - "If we were driving together, how would you show this issue?"

4) Create a technician-ready note and prioritize safety.

## Conversational Style
- Professional, empathetic, and concise.
- Use positive phrasings. DO NOT ask: 
  - "What makes you think you need a … ?"
  - "Have you had it inspected?"
  Instead use:
  - "Tell me about the [issue/component]. What symptoms are you experiencing?"
  - "Have you had a trusted shop perform the necessary testing?"

## Question Generation Rules
A) Start with general, broadly applicable questions:
   - Vehicle make/model, mileage
   - What symptoms are you experiencing?
   - How long has this been happening?
   - Under what conditions does it occur (cold start, highway, turning, A/C on, etc.)?
   - Are any warning lights on? If yes, which ones?
   - "Tell me the story about your [issue/symptom]. What happened?"

B) Add system-specific question sets based on the customer's concern. Use the closest category and adapt wording:
   - Check Engine Light: light status (steady/flashing), how long on, other lights, recent events.
   - Battery/Alternator/No Start: jump-start history, cranking noises, dash lights at ON.
   - Brakes: noises (when/where/changes), steering shake under braking vs. always, pedal feel (soft/hard/pulsating), last inspection/replacement.
   - Cooling System: gauge reading, leaks on ground, steam, relevant components mentioned (pump/thermostat/radiator).
   - Transmission: auto/manual, drivable or tow-needed, reverse operation, warning lights.
   - Steering & Suspension: when symptoms occur (moving/turning), pull to one side, noises.
   - Tires: condition (worn/aged/damaged), preferences, size/brand, use case.
   - Alignment: recent suspension/steering/tire work, vibrations/pulling, pothole/curb events, last alignment.
   - Air Conditioning: duration of issue, warm air vs airflow problem, works at high/low speeds, last service/recharge.
   - Timing Belt: reason (age/mileage), vehicle running normally, service records, miles.
   - Emissions: warning lights, symptoms, ownership length, registration due date, emissions testing history.
   - Customer-Reported Smell: duration, odor character (sweet/burning/musty/plastic), location, steps to replicate.
   - Engine/Transmission Replacement Inquiry: drivable/tow, detailed history, current symptoms, miles, budget, daily driver, price/second-opinion intent, long-term plans, used/new/rebuilt preference.

C) End EVERY list of clarifying questions with the universal duplication question (or a variation), as specified above.

## Output Format (JSON)
Return a single JSON object with the following keys:
{
  "customer_concern_exact_words": string,         // quote the customer if provided
  "clarified_description": string,                // plain-language summary in shop terms
  "conditions_context": string,                   // when/how it happens (cold start, speed, load, weather, etc.)
  "priority": "Safety" | "Performance" | "Convenience",
  "advisor_clarifying_questions": [string, ...],  // include general + system-specific + the universal duplication question
  "notes_for_technician": string,                 // concise, testable statements technicians can act on
  "recommended_next_steps": string,               // e.g., "Initial inspection & testing," "Brake inspection," "Smoke test," etc.
  "safety_flags": {                               // set true if any safety-critical symptom or condition is implied
    "is_safety_critical": boolean,
    "why": string
  }
}

## Few-Shot Example
INPUT (customer): "My steering wheel shakes when I hit the brakes on the highway."

ASSISTANT OUTPUT:
{
  "customer_concern_exact_words": "My steering wheel shakes when I hit the brakes on the highway.",
  "clarified_description": "Steering vibration during higher-speed braking, likely brake-related.",
  "conditions_context": "Occurs during braking above ~50 mph; not reported during steady cruising.",
  "priority": "Safety",
  "advisor_clarifying_questions": [
    "At what speed does the shaking usually begin?",
    "Does it happen every time you brake or only occasionally?",
    "Do you feel the vibration mainly in the steering wheel, the brake pedal, or both?",
    "When were your front brakes last inspected or replaced?",
    "How will my technician duplicate this symptom you're experiencing?"
  ],
  "notes_for_technician": "Road test to reproduce high-speed braking vibration; inspect front rotors/pads for thickness variation or hot spots; verify suspension/steering components.",
  "recommended_next_steps": "Brake system inspection and measurement of rotor runout/thickness variation; check wheel/tire balance if needed.",
  "safety_flags": {
    "is_safety_critical": true,
    "why": "Braking-related vibration at highway speeds can compromise stopping performance."
  }
}`;

        if (result.openaiPrompt) {
            document.getElementById('openaiPrompt').value = result.openaiPrompt;
        } else {
            // Set default prompt if none exists
            document.getElementById('openaiPrompt').value = defaultPrompt;
        }
    });

    // Load saved API key
    chrome.storage.local.get(['openaiApiKey'], function(result) {
        if (result.openaiApiKey) {
            document.getElementById('openaiApiKey').value = result.openaiApiKey;
        }
    });

    // Load saved theme
    chrome.storage.sync.get(['theme'], function(result) {
        const theme = result.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        
        // Set the radio button
        const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`);
        if (themeRadio) {
            themeRadio.checked = true;
        }
    });

    // Load saved proxy URL
    chrome.storage.local.get(['proxyUrl'], function(result) {
        if (result.proxyUrl) {
            document.getElementById('proxyUrl').value = result.proxyUrl;
        }
    });

    // Load saved warning intervals for Promise Time
    chrome.storage.sync.get(['warningIntervals'], (data) => {
        const intervals = data.warningIntervals || [60, 1]; // Default intervals: 60 minutes and 1 minute
        intervals.forEach(addIntervalInput);
    });
});

// Save theme option
document.getElementById('saveTheme').addEventListener('click', function() {
    const selectedTheme = document.querySelector('input[name="theme"]:checked')?.value || 'dark';
    
    // Save theme preference
    chrome.storage.sync.set({ theme: selectedTheme }, function() {
        // Apply theme immediately
        document.documentElement.setAttribute('data-theme', selectedTheme);
        
        // Show confirmation
        const saveThemeBtn = document.getElementById('saveTheme');
        const originalText = saveThemeBtn.textContent;
        saveThemeBtn.textContent = 'Theme Saved!';
        saveThemeBtn.style.backgroundColor = 'var(--accent-green)';
        
        setTimeout(() => {
            saveThemeBtn.textContent = originalText;
            saveThemeBtn.style.backgroundColor = '';
        }, 1500);
    });
});

// Save proxy URL
document.getElementById('saveProxyButton').addEventListener('click', function() {
    const proxyUrl = document.getElementById('proxyUrl').value.trim();
    chrome.storage.local.set({ proxyUrl }, function() {
        const saveProxyBtn = document.getElementById('saveProxyButton');
        const originalText = saveProxyBtn.textContent;
        saveProxyBtn.textContent = 'Proxy URL Saved!';
        saveProxyBtn.style.backgroundColor = 'var(--accent-green)';
        
        setTimeout(() => {
            saveProxyBtn.textContent = originalText;
            saveProxyBtn.style.backgroundColor = '';
        }, 1500);
    });
});

// ===============================
// PROMISE TIME FUNCTIONALITY
// ===============================

// Add interval input for Promise Time alerts
function addIntervalInput(value = '') {
    const intervalList = document.getElementById('intervalList');
    const intervalDiv = document.createElement('div');
    intervalDiv.className = 'interval-input-container';
    intervalDiv.style.marginBottom = '5px';

    const intervalInput = document.createElement('input');
    intervalInput.type = 'number';
    intervalInput.className = 'interval-input';
    intervalInput.placeholder = 'Enter minutes';
    intervalInput.value = value;
    intervalInput.style.marginRight = '10px';
    intervalInput.style.width = '100px';

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.style.fontSize = '12px';
    removeButton.style.padding = '2px 6px';
    removeButton.addEventListener('click', () => {
        intervalList.removeChild(intervalDiv);
    });

    intervalDiv.appendChild(intervalInput);
    intervalDiv.appendChild(removeButton);
    intervalList.appendChild(intervalDiv);
}

// Save Promise Time warning intervals
function saveIntervals() {
    const intervalInputs = document.querySelectorAll('.interval-input');
    const intervals = Array.from(intervalInputs).map(input => parseInt(input.value, 10)).filter(value => !isNaN(value) && value > 0);

    chrome.storage.sync.set({ warningIntervals: intervals }, () => {
        const saveBtn = document.getElementById('saveIntervals');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Intervals Saved!';
        saveBtn.style.backgroundColor = 'var(--accent-green)';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
        }, 1500);
    });
}

// Event listeners for Promise Time functionality
document.getElementById('addInterval').addEventListener('click', () => addIntervalInput());
document.getElementById('saveIntervals').addEventListener('click', saveIntervals);
