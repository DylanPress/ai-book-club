exports.handler = async function(event) {
    console.log("Function called with:", JSON.stringify(event.body).substring(0, 100) + "...");
    
    try {
      const data = JSON.parse(event.body);
      
      console.log("Calling Perplexity API...");
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_KEY}`
        },
        body: JSON.stringify({
          model: "sonar",
          messages: data.messages,
          max_tokens: 1000
        })
      });
      
      const result = await response.json();
      console.log("API response status:", response.status);
      
      return {
        statusCode: 200,
        body: JSON.stringify(result)
      };
    } catch (error) {
      console.error("Function error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }