// aiInteraction.js

// Function to get predictions from OpenAI API
export async function getPredictions(prompt, model = 'gpt-3.5-turbo') {
    // Get API key from storage - user must configure this in options
    const result = await chrome.storage.local.get(['openaiApiKey', 'proxyUrl']);
    const apiKey = result.openaiApiKey;
    const proxyUrl = result.proxyUrl;
    
    if (!apiKey && !proxyUrl) {
        throw new Error('Please configure your OpenAI API key or proxy URL in the extension options.');
    }
    
    const url = proxyUrl || 'https://api.openai.com/v1/chat/completions';

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add authorization header only if using direct API (not proxy)
        if (!proxyUrl && apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            console.error(`API request failed with status: ${response.status}`);
            return ["Sorry, I couldn't generate a suggestion. Please try again."];
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.split('\n').filter(line => line.trim() !== '');
        } else {
            console.error("No choices found in the response:", JSON.stringify(data, null, 2));
            return ["Sorry, I couldn't generate a suggestion. Please try again."];
        }
    } catch (error) {
        console.error("Error fetching predictions:", error);
        return ["An error occurred while fetching predictions. Please check your API key and network connection."];
    }
}
