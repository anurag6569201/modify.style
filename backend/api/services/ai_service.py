import os
import textwrap
import google.generativeai as genai
from django.conf import settings

class GeminiService:
    def __init__(self):
        # Configure Gemini API
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            print("WARNING: GEMINI_API_KEY not found in environment variables.")
        else:
            genai.configure(api_key=api_key)
            
        # Use a model that supports JSON mode if possible, or standard Pro model
        self.model = genai.GenerativeModel('models/gemini-2.5-flash')

    def analyze_page(self, html_content):
        """
        Analyzes the provided HTML/CSS content and returns design, accessibility, and performance insights.
        """
        if not os.getenv('GEMINI_API_KEY'):
            return {
                "error": "API Key missing",
                "scores": {"design": 0, "a11y": 0, "perf": 0},
                "suggestions": []
            }

        prompt = f"""
        You are an expert CSS/HTML Performance and Design Analyst. Analyze the following HTML/CSS snippet.
        
        STRICT SCOPE: Only analyze CSS and HTML. Do not suggest JavaScript or other technologies.
        
        FOCUS AREAS:
        1. **Page Speed & Performance**: 
           - CSS optimization (critical CSS, unused styles, selector efficiency)
           - Layout shift prevention (CLS)
           - Render-blocking CSS issues
           - CSS specificity and cascade optimization
           - Use of modern CSS features (content-visibility, contain, will-change)
        2. **CSS Best Practices**: 
           - Efficient selectors and specificity
           - CSS architecture and maintainability
           - Responsive design patterns
           - CSS custom properties usage
        3. **HTML/CSS Accessibility**: 
           - Semantic HTML structure
           - CSS contrast ratios
           - Focus states and visual indicators
           - Responsive typography

        HTML Context:
        {html_content[:5000]}... (truncated)

        Return ONLY a JSON object with this structure:
        {{
            "scores": {{ "design": <0-100>, "a11y": <0-100>, "perf": <0-100> }},
            "suggestions": [
                {{
                    "type": "performance" | "design" | "accessibility",
                    "title": "Short Title",
                    "description": "Actionable CSS/HTML advice (e.g., 'Use content-visibility: auto for off-screen elements' or 'Optimize CSS selectors to reduce specificity').",
                    "action_css": "CSS code to fix it (optional, CSS only)"
                }},
                ... (3-4 suggestions)
            ]
        }}
        """


        try:
            response = self.model.generate_content(prompt)
            # Basic cleanup if the model returns markdown code blocks
            text = response.text.replace('```json', '').replace('```', '').strip()
            import json
            return json.loads(text)
        except Exception as e:
            print(f"Gemini Analysis Error: {e}")
            return {
                "scores": {"design": 50, "a11y": 50, "perf": 50},
                "suggestions": [
                    {
                        "type": "design",
                        "title": "Analysis Failed",
                        "description": "Could not analyze page at this time. Please try again.",
                        "action_css": ""
                    }
                ]
            }

    def chat(self, user_message, current_html=None):
        """
        Handles a chat message from the user, potentially generating CSS code to modify the page.
        """
        if not os.getenv('GEMINI_API_KEY'):
            return {
                "text": "I can't help you yet because the GEMINI_API_KEY is missing from the server configuration.",
                "css": ""
            }

        prompt = f"""
        You are an expert CSS/HTML Assistant specialized in styling, layout, performance optimization, and production best practices.
        
        STRICT RULES - SECURITY & SCOPE:
        1. You MUST ONLY provide CSS and HTML advice/code. NO JavaScript, NO executable code, NO server-side code.
        2. If asked about JavaScript, security, backend, or anything outside CSS/HTML, politely decline and redirect to CSS/HTML solutions.
        3. Your purpose is to help users solve CSS/HTML related issues, improve page speed, and follow production best practices.
        4. Prioritize PAGE SPEED optimization:
           - Critical CSS extraction
           - Layout shift prevention (CLS)
           - Efficient CSS selectors (avoid deep nesting, use specificity wisely)
           - Modern CSS features (content-visibility, contain, will-change)
           - CSS optimization techniques
        5. Focus on PRODUCTION BEST PRACTICES:
           - Maintainable CSS architecture
           - Responsive design patterns
           - Accessibility through CSS (contrast, focus states)
           - Performance-first CSS

        User Request: "{user_message}"
        
        Context (HTML snippet):
        {current_html[:2000] if current_html else "No context provided"}

        Instructions:
        1. If the request is NOT about CSS/HTML, respond politely that you only help with CSS/HTML and page speed optimization.
        2. Understand the user's CSS/HTML design or performance intent.
        3. Generate valid, modern, production-ready CSS to achieve the goal.
        4. Use !important sparingly but use it if necessary to override existing styles.
        5. Always consider performance implications of your CSS suggestions.
        6. Return a JSON object:
        {{
            "text": "A friendly, short response explaining the CSS/HTML solution and its performance/design impact.",
            "css": "The CSS code block to inject (CSS only, no JavaScript)"
        }}
        """

        try:
            response = self.model.generate_content(prompt)
            text = response.text.replace('```json', '').replace('```', '').strip()
            import json
            return json.loads(text)
        except Exception as e:
            print(f"Gemini Chat Error: {e}")
            return {
                "text": "I encountered an error processing your request. Please try again.",
                "css": ""
            }
