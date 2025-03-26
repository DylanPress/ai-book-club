document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    
    let booksLiked = [];
    let chatHistory = [];
    
    // Add initial welcome message visually (but not in the API messages)
    addMessage("Hi there! What are some books you've enjoyed recently?", 'ai');
    
    // Function to add a message to the chat with typing animation for AI responses
    function addMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ai-message');
        
        const messageParagraph = document.createElement('p');
        messageDiv.appendChild(messageParagraph);
        chatMessages.appendChild(messageDiv);
        
        // If it's a user message, just add it immediately
        if (sender === 'user') {
            messageParagraph.innerHTML = message;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }
        
        // For AI messages, split by double newlines and create separate paragraphs
        const paragraphs = message.split('\n\n');
        
        // Initialize the typing for the first paragraph
        let currentParagraph = messageParagraph;
        let currentParagraphIndex = 0;
        
        // Function to type out the text with animation
        function typeText(text, element, index = 0) {
            if (index < text.length) {
                // If we have HTML tags, handle them specially
                if (text[index] === '<') {
                    // Find the end of this tag
                    const endIndex = text.indexOf('>', index);
                    if (endIndex !== -1) {
                        // Add the whole tag at once
                        element.innerHTML += text.substring(index, endIndex + 1);
                        index = endIndex + 1;
                    }
                } else {
                    element.innerHTML += text[index];
                    index++;
                }
                
                // Scroll to bottom with each character
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                // Continue typing with a slight delay
                setTimeout(() => typeText(text, element, index), 10);
            } else {
                // This paragraph is done, move to the next one
                currentParagraphIndex++;
                if (currentParagraphIndex < paragraphs.length) {
                    // Create a new paragraph element for the next section
                    currentParagraph = document.createElement('p');
                    messageDiv.appendChild(currentParagraph);
                    
                    // Start typing the next paragraph
                    typeText(paragraphs[currentParagraphIndex], currentParagraph);
                }
            }
        }
        
        // Start typing the first paragraph
        if (paragraphs.length > 0) {
            typeText(paragraphs[0], currentParagraph);
        }
    }
    
    // Function to extract book titles from text
    function extractBookTitles(text) {
        // First, check if the input is just a comma-separated list of books
        if (text.includes(',') && !text.includes('?') && text.split(',').length >= 2) {
            return text.split(',').map(book => book.trim()).filter(book => book.length > 0);
        }

        // Otherwise, look for quoted books or books following specific phrases
        const quotedBooks = text.match(/"([^"]+)"/g) || [];
        const mentionedBooks = [];
        
        // Clean up the quoted books
        quotedBooks.forEach(book => {
            mentionedBooks.push(book.replace(/"/g, '').trim());
        });
        
        // Also look for book titles following phrases like "I enjoyed", "I liked", etc.
        const enjoymentPhrases = [
            'enjoyed', 'liked', 'loved', 'favorite', 
            'read', 'reading', 'finished'
        ];
        
        enjoymentPhrases.forEach(phrase => {
            const regex = new RegExp(`${phrase}\\s+([A-Z][\\w\\s'\\-:,]+)`, 'g');
            const matches = text.match(regex);
            if (matches) {
                matches.forEach(match => {
                    const book = match.substring(phrase.length).trim();
                    if (book.length > 3) { // Avoid short phrases
                        mentionedBooks.push(book);
                    }
                });
            }
        });
        
        return mentionedBooks;
    }
    
    // Function to get AI response from our backend server
    async function getAIResponse(userMessage) {
        // Extract book titles from user message
        const mentionedBooks = extractBookTitles(userMessage);
        
        // Add all mentioned books to our "liked" list
        if (mentionedBooks.length > 0) {
            booksLiked = [...new Set([...booksLiked, ...mentionedBooks])];
            console.log("Books liked:", booksLiked);
        }
        
        // Add user message to chat history
        chatHistory.push({
            role: "user",
            content: userMessage
        });
        
        // Create a system prompt based on whether we have books or not
        let systemPrompt;
        
        // Check if first message appears to be a list of books or contains "just said" as a response to being asked again
        const isFirstMessage = chatHistory.length === 1;
        const containsJustSaid = userMessage.toLowerCase().includes("just said") || userMessage.toLowerCase().includes("already told");
        
        if (booksLiked.length > 0 || containsJustSaid) {
            // If user has mentioned books or indicated they already provided books, give recommendations
            systemPrompt = `You are a friendly bookstore owner who recommends books. 

VERY IMPORTANT RULES:
1. The user has already mentioned these books they like: ${booksLiked.join(', ')}
2. NEVER recommend any of these books back to them.
3. Use DOUBLE LINE BREAKS between each recommendation (this is critical for formatting).
4. Format each recommendation as: "<b>Title</b> by Author - One sentence about why they'd like it."
5. Use HTML <b> tags for bold titles.
6. Recommend exactly 4 books.
7. End with a simple "Would you like more recommendations?"
8. Keep your introductory text very brief - one sentence maximum.

Example of correct formatting:
Based on your interest in these titles, here are some books you might enjoy:

<b>The Night Circus</b> by Erin Morgenstern - A magical tale of two competing illusionists who fall in love.

<b>The Shadow of the Wind</b> by Carlos Ruiz Zafón - A captivating mystery set in post-war Barcelona with a hidden library at its heart.

<b>The Starless Sea</b> by Erin Morgenstern - An enchanting adventure about a hidden underground world dedicated to storytelling.

<b>The House in the Cerulean Sea</b> by TJ Klune - A heartwarming fantasy about a case worker who discovers a home for magical children.

Would you like more recommendations?`;
        } else if (isFirstMessage && userMessage.split(' ').length <= 5 && !userMessage.includes('?')) {
            // If first message is short and doesn't look like a question, assume they might be trying to list books
            systemPrompt = "The user's message might be a partial list of books. Ask them to clarify which books or genres they've enjoyed recently, but phrase it in a way that acknowledges they might have already started listing some. Be brief and friendly.";
        } else {
            // Otherwise, ask what books they like
            systemPrompt = "You are a friendly bookstore owner. Ask what books or genres they've enjoyed recently. Keep it to one short sentence. Do NOT give recommendations yet.";
        }
        
        // Prepare messages array with system message first, then user-assistant pairs
        let apiMessages = [
            { role: "system", content: systemPrompt },
            ...chatHistory
        ];
        
        try {
            const response = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  messages: chatHistory
                })
              });
            
            if (!response.ok) {
                throw new Error('API request failed');
            }
            
            const data = await response.json();
            const aiResponse = data.choices[0].message.content;
            
            // Add AI response to chat history for context
            chatHistory.push({
                role: "assistant",
                content: aiResponse
            });
            
            // Return the AI response text
            return aiResponse;
        } catch (error) {
            console.error('Error getting AI response:', error);
            return "Sorry, I encountered an error. Please try again.";
        }
    }
    
    // Send message function
    async function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;
        
        // Add user message to chat
        addMessage(message, 'user');
        
        // Clear input field
        userInput.value = '';
        
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'ai-message', 'loading');
        loadingDiv.textContent = 'Thinking...';
        chatMessages.appendChild(loadingDiv);
        
        try {
            const aiResponse = await getAIResponse(message);
            
            // Remove loading indicator
            chatMessages.removeChild(loadingDiv);
            
            // Add AI response with typing effect
            addMessage(aiResponse, 'ai');
        } catch (error) {
            // Remove loading indicator
            chatMessages.removeChild(loadingDiv);
            
            // Add error message
            addMessage("I'm sorry, I encountered an error. Please try again.", 'ai');
            console.error(error);
        }
    }
    
    // Send message when button is clicked
    sendButton.addEventListener('click', sendMessage);
    
    // Send message when Enter key is pressed
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});