document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    
    let currentBook = '';
    let bookConfirmed = false;
    let chatHistory = [];
    
    // Add initial welcome message visually (but not in the API messages)
    addMessage("What book would you like to talk about today?", 'ai');
    
    // Function to add a message to the chat with typing animation for AI responses
    function addMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ai-message');
        
        // If it's a user message, just add it immediately
        if (sender === 'user') {
            const messageParagraph = document.createElement('p');
            messageParagraph.innerHTML = message;
            messageDiv.appendChild(messageParagraph);
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }
        
        // Handle bullet points differently for AI messages
        let paragraphs;
        
        // Check if message contains bullet points
        if (message.includes('• ')) {
            // Split by bullet points, preserving the bullets
            const parts = message.split(/(?=• )/);
            
            // For the initial non-bullet content (if any)
            const initialContent = parts[0].includes('• ') ? '' : parts[0];
            paragraphs = initialContent ? [initialContent] : [];
            
            // Add bullet points as separate paragraphs
            const bulletPoints = parts.filter(part => part.trim().startsWith('• '));
            paragraphs = paragraphs.concat(bulletPoints);
        } else {
            // Regular paragraph splitting for non-bullet content
            paragraphs = message.split('\n\n');
        }
        
        // Add the message div to DOM before starting animation
        chatMessages.appendChild(messageDiv);
        
        // Function to type all paragraphs sequentially
        function typeAllParagraphs(index = 0) {
            if (index < paragraphs.length) {
                const paragraph = document.createElement('p');
                messageDiv.appendChild(paragraph);
                
                // Type this paragraph
                typeText(paragraphs[index], paragraph, 0, () => {
                    // When done, type next paragraph
                    typeAllParagraphs(index + 1);
                });
            }
        }
        
        // Function to type text with callback
        function typeText(text, element, index = 0, onComplete) {
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
                setTimeout(() => typeText(text, element, index, onComplete), 10);
            } else if (onComplete) {
                // This paragraph is done, call the completion callback
                onComplete();
            }
        }
        
        // Start typing all paragraphs
        typeAllParagraphs();
    }
    
    // Function to get AI response from our backend server
    async function getAIResponse(userMessage) {
        // Add user message to chat history
        chatHistory.push({
            role: "user",
            content: userMessage
        });
        
        // If this is the first message, it should be the book title
        if (chatHistory.length === 1) {
            currentBook = userMessage;
            
            // Add context about the conversation with simplified prompt for initial response
            let systemMessage = {
                role: "system",
                content: `You are a friendly book club host discussing books with readers. The user has mentioned "${currentBook}". 

For your FIRST response ONLY:
1. Reply with just the book title and author
2. Then list some suggested questions the user might want to ask about the book, formatted as bullet points with line breaks
3. Use this exact format with DOUBLE LINE BREAKS after each bullet point:

<b>${currentBook}</b> by [Author Name]

Here are some questions you might want to ask about this book:

• Can you explain the ending?

• What are some criticisms of ${currentBook}?

• What are some theories about ${currentBook}?

• What might I have missed in ${currentBook}?

• What are the main themes in ${currentBook}?

Just choose any question if you'd like to start our discussion.`
            };
            
            // Prepare messages array with system message first, then user message
            let apiMessages = [systemMessage, ...chatHistory];
            
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
                
                // Set book as confirmed after first response
                bookConfirmed = true;
                
                // Return the AI response text
                return aiResponse;
            } catch (error) {
                console.error('Error getting AI response:', error);
                return "Sorry, I encountered an error. Please try again.";
            }
        } else {
            // This is a follow-up message in the conversation
            // Add context about the book discussion
            let systemPrompt = `You are a friendly, conversational book club host discussing ${currentBook} with a reader. 
            
IMPORTANT GUIDELINES:
1. Keep responses warm and personable in tone
2. Use paragraphs with double line breaks to make responses readable
3. Balance literary insights with conversational friendliness
4. Respond thoughtfully to questions about themes, character development, plot, symbolism, or reader reactions
5. If you don't know specific information, be honest but try to engage with what you do know about the book
6. Use <b> HTML tags for emphasis when appropriate (e.g., character names, book titles)
7. Be concise - keep responses to 2-3 paragraphs maximum`;
            
            // Prepare messages array with system message first, then conversation history
            let apiMessages = [
                { role: "system", content: systemPrompt },
                ...chatHistory
            ];
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messages: apiMessages
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
            
            // Add AI response with typing animation
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